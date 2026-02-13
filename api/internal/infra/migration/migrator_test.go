package migration

import (
	"context"
	"errors"
	"slices"
	"sort"
	"sync"
	"testing"

	"github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/glebarez/sqlite"
	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testMigration is a simple migration for testing
type testMigration struct {
	BaseMigration
	upFunc   func(db *gorm.DB) error
	downFunc func(db *gorm.DB) error
}

func (m *testMigration) Up(db *gorm.DB) error {
	if m.upFunc != nil {
		return m.upFunc(db)
	}
	return nil
}

func (m *testMigration) Down(db *gorm.DB) error {
	if m.downFunc != nil {
		return m.downFunc(db)
	}
	return nil
}

// newTestMigration creates a simple test migration
func newTestMigration() *testMigration {
	return &testMigration{
		BaseMigration: BaseMigration{UseTransaction: false},
	}
}

// newTestMigrationWithTransaction creates a test migration that runs in a transaction
func newTestMigrationWithTransaction() *testMigration {
	return &testMigration{
		BaseMigration: BaseMigration{UseTransaction: true},
	}
}

// failingMigration is a migration that always fails
type failingMigration struct {
	BaseMigration
	errMsg string
}

func (m *failingMigration) Up(db *gorm.DB) error {
	return errors.New(m.errMsg)
}

func (m *failingMigration) Down(db *gorm.DB) error {
	return errors.New(m.errMsg)
}

// setupMigratorTest creates a migrator with fresh database and repository
func setupMigratorTest(t *testing.T) (*Migrator, *gorm.DB, *events.EventBus) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	repo := NewDatabaseRepository(db, "migrations")
	eventBus := events.NewEventBus()
	migrator := NewMigrator(repo, db, eventBus)

	return migrator, db, eventBus
}

// eventCollector collects events for testing
type eventCollector struct {
	mu     sync.Mutex
	events []events.Event
}

func newEventCollector() *eventCollector {
	return &eventCollector{events: make([]events.Event, 0)}
}

func (c *eventCollector) handler(ctx context.Context, event events.Event) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, event)
	return nil
}

func (c *eventCollector) getEvents() []events.Event {
	c.mu.Lock()
	defer c.mu.Unlock()
	result := make([]events.Event, len(c.events))
	copy(result, c.events)
	return result
}

func (c *eventCollector) clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = make([]events.Event, 0)
}

// Feature: migration-system, Property 5: Migrator Run Executes Pending
// For any set of registered migrations where some are already ran,
// Run() should execute only the pending migrations in alphabetical order
// and mark them as ran.
func TestProperty5_MigratorRunExecutesPending(t *testing.T) {
	parameters := gopter.DefaultTestParameters()
	parameters.MinSuccessfulTests = 100
	properties := gopter.NewProperties(parameters)

	properties.Property("Run executes only pending migrations in order", prop.ForAll(
		func(allMigrations []string, alreadyRanCount int) bool {
			// Setup fresh migrator
			migrator, _, _ := setupMigratorTest(t)

			// Deduplicate and sort migration names
			seen := make(map[string]bool)
			uniqueMigrations := make([]string, 0)
			for _, name := range allMigrations {
				if !seen[name] {
					seen[name] = true
					uniqueMigrations = append(uniqueMigrations, name)
				}
			}
			sort.Strings(uniqueMigrations)

			if len(uniqueMigrations) == 0 {
				return true // Empty case is valid
			}

			// Ensure alreadyRanCount is within bounds
			if alreadyRanCount > len(uniqueMigrations) {
				alreadyRanCount = len(uniqueMigrations)
			}
			if alreadyRanCount < 0 {
				alreadyRanCount = 0
			}

			// Register all migrations
			for _, name := range uniqueMigrations {
				migrator.Register(name, newTestMigration())
			}

			// Create repository
			if err := migrator.Repository().CreateRepository(); err != nil {
				return false
			}

			// Mark some as already ran
			for i := 0; i < alreadyRanCount; i++ {
				if err := migrator.Repository().Log(uniqueMigrations[i], 1); err != nil {
					return false
				}
			}

			// Run migrations
			executed, err := migrator.Run(NewMigratorOptions())
			if err != nil {
				return false
			}

			// Expected pending migrations (those not already ran)
			expectedPending := uniqueMigrations[alreadyRanCount:]

			// Verify executed matches expected pending
			if len(executed) != len(expectedPending) {
				return false
			}

			// Verify order (should be alphabetical)
			for i, name := range executed {
				if name != expectedPending[i] {
					return false
				}
			}

			// Verify all are now marked as ran
			ran, err := migrator.Repository().GetRan()
			if err != nil {
				return false
			}

			return len(ran) == len(uniqueMigrations)
		},
		gen.SliceOfN(10, migrationNameGen()),
		gen.IntRange(0, 10),
	))

	properties.TestingRun(t)
}

