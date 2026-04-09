package apispec

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers API specification routes
func RegisterRoutes(r *router.Router, handler *Handler, memberService member.Service) {
	r.Group("/projects/:id/api-specs", func(projects *router.Router) {
		projects.WithMiddleware("auth")

		projects.GET("", handler.ListSpecs).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		projects.POST("", handler.CreateSpec).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.POST("/import", handler.ImportSpecs).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.GET("/export", handler.ExportSpecs).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		projects.POST("/batch-gen-doc", handler.BatchGenDoc).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.POST("/ai-drafts", handler.CreateAIDraft).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.GET("/ai-drafts/:aid", handler.GetAIDraft).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.POST("/ai-drafts/:aid/refine", handler.RefineAIDraft).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.POST("/ai-drafts/:aid/accept", handler.AcceptAIDraft).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))

		projects.GET("/:sid", handler.GetSpec).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		projects.GET("/:sid/full", handler.GetSpecWithExamples).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		projects.PATCH("/:sid", handler.UpdateSpec).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.DELETE("/:sid", handler.DeleteSpec).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))

		projects.POST("/:sid/gen-doc", handler.GenDoc).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.POST("/:sid/gen-test", handler.GenTest).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.GET("/:sid/examples", handler.ListExamples).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		projects.POST("/:sid/examples", handler.CreateExample).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))

		projects.GET("/:sid/share", handler.GetShare).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		projects.POST("/:sid/share", handler.PublishShare).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.DELETE("/:sid/share", handler.DeleteShare).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
	})

	r.GET("/public/api-spec-shares/:slug", handler.GetPublicShare)
}
