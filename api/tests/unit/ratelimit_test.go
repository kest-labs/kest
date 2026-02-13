package unit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/ratelimit"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestMemoryStore_Allow(t *testing.T) {
	store := ratelimit.NewMemoryStore(5, time.Minute)
	defer store.Close()
	ctx := context.Background()

	// First request should be allowed
	allowed, remaining, _ := store.Allow(ctx, "test-key")
	if !allowed {
		t.Error("First request should be allowed")
	}
	if remaining != 5 {
		t.Errorf("Expected 5 remaining, got %d", remaining)
	}
}

func TestMemoryStore_Hit(t *testing.T) {
	store := ratelimit.NewMemoryStore(5, time.Minute)
	defer store.Close()
	ctx := context.Background()

	// Record hits
	remaining, _ := store.Hit(ctx, "test-key")
	if remaining != 4 {
		t.Errorf("Expected 4 remaining after first hit, got %d", remaining)
	}

	remaining, _ = store.Hit(ctx, "test-key")
	if remaining != 3 {
		t.Errorf("Expected 3 remaining after second hit, got %d", remaining)
	}
}

func TestMemoryStore_ExceedsLimit(t *testing.T) {
	store := ratelimit.NewMemoryStore(3, time.Minute)
	defer store.Close()
	ctx := context.Background()

	// Exhaust the limit
	store.Hit(ctx, "test-key")
	store.Hit(ctx, "test-key")
	store.Hit(ctx, "test-key")

	// Next request should be denied
	allowed, remaining, _ := store.Allow(ctx, "test-key")
	if allowed {
		t.Error("Request should be denied after exceeding limit")
	}
	if remaining != 0 {
		t.Errorf("Expected 0 remaining, got %d", remaining)
	}
}

func TestMemoryStore_Reset(t *testing.T) {
	store := ratelimit.NewMemoryStore(5, time.Minute)
	defer store.Close()
	ctx := context.Background()

	// Record some hits
	store.Hit(ctx, "test-key")
	store.Hit(ctx, "test-key")

	// Reset the key
	store.Reset(ctx, "test-key")

	// Should have full quota again
	allowed, remaining, _ := store.Allow(ctx, "test-key")
	if !allowed {
		t.Error("Request should be allowed after reset")
	}
	if remaining != 5 {
		t.Errorf("Expected 5 remaining after reset, got %d", remaining)
	}
}

func TestMemoryStore_WindowExpiry(t *testing.T) {
	store := ratelimit.NewMemoryStore(3, 100*time.Millisecond)
	defer store.Close()
	ctx := context.Background()

	// Exhaust the limit
	store.Hit(ctx, "test-key")
	store.Hit(ctx, "test-key")
	store.Hit(ctx, "test-key")

	// Should be denied
	allowed, _, _ := store.Allow(ctx, "test-key")
	if allowed {
		t.Error("Request should be denied")
	}

	// Wait for window to expire
	time.Sleep(150 * time.Millisecond)

	// Should be allowed again
	allowed, remaining, _ := store.Allow(ctx, "test-key")
	if !allowed {
		t.Error("Request should be allowed after window expiry")
	}
	if remaining != 3 {
		t.Errorf("Expected 3 remaining after expiry, got %d", remaining)
	}
}

func TestMiddleware_AllowsRequests(t *testing.T) {
	router := gin.New()
	router.Use(ratelimit.PerMinute(10))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Check rate limit headers
	if w.Header().Get("X-RateLimit-Limit") != "10" {
		t.Error("Expected X-RateLimit-Limit header")
	}
	if w.Header().Get("X-RateLimit-Remaining") == "" {
		t.Error("Expected X-RateLimit-Remaining header")
	}
	if w.Header().Get("X-RateLimit-Reset") == "" {
		t.Error("Expected X-RateLimit-Reset header")
	}
}

func TestMiddleware_BlocksExcessiveRequests(t *testing.T) {
	router := gin.New()
	router.Use(ratelimit.PerMinute(3))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	// Make requests up to and beyond the limit
	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		router.ServeHTTP(w, req)

		if i < 3 {
			if w.Code != http.StatusOK {
				t.Errorf("Request %d: expected 200, got %d", i+1, w.Code)
			}
		} else {
			if w.Code != http.StatusTooManyRequests {
				t.Errorf("Request %d: expected 429, got %d", i+1, w.Code)
			}
			if w.Header().Get("Retry-After") == "" {
				t.Error("Expected Retry-After header on 429 response")
			}
		}
	}
}

