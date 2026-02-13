package category

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers category routes
func RegisterRoutes(r *router.Router, handler *Handler, memberService member.Service) {
	// All category operations are now project-scoped
	r.Group("/projects/:id/categories", func(projects *router.Router) {
		projects.WithMiddleware("auth")

		projects.GET("", handler.List).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		projects.POST("", handler.Create).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.PUT("/sort", handler.Sort).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))

		projects.GET("/:cid", handler.Get).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleRead))
		projects.PATCH("/:cid", handler.Update).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
		projects.DELETE("/:cid", handler.Delete).
			Middleware(middleware.RequireProjectRole(memberService, member.RoleWrite))
	})
}
