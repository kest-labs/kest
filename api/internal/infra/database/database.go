package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// NewDB creates a new database connection via Wire DI.
// Returns nil if database is disabled in config.
func NewDB(cfg *config.Config) (*gorm.DB, error) {
	if !cfg.Database.Enabled {
		log.Println("Database initialization skipped (DB_ENABLED=false)")
		return nil, nil
	}

	return initDB(cfg.Database)
}

// initDB initializes database connection with the given config
func initDB(cfg config.DatabaseConfig) (*gorm.DB, error) {
	// Configure custom logger
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	var dialector gorm.Dialector

	if cfg.Driver == "sqlite" {
		dsn := cfg.Name
		if cfg.Memory {
			dsn = ":memory:"
		}
		dialector = sqlite.Open(dsn)
	} else {
		dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%d sslmode=%s timezone=%s",
			cfg.Host,
			cfg.Username,
			cfg.Password,
			cfg.Name,
			cfg.Port,
			cfg.SSLMode,
			cfg.Timezone,
		)
		dialector = postgres.New(postgres.Config{
			DSN:                  dsn,
			PreferSimpleProtocol: true,
		})
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	// Set connection pool
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(0) // Disable connection max lifetime

	// Check if we can connect to the database
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

// NewTestDB creates an in-memory SQLite database for testing.
// This is a convenience function for tests that need a real database.
func NewTestDB() (*gorm.DB, error) {
	return initDB(config.DatabaseConfig{
		Driver: "sqlite",
		Memory: true,
	})
}
