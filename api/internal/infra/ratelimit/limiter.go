package ratelimit

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Limiter defines the rate limiter interface
type Limiter interface {
	// Allow checks if a request is allowed and returns remaining attempts
	Allow(ctx context.Context, key string) (allowed bool, remaining int, resetAt time.Time)

	// Hit records a hit for the given key
	Hit(ctx context.Context, key string) (remaining int, resetAt time.Time)

	// Reset resets the limiter for a key
	Reset(ctx context.Context, key string) error
}

// Taker is implemented by stores that can check and record a hit
// atomically. Middleware prefers it over the racy Allow+Hit sequence.
type Taker interface {
	Take(ctx context.Context, key string) (allowed bool, remaining int, resetAt time.Time)
}

// Config holds rate limiter configuration
type Config struct {
	// Max number of requests allowed
	Max int

	// Duration for the rate limit window
	Duration time.Duration

	// KeyFunc extracts the rate limit key from request
	KeyFunc func(*gin.Context) string

	// ErrorHandler handles rate limit exceeded
	ErrorHandler func(*gin.Context, time.Time)

	// SkipFunc returns true to skip rate limiting for a request
	SkipFunc func(*gin.Context) bool

	// Store is the underlying storage (default: memory)
	Store Limiter
}

// DefaultConfig returns default rate limiter configuration
func DefaultConfig() Config {
	return Config{
		Max:      60,
		Duration: time.Minute,
		KeyFunc: func(c *gin.Context) string {
			return c.ClientIP()
		},
		ErrorHandler: func(c *gin.Context, resetAt time.Time) {
			retryAfter := int(time.Until(resetAt).Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Too many requests",
				"retry_after": retryAfter,
			})
		},
	}
}

// MemoryStore implements an in-memory rate limiter store
type MemoryStore struct {
	mu      sync.RWMutex
	entries map[string]*entry
	max     int
	window  time.Duration

	stopCleanup chan struct{}
}

type entry struct {
	hits    int
	resetAt time.Time
}

// NewMemoryStore creates a new in-memory rate limiter store
func NewMemoryStore(max int, window time.Duration) *MemoryStore {
	s := &MemoryStore{
		entries:     make(map[string]*entry),
		max:         max,
		window:      window,
		stopCleanup: make(chan struct{}),
	}

	// Start cleanup goroutine
	go s.cleanup()

	return s
}

// cleanup periodically removes expired entries
func (s *MemoryStore) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.mu.Lock()
			now := time.Now()
			for key, e := range s.entries {
				if now.After(e.resetAt) {
					delete(s.entries, key)
				}
			}
			s.mu.Unlock()
		case <-s.stopCleanup:
			return
		}
	}
}

// Close stops the cleanup goroutine
func (s *MemoryStore) Close() {
	close(s.stopCleanup)
}

// Allow checks if a request is allowed
func (s *MemoryStore) Allow(ctx context.Context, key string) (bool, int, time.Time) {
	s.mu.RLock()
	e, exists := s.entries[key]
	s.mu.RUnlock()

	now := time.Now()

	if !exists || now.After(e.resetAt) {
		return true, s.max, now.Add(s.window)
	}

	remaining := s.max - e.hits
	if remaining <= 0 {
		return false, 0, e.resetAt
	}

	return true, remaining, e.resetAt
}

// Hit records a hit for the given key
func (s *MemoryStore) Hit(ctx context.Context, key string) (int, time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	e, exists := s.entries[key]

	if !exists || now.After(e.resetAt) {
		e = &entry{
			hits:    1,
			resetAt: now.Add(s.window),
		}
		s.entries[key] = e
		return s.max - 1, e.resetAt
	}

	e.hits++
	remaining := s.max - e.hits
	if remaining < 0 {
		remaining = 0
	}

	return remaining, e.resetAt
}

// Take atomically checks and records a hit for key. It implements Taker.
func (s *MemoryStore) Take(ctx context.Context, key string) (bool, int, time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	e, exists := s.entries[key]
	if !exists || now.After(e.resetAt) {
		e = &entry{resetAt: now.Add(s.window)}
		s.entries[key] = e
	}
	if e.hits >= s.max {
		return false, 0, e.resetAt
	}
	e.hits++
	return true, s.max - e.hits, e.resetAt
}

// Reset resets the limiter for a key
func (s *MemoryStore) Reset(ctx context.Context, key string) error {
	s.mu.Lock()
	delete(s.entries, key)
	s.mu.Unlock()
	return nil
}

