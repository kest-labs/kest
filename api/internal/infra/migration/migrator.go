// Package migration provides a Laravel-inspired database migration system.
package migration

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/events"
	"gorm.io/gorm"
	gormLogger "gorm.io/gorm/logger"
)

// Migrator coordinates all migration operations including run, rollback, and reset.
// It uses a repository for tracking migration state and fires events during execution.
type Migrator struct {
	mu         sync.RWMutex
	repository Repository
	db         *gorm.DB
	eventBus   *events.EventBus
	migrations map[string]Migration
	output     OutputWriter
}

// OutputWriter defines the interface for migration output.
// This allows capturing SQL statements in pretend mode.
type OutputWriter interface {
	Write(migration string, statements []string)
}

// NewMigrator creates a new migrator instance.
// The repository is used to track migration state, db is the database connection,
// and eventBus is optional (can be nil) for firing migration events.
func NewMigrator(repo Repository, db *gorm.DB, eventBus *events.EventBus) *Migrator {
	return &Migrator{
		repository: repo,
		db:         db,
		eventBus:   eventBus,
		migrations: make(map[string]Migration),
	}
}

// SetOutput sets the output writer for capturing SQL statements.
func (m *Migrator) SetOutput(output OutputWriter) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.output = output
}

// Register adds a migration to the migrator.
// The name should be unique and typically follows the format: YYYY_MM_DD_HHMMSS_description
func (m *Migrator) Register(name string, migration Migration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.migrations[name] = migration
}

// RegisterMany adds multiple migrations to the migrator.
func (m *Migrator) RegisterMany(migrations map[string]Migration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for name, migration := range migrations {
		m.migrations[name] = migration
	}
}

// GetMigration returns a registered migration by name.
func (m *Migrator) GetMigration(name string) (Migration, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	migration, ok := m.migrations[name]
	return migration, ok
}

// GetRegisteredMigrations returns all registered migration names in sorted order.
func (m *Migrator) GetRegisteredMigrations() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	names := make([]string, 0, len(m.migrations))
	for name := range m.migrations {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// getPendingMigrations returns migrations that haven't been run yet.
// It compares registered migrations against the list of already ran migrations.
func (m *Migrator) getPendingMigrations(ran []string) []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Create a set of ran migrations for O(1) lookup
	ranSet := make(map[string]struct{}, len(ran))
	for _, name := range ran {
		ranSet[name] = struct{}{}
	}

	// Find migrations that haven't been run
	pending := make([]string, 0)
	for name := range m.migrations {
		if _, exists := ranSet[name]; !exists {
			pending = append(pending, name)
		}
	}

	// Sort pending migrations alphabetically for consistent ordering
	sort.Strings(pending)
	return pending
}

// fireEvent publishes an event to the event bus if one is configured.
func (m *Migrator) fireEvent(event events.Event) {
	if m.eventBus != nil {
		// Fire event asynchronously to not block migration execution
		_ = m.eventBus.Publish(context.Background(), event)
	}
}

// Repository returns the underlying migration repository.
func (m *Migrator) Repository() Repository {
	return m.repository
}

// DB returns the underlying database connection.
func (m *Migrator) DB() *gorm.DB {
	return m.db
}

// Run executes all pending migrations.
// It returns the list of migrations that were executed and any error encountered.
// If opts.Pretend is true, SQL statements are captured but not executed.
// If opts.Step is true, each migration gets its own batch number.
func (m *Migrator) Run(opts MigratorOptions) ([]string, error) {
	// Ensure repository exists
	if !m.repository.RepositoryExists() {
		if err := m.repository.CreateRepository(); err != nil {
			return nil, err
		}
	}

	// Get already ran migrations
	ran, err := m.repository.GetRan()
	if err != nil {
		return nil, err
	}

	// Get pending migrations
	pending := m.getPendingMigrations(ran)
	if len(pending) == 0 {
		m.fireEvent(NewNoPendingMigrations("up"))
		return nil, nil
	}

	// Get the next batch number
	batch, err := m.repository.GetNextBatchNumber()
	if err != nil {
		return nil, err
	}

	// Fire migrations started event
	m.fireEvent(NewMigrationsStarted("up"))

	// Execute each pending migration
	executed := make([]string, 0, len(pending))
	for _, name := range pending {
		if err := m.runUp(name, batch, opts.Pretend); err != nil {
			return executed, err
		}
		executed = append(executed, name)

		// In step mode, increment batch for each migration
		if opts.Step {
			batch++
		}
	}

	// Fire migrations ended event
	m.fireEvent(NewMigrationsEnded("up"))

	return executed, nil
}

