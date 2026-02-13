// Package migration provides a Laravel-inspired database migration system.
package migration

import (
	"time"

	"github.com/kest-labs/kest/api/internal/infra/events"
)

// Event name constants for migration events
const (
	EventMigrationsStarted   = "migration.migrations_started"
	EventMigrationsEnded     = "migration.migrations_ended"
	EventMigrationStarted    = "migration.migration_started"
	EventMigrationEnded      = "migration.migration_ended"
	EventMigrationSkipped    = "migration.migration_skipped"
	EventNoPendingMigrations = "migration.no_pending"
)

// MigrationsStarted is fired before running any migrations.
// It indicates the beginning of a migration batch operation.
type MigrationsStarted struct {
	events.BaseEvent
	// Direction indicates the migration direction: "up" for migrate, "down" for rollback
	Direction string
}

// EventName returns the unique event identifier
func (e *MigrationsStarted) EventName() string {
	return EventMigrationsStarted
}

// NewMigrationsStarted creates a new MigrationsStarted event
func NewMigrationsStarted(direction string) *MigrationsStarted {
	return &MigrationsStarted{
		BaseEvent: events.NewBaseEventWithSource("migration"),
		Direction: direction,
	}
}

// MigrationsEnded is fired after all migrations complete.
// It indicates the end of a migration batch operation.
type MigrationsEnded struct {
	events.BaseEvent
	// Direction indicates the migration direction: "up" for migrate, "down" for rollback
	Direction string
}

// EventName returns the unique event identifier
func (e *MigrationsEnded) EventName() string {
	return EventMigrationsEnded
}

// NewMigrationsEnded creates a new MigrationsEnded event
func NewMigrationsEnded(direction string) *MigrationsEnded {
	return &MigrationsEnded{
		BaseEvent: events.NewBaseEventWithSource("migration"),
		Direction: direction,
	}
}

// MigrationStarted is fired before each individual migration.
// It provides information about which migration is about to run.
type MigrationStarted struct {
	events.BaseEvent
	// Migration is the name of the migration being executed
	Migration string
	// Method indicates the migration method: "up" or "down"
	Method string
}

// EventName returns the unique event identifier
func (e *MigrationStarted) EventName() string {
	return EventMigrationStarted
}

// NewMigrationStarted creates a new MigrationStarted event
func NewMigrationStarted(migration, method string) *MigrationStarted {
	return &MigrationStarted{
		BaseEvent: events.NewBaseEventWithSource("migration"),
		Migration: migration,
		Method:    method,
	}
}

// MigrationEnded is fired after each individual migration completes.
// It provides information about which migration just finished.
type MigrationEnded struct {
	events.BaseEvent
	// Migration is the name of the migration that was executed
	Migration string
	// Method indicates the migration method: "up" or "down"
	Method string
}

// EventName returns the unique event identifier
func (e *MigrationEnded) EventName() string {
	return EventMigrationEnded
}

// NewMigrationEnded creates a new MigrationEnded event
func NewMigrationEnded(migration, method string) *MigrationEnded {
	return &MigrationEnded{
		BaseEvent: events.NewBaseEventWithSource("migration"),
		Migration: migration,
		Method:    method,
	}
}

// MigrationSkipped is fired when a migration is skipped.
// This can happen when a migration is already ran or doesn't need to run.
type MigrationSkipped struct {
	events.BaseEvent
	// Migration is the name of the migration that was skipped
	Migration string
}

// EventName returns the unique event identifier
func (e *MigrationSkipped) EventName() string {
	return EventMigrationSkipped
}

// NewMigrationSkipped creates a new MigrationSkipped event
func NewMigrationSkipped(migration string) *MigrationSkipped {
	return &MigrationSkipped{
		BaseEvent: events.NewBaseEventWithSource("migration"),
		Migration: migration,
	}
}

// NoPendingMigrations is fired when there are no migrations to run.
// This indicates that all migrations are up to date.
type NoPendingMigrations struct {
	events.BaseEvent
	// Direction indicates the migration direction: "up" for migrate, "down" for rollback
	Direction string
}

// EventName returns the unique event identifier
func (e *NoPendingMigrations) EventName() string {
	return EventNoPendingMigrations
}

// NewNoPendingMigrations creates a new NoPendingMigrations event
func NewNoPendingMigrations(direction string) *NoPendingMigrations {
	return &NoPendingMigrations{
		BaseEvent: events.NewBaseEventWithSource("migration"),
		Direction: direction,
	}
}

// Ensure all event types implement the events.Event interface
var (
	_ events.Event = (*MigrationsStarted)(nil)
	_ events.Event = (*MigrationsEnded)(nil)
	_ events.Event = (*MigrationStarted)(nil)
	_ events.Event = (*MigrationEnded)(nil)
	_ events.Event = (*MigrationSkipped)(nil)
	_ events.Event = (*NoPendingMigrations)(nil)
)

// Helper functions for checking event metadata

// OccurredAt returns when the event occurred (from BaseEvent)
func (e *MigrationsStarted) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt()
}

// OccurredAt returns when the event occurred (from BaseEvent)
func (e *MigrationsEnded) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt()
}

// OccurredAt returns when the event occurred (from BaseEvent)
func (e *MigrationStarted) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt()
}

// OccurredAt returns when the event occurred (from BaseEvent)
func (e *MigrationEnded) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt()
}

// OccurredAt returns when the event occurred (from BaseEvent)
func (e *MigrationSkipped) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt()
}

// OccurredAt returns when the event occurred (from BaseEvent)
func (e *NoPendingMigrations) OccurredAt() time.Time {
	return e.BaseEvent.OccurredAt()
}
