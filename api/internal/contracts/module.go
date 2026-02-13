package contracts

import (
	"github.com/kest-labs/kest/api/internal/infra/console"
	"github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// Module defines the contract for a ZGO business module.
// Implementing this interface allows a module to register its own
// routes, event listeners, and console commands.
type Module interface {
	// Name returns the unique name of the module
	Name() string

	// Init initializes the module with infrastructure components
	// This is called after all dependencies are wired
	Init() error

	// RegisterRoutes registers the module's HTTP routes
	RegisterRoutes(r *router.Router)

	// RegisterEvents registers the module's event subscribers
	RegisterEvents(bus *events.EventBus)

	// RegisterCommands registers the module's console commands
	RegisterCommands(app *console.Application)
}

// BaseModule provides default empty implementations for the Module interface.
// Business modules can embed this to only implement needed methods.
type BaseModule struct{}

func (m BaseModule) Init() error                               { return nil }
func (m BaseModule) RegisterRoutes(r *router.Router)           {}
func (m BaseModule) RegisterEvents(bus *events.EventBus)       {}
func (m BaseModule) RegisterCommands(app *console.Application) {}
