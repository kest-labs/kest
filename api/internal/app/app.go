package app

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/email"
	"github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/kest-labs/kest/api/internal/infra/jwt"
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/apispec"
	"github.com/kest-labs/kest/api/internal/modules/audit"
	"github.com/kest-labs/kest/api/internal/modules/category"
	"github.com/kest-labs/kest/api/internal/modules/collection"
	"github.com/kest-labs/kest/api/internal/modules/environment"
	"github.com/kest-labs/kest/api/internal/modules/example"
	"github.com/kest-labs/kest/api/internal/modules/export"
	"github.com/kest-labs/kest/api/internal/modules/flow"
	"github.com/kest-labs/kest/api/internal/modules/history"
	"github.com/kest-labs/kest/api/internal/modules/importer"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/internal/modules/permission"
	"github.com/kest-labs/kest/api/internal/modules/project"
	"github.com/kest-labs/kest/api/internal/modules/projectinvite"
	"github.com/kest-labs/kest/api/internal/modules/request"
	"github.com/kest-labs/kest/api/internal/modules/run"
	"github.com/kest-labs/kest/api/internal/modules/system"
	"github.com/kest-labs/kest/api/internal/modules/testcase"
	"github.com/kest-labs/kest/api/internal/modules/user"
)

// Application holds all application dependencies injected via Wire.
// This is the root container for the entire application.
type Application struct {
	Config       *config.Config
	DB           *gorm.DB
	JWTService   *jwt.Service
	EmailService *email.Service
	EventBus     *events.EventBus
	Migrator     *migration.Migrator
	Handlers     *Handlers
}

// Handlers holds all HTTP handlers for modules.
type Handlers struct {
	User          *user.Handler
	Member        *member.Handler
	Permission    *permission.Handler
	Audit         *audit.Handler
	Project       *project.Handler
	ProjectInvite *projectinvite.Handler
	Collection    *collection.Handler
	Request       *request.Handler
	Example       *example.Handler
	Run           *run.Handler
	History       *history.Handler
	Export        *export.Handler
	Importer      *importer.Handler
	APISpec       *apispec.Handler
	Category      *category.Handler
	Environment   *environment.Handler
	Flow          *flow.Handler
	TestCase      *testcase.Handler
	System        *system.Handler
}

// Modules returns a list of all active modules
func (h *Handlers) Modules() []contracts.Module {
	modules := make([]contracts.Module, 0, 19)

	if h.User != nil {
		modules = append(modules, h.User)
	}
	if h.Member != nil {
		modules = append(modules, h.Member)
	}
	if h.Permission != nil {
		modules = append(modules, h.Permission)
	}
	if h.Audit != nil {
		modules = append(modules, h.Audit)
	}
	if h.Project != nil {
		modules = append(modules, h.Project)
	}
	if h.ProjectInvite != nil {
		modules = append(modules, h.ProjectInvite)
	}
	if h.Collection != nil {
		modules = append(modules, h.Collection)
	}
	if h.Request != nil {
		modules = append(modules, h.Request)
	}
	if h.Example != nil {
		modules = append(modules, h.Example)
	}
	if h.Run != nil {
		modules = append(modules, h.Run)
	}
	if h.History != nil {
		modules = append(modules, h.History)
	}
	if h.Export != nil {
		modules = append(modules, h.Export)
	}
	if h.Importer != nil {
		modules = append(modules, h.Importer)
	}
	if h.APISpec != nil {
		modules = append(modules, h.APISpec)
	}
	if h.Category != nil {
		modules = append(modules, h.Category)
	}
	if h.Environment != nil {
		modules = append(modules, h.Environment)
	}
	if h.Flow != nil {
		modules = append(modules, h.Flow)
	}
	if h.TestCase != nil {
		modules = append(modules, h.TestCase)
	}
	if h.System != nil {
		modules = append(modules, h.System)
	}

	return modules
}