// runUp executes a single migration's Up method.
func (m *Migrator) runUp(name string, batch int, pretend bool) error {
	migration, ok := m.GetMigration(name)
	if !ok {
		return NewMigrationError(name, "up", ErrMigrationNotRegistered)
	}

	// Fire migration started event
	m.fireEvent(NewMigrationStarted(name, "up"))

	if pretend {
		return m.pretendToRun(name, migration, "up")
	}

	// Run the migration
	if err := m.runMigration(migration, "up"); err != nil {
		return NewMigrationError(name, "up", err)
	}

	// Log the migration
	if err := m.repository.Log(name, batch); err != nil {
		return err
	}

	// Fire migration ended event
	m.fireEvent(NewMigrationEnded(name, "up"))

	return nil
}

// runMigration executes a migration with optional transaction support.
func (m *Migrator) runMigration(migration Migration, method string) error {
	db := m.db

	// Get the appropriate method
	var callback func() error
	if method == "up" {
		callback = func() error { return migration.Up(db) }
	} else {
		callback = func() error { return migration.Down(db) }
	}

	// Run within transaction if specified
	if migration.WithinTransaction() {
		return db.Transaction(func(tx *gorm.DB) error {
			// Create a temporary migration wrapper with the transaction
			if method == "up" {
				return migration.Up(tx)
			}
			return migration.Down(tx)
		})
	}

	return callback()
}

// pretendToRun captures SQL statements without executing them.
// It uses GORM's DryRun mode to capture SQL that would be executed.
func (m *Migrator) pretendToRun(name string, migration Migration, method string) error {
	// Capture SQL using GORM's DryRun mode
	statements := m.getQueries(migration, method)

	// Output the captured statements
	if m.output != nil {
		m.output.Write(name, statements)
	}

	// Fire migration ended event even in pretend mode
	m.fireEvent(NewMigrationEnded(name, method))

	return nil
}

// getQueries captures SQL statements that would be executed by a migration.
// It uses a custom logger to intercept SQL statements.
func (m *Migrator) getQueries(migration Migration, method string) []string {
	// Create a SQL collector
	collector := &sqlCollector{statements: make([]string, 0)}

	// Create a session with DryRun mode and custom logger
	dryRunDB := m.db.Session(&gorm.Session{
		DryRun: true,
		Logger: collector,
	})

	// Run the migration in dry run mode
	if method == "up" {
		_ = migration.Up(dryRunDB)
	} else {
		_ = migration.Down(dryRunDB)
	}

	return collector.statements
}

// sqlCollector implements gorm.Logger to capture SQL statements.
type sqlCollector struct {
	statements []string
}

// LogMode implements gorm.Logger interface.
func (c *sqlCollector) LogMode(_ gormLogger.LogLevel) gormLogger.Interface {
	return c
}

// Info implements gorm.Logger interface.
func (c *sqlCollector) Info(_ context.Context, _ string, _ ...interface{}) {}

// Warn implements gorm.Logger interface.
func (c *sqlCollector) Warn(_ context.Context, _ string, _ ...interface{}) {}

// Error implements gorm.Logger interface.
func (c *sqlCollector) Error(_ context.Context, _ string, _ ...interface{}) {}

// Trace implements gorm.Logger interface and captures SQL statements.
func (c *sqlCollector) Trace(_ context.Context, _ time.Time, fc func() (sql string, rowsAffected int64), _ error) {
	sql, _ := fc()
	if sql != "" {
		c.statements = append(c.statements, sql)
	}
}

