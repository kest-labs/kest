package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/bootstrap"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/wiring"
	"github.com/kest-labs/kest/api/routes"
)

func main() {
	// Initialize logger
	bootstrap.InitLogger()

	// Initialize application via Wire DI
	application, err := wiring.InitApplication()
	if err != nil {
		log.Fatalf("Failed to initialize application: %v", err)
	}

	cfg := application.Config

	// Set JWT service for middleware
	middleware.SetJWTService(application.JWTService)

	// Set Gin mode
	if cfg.Server.Mode == "release" || cfg.Server.Mode == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	r := gin.Default()

	// Setup API routes (no static files)
	routes.Setup(r, application.Handlers)

	// Start server
	serverAddr := fmt.Sprintf(":%d", cfg.Server.Port)
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      r,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	go func() {
		log.Printf("\n")
		log.Printf("  🚀 Kest API Started!")
		log.Printf("  ➜ Local:   http://localhost:%d", cfg.Server.Port)
		log.Printf("  ➜ Mode:    %s", cfg.Server.Mode)
		log.Printf("\n")

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Close database connection
	if application.DB != nil {
		if sqlDB, err := application.DB.DB(); err == nil {
			sqlDB.Close()
		}
	}

	log.Println("Server stopped")
}
