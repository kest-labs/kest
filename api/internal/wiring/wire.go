//go:build wireinject
// +build wireinject

package wiring

import (
	"github.com/google/wire"
	"github.com/kest-labs/kest/api/internal/app"
	"github.com/kest-labs/kest/api/internal/infra"
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
	"github.com/kest-labs/kest/api/internal/modules/runner"
	"github.com/kest-labs/kest/api/internal/modules/system"
	"github.com/kest-labs/kest/api/internal/modules/testcase"
	"github.com/kest-labs/kest/api/internal/modules/testrunner"
	"github.com/kest-labs/kest/api/internal/modules/user"
)

// InitApplication initializes the entire application with all dependencies.
// This is the single entry point for Wire DI.
func InitApplication() (*app.Application, error) {
	wire.Build(
		// Infrastructure providers
		infra.ProviderSet,

		// Module providers
		user.ProviderSet,
		member.ProviderSet,
		permission.ProviderSet,
		audit.ProviderSet,
		project.ProviderSet,
		collection.ProviderSet,
		request.ProviderSet,
		example.ProviderSet,
		runner.ProviderSet,
		run.ProviderSet,
		history.ProviderSet,
		export.ProviderSet,
		importer.ProviderSet,
		apispec.ProviderSet,
		category.ProviderSet,
		environment.ProviderSet,
		flow.ProviderSet,
		testcase.ProviderSet,
		testrunner.ProviderSet,
		system.ProviderSet,

		// Bind testrunner.Executor to testcase.Runner
		wire.Bind(new(testcase.Runner), new(*testrunner.Executor)),

		// Aggregate handlers
		wire.Struct(new(app.Handlers), "*"),

		// Build final application
		wire.Struct(new(app.Application), "*"),
	)
	return nil, nil
}
