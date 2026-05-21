package wiring

import (
	"github.com/kest-labs/kest/api/internal/modules/apispec"
	"github.com/kest-labs/kest/api/internal/modules/importer"
	"github.com/kest-labs/kest/api/internal/modules/testcase"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

func provideAPISpecHandler(service apispec.Service, importerService importer.Service, workspaceService workspace.Service, tcSaver testcase.Repository) *apispec.Handler {
	handler := apispec.NewHandler(service, importerService, workspaceService)
	handler.SetTestCaseSaver(tcSaver)
	return handler
}
