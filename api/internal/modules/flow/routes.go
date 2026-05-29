package flow

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers flow routes
func RegisterRoutes(r *router.Router, handler *Handler, memberService member.Service) {
	r.Group("/workspaces/:id/flows", func(flows *router.Router) {
		flows.WithMiddleware("auth")

		flows.GET("", handler.ListFlows).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleRead))
		flows.POST("", handler.CreateFlow).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))

		flows.GET("/:fid", handler.GetFlow).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleRead))
		flows.PATCH("/:fid", handler.UpdateFlow).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))
		flows.PUT("/:fid", handler.SaveFlow).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))
		flows.DELETE("/:fid", handler.DeleteFlow).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))

		// Steps
		flows.POST("/:fid/steps", handler.CreateStep).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))
		flows.PATCH("/:fid/steps/:sid", handler.UpdateStep).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))
		flows.DELETE("/:fid/steps/:sid", handler.DeleteStep).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))

		// Edges
		flows.POST("/:fid/edges", handler.CreateEdge).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))
		flows.DELETE("/:fid/edges/:eid", handler.DeleteEdge).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))

		// Run
		flows.POST("/:fid/run", handler.RunFlow).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleWrite))
		flows.GET("/:fid/runs", handler.ListRuns).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleRead))
		flows.GET("/:fid/runs/:rid", handler.GetRun).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleRead))
		flows.GET("/:fid/runs/:rid/events", handler.ExecuteFlowSSE).
			Middleware(middleware.RequireWorkspaceRole(memberService, member.RoleRead))
	})
}
