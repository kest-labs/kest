// Package commands provides CLI commands for the Eogo framework.
package commands

import (
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/kest-labs/kest/api/database/migrations"
	"github.com/kest-labs/kest/api/internal/bootstrap"
	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/console"
	"github.com/kest-labs/kest/api/internal/infra/database"
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"gorm.io/gorm"
)

// consoleOutputWriter implements migration.OutputWriter for console output.
type consoleOutputWriter struct {
	output *console.Output
}

func (w *consoleOutputWriter) Write(migrationName string, statements []string) {
	w.output.Info("Migration: %s", migrationName)
	for _, sql := range statements {
		w.output.Line("    %s", sql)
	}
}

// createMigrator creates a new Migrator instance with registered migrations.
func createMigrator(cfg *config.Config) (*migration.Migrator, error) {
	// Connect to DB
	db, err := database.NewDB(cfg)
	if err != nil {
		return nil, err
	}
	if db == nil {
		return nil, nil
	}

	// Create repository
	repo := migration.NewDatabaseRepository(db, "migrations")

	// Create migrator
	migrator := migration.NewMigrator(repo, db, nil)

	// Register all migrations from the registry
	migrator.RegisterMany(migrations.All())

	return migrator, nil
}

// isProduction checks if the application is running in production.
func isProduction() bool {
	env := os.Getenv("APP_ENV")
	return env == "production" || env == "prod"
}

// MigrateCommand runs database migrations using the new Migrator.
type MigrateCommand struct {
	output *console.Output
}

// NewMigrateCommand creates a new MigrateCommand instance.
func NewMigrateCommand() *MigrateCommand {
	return &MigrateCommand{output: console.NewOutput()}
}

func (c *MigrateCommand) Name() string        { return "db:migrate" }
func (c *MigrateCommand) Description() string { return "Run database migrations" }
func (c *MigrateCommand) Usage() string {
	return "db:migrate [--pretend] [--step] [--force]"
}

func (c *MigrateCommand) Run(args []string) error {
	// Parse flags
	pretend := slices.Contains(args, "--pretend")
	step := slices.Contains(args, "--step")
	force := slices.Contains(args, "--force")

	// Check production environment
	if isProduction() && !force {
		c.output.Error("Cannot run migrations in production without --force flag")
		return nil
	}

	// Load config
	cfg, err := config.Load()
	if err != nil {
		c.output.Error("Failed to load config: %v", err)
		return err
	}

	// Create migrator
	migrator, err := createMigrator(cfg)
	if err != nil {
		c.output.Error("Failed to create migrator: %v", err)
		return err
	}
	if migrator == nil {
		c.output.Warning("Database is disabled in config")
		return nil
	}

	// Set output writer for pretend mode
	if pretend {
		migrator.SetOutput(&consoleOutputWriter{output: c.output})
		c.output.Info("Running migrations in pretend mode...")
	} else {
		c.output.Info("Running migrations...")
	}

	// Run migrations
	opts := migration.MigratorOptions{
		Pretend: pretend,
		Step:    step,
		Force:   force,
	}

	executed, err := migrator.Run(opts)
	if err != nil {
		c.output.Error("Migration failed: %v", err)
		return err
	}

	if len(executed) == 0 {
		c.output.Info("Nothing to migrate")
		return nil
	}

	// Display executed migrations
	for _, name := range executed {
		c.output.Success("Migrated: %s", name)
	}

	c.output.Success("Migrations completed (%d migrations)", len(executed))
	return nil
}

// RollbackCommand rolls back database migrations.
type RollbackCommand struct {
	output *console.Output
}

// NewRollbackCommand creates a new RollbackCommand instance.
func NewRollbackCommand() *RollbackCommand {
	return &RollbackCommand{output: console.NewOutput()}
}

func (c *RollbackCommand) Name() string        { return "db:rollback" }
func (c *RollbackCommand) Description() string { return "Rollback database migrations" }
func (c *RollbackCommand) Usage() string {
	return "db:rollback [--step=N] [--batch=N] [--pretend]"
}