// Feature: migration-system, Property 6: Migrator Rollback By Batch
// For any set of ran migrations, Rollback() with no options should revert
// only migrations from the last batch, and those migrations should no longer
// appear in GetRan().
func TestProperty6_MigratorRollbackByBatch(t *testing.T) {
	parameters := gopter.DefaultTestParameters()
	parameters.MinSuccessfulTests = 100
	properties := gopter.NewProperties(parameters)

	properties.Property("Rollback reverts only last batch migrations", prop.ForAll(
		func(batch1Migrations []string, batch2Migrations []string) bool {
			// Setup fresh migrator
			migrator, _, _ := setupMigratorTest(t)

			// Deduplicate migrations
			seen := make(map[string]bool)
			uniqueBatch1 := make([]string, 0)
			for _, name := range batch1Migrations {
				if !seen[name] {
					seen[name] = true
					uniqueBatch1 = append(uniqueBatch1, name)
				}
			}
			uniqueBatch2 := make([]string, 0)
			for _, name := range batch2Migrations {
				if !seen[name] {
					seen[name] = true
					uniqueBatch2 = append(uniqueBatch2, name)
				}
			}

			if len(uniqueBatch1) == 0 && len(uniqueBatch2) == 0 {
				return true // Empty case
			}

			// Register all migrations
			for _, name := range uniqueBatch1 {
				migrator.Register(name, newTestMigration())
			}
			for _, name := range uniqueBatch2 {
				migrator.Register(name, newTestMigration())
			}

			// Create repository
			if err := migrator.Repository().CreateRepository(); err != nil {
				return false
			}

			// Log batch 1 migrations
			for _, name := range uniqueBatch1 {
				if err := migrator.Repository().Log(name, 1); err != nil {
					return false
				}
			}

			// Log batch 2 migrations
			for _, name := range uniqueBatch2 {
				if err := migrator.Repository().Log(name, 2); err != nil {
					return false
				}
			}

			// Rollback (should only rollback batch 2)
			rolledBack, err := migrator.Rollback(NewRollbackOptions())
			if err != nil {
				return false
			}

			// Determine expected rollback
			var expectedRollback []string
			if len(uniqueBatch2) > 0 {
				expectedRollback = uniqueBatch2
			} else if len(uniqueBatch1) > 0 {
				expectedRollback = uniqueBatch1
			}

			// Verify rolled back count
			if len(rolledBack) != len(expectedRollback) {
				return false
			}

			// Verify remaining migrations
			ran, err := migrator.Repository().GetRan()
			if err != nil {
				return false
			}

			// If batch 2 was rolled back, batch 1 should remain
			if len(uniqueBatch2) > 0 {
				return len(ran) == len(uniqueBatch1)
			}

			// If only batch 1 existed and was rolled back, nothing should remain
			return len(ran) == 0
		},
		gen.SliceOfN(5, migrationNameGen()),
		gen.SliceOfN(5, migrationNameGen()),
	))

	properties.TestingRun(t)
}

