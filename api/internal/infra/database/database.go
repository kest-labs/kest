package database

import (
	"fmt"
	"log"
	"os"
	"reflect"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/kest-labs/kest/api/internal/infra/config"
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
	if err := registerUUIDPrimaryKeyCallback(db); err != nil {
		return nil, fmt.Errorf("failed to register UUID primary key callback: %w", err)
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

func registerUUIDPrimaryKeyCallback(db *gorm.DB) error {
	return db.Callback().Create().Before("gorm:before_create").Register("kest:assign_uuid_primary_key", func(tx *gorm.DB) {
		if tx == nil || tx.Statement == nil || tx.Statement.Schema == nil {
			return
		}

		idField := tx.Statement.Schema.LookUpField("ID")
		if idField == nil || idField.FieldType.Kind() != reflect.String {
			return
		}

		assignID := func(value reflect.Value) {
			if !value.IsValid() {
				return
			}

			for value.Kind() == reflect.Ptr {
				if value.IsNil() {
					return
				}
				value = value.Elem()
			}

			if value.Kind() != reflect.Struct {
				return
			}

			_, isZero := idField.ValueOf(tx.Statement.Context, value)
			if !isZero {
				return
			}

			_ = idField.Set(tx.Statement.Context, value, uuid.NewString())
		}

		value := tx.Statement.ReflectValue
		switch value.Kind() {
		case reflect.Slice, reflect.Array:
			for i := 0; i < value.Len(); i++ {
				assignID(value.Index(i))
			}
		default:
			assignID(value)
		}
	})
}

// NewTestDB creates an in-memory SQLite database for testing.
// This is a convenience function for tests that need a real database.
func NewTestDB() (*gorm.DB, error) {
	return initDB(config.DatabaseConfig{
		Driver: "sqlite",
		Memory: true,
	})
}
