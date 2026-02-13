package migration

import (
	"context"
	"sync"
	"testing"

	"github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/kest-labs/kest/api/internal/infra/migration/schema"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Integration test for complete migration workflow:
// create → migrate → rollback → fresh
// This validates the entire migration system works end-to-end.

// integrationEventCollector collects events for integration testing
type integrationEventCollector struct {
	mu     sync.Mutex
	events []events.Event
}

func newIntegrationEventCollector() *integrationEventCollector {
	return &integrationEventCollector{events: make([]events.Event, 0)}
}

func (c *integrationEventCollector) handler(ctx context.Context, event events.Event) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, event)
	return nil
}

func (c *integrationEventCollector) getEvents() []events.Event {
	c.mu.Lock()
	defer c.mu.Unlock()
	result := make([]events.Event, len(c.events))
	copy(result, c.events)
	return result
}

func (c *integrationEventCollector) clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = make([]events.Event, 0)
}

// setupIntegrationTest creates a fresh database and migrator for integration testing
func setupIntegrationTest(t *testing.T) (*Migrator, *gorm.DB, *events.EventBus, *integrationEventCollector) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	repo := NewDatabaseRepository(db, "migrations")
	eventBus := events.NewEventBus()
	migrator := NewMigrator(repo, db, eventBus)

	collector := newIntegrationEventCollector()
	eventBus.Subscribe("migration.*", collector.handler)

	return migrator, db, eventBus, collector
}

// createTestMigration creates a migration that creates a table using schema builder
func createTestMigration(tableName string) *testSchemaMigration {
	return &testSchemaMigration{
		BaseMigration: BaseMigration{UseTransaction: true},
		tableName:     tableName,
	}
}

// testSchemaMigration is a migration that uses the schema builder
type testSchemaMigration struct {
	BaseMigration
	tableName string
}

func (m *testSchemaMigration) Up(db *gorm.DB) error {
	builder := schema.NewBuilder(db)
	return builder.Create(m.tableName, func(bp *schema.Blueprint) {
		bp.ID()
		bp.String("name")
		bp.String("email", 100)
		bp.Boolean("active").Default(true)
		bp.Timestamps()
	})
}

func (m *testSchemaMigration) Down(db *gorm.DB) error {
	builder := schema.NewBuilder(db)
	return builder.Drop(m.tableName)
}

