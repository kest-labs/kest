// Package migrations provides database migration files for the Eogo framework.
// Migrations are registered using the new Migration interface from internal/infra/migration.
package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
)

// registry holds all registered migrations
var registry = make(map[string]migration.Migration)

// register adds a migration to the registry.
// This is called by init() functions in migration files.
func register(name string, m migration.Migration) {
	registry[name] = m
}

// All returns all registered migrations as a map.
// The key is the migration name (e.g., "2025_06_18_000000_create_users_table").
func All() map[string]migration.Migration {
	return registry
}

// Names returns all registered migration names in sorted order.
func Names() []string {
	names := make([]string, 0, len(registry))
	for name := range registry {
		names = append(names, name)
	}
	return names
}
