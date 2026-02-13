package bootstrap

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/app"
	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/health"
	"github.com/kest-labs/kest/api/internal/infra/metrics"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/tracing"
	"github.com/kest-labs/kest/api/pkg/logger"
	"github.com/kest-labs/kest/api/pkg/support"
	"github.com/kest-labs/kest/api/routes"
)

// HttpKernel handles HTTP server lifecycle
type HttpKernel struct {
	App            *app.Application
	Engine         *gin.Engine
	TracerProvider *tracing.TracerProvider
	Health         *health.Health
}

// NewHttpKernel creates a new HTTP kernel from Wire-injected Application
func NewHttpKernel(application *app.Application) *HttpKernel {
	// Set JWT service for middleware
	middleware.SetJWTService(application.JWTService)

	// Set Mode
	setGinMode(application.Config.Server.Mode)

	// Create Engine
	r := gin.New()

	// Initialize Tracing (if enabled)
	var tracerProvider *tracing.TracerProvider
	if application.Config.Tracing.Enabled {
		tp, err := tracing.NewTracerProvider(&tracing.Config{
			Enabled:     true,
			ServiceName: application.Config.App.Name,
			Environment: application.Config.App.Env,
			Endpoint:    application.Config.Tracing.Endpoint,
			Insecure:    application.Config.Tracing.Insecure,
			SampleRate:  application.Config.Tracing.SampleRate,
			Debug:       application.Config.App.Debug,
		})
		if err != nil {
			log.Printf("Warning: Failed to initialize tracing: %v", err)
		} else {
			tracerProvider = tp
			// Add tracing middleware
			r.Use(tracing.Middleware(application.Config.App.Name))
			r.Use(tracing.InjectTraceID())
			log.Println("OpenTelemetry tracing enabled")

			// Add GORM tracing
			if err := tracing.WithTracing(application.DB, application.Config.App.Name); err != nil {
				log.Printf("Warning: Failed to add GORM tracing: %v", err)
			}
		}
	}

	// Add custom logger and recovery middleware
	r.Use(logger.GinLogger())
	r.Use(gin.Recovery())

	// Add Prometheus metrics middleware
	r.Use(metrics.Middleware())

	// Apply Global Middleware (CORS mainly)
	applyGlobalMiddleware(r, application.Config)

	// Initialize Health Checks
	h := health.New()
	h.Register("database", health.DatabaseChecker(application.DB))

	// Register health and metrics routes
	h.RegisterRoutes(r)
	r.GET("/metrics", metrics.Handler())

	// Initialize Modules (Events and Init)
	for _, m := range application.Handlers.Modules() {
		if err := m.Init(); err != nil {
			log.Printf("Warning: Module %s failed to initialize: %v", m.Name(), err)
		}
		m.RegisterEvents(application.EventBus)
	}

	// Register Routes
	// We temporarily silence Gin's default route logging to keep console clean
	gin.SetMode(gin.ReleaseMode) // Temporarily set to release to silence route logs
	routes.Setup(r, application.Handlers)
	setGinMode(application.Config.Server.Mode) // Restore correct mode

	// Print Professional Banner
	support.PrintBanner("1.0.0")

	return &HttpKernel{
		App:            application,
		Engine:         r,
		TracerProvider: tracerProvider,
		Health:         h,
	}
}

// Handle starts the HTTP server with graceful shutdown
func (k *HttpKernel) Handle() {
	cfg := k.App.Config
	addr := fmt.Sprintf(":%d", cfg.Server.Port)

	srv := &http.Server{
		Addr:         addr,
		Handler:      k.Engine,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	// Start Server in goroutine
	go func() {
		host := cfg.Server.Host
		if host == "" {
			host = "localhost"
		}
		url := fmt.Sprintf("http://%s:%d", host, cfg.Server.Port)

		log.Printf("\n")
		log.Printf("  🚀 Eogo Server Started!")
		log.Printf("  ➜ Local:   \033[36m%s\033[0m", url)
		log.Printf("  ➜ Mode:    %s", cfg.Server.Mode)
		log.Printf("\n")

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful Shutdown
	k.gracefulShutdown(srv)
}

// gracefulShutdown handles graceful shutdown of the server and resources
func (k *HttpKernel) gracefulShutdown(srv *http.Server) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create context with timeout for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Shutdown HTTP server (stop accepting new requests, wait for existing)
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	// 2. Shutdown tracer provider (flush remaining spans)
	if k.TracerProvider != nil {
		if err := k.TracerProvider.Shutdown(ctx); err != nil {
			log.Printf("Tracer shutdown error: %v", err)
		} else {
			log.Println("Tracer provider shutdown complete")
		}
	}

	// 3. Close database connection
	if k.App.DB != nil {
		if sqlDB, err := k.App.DB.DB(); err == nil {
			if err := sqlDB.Close(); err != nil {
				log.Printf("Database close error: %v", err)
			} else {
				log.Println("Database connection closed")
			}
		}
	}

	log.Println("Server exited gracefully")
}

func setGinMode(mode string) {
	switch strings.ToLower(mode) {
	case "release", "prod", "production":
		gin.SetMode(gin.ReleaseMode)
	case "test":
		gin.SetMode(gin.TestMode)
	default:
		gin.SetMode(gin.DebugMode)
	}
}

func applyGlobalMiddleware(r *gin.Engine, cfg *config.Config) {
	corsConfig := cors.Config{
		AllowOrigins:     cfg.CORS.AllowOrigins,
		AllowMethods:     cfg.CORS.AllowMethods,
		AllowHeaders:     cfg.CORS.AllowHeaders,
		ExposeHeaders:    cfg.CORS.ExposeHeaders,
		AllowCredentials: cfg.CORS.AllowCredentials,
	}
	r.Use(cors.New(corsConfig))
}
