package wiring

import (
	"github.com/kest-labs/kest/api/internal/modules/apispec"
	"github.com/kest-labs/kest/api/internal/modules/history"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/internal/modules/project"
	"github.com/kest-labs/kest/api/internal/modules/testcase"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

func provideAPISpecHandler(service apispec.Service, workspaceService workspace.Service, tcSaver testcase.Repository) *apispec.Handler {
	handler := apispec.NewHandler(service, workspaceService)
	handler.SetTestCaseSaver(tcSaver)
	return handler
}

func provideProjectHandler(
	service project.Service,
	memberService member.Service,
	workspaceService workspace.Service,
	apiSpecHandler *apispec.Handler,
	historyHandler *history.Handler,
) *project.Handler {
	handler := project.NewHandler(service, memberService)
	handler.SetWorkspaceTokenValidator(workspaceService)
	handler.SetSpecSyncer(apiSpecHandler)
	handler.SetHistorySyncer(historyHandler)
	return handler
}
