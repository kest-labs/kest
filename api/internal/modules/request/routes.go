package request

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers the request module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/collections/:cid/requests", func(reqs *router.Router) {
		reqs.WithMiddleware("auth")

		// Request CRUD
		reqs.POST("", h.Create).
			Name("requests.create").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		reqs.GET("", h.List).
			Name("requests.list").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))

		// Single request operations
		reqs.GET("/:rid", h.Get).
			Name("requests.show").
			WhereNumber("rid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		reqs.PUT("/:rid", h.Update).
			Name("requests.update").
			WhereNumber("rid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		reqs.DELETE("/:rid", h.Delete).
			Name("requests.delete").
			WhereNumber("rid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))

		// Move request
		reqs.PATCH("/:rid/move", h.Move).
			Name("requests.move").
			WhereNumber("rid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))

		// Rollback request
		reqs.POST("/:rid/rollback", h.Rollback).
			Name("requests.rollback").
			WhereNumber("rid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
	})
}