// Feature: migration-system, Property 7: Migrator Rollback By Steps
// For any positive integer N and set of ran migrations with at least N migrations,
// Rollback(steps=N) should revert exactly N migrations in reverse order.
func TestProperty7_MigratorRollbackBySteps(t *testing.T) {
	parameters := gopter.DefaultTestParameters()
	parameters.MinSuccessfulTests = 100
	properties := gopter.NewProperties(parameters)

	properties.Property("Rollback with steps reverts exactly N migrations", prop.ForAll(
		func(migrations []string, steps int) bool {
			// Setup fresh migrator
			migrator, _, _ := setupMigratorTest(t)

			// Deduplicate migrations
			seen := make(map[string]bool)
			uniqueMigrations := make([]string, 0)
			for _, name := range migrations {
				if !seen[name] {
					seen[name] = true
					uniqueMigrations = append(uniqueMigrations, name)
				}
			}

			if len(uniqueMigrations) == 0 {
				return true // Empty case
			}

			// Ensure steps is within bounds
			if steps > len(uniqueMigrations) {
				steps = len(uniqueMigrations)
			}
			if steps < 1 {
				steps = 1
			}

			// Register all migrations
			for _, name := range uniqueMigrations {
				migrator.Register(name, newTestMigration())
			}

			// Create repository
			if err := migrator.Repository().CreateRepository(); err != nil {
				return false
			}

			// Log all migrations in batch 1
			for _, name := range uniqueMigrations {
				if err := migrator.Repository().Log(name, 1); err != nil {
					return false
				}
			}

			// Rollback by steps
			opts := NewRollbackOptions().WithSteps(steps)
			rolledBack, err := migrator.Rollback(opts)
			if err != nil {
				return false
			}

			// Verify exactly N migrations were rolled back
			if len(rolledBack) != steps {
				return false
			}

			// Verify remaining count
			ran, err := migrator.Repository().GetRan()
			if err != nil {
				return false
			}

			return len(ran) == len(uniqueMigrations)-steps
		},
		gen.SliceOfN(10, migrationNameGen()),
		gen.IntRange(1, 10),
	))

	properties.TestingRun(t)
}

// Feature: migration-system, Property 8: Migrator Reset Reverses All
// For any set of ran migrations, Reset() should revert all migrations
// in reverse order, leaving GetRan() empty.
func TestProperty8_MigratorResetReversesAll(t *testing.T) {
	parameters := gopter.DefaultTestParameters()
	parameters.MinSuccessfulTests = 100
	properties := gopter.NewProperties(parameters)

	properties.Property("Reset reverts all migrations leaving repository empty", prop.ForAll(
		func(migrations []string) bool {
			// Setup fresh migrator
			migrator, _, _ := setupMigratorTest(t)

			// Deduplicate migrations
			seen := make(map[string]bool)
			uniqueMigrations := make([]string, 0)
			for _, name := range migrations {
				if !seen[name] {
					seen[name] = true
					uniqueMigrations = append(uniqueMigrations, name)
				}
			}

			// Register all migrations
			for _, name := range uniqueMigrations {
				migrator.Register(name, newTestMigration())
			}

			// Create repository
			if err := migrator.Repository().CreateRepository(); err != nil {
				return false
			}

			// Log all migrations
			for i, name := range uniqueMigrations {
				if err := migrator.Repository().Log(name, i+1); err != nil {
					return false
				}
			}

			// Reset
			rolledBack, err := migrator.Reset(false)
			if err != nil {
				return false
			}

			// Verify all were rolled back
			if len(rolledBack) != len(uniqueMigrations) {
				return false
			}

			// Verify repository is empty
			ran, err := migrator.Repository().GetRan()
			if err != nil {
				return false
			}

			return len(ran) == 0
		},
		gen.SliceOfN(10, migrationNameGen()),
	))

	properties.TestingRun(t)
}