func TestMiddleware_CustomKeyFunc(t *testing.T) {
	store := ratelimit.NewMemoryStore(2, time.Minute)

	router := gin.New()
	router.Use(ratelimit.Middleware(ratelimit.Config{
		Max:      2,
		Duration: time.Minute,
		Store:    store,
		KeyFunc: func(c *gin.Context) string {
			return c.GetHeader("X-API-Key")
		},
	}))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	// Requests with different API keys should have separate limits
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.Header.Set("X-API-Key", "key-1")
		router.ServeHTTP(w, req)

		if i < 2 && w.Code != http.StatusOK {
			t.Errorf("Request %d with key-1: expected 200, got %d", i+1, w.Code)
		}
		if i >= 2 && w.Code != http.StatusTooManyRequests {
			t.Errorf("Request %d with key-1: expected 429, got %d", i+1, w.Code)
		}
	}

	// Different API key should have its own limit
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-API-Key", "key-2")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Request with key-2: expected 200, got %d", w.Code)
	}
}

func TestMiddleware_SkipFunc(t *testing.T) {
	router := gin.New()
	router.Use(ratelimit.Middleware(ratelimit.Config{
		Max:      1,
		Duration: time.Minute,
		SkipFunc: func(c *gin.Context) bool {
			return c.GetHeader("X-Skip-RateLimit") == "true"
		},
	}))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	// First request without skip header
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", w.Code)
	}

	// Second request should be rate limited
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("Expected 429, got %d", w.Code)
	}

	// Request with skip header should bypass rate limit
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Skip-RateLimit", "true")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 with skip header, got %d", w.Code)
	}
}

func TestPerSecond(t *testing.T) {
	router := gin.New()
	router.Use(ratelimit.PerSecond(2))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	// Make 3 requests quickly
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		router.ServeHTTP(w, req)

		if i < 2 && w.Code != http.StatusOK {
			t.Errorf("Request %d: expected 200, got %d", i+1, w.Code)
		}
		if i >= 2 && w.Code != http.StatusTooManyRequests {
			t.Errorf("Request %d: expected 429, got %d", i+1, w.Code)
		}
	}
}

func TestByRoute(t *testing.T) {
	store1 := ratelimit.NewMemoryStore(2, time.Minute)
	store2 := ratelimit.NewMemoryStore(2, time.Minute)

	router := gin.New()

	// Different routes with different limits
	route1 := router.Group("/api")
	route1.Use(ratelimit.Middleware(ratelimit.Config{
		Max:      2,
		Duration: time.Minute,
		Store:    store1,
	}))
	route1.GET("/users", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"route": "users"})
	})

	route2 := router.Group("/api")
	route2.Use(ratelimit.Middleware(ratelimit.Config{
		Max:      2,
		Duration: time.Minute,
		Store:    store2,
	}))
	route2.GET("/posts", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"route": "posts"})
	})

	// Exhaust /api/users limit
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/users", nil)
		router.ServeHTTP(w, req)
	}

	// /api/posts should still work
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/posts", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected /api/posts to return 200, got %d", w.Code)
	}
}

func TestThrottle(t *testing.T) {
	router := gin.New()
	router.Use(ratelimit.Throttle(5))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", w.Code)
	}
	if w.Header().Get("X-RateLimit-Limit") != "5" {
		t.Errorf("Expected X-RateLimit-Limit to be 5, got %s", w.Header().Get("X-RateLimit-Limit"))
	}
}

func TestCustomErrorHandler(t *testing.T) {
	router := gin.New()
	router.Use(ratelimit.Middleware(ratelimit.Config{
		Max:      1,
		Duration: time.Minute,
		ErrorHandler: func(c *gin.Context, resetAt time.Time) {
			c.JSON(http.StatusTeapot, gin.H{"custom": "error"})
		},
	}))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})

	// First request
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	// Second request should get custom error
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusTeapot {
		t.Errorf("Expected custom status 418, got %d", w.Code)
	}
}
