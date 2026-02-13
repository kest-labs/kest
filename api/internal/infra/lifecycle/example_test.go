package lifecycle_test

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/lifecycle"
)

// Example: How to use Lifecycle in ZGO

// ============================================
// 1. Infrastructure Layer - Database (Mock)
// ============================================

// mockDB simulates a database connection for example purposes
type mockDB struct {
	connected bool
}

func NewDB(lc *lifecycle.Lifecycle, dsn string) (*mockDB, error) {
	db := &mockDB{}

	lc.Append(lifecycle.Hook{
		Name: "database",
		OnStart: func(ctx context.Context) error {
			// Simulate connection
			db.connected = true
			return nil
		},
		OnStop: func(ctx context.Context) error {
			// Close connection
			db.connected = false
			return nil
		},
	})

	return db, nil
}

// ============================================
// 2. Infrastructure Layer - HTTP Server
// ============================================

func NewHTTPServer(lc *lifecycle.Lifecycle, handler http.Handler, addr string) *http.Server {
	server := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	lc.Append(lifecycle.Hook{
		Name: "http-server",
		OnStart: func(ctx context.Context) error {
			// Start server in background
			go func() {
				if err := server.ListenAndServe(); err != http.ErrServerClosed {
					fmt.Printf("HTTP server error: %v\n", err)
				}
			}()
			return nil
		},
		OnStop: func(ctx context.Context) error {
			// Graceful shutdown
			return server.Shutdown(ctx)
		},
	})

	return server
}

// ============================================
// 3. Business Layer - Background Worker
// ============================================

type OrderTimeoutWorker struct {
	stopCh chan struct{}
}

func NewOrderTimeoutWorker(lc *lifecycle.Lifecycle) *OrderTimeoutWorker {
	w := &OrderTimeoutWorker{
		stopCh: make(chan struct{}),
	}

	lc.Append(lifecycle.Hook{
		Name: "order-timeout-worker",
		OnStart: func(ctx context.Context) error {
			go w.run()
			return nil
		},
		OnStop: func(ctx context.Context) error {
			close(w.stopCh)
			return nil
		},
	})

	return w
}

func (w *OrderTimeoutWorker) run() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Cancel timeout orders
		case <-w.stopCh:
			return
		}
	}
}

// ============================================
// 4. Business Layer - Cache Warmup
// ============================================

type ProductCache struct{}

func NewProductCache(lc *lifecycle.Lifecycle) *ProductCache {
	pc := &ProductCache{}

	lc.Append(lifecycle.Hook{
		Name: "product-cache-warmup",
		OnStart: func(ctx context.Context) error {
			// Warm up cache on startup
			return pc.warmup(ctx)
		},
		// No OnStop needed
	})

	return pc
}

func (pc *ProductCache) warmup(ctx context.Context) error {
	// Load hot products into cache
	return nil
}

// ============================================
// 5. Main Application
// ============================================

func ExampleLifecycle() {
	// Create lifecycle with silent logger for predictable output
	lc := lifecycle.New(lifecycle.WithLogger(&lifecycle.NopLogger{}))

	// Components register themselves via DI
	// (In real app, Wire handles this)
	_, _ = NewDB(lc, "dsn")
	NewProductCache(lc)

	// Start all components
	ctx := context.Background()
	if err := lc.Start(ctx); err != nil {
		fmt.Printf("Failed to start: %v\n", err)
		return
	}

	fmt.Println("Application started")

	// Stop all components (reverse order)
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := lc.Stop(ctx); err != nil {
		fmt.Printf("Shutdown errors: %v\n", err)
	}

	fmt.Println("Application stopped")

	// Output:
	// Application started
	// Application stopped
}