// Feature: migration-system, Property 9: Migrator Step Mode Batch Increment
// For any set of pending migrations run with step=true, each migration
// should have a unique, incrementing batch number.
func TestProperty9_MigratorStepModeBatchIncrement(t *testing.T) {
	parameters := gopter.DefaultTestParameters()
	parameters.MinSuccessfulTests = 100
	properties := gopter.NewProperties(parameters)

	properties.Property("Step mode assigns unique incrementing batch numbers", prop.ForAll(
		func(migrations []string) bool {
			// Setup fresh migrator
			migrator, _, _ := setupMigratorTest(t)

			// Deduplicate migrations
			seen := make(map[string]bool)
			uniqueMigrations := make([]string, 0)
			for _, name := range migrations {
				if !seen[name] {
					seen[name] = true
					uniqueMigrations = append(uniqueMigrations, name)
				}
			}

			if len(uniqueMigrations) == 0 {
				return true // Empty case
			}

			// Register all migrations
			for _, name := range uniqueMigrations {
				migrator.Register(name, newTestMigration())
			}

			// Create repository
			if err := migrator.Repository().CreateRepository(); err != nil {
				return false
			}

			// Run with step mode
			opts := NewMigratorOptions().WithStep()
			_, err := migrator.Run(opts)
			if err != nil {
				return false
			}

			// Get batch numbers
			batches, err := migrator.Repository().GetMigrationBatches()
			if err != nil {
				return false
			}

			// Verify each migration has a unique batch number
			batchSet := make(map[int]bool)
			for _, batch := range batches {
				if batchSet[batch] {
					return false // Duplicate batch number
				}
				batchSet[batch] = true
			}

			// Verify batch numbers are sequential starting from 1
			for i := 1; i <= len(uniqueMigrations); i++ {
				if !batchSet[i] {
					return false // Missing batch number
				}
			}

			return true
		},
		gen.SliceOfN(10, migrationNameGen()),
	))

	properties.TestingRun(t)
}

// Feature: migration-system, Property 10: Pretend Mode No Side Effects
// For any migration operation with pretend=true, the database state should
// remain unchanged (no tables created/modified, no migration records logged).
func TestProperty10_PretendModeNoSideEffects(t *testing.T) {
	parameters := gopter.DefaultTestParameters()
	parameters.MinSuccessfulTests = 100
	properties := gopter.NewProperties(parameters)

	properties.Property("Pretend mode does not modify database state", prop.ForAll(
		func(migrations []string) bool {
			// Setup fresh migrator
			migrator, db, _ := setupMigratorTest(t)

			// Deduplicate migrations
			seen := make(map[string]bool)
			uniqueMigrations := make([]string, 0)
			for _, name := range migrations {
				if !seen[name] {
					seen[name] = true
					uniqueMigrations = append(uniqueMigrations, name)
				}
			}

			if len(uniqueMigrations) == 0 {
				return true // Empty case
			}

			// Register migrations that would create tables
			for i, name := range uniqueMigrations {
				tableName := "test_table_" + name
				migrator.Register(name, &testMigration{
					BaseMigration: BaseMigration{UseTransaction: false},
					upFunc: func(db *gorm.DB) error {
						return db.Exec("CREATE TABLE IF NOT EXISTS " + tableName + " (id INTEGER PRIMARY KEY)").Error
					},
					downFunc: func(db *gorm.DB) error {
						return db.Exec("DROP TABLE IF EXISTS " + tableName).Error
					},
				})
				_ = i // Avoid unused variable
			}

			// Create repository
			if err := migrator.Repository().CreateRepository(); err != nil {
				return false
			}

			// Get initial state
			initialRan, err := migrator.Repository().GetRan()
			if err != nil {
				return false
			}

			// Run with pretend mode
			opts := NewMigratorOptions().WithPretend()
			_, err = migrator.Run(opts)
			if err != nil {
				return false
			}

			// Verify no migrations were logged
			afterRan, err := migrator.Repository().GetRan()
			if err != nil {
				return false
			}

			if len(afterRan) != len(initialRan) {
				return false
			}

			// Verify no tables were created
			for _, name := range uniqueMigrations {
				tableName := "test_table_" + name
				if db.Migrator().HasTable(tableName) {
					return false
				}
			}

			return true
		},
		gen.SliceOfN(5, migrationNameGen()),
	))

	properties.TestingRun(t)
}

