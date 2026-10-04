package ratelimit

import (
	"context"
	"testing"
	"time"

	goRedis "github.com/redis/go-redis/v9"
)

// With Redis unreachable the store must keep enforcing limits locally
// rather than failing open.
func TestWindowRedisStore_FallsBackToMemoryWhenRedisDown(t *testing.T) {
	client := goRedis.NewClient(&goRedis.Options{
		Addr:        "127.0.0.1:1",
		DialTimeout: 100 * time.Millisecond,
		MaxRetries:  -1,
	})
	defer client.Close()

	store := NewWindowRedisStore(client, 2, time.Minute, "test")
	ctx := context.Background()

	for i := 0; i < 2; i++ {
		if ok, _, _ := store.Take(ctx, "k"); !ok {
			t.Fatalf("hit %d should be allowed", i+1)
		}
	}
	if ok, _, resetAt := store.Take(ctx, "k"); ok || !resetAt.After(time.Now()) {
		t.Fatalf("third hit must be denied with a future reset, got ok=%v reset=%v", ok, resetAt)
	}
}

func TestMemoryStore_TakeIsAtomicCheckAndHit(t *testing.T) {
	store := NewMemoryStore(1, time.Minute)
	defer store.Close()
	ctx := context.Background()

	ok, remaining, _ := store.Take(ctx, "k")
	if !ok || remaining != 0 {
		t.Fatalf("first take: ok=%v remaining=%d", ok, remaining)
	}
	if ok, _, _ := store.Take(ctx, "k"); ok {
		t.Fatal("second take must be denied")
	}
}
