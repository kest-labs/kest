package wiring

import (
	"github.com/kest-labs/kest/api/internal/modules/apispec"
	"github.com/kest-labs/kest/api/internal/modules/history"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/internal/modules/project"
	"github.com/kest-labs/kest/api/internal/modules/testcase"
)

func provideAPISpecHandler(service apispec.Service, memberService member.Service, tcSaver testcase.Repository) *apispec.Handler {
	handler := apispec.NewHandler(service, memberService)
	handler.SetTestCaseSaver(tcSaver)
	return handler
}

func provideProjectHandler(service project.Service, memberService member.Service, historyHandler *history.Handler) *project.Handler {
	handler := project.NewHandler(service, memberService)
	handler.SetHistorySyncer(historyHandler)
	return handler
}
