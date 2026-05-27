package project

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

// RegisterRoutes registers the project module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	// Protected routes - require authentication
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		// Workspace dashboard compatibility over the legacy backing model.
		auth.POST("/workspaces/dashboard", h.CreateWorkspaceDashboard).Name("workspaces.dashboard.create")
		auth.GET("/workspaces/dashboard", h.ListWorkspaceDashboard).Name("workspaces.dashboard.list")
		auth.GET("/workspaces/dashboard/:id", h.GetWorkspaceDashboard).Name("workspaces.dashboard.show").WhereUUIDOrNumber("id")
		auth.PATCH("/workspaces/dashboard/:id", h.UpdateWorkspaceDashboard).Name("workspaces.dashboard.update").WhereUUIDOrNumber("id")
		auth.DELETE("/workspaces/dashboard/:id", h.DeleteWorkspaceDashboard).Name("workspaces.dashboard.delete").WhereUUIDOrNumber("id")

		auth.GET("/workspaces/:id/stats", h.GetWorkspaceStats).
			Name("workspaces.stats").
			WhereUUIDOrNumber("id")

		// Project CRUD
		auth.POST("/projects", h.Create).Name("projects.create")
		auth.GET("/projects", h.List).Name("projects.list")
		auth.GET("/projects/:id", h.Get).
			Name("projects.show").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		auth.PUT("/projects/:id", h.Update).
			Name("projects.update").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		auth.PATCH("/projects/:id", h.Update).
			Name("projects.patch").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		auth.DELETE("/projects/:id", h.Delete).
			Name("projects.delete").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleAdmin))

		// Stats endpoint
		auth.GET("/projects/:id/stats", h.GetStats).
			Name("projects.stats").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
	})

	r.Group("", func(cli *router.Router) {
		cli.POST("/workspaces/:id/cli/spec-sync", h.SyncWorkspaceSpecsFromCLI).
			Name("workspaces.cli.spec_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(h.workspaceTokenValidator, workspace.CLITokenScopeCollectionRead))
		cli.POST("/workspaces/:id/cli/history-sync", h.SyncWorkspaceHistoryFromCLI).
			Name("workspaces.cli.history_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(h.workspaceTokenValidator, workspace.CLITokenScopeCollectionRun))

		cli.POST("/projects/:id/cli/spec-sync", h.SyncSpecsFromCLI).
			Name("projects.cli.spec_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(h.workspaceTokenValidator, workspace.CLITokenScopeCollectionRead))
		cli.POST("/projects/:id/cli/history-sync", h.SyncHistoryFromCLI).
			Name("projects.cli.history_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(h.workspaceTokenValidator, workspace.CLITokenScopeCollectionRun))
	})
}
