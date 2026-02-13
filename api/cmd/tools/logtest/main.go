package main

import (
	"github.com/kest-labs/kest/api/pkg/logger"
)

func main() {
	// Initialize logs
	logger.Boot()
	defer logger.Close()

	// Test different log levels
	logger.Debug("this is debug message")
	logger.Info("user logged in", map[string]any{"user_id": 123, "email": "test@example.com"})
	logger.Notice("cache cleared")
	logger.Warning("disk space low", map[string]any{"available": "10GB"})
	logger.Error("database connection failed", map[string]any{"host": "localhost", "port": 5432})
	logger.Critical("payment service unavailable")
	logger.Alert("security breach detected")
	logger.Emergency("system is down")

	// Test channel-specific loggers
	logger.HTTP().Info("request received", map[string]any{
		"method": "POST",
		"path":   "/api/users",
	})

	logger.Database().Debug("query executed", map[string]any{
		"sql":      "SELECT * FROM users WHERE id = ?",
		"duration": "12ms",
	})

	logger.Auth().Warning("login failed", map[string]any{
		"email":  "test@example.com",
		"reason": "invalid password",
	})

	// Test WithContext for contextual logging
	log := logger.WithContext(map[string]any{
		"request_id": "req-abc-123",
		"user_id":    456,
	})
	log.Info("processing order")
	log.Error("order failed", map[string]any{"order_id": 789})

	// Test formatted logging
	logger.Infof("server started on port %d", 8025)
	logger.Errorf("failed to process %d items", 5)

	println("\n✅ Log test completed! Check storage/logs/ for log files.")
}