// Feature: migration-system, Property 11: Event Ordering
// For any migration operation, events should be fired in order:
// MigrationsStarted → (MigrationStarted → MigrationEnded)* → MigrationsEnded
func TestProperty11_EventOrdering(t *testing.T) {
	parameters := gopter.DefaultTestParameters()
	parameters.MinSuccessfulTests = 100
	properties := gopter.NewProperties(parameters)

	properties.Property("Events are fired in correct order", prop.ForAll(
		func(migrations []string) bool {
			// Setup fresh migrator
			migrator, _, eventBus := setupMigratorTest(t)

			// Deduplicate migrations
			seen := make(map[string]bool)
			uniqueMigrations := make([]string, 0)
			for _, name := range migrations {
				if !seen[name] {
					seen[name] = true
					uniqueMigrations = append(uniqueMigrations, name)
				}
			}

			if len(uniqueMigrations) == 0 {
				return true // Empty case
			}

			// Register all migrations
			for _, name := range uniqueMigrations {
				migrator.Register(name, newTestMigration())
			}

			// Create repository
			if err := migrator.Repository().CreateRepository(); err != nil {
				return false
			}

			// Collect events
			collector := newEventCollector()
			eventBus.Subscribe("migration.*", collector.handler)

			// Run migrations
			_, err := migrator.Run(NewMigratorOptions())
			if err != nil {
				return false
			}

			// Verify event order
			collectedEvents := collector.getEvents()
			if len(collectedEvents) == 0 {
				return false
			}

			// First event should be MigrationsStarted
			if _, ok := collectedEvents[0].(*MigrationsStarted); !ok {
				return false
			}

			// Last event should be MigrationsEnded
			if _, ok := collectedEvents[len(collectedEvents)-1].(*MigrationsEnded); !ok {
				return false
			}

			// Middle events should alternate MigrationStarted/MigrationEnded
			for i := 1; i < len(collectedEvents)-1; i += 2 {
				if _, ok := collectedEvents[i].(*MigrationStarted); !ok {
					return false
				}
				if i+1 < len(collectedEvents)-1 {
					if _, ok := collectedEvents[i+1].(*MigrationEnded); !ok {
						return false
					}
				}
			}

			return true
		},
		gen.SliceOfN(5, migrationNameGen()),
	))

	properties.TestingRun(t)
}

// Feature: migration-system, Property 12: Migration Error Contains Name
// For any migration that fails during execution, the returned error
// should contain the migration name.
func TestProperty12_MigrationErrorContainsName(t *testing.T) {
	parameters := gopter.DefaultTestParameters()
	parameters.MinSuccessfulTests = 100
	properties := gopter.NewProperties(parameters)

	properties.Property("Migration errors contain the migration name", prop.ForAll(
		func(migrationName string, errorMsg string) bool {
			// Setup fresh migrator
			migrator, _, _ := setupMigratorTest(t)

			// Register a failing migration
			migrator.Register(migrationName, &failingMigration{
				BaseMigration: BaseMigration{UseTransaction: false},
				errMsg:        errorMsg,
			})

			// Create repository
			if err := migrator.Repository().CreateRepository(); err != nil {
				return false
			}

			// Run migrations (should fail)
			_, err := migrator.Run(NewMigratorOptions())
			if err == nil {
				return false // Should have failed
			}

			// Verify error contains migration name
			errStr := err.Error()
			if !slices.Contains([]string{migrationName}, migrationName) {
				return false
			}

			// Check if error message contains the migration name
			return slices.Contains([]string{errStr}, errStr) &&
				len(errStr) > 0 &&
				containsSubstring(errStr, migrationName)
		},
		migrationNameGen(),
		gen.AlphaString(),
	))

	properties.TestingRun(t)
}

