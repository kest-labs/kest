package ratelimit

import (
	"context"
	_ "embed"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	infraRedis "github.com/kest-labs/kest/api/internal/infra/redis"
	"github.com/kest-labs/kest/api/pkg/logger"
	goRedis "github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"
)

//go:embed tokenscript.lua
var tokenLuaScript string

const (
	tokenKeyFormat     = "{ratelimit:%s}.tokens"
	timestampKeyFormat = "{ratelimit:%s}.ts"
	pingInterval       = 100 * time.Millisecond
)

// RedisStore implements a distributed rate limiter using Redis
// with automatic fallback to local limiter when Redis is unavailable
type RedisStore struct {
	rate   int           // tokens per second
	burst  int           // max burst size (capacity)
	window time.Duration // rate limit window
	client *infraRedis.Client
	script *goRedis.Script

	// Local fallback limiter
	rescueLock     sync.Mutex
	rescueLimiters map[string]*rate.Limiter
	redisAlive     uint32
	monitorStarted bool
}

// RedisStoreConfig holds Redis rate limiter configuration
type RedisStoreConfig struct {
	// Rate is the number of requests allowed per window
	Rate int
	// Burst is the maximum burst size
	Burst int
	// Window is the rate limit window duration
	Window time.Duration
	// Client is the Redis client (optional, uses default if nil)
	Client *infraRedis.Client
}

// NewRedisStore creates a new Redis-backed rate limiter store
func NewRedisStore(cfg RedisStoreConfig) *RedisStore {
	if cfg.Rate <= 0 {
		cfg.Rate = 60
	}
	if cfg.Burst <= 0 {
		cfg.Burst = cfg.Rate
	}
	if cfg.Window <= 0 {
		cfg.Window = time.Minute
	}
	if cfg.Client == nil {
		cfg.Client = infraRedis.Default()
	}

	// Calculate rate per second
	ratePerSecond := float64(cfg.Rate) / cfg.Window.Seconds()
	if ratePerSecond < 1 {
		ratePerSecond = 1
	}

	return &RedisStore{
		rate:           int(ratePerSecond),
		burst:          cfg.Burst,
		window:         cfg.Window,
		client:         cfg.Client,
		script:         goRedis.NewScript(tokenLuaScript),
		rescueLimiters: make(map[string]*rate.Limiter),
		redisAlive:     1,
	}
}

// Allow checks if a request is allowed
func (s *RedisStore) Allow(ctx context.Context, key string) (bool, int, time.Time) {
	now := time.Now()
	resetAt := now.Add(s.window)

	// If Redis is down, use local fallback
	if atomic.LoadUint32(&s.redisAlive) == 0 {
		return s.allowLocal(key, now, resetAt)
	}

	allowed, remaining := s.allowRedis(ctx, key, now)
	if !allowed {
		return false, 0, resetAt
	}

	return true, remaining, resetAt
}

// Hit records a hit for the given key
func (s *RedisStore) Hit(ctx context.Context, key string) (int, time.Time) {
	now := time.Now()
	resetAt := now.Add(s.window)

	// If Redis is down, use local fallback
	if atomic.LoadUint32(&s.redisAlive) == 0 {
		limiter := s.getLocalLimiter(key)
		if limiter.Allow() {
			return s.burst - int(limiter.Tokens()), resetAt
		}
		return 0, resetAt
	}

	// For Redis, Allow already consumes the token
	allowed, remaining := s.allowRedis(ctx, key, now)
	if !allowed {
		return 0, resetAt
	}

	return remaining, resetAt
}

// Reset resets the limiter for a key
func (s *RedisStore) Reset(ctx context.Context, key string) error {
	if s.client == nil {
		return nil
	}

	tokenKey := s.tokenKey(key)
	tsKey := s.timestampKey(key)

	_, err := s.client.Del(tokenKey, tsKey)
	if err != nil {
		logger.Warningf("failed to reset rate limit for key %s: %v", key, err)
	}

	// Also reset local limiter
	s.rescueLock.Lock()
	delete(s.rescueLimiters, key)
	s.rescueLock.Unlock()

	return err
}

// Close cleans up resources
func (s *RedisStore) Close() error {
	// Nothing to close, Redis client is external
	return nil
}

// allowRedis checks if request is allowed using Redis
func (s *RedisStore) allowRedis(ctx context.Context, key string, now time.Time) (bool, int) {
	if s.client == nil {
		allowed, remaining, _ := s.allowLocal(key, now, now.Add(s.window))
		return allowed, remaining
	}

	tokenKey := s.tokenKey(key)
	tsKey := s.timestampKey(key)

	result, err := s.script.Run(ctx, s.client.Raw(), []string{tokenKey, tsKey},
		s.rate,
		s.burst,
		now.Unix(),
		1, // requested tokens
	).Result()

	if err != nil {
		logger.Warningf("rate limiter redis error: %v, falling back to local limiter", err)
		s.startMonitor()
		allowed, remaining, _ := s.allowLocal(key, now, now.Add(s.window))
		return allowed, remaining
	}

	// Lua returns 1 for allowed, nil/false for denied
	allowed, ok := result.(int64)
	if !ok {
		logger.Warningf("unexpected redis script result: %v, falling back to local limiter", result)
		s.startMonitor()
		allowed, remaining, _ := s.allowLocal(key, now, now.Add(s.window))
		return allowed, remaining
	}

	return allowed == 1, s.burst - 1 // approximate remaining
}

// allowLocal uses local rate limiter as fallback
func (s *RedisStore) allowLocal(key string, now time.Time, resetAt time.Time) (bool, int, time.Time) {
	limiter := s.getLocalLimiter(key)
	if limiter.AllowN(now, 1) {
		return true, s.burst - 1, resetAt
	}
	return false, 0, resetAt
}

// getLocalLimiter returns or creates a local limiter for the key
func (s *RedisStore) getLocalLimiter(key string) *rate.Limiter {
	s.rescueLock.Lock()
	defer s.rescueLock.Unlock()

	if limiter, ok := s.rescueLimiters[key]; ok {
		return limiter
	}

	// Create new limiter: rate per second, burst size
	limiter := rate.NewLimiter(rate.Limit(s.rate), s.burst)
	s.rescueLimiters[key] = limiter
	return limiter
}

// startMonitor starts monitoring Redis health
func (s *RedisStore) startMonitor() {
	s.rescueLock.Lock()
	defer s.rescueLock.Unlock()

	if s.monitorStarted {
		return
	}

	s.monitorStarted = true
	atomic.StoreUint32(&s.redisAlive, 0)

	go s.waitForRedis()
}

// waitForRedis waits for Redis to become available again
func (s *RedisStore) waitForRedis() {
	ticker := time.NewTicker(pingInterval)
	defer func() {
		ticker.Stop()
		s.rescueLock.Lock()
		s.monitorStarted = false
		s.rescueLock.Unlock()
	}()

	for range ticker.C {
		if s.client != nil && s.client.Ping() == nil {
			atomic.StoreUint32(&s.redisAlive, 1)
			logger.Info("rate limiter: redis connection restored")
			return
		}
	}
}

// tokenKey returns the Redis key for tokens
func (s *RedisStore) tokenKey(key string) string {
	return fmt.Sprintf(tokenKeyFormat, key)
}

// timestampKey returns the Redis key for timestamp
func (s *RedisStore) timestampKey(key string) string {
	return fmt.Sprintf(timestampKeyFormat, key)
}