func (c *RollbackCommand) Run(args []string) error {
	// Parse flags
	pretend := slices.Contains(args, "--pretend")
	steps := 0
	batch := 0

	// Parse --step=N or --step N
	for i, arg := range args {
		if val, found := strings.CutPrefix(arg, "--step="); found {
			if n, err := strconv.Atoi(val); err == nil {
				steps = n
			}
		} else if arg == "--step" && i+1 < len(args) {
			if n, err := strconv.Atoi(args[i+1]); err == nil {
				steps = n
			}
		}

		// Parse --batch=N or --batch N
		if val, found := strings.CutPrefix(arg, "--batch="); found {
			if n, err := strconv.Atoi(val); err == nil {
				batch = n
			}
		} else if arg == "--batch" && i+1 < len(args) {
			if n, err := strconv.Atoi(args[i+1]); err == nil {
				batch = n
			}
		}
	}

	// Load config
	cfg, err := config.Load()
	if err != nil {
		c.output.Error("Failed to load config: %v", err)
		return err
	}

	// Create migrator
	migrator, err := createMigrator(cfg)
	if err != nil {
		c.output.Error("Failed to create migrator: %v", err)
		return err
	}
	if migrator == nil {
		c.output.Warning("Database is disabled in config")
		return nil
	}

	// Set output writer for pretend mode
	if pretend {
		migrator.SetOutput(&consoleOutputWriter{output: c.output})
		c.output.Info("Rolling back migrations in pretend mode...")
	} else {
		c.output.Info("Rolling back migrations...")
	}

	// Rollback migrations
	opts := migration.RollbackOptions{
		Steps:   steps,
		Batch:   batch,
		Pretend: pretend,
	}

	rolledBack, err := migrator.Rollback(opts)
	if err != nil {
		c.output.Error("Rollback failed: %v", err)
		return err
	}

	if len(rolledBack) == 0 {
		c.output.Info("Nothing to rollback")
		return nil
	}

	// Display rolled back migrations
	for _, name := range rolledBack {
		c.output.Success("Rolled back: %s", name)
	}

	c.output.Success("Rollback completed (%d migrations)", len(rolledBack))
	return nil
}

// ResetCommand resets all database migrations.
type ResetCommand struct {
	output *console.Output
}

// NewResetCommand creates a new ResetCommand instance.
func NewResetCommand() *ResetCommand {
	return &ResetCommand{output: console.NewOutput()}
}

func (c *ResetCommand) Name() string        { return "db:reset" }
func (c *ResetCommand) Description() string { return "Reset all database migrations" }
func (c *ResetCommand) Usage() string {
	return "db:reset [--force] [--pretend]"
}

func (c *ResetCommand) Run(args []string) error {
	// Parse flags
	force := slices.Contains(args, "--force")
	pretend := slices.Contains(args, "--pretend")

	// Check production environment
	if isProduction() && !force {
		c.output.Error("Cannot reset migrations in production without --force flag")
		return nil
	}

	// Load config first to show database info
	cfg, err := config.Load()
	if err != nil {
		c.output.Error("Failed to load config: %v", err)
		return err
	}

	// Show warning with database info (unless pretend mode)
	if !pretend {
		c.output.Warning("╔════════════════════════════════════════════════════════════╗")
		c.output.Warning("║  ⚠️  WARNING - This will rollback ALL migrations!          ║")
		c.output.Warning("╚════════════════════════════════════════════════════════════╝")
		c.output.Line("")
		c.output.Info("Database: %s@%s:%d/%s",
			cfg.Database.Username,
			cfg.Database.Host,
			cfg.Database.Port,
			cfg.Database.Name,
		)
		c.output.Line("")
	}

	// Require explicit confirmation if not forced
	if !force {
		if !c.output.Confirm("This will rollback ALL migrations. Continue?", false) {
			c.output.Info("Operation cancelled")
			return nil
		}
	}

	// Create migrator
	migrator, err := createMigrator(cfg)
	if err != nil {
		c.output.Error("Failed to create migrator: %v", err)
		return err
	}
	if migrator == nil {
		c.output.Warning("Database is disabled in config")
		return nil
	}

	// Set output writer for pretend mode
	if pretend {
		migrator.SetOutput(&consoleOutputWriter{output: c.output})
		c.output.Info("Resetting migrations in pretend mode...")
	} else {
		c.output.Info("Resetting all migrations...")
	}

	// Reset migrations
	rolledBack, err := migrator.Reset(pretend)
	if err != nil {
		c.output.Error("Reset failed: %v", err)
		return err
	}

	if len(rolledBack) == 0 {
		c.output.Info("Nothing to reset")
		return nil
	}

	// Display rolled back migrations
	for _, name := range rolledBack {
		c.output.Success("Rolled back: %s", name)
	}

	c.output.Success("Reset completed (%d migrations)", len(rolledBack))
	return nil
}

// FreshCommand drops all tables and re-runs migrations.
type FreshCommand struct {
	output *console.Output
}

// NewFreshCommand creates a new FreshCommand instance.
func NewFreshCommand() *FreshCommand {
	return &FreshCommand{output: console.NewOutput()}
}

func (c *FreshCommand) Name() string        { return "db:fresh" }
func (c *FreshCommand) Description() string { return "Drop all tables and re-run migrations" }
func (c *FreshCommand) Usage() string {
	return "db:fresh [--seed] [--force]"
}