// containsSubstring checks if s contains substr
func containsSubstring(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Unit tests for edge cases and specific examples

func TestMigrator_NewMigrator(t *testing.T) {
	migrator, _, eventBus := setupMigratorTest(t)

	assert.NotNil(t, migrator)
	assert.NotNil(t, migrator.Repository())
	assert.NotNil(t, migrator.DB())
	assert.Equal(t, eventBus, migrator.eventBus)
}

func TestMigrator_Register(t *testing.T) {
	migrator, _, _ := setupMigratorTest(t)

	migration := newTestMigration()
	migrator.Register("test_migration", migration)

	retrieved, ok := migrator.GetMigration("test_migration")
	assert.True(t, ok)
	assert.Equal(t, migration, retrieved)
}

func TestMigrator_GetMigration_NotFound(t *testing.T) {
	migrator, _, _ := setupMigratorTest(t)

	_, ok := migrator.GetMigration("non_existent")
	assert.False(t, ok)
}

func TestMigrator_GetRegisteredMigrations(t *testing.T) {
	migrator, _, _ := setupMigratorTest(t)

	migrator.Register("migration_c", newTestMigration())
	migrator.Register("migration_a", newTestMigration())
	migrator.Register("migration_b", newTestMigration())

	names := migrator.GetRegisteredMigrations()
	assert.Equal(t, []string{"migration_a", "migration_b", "migration_c"}, names)
}

func TestMigrator_Run_EmptyMigrations(t *testing.T) {
	migrator, _, eventBus := setupMigratorTest(t)

	// Collect events
	collector := newEventCollector()
	eventBus.Subscribe("migration.*", collector.handler)

	// Run with no migrations registered
	executed, err := migrator.Run(NewMigratorOptions())
	assert.NoError(t, err)
	assert.Empty(t, executed)

	// Should fire NoPendingMigrations event
	collectedEvents := collector.getEvents()
	assert.Len(t, collectedEvents, 1)
	_, ok := collectedEvents[0].(*NoPendingMigrations)
	assert.True(t, ok)
}

func TestMigrator_Run_AllAlreadyRan(t *testing.T) {
	migrator, _, eventBus := setupMigratorTest(t)

	// Register and run a migration
	migrator.Register("test_migration", newTestMigration())
	_, err := migrator.Run(NewMigratorOptions())
	require.NoError(t, err)

	// Collect events for second run
	collector := newEventCollector()
	eventBus.Subscribe("migration.*", collector.handler)

	// Run again (should have nothing to do)
	executed, err := migrator.Run(NewMigratorOptions())
	assert.NoError(t, err)
	assert.Empty(t, executed)

	// Should fire NoPendingMigrations event
	collectedEvents := collector.getEvents()
	assert.Len(t, collectedEvents, 1)
	_, ok := collectedEvents[0].(*NoPendingMigrations)
	assert.True(t, ok)
}

func TestMigrator_Rollback_EmptyRepository(t *testing.T) {
	migrator, _, eventBus := setupMigratorTest(t)

	// Create repository
	err := migrator.Repository().CreateRepository()
	require.NoError(t, err)

	// Collect events
	collector := newEventCollector()
	eventBus.Subscribe("migration.*", collector.handler)

	// Rollback with nothing to rollback
	rolledBack, err := migrator.Rollback(NewRollbackOptions())
	assert.NoError(t, err)
	assert.Empty(t, rolledBack)

	// Should fire NoPendingMigrations event
	collectedEvents := collector.getEvents()
	assert.Len(t, collectedEvents, 1)
	_, ok := collectedEvents[0].(*NoPendingMigrations)
	assert.True(t, ok)
}

func TestMigrator_Rollback_ByBatch(t *testing.T) {
	migrator, _, _ := setupMigratorTest(t)

	// Register migrations
	migrator.Register("migration_a", newTestMigration())
	migrator.Register("migration_b", newTestMigration())
	migrator.Register("migration_c", newTestMigration())

	// Create repository
	err := migrator.Repository().CreateRepository()
	require.NoError(t, err)

	// Log migrations in different batches
	err = migrator.Repository().Log("migration_a", 1)
	require.NoError(t, err)
	err = migrator.Repository().Log("migration_b", 2)
	require.NoError(t, err)
	err = migrator.Repository().Log("migration_c", 2)
	require.NoError(t, err)

	// Rollback batch 2
	opts := NewRollbackOptions().WithBatch(2)
	rolledBack, err := migrator.Rollback(opts)
	assert.NoError(t, err)
	assert.Len(t, rolledBack, 2)

	// Verify only batch 1 remains
	ran, err := migrator.Repository().GetRan()
	require.NoError(t, err)
	assert.Equal(t, []string{"migration_a"}, ran)
}

func TestMigrator_Reset_EmptyRepository(t *testing.T) {
	migrator, _, eventBus := setupMigratorTest(t)

	// Create repository
	err := migrator.Repository().CreateRepository()
	require.NoError(t, err)

	// Collect events
	collector := newEventCollector()
	eventBus.Subscribe("migration.*", collector.handler)

	// Reset with nothing to reset
	rolledBack, err := migrator.Reset(false)
	assert.NoError(t, err)
	assert.Empty(t, rolledBack)

	// Should fire NoPendingMigrations event
	collectedEvents := collector.getEvents()
	assert.Len(t, collectedEvents, 1)
	_, ok := collectedEvents[0].(*NoPendingMigrations)
	assert.True(t, ok)
}

func TestMigrator_TransactionSupport(t *testing.T) {
	migrator, db, _ := setupMigratorTest(t)

	// Create a test table
	err := db.Exec("CREATE TABLE test_tx (id INTEGER PRIMARY KEY, value TEXT)").Error
	require.NoError(t, err)

	// Register a migration that uses transactions
	migrator.Register("tx_migration", &testMigration{
		BaseMigration: BaseMigration{UseTransaction: true},
		upFunc: func(db *gorm.DB) error {
			return db.Exec("INSERT INTO test_tx (id, value) VALUES (1, 'test')").Error
		},
		downFunc: func(db *gorm.DB) error {
			return db.Exec("DELETE FROM test_tx WHERE id = 1").Error
		},
	})

	// Run migration
	_, err = migrator.Run(NewMigratorOptions())
	assert.NoError(t, err)

	// Verify data was inserted
	var count int64
	db.Raw("SELECT COUNT(*) FROM test_tx").Scan(&count)
	assert.Equal(t, int64(1), count)
}

func TestMigrator_FailingMigration(t *testing.T) {
	migrator, _, _ := setupMigratorTest(t)

	// Register a failing migration
	migrator.Register("failing_migration", &failingMigration{
		BaseMigration: BaseMigration{UseTransaction: false},
		errMsg:        "intentional failure",
	})

	// Run migration (should fail)
	_, err := migrator.Run(NewMigratorOptions())
	assert.Error(t, err)

	// Verify error is a MigrationError
	var migErr *MigrationError
	assert.True(t, errors.As(err, &migErr))
	assert.Equal(t, "failing_migration", migErr.Migration)
	assert.Equal(t, "up", migErr.Method)
}

func TestMigrator_UnregisteredMigration(t *testing.T) {
	migrator, _, _ := setupMigratorTest(t)

	// Create repository and log a migration that isn't registered
	err := migrator.Repository().CreateRepository()
	require.NoError(t, err)
	err = migrator.Repository().Log("unregistered_migration", 1)
	require.NoError(t, err)

	// Try to rollback (should fail because migration isn't registered)
	_, err = migrator.Rollback(NewRollbackOptions())
	assert.Error(t, err)

	var migErr *MigrationError
	assert.True(t, errors.As(err, &migErr))
	assert.Equal(t, "unregistered_migration", migErr.Migration)
}

func TestMigrator_NilEventBus(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	repo := NewDatabaseRepository(db, "migrations")
	migrator := NewMigrator(repo, db, nil) // nil event bus

	// Register a migration
	migrator.Register("test_migration", newTestMigration())

	// Run should work without event bus
	executed, err := migrator.Run(NewMigratorOptions())
	assert.NoError(t, err)
	assert.Equal(t, []string{"test_migration"}, executed)
}
