package middleware

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/ratelimit"
	infraRedis "github.com/kest-labs/kest/api/internal/infra/redis"
	"github.com/kest-labs/kest/api/pkg/response"
)

// authRateLimitedSuffixes are POST routes guarded by the strict per-IP limit.
var authRateLimitedSuffixes = []string{
	"/login",
	"/register",
	"/password/reset",
	"/cli-tokens", // CLI token creation
}

// IsAuthRateLimitedRoute reports whether a matched route is an auth endpoint.
func IsAuthRateLimitedRoute(method, fullPath string) bool {
	if method != http.MethodPost || fullPath == "" {
		return false
	}
	for _, suffix := range authRateLimitedSuffixes {
		if strings.HasSuffix(fullPath, suffix) {
			return true
		}
	}
	return false
}

// IsRunRateLimitedRoute reports whether a matched route executes outbound
// requests: request runs, test-case runs, flow runs and the flow-run SSE
// endpoint (which executes the pending run).
func IsRunRateLimitedRoute(method, fullPath string) bool {
	switch {
	case fullPath == "":
		return false
	case method == http.MethodPost && strings.HasSuffix(fullPath, "/run"):
		return true
	case method == http.MethodGet && strings.HasSuffix(fullPath, "/runs/:rid/events"):
		return true
	}
	return false
}

// RateLimiters returns the global rate-limit middlewares configured by cfg.
// They must be registered with engine.Use before routes so that
// c.FullPath() identifies the matched route.
func RateLimiters(cfg *config.Config) []gin.HandlerFunc {
	if cfg == nil || !cfg.RateLimit.Enabled {
		return nil
	}
	rl := cfg.RateLimit

	var handlers []gin.HandlerFunc
	if rl.AuthMax > 0 && rl.AuthWindow > 0 {
		handlers = append(handlers, ratelimit.Middleware(ratelimit.Config{
			Max:          rl.AuthMax,
			Duration:     rl.AuthWindow,
			Store:        newRateLimitStore(cfg, "auth", rl.AuthMax, rl.AuthWindow),
			KeyFunc:      func(c *gin.Context) string { return "ip:" + c.ClientIP() },
			SkipFunc:     func(c *gin.Context) bool { return !IsAuthRateLimitedRoute(c.Request.Method, c.FullPath()) },
			ErrorHandler: rateLimitExceeded,
		}))
	}
	if rl.RunMax > 0 && rl.RunWindow > 0 {
		handlers = append(handlers, ratelimit.Middleware(ratelimit.Config{
			Max:          rl.RunMax,
			Duration:     rl.RunWindow,
			Store:        newRateLimitStore(cfg, "run", rl.RunMax, rl.RunWindow),
			KeyFunc:      userOrIPKey,
			SkipFunc:     func(c *gin.Context) bool { return !IsRunRateLimitedRoute(c.Request.Method, c.FullPath()) },
			ErrorHandler: rateLimitExceeded,
		}))
	}
	return handlers
}

// userOrIPKey keys by the authenticated user when a valid bearer JWT is
// present (these middlewares run before route-level auth), else by IP.
func userOrIPKey(c *gin.Context) string {
	if jwtService != nil {
		if token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer "); ok && token != "" {
			if claims, err := jwtService.ParseToken(token); err == nil {
				return "user:" + claims.UserID.String()
			}
		}
	}
	return "ip:" + c.ClientIP()
}

func rateLimitExceeded(c *gin.Context, resetAt time.Time) {
	retryAfter := int(time.Until(resetAt).Seconds() + 0.999)
	if retryAfter < 1 {
		retryAfter = 1
	}
	c.Header("Retry-After", strconv.Itoa(retryAfter))
	response.TooManyRequests(c, "Too many requests, please retry after "+strconv.Itoa(retryAfter)+" seconds")
}

var (
	rateLimitRedisOnce   sync.Once
	rateLimitRedisClient *infraRedis.Client
)

// newRateLimitStore returns a Redis store when RATE_LIMIT_STORE=redis (the
// default when REDIS_ENABLED=true) and Redis is reachable at startup,
// otherwise an in-memory store.
func newRateLimitStore(cfg *config.Config, name string, max int, window time.Duration) ratelimit.Limiter {
	if cfg.RateLimit.Store == "redis" {
		rateLimitRedisOnce.Do(func() {
			client := infraRedis.Default()
			if client == nil {
				var err error
				client, err = infraRedis.Connect(infraRedis.Config{
					Host:     cfg.Redis.Host,
					Port:     strconv.Itoa(cfg.Redis.Port),
					Password: cfg.Redis.Password,
					DB:       cfg.Redis.DB,
				})
				if err != nil {
					log.Printf("[ratelimit] Redis unavailable (%v); falling back to in-memory rate limiting", err)
					return
				}
			}
			rateLimitRedisClient = client
		})
		if rateLimitRedisClient != nil {
			return ratelimit.NewWindowRedisStore(rateLimitRedisClient.Raw(), max, window, name)
		}
	}
	return ratelimit.NewMemoryStore(max, window)
}