// --- Middleware Functions ---

// Middleware creates a rate limiting middleware with the given config
func Middleware(cfg Config) gin.HandlerFunc {
	if cfg.Store == nil {
		cfg.Store = NewMemoryStore(cfg.Max, cfg.Duration)
	}
	if cfg.KeyFunc == nil {
		cfg.KeyFunc = func(c *gin.Context) string {
			return c.ClientIP()
		}
	}
	if cfg.ErrorHandler == nil {
		cfg.ErrorHandler = DefaultConfig().ErrorHandler
	}

	return func(c *gin.Context) {
		// Check if should skip
		if cfg.SkipFunc != nil && cfg.SkipFunc(c) {
			c.Next()
			return
		}

		key := cfg.KeyFunc(c)

		var (
			allowed   bool
			remaining int
			resetAt   time.Time
		)
		if taker, ok := cfg.Store.(Taker); ok {
			allowed, remaining, resetAt = taker.Take(c.Request.Context(), key)
		} else {
			allowed, _, resetAt = cfg.Store.Allow(c.Request.Context(), key)
			if allowed {
				remaining, resetAt = cfg.Store.Hit(c.Request.Context(), key)
			}
		}
		if !allowed {
			cfg.ErrorHandler(c, resetAt)
			c.Abort()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(cfg.Max))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetAt.Unix(), 10))

		c.Next()
	}
}

// PerMinute creates a middleware that limits requests per minute
func PerMinute(max int) gin.HandlerFunc {
	cfg := DefaultConfig()
	cfg.Max = max
	cfg.Duration = time.Minute
	return Middleware(cfg)
}

// PerHour creates a middleware that limits requests per hour
func PerHour(max int) gin.HandlerFunc {
	cfg := DefaultConfig()
	cfg.Max = max
	cfg.Duration = time.Hour
	return Middleware(cfg)
}

// PerDay creates a middleware that limits requests per day
func PerDay(max int) gin.HandlerFunc {
	cfg := DefaultConfig()
	cfg.Max = max
	cfg.Duration = 24 * time.Hour
	return Middleware(cfg)
}

// PerSecond creates a middleware that limits requests per second
func PerSecond(max int) gin.HandlerFunc {
	cfg := DefaultConfig()
	cfg.Max = max
	cfg.Duration = time.Second
	return Middleware(cfg)
}

// WithKeyFunc sets a custom key function for rate limiting
func WithKeyFunc(keyFunc func(*gin.Context) string) func(*Config) {
	return func(cfg *Config) {
		cfg.KeyFunc = keyFunc
	}
}

// WithSkipFunc sets a skip function for rate limiting
func WithSkipFunc(skipFunc func(*gin.Context) bool) func(*Config) {
	return func(cfg *Config) {
		cfg.SkipFunc = skipFunc
	}
}

// Custom creates a custom rate limiter middleware
func Custom(max int, duration time.Duration, opts ...func(*Config)) gin.HandlerFunc {
	cfg := Config{
		Max:          max,
		Duration:     duration,
		ErrorHandler: DefaultConfig().ErrorHandler,
	}

	for _, opt := range opts {
		opt(&cfg)
	}

	return Middleware(cfg)
}

// ByUser creates a rate limiter keyed by user ID
func ByUser(max int, duration time.Duration, userIDFunc func(*gin.Context) string) gin.HandlerFunc {
	return Custom(max, duration, WithKeyFunc(userIDFunc))
}

// ByRoute creates a rate limiter keyed by route + IP
func ByRoute(max int, duration time.Duration) gin.HandlerFunc {
	return Custom(max, duration, WithKeyFunc(func(c *gin.Context) string {
		return c.FullPath() + ":" + c.ClientIP()
	}))
}

// ByAPIKey creates a rate limiter keyed by API key
func ByAPIKey(max int, duration time.Duration, headerName string) gin.HandlerFunc {
	return Custom(max, duration, WithKeyFunc(func(c *gin.Context) string {
		apiKey := c.GetHeader(headerName)
		if apiKey == "" {
			return c.ClientIP()
		}
		return apiKey
	}))
}

// Throttle is an alias for PerMinute.
func Throttle(maxPerMinute int) gin.HandlerFunc {
	return PerMinute(maxPerMinute)
}

// ThrottleWithDecay creates a rate limiter with decay (sliding window)
func ThrottleWithDecay(max int, decayMinutes int) gin.HandlerFunc {
	return Custom(max, time.Duration(decayMinutes)*time.Minute)
}