// TestIntegration_CompleteWorkflow tests the complete migration workflow
func TestIntegration_CompleteWorkflow(t *testing.T) {
	migrator, db, _, collector := setupIntegrationTest(t)

	// Register migrations
	migrator.Register("2024_01_01_000000_create_users_table", createTestMigration("users"))
	migrator.Register("2024_01_01_000001_create_posts_table", createTestMigration("posts"))
	migrator.Register("2024_01_01_000002_create_comments_table", createTestMigration("comments"))

	// Step 1: Run migrations
	t.Run("Step1_RunMigrations", func(t *testing.T) {
		collector.clear()

		executed, err := migrator.Run(NewMigratorOptions())
		require.NoError(t, err)
		assert.Len(t, executed, 3)

		// Verify tables were created
		assert.True(t, db.Migrator().HasTable("users"))
		assert.True(t, db.Migrator().HasTable("posts"))
		assert.True(t, db.Migrator().HasTable("comments"))

		// Verify columns exist
		assert.True(t, db.Migrator().HasColumn("users", "id"))
		assert.True(t, db.Migrator().HasColumn("users", "name"))
		assert.True(t, db.Migrator().HasColumn("users", "email"))
		assert.True(t, db.Migrator().HasColumn("users", "active"))
		assert.True(t, db.Migrator().HasColumn("users", "created_at"))
		assert.True(t, db.Migrator().HasColumn("users", "updated_at"))

		// Verify migrations were logged
		ran, err := migrator.Repository().GetRan()
		require.NoError(t, err)
		assert.Len(t, ran, 3)

		// Verify events were fired
		collectedEvents := collector.getEvents()
		assert.NotEmpty(t, collectedEvents)

		// First event should be MigrationsStarted
		_, ok := collectedEvents[0].(*MigrationsStarted)
		assert.True(t, ok, "First event should be MigrationsStarted")

		// Last event should be MigrationsEnded
		_, ok = collectedEvents[len(collectedEvents)-1].(*MigrationsEnded)
		assert.True(t, ok, "Last event should be MigrationsEnded")
	})

	// Step 2: Rollback last batch
	t.Run("Step2_RollbackLastBatch", func(t *testing.T) {
		collector.clear()

		rolledBack, err := migrator.Rollback(NewRollbackOptions())
		require.NoError(t, err)
		assert.Len(t, rolledBack, 3) // All 3 were in batch 1

		// Verify tables were dropped
		assert.False(t, db.Migrator().HasTable("users"))
		assert.False(t, db.Migrator().HasTable("posts"))
		assert.False(t, db.Migrator().HasTable("comments"))

		// Verify migrations were removed from repository
		ran, err := migrator.Repository().GetRan()
		require.NoError(t, err)
		assert.Empty(t, ran)

		// Verify events were fired
		collectedEvents := collector.getEvents()
		assert.NotEmpty(t, collectedEvents)
	})

	// Step 3: Run migrations again with step mode
	t.Run("Step3_RunWithStepMode", func(t *testing.T) {
		collector.clear()

		opts := NewMigratorOptions().WithStep()
		executed, err := migrator.Run(opts)
		require.NoError(t, err)
		assert.Len(t, executed, 3)

		// Verify each migration has a unique batch number
		batches, err := migrator.Repository().GetMigrationBatches()
		require.NoError(t, err)

		batchSet := make(map[int]bool)
		for _, batch := range batches {
			assert.False(t, batchSet[batch], "Each migration should have unique batch")
			batchSet[batch] = true
		}
	})

	// Step 4: Rollback by steps
	t.Run("Step4_RollbackBySteps", func(t *testing.T) {
		collector.clear()

		opts := NewRollbackOptions().WithSteps(2)
		rolledBack, err := migrator.Rollback(opts)
		require.NoError(t, err)
		assert.Len(t, rolledBack, 2)

		// Verify only 1 migration remains
		ran, err := migrator.Repository().GetRan()
		require.NoError(t, err)
		assert.Len(t, ran, 1)

		// Verify users table still exists (first migration)
		assert.True(t, db.Migrator().HasTable("users"))
		assert.False(t, db.Migrator().HasTable("posts"))
		assert.False(t, db.Migrator().HasTable("comments"))
	})

	// Step 5: Reset all migrations
	t.Run("Step5_ResetAll", func(t *testing.T) {
		collector.clear()

		rolledBack, err := migrator.Reset(false)
		require.NoError(t, err)
		assert.Len(t, rolledBack, 1) // Only 1 remaining

		// Verify all tables are gone
		assert.False(t, db.Migrator().HasTable("users"))
		assert.False(t, db.Migrator().HasTable("posts"))
		assert.False(t, db.Migrator().HasTable("comments"))

		// Verify repository is empty
		ran, err := migrator.Repository().GetRan()
		require.NoError(t, err)
		assert.Empty(t, ran)
	})

	// Step 6: Fresh migrations
	t.Run("Step6_FreshMigrations", func(t *testing.T) {
		collector.clear()

		// First run some migrations
		_, err := migrator.Run(NewMigratorOptions())
		require.NoError(t, err)

		// Now run fresh
		collector.clear()
		executed, err := migrator.Fresh(NewMigratorOptions())
		require.NoError(t, err)
		assert.Len(t, executed, 3)

		// Verify tables exist
		assert.True(t, db.Migrator().HasTable("users"))
		assert.True(t, db.Migrator().HasTable("posts"))
		assert.True(t, db.Migrator().HasTable("comments"))

		// Verify migrations are logged
		ran, err := migrator.Repository().GetRan()
		require.NoError(t, err)
		assert.Len(t, ran, 3)
	})
}

// TestIntegration_PretendMode tests that pretend mode doesn't modify the database
func TestIntegration_PretendMode(t *testing.T) {
	migrator, db, _, _ := setupIntegrationTest(t)

	// Register migrations
	migrator.Register("2024_01_01_000000_create_users_table", createTestMigration("users"))

	// Run in pretend mode
	opts := NewMigratorOptions().WithPretend()
	executed, err := migrator.Run(opts)
	require.NoError(t, err)
	assert.Len(t, executed, 1)

	// Verify table was NOT created
	assert.False(t, db.Migrator().HasTable("users"))

	// Verify migration was NOT logged
	ran, err := migrator.Repository().GetRan()
	require.NoError(t, err)
	assert.Empty(t, ran)
}

