package flow

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

// RegisterRoutes registers flow routes
func RegisterRoutes(r *router.Router, handler *Handler, memberService member.Service) {
	registerWorkspaceFlowMarkdownRoutes(r, handler, memberService)
	registerFlowRoutes(r, "/workspaces/:id/flows", handler, memberService, true)
	registerFlowRoutes(r, "/projects/:id/flows", handler, memberService, false)
	registerCLIFlowRoutes(r, handler)
}

func registerWorkspaceFlowMarkdownRoutes(r *router.Router, handler *Handler, memberService member.Service) {
	r.Group("/workspaces/:id/flows", func(flows *router.Router) {
		flows.WithMiddleware("auth")
		flows.Use(middleware.ResolveWorkspaceContext(handler.workspaceBackingResolver))

		flows.POST("/import-markdown", handler.ImportFlowMarkdown).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))
		flows.PUT("/:fid/markdown", handler.UpdateFlowMarkdown).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))
	})
}

func registerCLIFlowRoutes(r *router.Router, handler *Handler) {
	r.Group("/workspaces/:id/cli", func(cli *router.Router) {
		cli.GET("/flows/runnable", handler.ListRunnableFlowsForCLI).
			Name("workspaces.cli.flows_runnable").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(handler.workspaceTokenValidator, workspace.CLITokenScopeFlowRun))
		cli.POST("/flows/sync", handler.SyncFlowsFromCLI).
			Name("workspaces.cli.flows_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(handler.workspaceTokenValidator, workspace.CLITokenScopeFlowWrite))
		cli.POST("/flow-runs/sync", handler.SyncFlowRunFromCLI).
			Name("workspaces.cli.flow_runs_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireWorkspaceCLIToken(handler.workspaceTokenValidator, workspace.CLITokenScopeFlowRun))
	})
}

func registerFlowRoutes(
	r *router.Router,
	prefix string,
	handler *Handler,
	memberService member.Service,
	resolveWorkspace bool,
) {
	r.Group(prefix, func(flows *router.Router) {
		flows.WithMiddleware("auth")
		if resolveWorkspace {
			flows.Use(middleware.ResolveWorkspaceContext(handler.workspaceBackingResolver))
		} else {
			flows.Use(middleware.ResolveLegacyWorkspaceContext(handler.workspaceBackingResolver))
		}

		flows.GET("", handler.ListFlows).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleRead))
		flows.POST("", handler.CreateFlow).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))

		flows.GET("/:fid", handler.GetFlow).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleRead))
		flows.PATCH("/:fid", handler.UpdateFlow).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))
		flows.PUT("/:fid", handler.SaveFlow).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))
		flows.DELETE("/:fid", handler.DeleteFlow).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))

		// Steps
		flows.POST("/:fid/steps", handler.CreateStep).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))
		flows.PATCH("/:fid/steps/:sid", handler.UpdateStep).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))
		flows.DELETE("/:fid/steps/:sid", handler.DeleteStep).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))

		// Edges
		flows.POST("/:fid/edges", handler.CreateEdge).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))
		flows.DELETE("/:fid/edges/:eid", handler.DeleteEdge).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))

		// Run
		flows.POST("/:fid/run", handler.RunFlow).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleWrite))
		flows.GET("/:fid/runs", handler.ListRuns).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleRead))
		flows.GET("/:fid/runs/:rid", handler.GetRun).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleRead))
		flows.GET("/:fid/runs/:rid/events", handler.ExecuteFlowSSE).
			Middleware(middleware.RequireResolvedWorkspaceRole(memberService, member.RoleRead))
	})
}
