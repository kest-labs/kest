package flow

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers flow routes
func RegisterRoutes(r *router.Router, handler *Handler, memberService member.Service) {
	r.Group("/projects/:id/flows", func(flows *router.Router) {
		flows.WithMiddleware("auth")

		flows.GET("", handler.ListFlows).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		flows.POST("", handler.CreateFlow).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))

		flows.GET("/:fid", handler.GetFlow).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		flows.PATCH("/:fid", handler.UpdateFlow).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		flows.PUT("/:fid", handler.SaveFlow).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		flows.DELETE("/:fid", handler.DeleteFlow).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))

		// Steps
		flows.POST("/:fid/steps", handler.CreateStep).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		flows.PATCH("/:fid/steps/:sid", handler.UpdateStep).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		flows.DELETE("/:fid/steps/:sid", handler.DeleteStep).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))

		// Edges
		flows.POST("/:fid/edges", handler.CreateEdge).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		flows.DELETE("/:fid/edges/:eid", handler.DeleteEdge).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))

		// Run
		flows.POST("/:fid/run", handler.RunFlow).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		flows.GET("/:fid/runs", handler.ListRuns).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		flows.GET("/:fid/runs/:rid", handler.GetRun).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		flows.GET("/:fid/runs/:rid/events", handler.ExecuteFlowSSE).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
	})
}
