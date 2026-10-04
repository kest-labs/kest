package ratelimit

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	goRedis "github.com/redis/go-redis/v9"

	"github.com/kest-labs/kest/api/pkg/logger"
)

// fixedWindowScript increments the counter for a window and returns
// {count, ttl_ms}. The expiry is set on the first hit of each window.
var fixedWindowScript = goRedis.NewScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`)

// WindowRedisStore is a distributed fixed-window limiter with the same
// semantics as MemoryStore (max hits per window). When Redis is unreachable
// it degrades to a process-local MemoryStore instead of failing open.
type WindowRedisStore struct {
	client   goRedis.Scripter
	max      int
	window   time.Duration
	prefix   string
	fallback *MemoryStore
	degraded atomic.Bool
}

// NewWindowRedisStore creates a Redis-backed fixed-window store. prefix
// namespaces the keys (e.g. "auth").
func NewWindowRedisStore(client goRedis.Scripter, max int, window time.Duration, prefix string) *WindowRedisStore {
	return &WindowRedisStore{
		client:   client,
		max:      max,
		window:   window,
		prefix:   prefix,
		fallback: NewMemoryStore(max, window),
	}
}

func (s *WindowRedisStore) redisKey(key string) string {
	return fmt.Sprintf("ratelimit:window:%s:%s", s.prefix, key)
}

// Take atomically records a hit and reports whether it is within the limit.
func (s *WindowRedisStore) Take(ctx context.Context, key string) (bool, int, time.Time) {
	res, err := fixedWindowScript.Run(ctx, s.client, []string{s.redisKey(key)}, s.window.Milliseconds()).Int64Slice()
	if err != nil || len(res) != 2 {
		if s.degraded.CompareAndSwap(false, true) {
			logger.Warningf("rate limiter: redis unavailable (%v), using in-memory fallback", err)
		}
		return s.fallback.Take(ctx, key)
	}
	if s.degraded.CompareAndSwap(true, false) {
		logger.Info("rate limiter: redis connection restored")
	}

	count, ttl := int(res[0]), time.Duration(res[1])*time.Millisecond
	resetAt := time.Now().Add(ttl)
	if count > s.max {
		return false, 0, resetAt
	}
	return true, s.max - count, resetAt
}

// Allow implements Limiter. It records a hit (same as Take).
func (s *WindowRedisStore) Allow(ctx context.Context, key string) (bool, int, time.Time) {
	return s.Take(ctx, key)
}

// Hit implements Limiter.
func (s *WindowRedisStore) Hit(ctx context.Context, key string) (int, time.Time) {
	_, remaining, resetAt := s.Take(ctx, key)
	return remaining, resetAt
}

// Reset implements Limiter.
func (s *WindowRedisStore) Reset(ctx context.Context, key string) error {
	_ = s.fallback.Reset(ctx, key)
	if c, ok := s.client.(interface {
		Del(ctx context.Context, keys ...string) *goRedis.IntCmd
	}); ok {
		return c.Del(ctx, s.redisKey(key)).Err()
	}
	return nil
}
