package workspace

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the workspace module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	// All workspace routes require authentication
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		// Workspace CRUD
		auth.POST("/workspaces", h.CreateWorkspace).Name("workspaces.create")
		auth.GET("/workspaces", h.ListWorkspaces).Name("workspaces.index")
		auth.GET("/workspaces/:id", h.GetWorkspace).Name("workspaces.show").WhereUUIDOrNumber("id")
		auth.PATCH("/workspaces/:id", h.UpdateWorkspace).Name("workspaces.update").WhereUUIDOrNumber("id")
		auth.DELETE("/workspaces/:id", h.DeleteWorkspace).Name("workspaces.delete").WhereUUIDOrNumber("id")
		auth.GET("/workspaces/:id/stats", h.GetStats).Name("workspaces.stats").WhereUUIDOrNumber("id")

		// CLI tokens
		auth.POST("/workspaces/:id/cli-tokens", h.GenerateCLIToken).Name("workspaces.cli_tokens.create").WhereUUIDOrNumber("id")
		auth.GET("/workspaces/:id/cli-tokens", h.ListCLITokens).Name("workspaces.cli_tokens.list").WhereUUIDOrNumber("id")
	})

	r.Group("", func(cli *router.Router) {
		cli.POST("/workspaces/:id/cli/spec-sync", h.SyncSpecsFromCLI).
			Name("workspaces.cli.spec_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(h.service, CLITokenScopeCollectionRead))
		cli.POST("/workspaces/:id/cli/history-sync", h.SyncHistoryFromCLI).
			Name("workspaces.cli.history_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(h.service, CLITokenScopeCollectionRun))
	})
}
