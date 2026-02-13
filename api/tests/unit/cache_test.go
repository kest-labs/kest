package unit

import (
	"context"
	"testing"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/cache"
)

func TestMemoryStore_PutAndGet(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	// Test Put and Get
	err := store.Put(ctx, "key1", "value1", 10*time.Minute)
	if err != nil {
		t.Fatalf("Put failed: %v", err)
	}

	val, err := store.Get(ctx, "key1")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}

	if val != "value1" {
		t.Errorf("Expected 'value1', got '%v'", val)
	}
}

func TestMemoryStore_GetMiss(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	_, err := store.Get(ctx, "nonexistent")
	if err != cache.ErrCacheMiss {
		t.Errorf("Expected ErrCacheMiss, got %v", err)
	}
}

func TestMemoryStore_Has(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	if store.Has(ctx, "key1") {
		t.Error("Expected Has to return false for nonexistent key")
	}

	store.Put(ctx, "key1", "value1", 10*time.Minute)

	if !store.Has(ctx, "key1") {
		t.Error("Expected Has to return true for existing key")
	}
}

func TestMemoryStore_Forget(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	store.Put(ctx, "key1", "value1", 10*time.Minute)
	store.Forget(ctx, "key1")

	if store.Has(ctx, "key1") {
		t.Error("Expected key to be forgotten")
	}
}

func TestMemoryStore_Flush(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	store.Put(ctx, "key1", "value1", 10*time.Minute)
	store.Put(ctx, "key2", "value2", 10*time.Minute)
	store.Flush(ctx)

	if store.Has(ctx, "key1") || store.Has(ctx, "key2") {
		t.Error("Expected all keys to be flushed")
	}
}

func TestMemoryStore_Forever(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	store.Forever(ctx, "key1", "value1")

	val, err := store.Get(ctx, "key1")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}

	if val != "value1" {
		t.Errorf("Expected 'value1', got '%v'", val)
	}
}

func TestMemoryStore_Expiration(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	// Put with very short TTL
	store.Put(ctx, "key1", "value1", 50*time.Millisecond)

	// Should exist immediately
	if !store.Has(ctx, "key1") {
		t.Error("Expected key to exist before expiration")
	}

	// Wait for expiration
	time.Sleep(100 * time.Millisecond)

	// Should be expired now
	if store.Has(ctx, "key1") {
		t.Error("Expected key to be expired")
	}
}

func TestMemoryStore_Increment(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	// Increment non-existent key
	val, err := store.Increment(ctx, "counter", 1)
	if err != nil {
		t.Fatalf("Increment failed: %v", err)
	}
	if val != 1 {
		t.Errorf("Expected 1, got %d", val)
	}

	// Increment existing key
	val, err = store.Increment(ctx, "counter", 5)
	if err != nil {
		t.Fatalf("Increment failed: %v", err)
	}
	if val != 6 {
		t.Errorf("Expected 6, got %d", val)
	}
}

func TestMemoryStore_Decrement(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	store.Put(ctx, "counter", int64(10), 10*time.Minute)

	val, err := store.Decrement(ctx, "counter", 3)
	if err != nil {
		t.Fatalf("Decrement failed: %v", err)
	}
	if val != 7 {
		t.Errorf("Expected 7, got %d", val)
	}
}

func TestMemoryStore_DifferentTypes(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	// String
	store.Put(ctx, "string", "hello", 10*time.Minute)
	val, _ := store.Get(ctx, "string")
	if val != "hello" {
		t.Errorf("String: expected 'hello', got '%v'", val)
	}

	// Int
	store.Put(ctx, "int", 42, 10*time.Minute)
	val, _ = store.Get(ctx, "int")
	if val != 42 {
		t.Errorf("Int: expected 42, got '%v'", val)
	}

	// Struct
	type User struct {
		Name string
		Age  int
	}
	user := User{Name: "John", Age: 30}
	store.Put(ctx, "user", user, 10*time.Minute)
	val, _ = store.Get(ctx, "user")
	if u, ok := val.(User); !ok || u.Name != "John" {
		t.Errorf("Struct: expected User{John, 30}, got '%v'", val)
	}

	// Slice
	slice := []string{"a", "b", "c"}
	store.Put(ctx, "slice", slice, 10*time.Minute)
	val, _ = store.Get(ctx, "slice")
	if s, ok := val.([]string); !ok || len(s) != 3 {
		t.Errorf("Slice: expected [a b c], got '%v'", val)
	}

	// Map
	m := map[string]int{"one": 1, "two": 2}
	store.Put(ctx, "map", m, 10*time.Minute)
	val, _ = store.Get(ctx, "map")
	if mp, ok := val.(map[string]int); !ok || mp["one"] != 1 {
		t.Errorf("Map: expected map with one=1, got '%v'", val)
	}
}

