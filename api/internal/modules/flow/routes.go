package flow

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers flow routes
func RegisterRoutes(r *router.Router, handler *Handler, memberService member.Service) {
	registerFlowRoutes(r, "/workspaces/:id/flows", handler, memberService, true)
	registerFlowRoutes(r, "/projects/:id/flows", handler, memberService, false)
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