// Rollback reverts migrations based on the provided options.
// By default, it rolls back the last batch of migrations.
// With opts.Steps > 0, it rolls back exactly N migrations.
// With opts.Batch > 0, it rolls back all migrations in that specific batch.
func (m *Migrator) Rollback(opts RollbackOptions) ([]string, error) {
	// Get migrations to rollback based on options
	var migrations []MigrationRecord
	var err error

	if opts.Steps > 0 {
		// Rollback by number of steps
		migrations, err = m.repository.GetMigrations(opts.Steps)
	} else if opts.Batch > 0 {
		// Rollback by specific batch
		migrations, err = m.repository.GetMigrationsByBatch(opts.Batch)
	} else {
		// Rollback last batch (default)
		migrations, err = m.repository.GetLast()
	}

	if err != nil {
		return nil, err
	}

	if len(migrations) == 0 {
		m.fireEvent(NewNoPendingMigrations("down"))
		return nil, nil
	}

	// Fire migrations started event
	m.fireEvent(NewMigrationsStarted("down"))

	// Execute rollback for each migration
	rolledBack := make([]string, 0, len(migrations))
	for _, record := range migrations {
		if err := m.runDown(record.Migration, opts.Pretend); err != nil {
			return rolledBack, err
		}
		rolledBack = append(rolledBack, record.Migration)
	}

	// Fire migrations ended event
	m.fireEvent(NewMigrationsEnded("down"))

	return rolledBack, nil
}

// runDown executes a single migration's Down method.
func (m *Migrator) runDown(name string, pretend bool) error {
	migration, ok := m.GetMigration(name)
	if !ok {
		return NewMigrationError(name, "down", ErrMigrationNotRegistered)
	}

	// Fire migration started event
	m.fireEvent(NewMigrationStarted(name, "down"))

	if pretend {
		return m.pretendToRun(name, migration, "down")
	}

	// Run the migration rollback
	if err := m.runMigration(migration, "down"); err != nil {
		return NewMigrationError(name, "down", err)
	}

	// Delete the migration record
	if err := m.repository.Delete(name); err != nil {
		return err
	}

	// Fire migration ended event
	m.fireEvent(NewMigrationEnded(name, "down"))

	return nil
}

// Reset reverts all migrations in reverse order.
// This effectively returns the database to its initial state.
func (m *Migrator) Reset(pretend bool) ([]string, error) {
	// Get all ran migrations
	ran, err := m.repository.GetRan()
	if err != nil {
		return nil, err
	}

	if len(ran) == 0 {
		m.fireEvent(NewNoPendingMigrations("down"))
		return nil, nil
	}

	// Reverse the order so we rollback in reverse order
	reversed := make([]string, len(ran))
	for i, name := range ran {
		reversed[len(ran)-1-i] = name
	}

	// Fire migrations started event
	m.fireEvent(NewMigrationsStarted("down"))

	// Execute rollback for each migration in reverse order
	rolledBack := make([]string, 0, len(reversed))
	for _, name := range reversed {
		if err := m.runDown(name, pretend); err != nil {
			return rolledBack, err
		}
		rolledBack = append(rolledBack, name)
	}

	// Fire migrations ended event
	m.fireEvent(NewMigrationsEnded("down"))

	return rolledBack, nil
}

// Fresh drops all tables and re-runs all migrations.
// This is useful for completely resetting the database.
func (m *Migrator) Fresh(opts MigratorOptions) ([]string, error) {
	// Drop all tables
	if err := m.dropAllTables(); err != nil {
		return nil, err
	}

	// Delete the repository and recreate it
	if m.repository.RepositoryExists() {
		if err := m.repository.DeleteRepository(); err != nil {
			return nil, err
		}
	}

	// Run all migrations
	return m.Run(opts)
}

// dropAllTables drops all tables in the database.
func (m *Migrator) dropAllTables() error {
	// Get all table names
	var tables []string
	dialect := m.db.Dialector.Name()

	switch dialect {
	case "mysql":
		if err := m.db.Raw("SHOW TABLES").Scan(&tables).Error; err != nil {
			return err
		}
	case "postgres":
		if err := m.db.Raw(`
			SELECT tablename FROM pg_tables
			WHERE schemaname = 'public'
		`).Scan(&tables).Error; err != nil {
			return err
		}
	case "sqlite":
		if err := m.db.Raw(`
			SELECT name FROM sqlite_master
			WHERE type='table' AND name NOT LIKE 'sqlite_%'
		`).Scan(&tables).Error; err != nil {
			return err
		}
	default:
		// Try SQLite syntax as fallback
		if err := m.db.Raw(`
			SELECT name FROM sqlite_master
			WHERE type='table' AND name NOT LIKE 'sqlite_%'
		`).Scan(&tables).Error; err != nil {
			return err
		}
	}

	// Drop each table
	for _, table := range tables {
		if err := m.db.Migrator().DropTable(table); err != nil {
			return err
		}
	}

	return nil
}
