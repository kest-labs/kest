package commands

import (
	"github.com/kest-labs/kest/api/internal/bootstrap"
	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/console"
	"github.com/kest-labs/kest/api/internal/infra/database"
)

// DBSeedCommand runs database seeders
type DBSeedCommand struct {
	output *console.Output
}

func NewDBSeedCommand() *DBSeedCommand {
	return &DBSeedCommand{output: console.NewOutput()}
}

func (c *DBSeedCommand) Name() string        { return "db:seed" }
func (c *DBSeedCommand) Description() string { return "Run database seeders" }
func (c *DBSeedCommand) Usage() string       { return "db:seed" }

func (c *DBSeedCommand) Run(args []string) error {
	c.output.Info("Running database seeders...")

	// Load config
	cfg, err := config.Load()
	if err != nil {
		c.output.Error("Failed to load config: %v", err)
		return err
	}

	// Connect to DB
	db, err := database.NewDB(cfg)
	if err != nil {
		c.output.Error("Failed to connect to database: %v", err)
		return err
	}
	if db == nil {
		c.output.Warning("Database is disabled in config")
		return nil
	}

	// Execute seeders
	if err := bootstrap.RunSeeders(db); err != nil {
		c.output.Error("Seeding failed: %v", err)
		return err
	}

	c.output.Success("Seeders completed")
	return nil
}
