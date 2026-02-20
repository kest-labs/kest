package infra

import (
	"github.com/google/wire"
	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/database"
	"github.com/kest-labs/kest/api/internal/infra/email"
	"github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/kest-labs/kest/api/internal/infra/jwt"
	"github.com/kest-labs/kest/api/internal/infra/migration"
)

// ProviderSet aggregates all infrastructure providers for Wire DI.
// This is the single source of truth for infrastructure dependencies.
var ProviderSet = wire.NewSet(
	// Config - loaded from environment
	config.Load,

	// Database - depends on Config
	database.NewDB,

	// JWT Service - depends on Config
	jwt.NewService,

	// Email Service - depends on Config
	email.NewService,

	// Event Bus
	events.NewEventBus,

	// Migration - depends on Database and EventBus
	migration.ProviderSet,
)