func (c *FreshCommand) Run(args []string) error {
	// Parse flags
	force := slices.Contains(args, "--force")
	seed := slices.Contains(args, "--seed")

	// Check production environment - always require --force in production
	if isProduction() && !force {
		c.output.Error("Cannot run db:fresh in production without --force flag")
		return nil
	}

	// Load config first to show database info
	cfg, err := config.Load()
	if err != nil {
		c.output.Error("Failed to load config: %v", err)
		return err
	}

	// Show warning with database info
	c.output.Warning("╔════════════════════════════════════════════════════════════╗")
	c.output.Warning("║  ⚠️  DESTRUCTIVE OPERATION - ALL DATA WILL BE LOST!        ║")
	c.output.Warning("╚════════════════════════════════════════════════════════════╝")
	c.output.Line("")
	c.output.Info("Database: %s@%s:%d/%s",
		cfg.Database.Username,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.Name,
	)
	c.output.Line("")

	// Require explicit confirmation if not forced
	if !force {
		// First confirmation
		if !c.output.Confirm("This will DROP ALL TABLES and DELETE ALL DATA. Continue?", false) {
			c.output.Info("Operation cancelled")
			return nil
		}

		// Second confirmation - require typing database name
		c.output.Warning("To confirm, please type the database name '%s':", cfg.Database.Name)
		dbName := c.output.Ask("Database name", "")
		if dbName != cfg.Database.Name {
			c.output.Error("Database name does not match. Operation cancelled.")
			return nil
		}
	}

	// Create migrator
	migrator, err := createMigrator(cfg)
	if err != nil {
		c.output.Error("Failed to create migrator: %v", err)
		return err
	}
	if migrator == nil {
		c.output.Warning("Database is disabled in config")
		return nil
	}

	c.output.Warning("Dropping all tables...")

	// Run fresh migrations
	opts := migration.MigratorOptions{
		Pretend: false,
		Step:    false,
		Force:   force,
	}

	executed, err := migrator.Fresh(opts)
	if err != nil {
		c.output.Error("Fresh migration failed: %v", err)
		return err
	}

	c.output.Success("Database refreshed")

	// Display executed migrations
	for _, name := range executed {
		c.output.Success("Migrated: %s", name)
	}

	c.output.Success("Migrations completed (%d migrations)", len(executed))

	// Run seeders if requested
	if seed {
		c.output.Info("Running seeders...")
		// Import bootstrap for seeder execution
		db := migrator.DB()
		if err := runSeeders(db); err != nil {
			c.output.Error("Seeding failed: %v", err)
			return err
		}
		c.output.Success("Seeders completed")
	}

	return nil
}

// runSeeders runs database seeders.
func runSeeders(db *gorm.DB) error {
	return bootstrap.RunSeeders(db)
}

// StatusCommand shows migration status.
type StatusCommand struct {
	output *console.Output
}

// NewStatusCommand creates a new StatusCommand instance.
func NewStatusCommand() *StatusCommand {
	return &StatusCommand{output: console.NewOutput()}
}

func (c *StatusCommand) Name() string        { return "db:status" }
func (c *StatusCommand) Description() string { return "Show the status of each migration" }
func (c *StatusCommand) Usage() string       { return "db:status" }

func (c *StatusCommand) Run(args []string) error {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		c.output.Error("Failed to load config: %v", err)
		return err
	}

	// Create migrator
	migrator, err := createMigrator(cfg)
	if err != nil {
		c.output.Error("Failed to create migrator: %v", err)
		return err
	}
	if migrator == nil {
		c.output.Warning("Database is disabled in config")
		return nil
	}

	// Get migration batches from repository
	repo := migrator.Repository()

	// Ensure repository exists
	if !repo.RepositoryExists() {
		c.output.Info("No migrations have been run yet")
		return nil
	}

	batches, err := repo.GetMigrationBatches()
	if err != nil {
		c.output.Error("Failed to get migration status: %v", err)
		return err
	}

	// Get all registered migrations
	registered := migrator.GetRegisteredMigrations()

	c.output.Title("Migration Status")

	if len(registered) == 0 {
		c.output.Info("No migrations found")
		return nil
	}

	// Build status table
	headers := []string{"Migration", "Batch", "Status"}
	rows := make([][]string, 0, len(registered))

	for _, name := range registered {
		batch, ran := batches[name]
		status := "Pending"
		batchStr := "-"
		if ran {
			status = "Ran"
			batchStr = strconv.Itoa(batch)
		}
		rows = append(rows, []string{name, batchStr, status})
	}

	c.output.Table(headers, rows)
	return nil
}
