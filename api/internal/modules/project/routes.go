package project

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

// RegisterRoutes registers the project module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("", func(cli *router.Router) {
		cli.POST("/workspaces/:id/cli/spec-sync", h.SyncSpecsFromCLI).
			Name("workspaces.cli.spec_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(h.workspaceTokenValidator, workspace.CLITokenScopeCollectionRead))
		cli.POST("/workspaces/:id/cli/history-sync", h.SyncHistoryFromCLI).
			Name("workspaces.cli.history_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(h.workspaceTokenValidator, workspace.CLITokenScopeCollectionRun))
	})
}
