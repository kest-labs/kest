package app

import (
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
	"github.com/kest-labs/kest/api/internal/modules/request"
	"github.com/kest-labs/kest/api/internal/modules/run"
	"github.com/kest-labs/kest/api/internal/modules/system"
	"github.com/kest-labs/kest/api/internal/modules/testcase"
	"github.com/kest-labs/kest/api/internal/modules/user"
	"gorm.io/gorm"
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
	User        *user.Handler
	Member      *member.Handler
	Permission  *permission.Handler
	Audit       *audit.Handler
	Project     *project.Handler
	Collection  *collection.Handler
	Request     *request.Handler
	Example     *example.Handler
	Run         *run.Handler
	History     *history.Handler
	Export      *export.Handler
	Importer    *importer.Handler
	APISpec     *apispec.Handler
	Category    *category.Handler
	Environment *environment.Handler
	Flow        *flow.Handler
	TestCase    *testcase.Handler
	System      *system.Handler
}

// Modules returns a list of all active modules
func (h *Handlers) Modules() []contracts.Module {
	return []contracts.Module{
		h.User,
		h.Member,
		h.Permission,
		h.Audit,
		h.Project,
		h.Collection,
		h.Request,
		h.Example,
		h.Run,
		h.History,
		h.Export,
		h.Importer,
		h.APISpec,
		h.Category,
		h.Environment,
		h.Flow,
		h.TestCase,
		h.System,
	}
}
