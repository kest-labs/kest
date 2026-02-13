// Package migration provides a Laravel-inspired database migration system.
package migration

import (
	"github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/google/wire"
	"gorm.io/gorm"
)

// ProviderSet provides migration components for Wire DI.
// Note: Migrations must be registered separately using RegisterMigrations()
// to avoid import cycles with the database/migrations package.
var ProviderSet = wire.NewSet(
	NewDatabaseRepositoryProvider,
	NewMigratorProvider,
)

// NewDatabaseRepositoryProvider creates a new database repository with default table name.
func NewDatabaseRepositoryProvider(db *gorm.DB) Repository {
	return NewDatabaseRepository(db, "migrations")
}

// NewMigratorProvider creates a new Migrator.
// Migrations should be registered separately using migrator.RegisterMany()
// to avoid import cycles.
func NewMigratorProvider(repo Repository, db *gorm.DB, eventBus *events.EventBus) *Migrator {
	return NewMigrator(repo, db, eventBus)
}

// MigratorConfig holds configuration for the migrator.
type MigratorConfig struct {
	// TableName is the name of the migrations table (default: "migrations")
	TableName string

	// UseTransactions indicates whether to use transactions by default
	UseTransactions bool
}

// DefaultMigratorConfig returns the default migrator configuration.
func DefaultMigratorConfig() MigratorConfig {
	return MigratorConfig{
		TableName:       "migrations",
		UseTransactions: true,
	}
}

// NewMigratorWithConfig creates a new Migrator with custom configuration.
// Migrations should be registered separately using migrator.RegisterMany().
func NewMigratorWithConfig(db *gorm.DB, eventBus *events.EventBus, cfg MigratorConfig) *Migrator {
	repo := NewDatabaseRepository(db, cfg.TableName)
	return NewMigrator(repo, db, eventBus)
}

// MigrationRegistrar is a function type that registers migrations with a migrator.
// This allows for lazy registration of migrations to avoid import cycles.
type MigrationRegistrar func(m *Migrator)

// NewMigratorWithRegistrar creates a new Migrator and registers migrations using the provided registrar.
// This is useful for Wire DI when you want to register migrations at construction time.
func NewMigratorWithRegistrar(repo Repository, db *gorm.DB, eventBus *events.EventBus, registrar MigrationRegistrar) *Migrator {
	m := NewMigrator(repo, db, eventBus)
	if registrar != nil {
		registrar(m)
	}
	return m
}