func TestGlobalCache_Remember(t *testing.T) {
	ctx := context.Background()

	// Clear any existing cache
	cache.Flush(ctx)

	callCount := 0
	callback := func() (interface{}, error) {
		callCount++
		return "computed_value", nil
	}

	// First call should execute callback
	val, err := cache.Remember(ctx, "remember_key", 10*time.Minute, callback)
	if err != nil {
		t.Fatalf("Remember failed: %v", err)
	}
	if val != "computed_value" {
		t.Errorf("Expected 'computed_value', got '%v'", val)
	}
	if callCount != 1 {
		t.Errorf("Expected callback to be called once, called %d times", callCount)
	}

	// Second call should return cached value
	val, err = cache.Remember(ctx, "remember_key", 10*time.Minute, callback)
	if err != nil {
		t.Fatalf("Remember failed: %v", err)
	}
	if val != "computed_value" {
		t.Errorf("Expected 'computed_value', got '%v'", val)
	}
	if callCount != 1 {
		t.Errorf("Expected callback to still be called once, called %d times", callCount)
	}
}

func TestGlobalCache_Pull(t *testing.T) {
	ctx := context.Background()

	cache.Put(ctx, "pull_key", "pull_value", 10*time.Minute)

	val, err := cache.Pull(ctx, "pull_key")
	if err != nil {
		t.Fatalf("Pull failed: %v", err)
	}
	if val != "pull_value" {
		t.Errorf("Expected 'pull_value', got '%v'", val)
	}

	// Key should be removed after pull
	if cache.Has(ctx, "pull_key") {
		t.Error("Expected key to be removed after Pull")
	}
}

func TestGlobalCache_Add(t *testing.T) {
	ctx := context.Background()
	cache.Flush(ctx)

	// Add to non-existent key should succeed
	if !cache.Add(ctx, "add_key", "value1", 10*time.Minute) {
		t.Error("Expected Add to succeed for new key")
	}

	// Add to existing key should fail
	if cache.Add(ctx, "add_key", "value2", 10*time.Minute) {
		t.Error("Expected Add to fail for existing key")
	}

	// Value should still be original
	val, _ := cache.Get(ctx, "add_key")
	if val != "value1" {
		t.Errorf("Expected 'value1', got '%v'", val)
	}
}

func TestGlobalCache_GetString(t *testing.T) {
	ctx := context.Background()

	cache.Put(ctx, "string_key", "string_value", 10*time.Minute)

	val, err := cache.GetString(ctx, "string_key")
	if err != nil {
		t.Fatalf("GetString failed: %v", err)
	}
	if val != "string_value" {
		t.Errorf("Expected 'string_value', got '%s'", val)
	}
}

func TestGlobalCache_GetInt(t *testing.T) {
	ctx := context.Background()

	cache.Put(ctx, "int_key", 42, 10*time.Minute)

	val, err := cache.GetInt(ctx, "int_key")
	if err != nil {
		t.Fatalf("GetInt failed: %v", err)
	}
	if val != 42 {
		t.Errorf("Expected 42, got %d", val)
	}
}

func TestMemoryStore_Keys(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	store.Put(ctx, "key1", "value1", 10*time.Minute)
	store.Put(ctx, "key2", "value2", 10*time.Minute)
	store.Put(ctx, "key3", "value3", 10*time.Minute)

	keys := store.Keys()
	if len(keys) != 3 {
		t.Errorf("Expected 3 keys, got %d", len(keys))
	}
}

func TestMemoryStore_Len(t *testing.T) {
	store := cache.NewMemoryStore()
	ctx := context.Background()

	if store.Len() != 0 {
		t.Errorf("Expected empty store, got %d items", store.Len())
	}

	store.Put(ctx, "key1", "value1", 10*time.Minute)
	store.Put(ctx, "key2", "value2", 10*time.Minute)

	if store.Len() != 2 {
		t.Errorf("Expected 2 items, got %d", store.Len())
	}
}