// TestIntegration_EventFiring tests that all events are fired correctly
func TestIntegration_EventFiring(t *testing.T) {
	migrator, _, _, collector := setupIntegrationTest(t)

	// Register migrations
	migrator.Register("2024_01_01_000000_create_users_table", createTestMigration("users"))
	migrator.Register("2024_01_01_000001_create_posts_table", createTestMigration("posts"))

	// Run migrations
	_, err := migrator.Run(NewMigratorOptions())
	require.NoError(t, err)

	// Verify event sequence
	collectedEvents := collector.getEvents()

	// Expected sequence:
	// 1. MigrationsStarted
	// 2. MigrationStarted (users)
	// 3. MigrationEnded (users)
	// 4. MigrationStarted (posts)
	// 5. MigrationEnded (posts)
	// 6. MigrationsEnded

	assert.GreaterOrEqual(t, len(collectedEvents), 6)

	// Verify first event
	migrationsStarted, ok := collectedEvents[0].(*MigrationsStarted)
	assert.True(t, ok)
	assert.Equal(t, "up", migrationsStarted.Direction)

	// Verify last event
	migrationsEnded, ok := collectedEvents[len(collectedEvents)-1].(*MigrationsEnded)
	assert.True(t, ok)
	assert.Equal(t, "up", migrationsEnded.Direction)

	// Verify MigrationStarted events
	migrationStartedCount := 0
	migrationEndedCount := 0
	for _, event := range collectedEvents {
		if _, ok := event.(*MigrationStarted); ok {
			migrationStartedCount++
		}
		if _, ok := event.(*MigrationEnded); ok {
			migrationEndedCount++
		}
	}
	assert.Equal(t, 2, migrationStartedCount)
	assert.Equal(t, 2, migrationEndedCount)
}

// TestIntegration_NoPendingMigrationsEvent tests that NoPendingMigrations event is fired
func TestIntegration_NoPendingMigrationsEvent(t *testing.T) {
	migrator, _, _, collector := setupIntegrationTest(t)

	// Run with no migrations registered
	_, err := migrator.Run(NewMigratorOptions())
	require.NoError(t, err)

	// Verify NoPendingMigrations event was fired
	collectedEvents := collector.getEvents()
	assert.Len(t, collectedEvents, 1)

	noPending, ok := collectedEvents[0].(*NoPendingMigrations)
	assert.True(t, ok)
	assert.Equal(t, "up", noPending.Direction)
}

// TestIntegration_ErrorHandling tests that errors are properly wrapped
func TestIntegration_ErrorHandling(t *testing.T) {
	migrator, _, _, _ := setupIntegrationTest(t)

	// Register a failing migration
	migrator.Register("2024_01_01_000000_failing_migration", &failingTestMigration{
		BaseMigration: BaseMigration{UseTransaction: false},
		errMsg:        "intentional failure",
	})

	// Run migrations
	_, err := migrator.Run(NewMigratorOptions())
	require.Error(t, err)

	// Verify error is a MigrationError
	var migErr *MigrationError
	assert.ErrorAs(t, err, &migErr)
	assert.Equal(t, "2024_01_01_000000_failing_migration", migErr.Migration)
	assert.Equal(t, "up", migErr.Method)
}

// failingTestMigration is a migration that always fails
type failingTestMigration struct {
	BaseMigration
	errMsg string
}

func (m *failingTestMigration) Up(db *gorm.DB) error {
	return &MigrationError{
		Migration: "failing",
		Method:    "up",
		Err:       nil,
	}
}

func (m *failingTestMigration) Down(db *gorm.DB) error {
	return &MigrationError{
		Migration: "failing",
		Method:    "down",
		Err:       nil,
	}
}

// TestIntegration_TransactionSupport tests that transactions work correctly
func TestIntegration_TransactionSupport(t *testing.T) {
	migrator, db, _, _ := setupIntegrationTest(t)

	// Register a migration with transaction support
	migrator.Register("2024_01_01_000000_tx_migration", &transactionTestMigration{
		BaseMigration: BaseMigration{UseTransaction: true},
	})

	// Run migrations
	_, err := migrator.Run(NewMigratorOptions())
	require.NoError(t, err)

	// Verify table was created
	assert.True(t, db.Migrator().HasTable("tx_test"))

	// Verify data was inserted
	var count int64
	db.Raw("SELECT COUNT(*) FROM tx_test").Scan(&count)
	assert.Equal(t, int64(1), count)
}

// transactionTestMigration is a migration that uses transactions
type transactionTestMigration struct {
	BaseMigration
}

func (m *transactionTestMigration) Up(db *gorm.DB) error {
	// Create table
	if err := db.Exec("CREATE TABLE tx_test (id INTEGER PRIMARY KEY, value TEXT)").Error; err != nil {
		return err
	}
	// Insert data
	return db.Exec("INSERT INTO tx_test (id, value) VALUES (1, 'test')").Error
}

func (m *transactionTestMigration) Down(db *gorm.DB) error {
	return db.Exec("DROP TABLE IF EXISTS tx_test").Error
}

// TestIntegration_SchemaBuilder tests the schema builder integration
func TestIntegration_SchemaBuilder(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	builder := schema.NewBuilder(db)

	// Create a table with various column types
	err = builder.Create("test_schema", func(bp *schema.Blueprint) {
		bp.ID()
		bp.String("name")
		bp.String("email", 100)
		bp.Text("bio")
		bp.Integer("age")
		bp.BigInteger("big_number")
		bp.Boolean("active").Default(true)
		bp.JSON("metadata")
		bp.Timestamps()
		bp.SoftDeletes()
	})
	require.NoError(t, err)

	// Verify table exists
	assert.True(t, builder.HasTable("test_schema"))

	// Verify all columns exist
	columns := []string{"id", "name", "email", "bio", "age", "big_number", "active", "metadata", "created_at", "updated_at", "deleted_at"}
	for _, col := range columns {
		assert.True(t, builder.HasColumn("test_schema", col), "Column %s should exist", col)
	}

	// Modify table
	err = builder.Table("test_schema", func(bp *schema.Blueprint) {
		bp.String("phone", 20)
	})
	require.NoError(t, err)

	// Verify new column exists
	assert.True(t, builder.HasColumn("test_schema", "phone"))

	// Rename table
	err = builder.Rename("test_schema", "renamed_schema")
	require.NoError(t, err)

	assert.False(t, builder.HasTable("test_schema"))
	assert.True(t, builder.HasTable("renamed_schema"))

	// Drop table
	err = builder.Drop("renamed_schema")
	require.NoError(t, err)

	assert.False(t, builder.HasTable("renamed_schema"))
}

// TestIntegration_RepositoryOperations tests repository operations
func TestIntegration_RepositoryOperations(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	repo := NewDatabaseRepository(db, "migrations")

	// Repository should not exist initially
	assert.False(t, repo.RepositoryExists())

	// Create repository
	err = repo.CreateRepository()
	require.NoError(t, err)

	// Repository should exist now
	assert.True(t, repo.RepositoryExists())

	// Log some migrations
	err = repo.Log("migration_a", 1)
	require.NoError(t, err)
	err = repo.Log("migration_b", 1)
	require.NoError(t, err)
	err = repo.Log("migration_c", 2)
	require.NoError(t, err)

	// Test GetRan
	ran, err := repo.GetRan()
	require.NoError(t, err)
	assert.Len(t, ran, 3)

	// Test GetLast
	last, err := repo.GetLast()
	require.NoError(t, err)
	assert.Len(t, last, 1)
	assert.Equal(t, "migration_c", last[0].Migration)
	assert.Equal(t, 2, last[0].Batch)

	// Test GetMigrationsByBatch
	batch1, err := repo.GetMigrationsByBatch(1)
	require.NoError(t, err)
	assert.Len(t, batch1, 2)

	// Test GetMigrationBatches
	batches, err := repo.GetMigrationBatches()
	require.NoError(t, err)
	assert.Equal(t, 1, batches["migration_a"])
	assert.Equal(t, 1, batches["migration_b"])
	assert.Equal(t, 2, batches["migration_c"])

	// Test GetNextBatchNumber
	next, err := repo.GetNextBatchNumber()
	require.NoError(t, err)
	assert.Equal(t, 3, next)

	// Test Delete
	err = repo.Delete("migration_c")
	require.NoError(t, err)

	ran, err = repo.GetRan()
	require.NoError(t, err)
	assert.Len(t, ran, 2)

	// Test DeleteRepository
	err = repo.DeleteRepository()
	require.NoError(t, err)

	assert.False(t, repo.RepositoryExists())
}

// TestIntegration_RollbackByBatch tests rollback by specific batch
func TestIntegration_RollbackByBatch(t *testing.T) {
	migrator, db, _, _ := setupIntegrationTest(t)

	// Register migrations
	migrator.Register("2024_01_01_000000_create_users_table", createTestMigration("users"))
	migrator.Register("2024_01_01_000001_create_posts_table", createTestMigration("posts"))
	migrator.Register("2024_01_01_000002_create_comments_table", createTestMigration("comments"))

	// Run with step mode to get different batches
	opts := NewMigratorOptions().WithStep()
	_, err := migrator.Run(opts)
	require.NoError(t, err)

	// Verify all tables exist
	assert.True(t, db.Migrator().HasTable("users"))
	assert.True(t, db.Migrator().HasTable("posts"))
	assert.True(t, db.Migrator().HasTable("comments"))

	// Rollback batch 2 (posts)
	rollbackOpts := NewRollbackOptions().WithBatch(2)
	rolledBack, err := migrator.Rollback(rollbackOpts)
	require.NoError(t, err)
	assert.Len(t, rolledBack, 1)

	// Verify posts table is gone but others remain
	assert.True(t, db.Migrator().HasTable("users"))
	assert.False(t, db.Migrator().HasTable("posts"))
	assert.True(t, db.Migrator().HasTable("comments"))
}
