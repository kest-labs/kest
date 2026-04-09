package collection

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers the collection module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/collections", func(cols *router.Router) {
		cols.WithMiddleware("auth")

		// Collection CRUD
		cols.POST("", h.Create).
			Name("collections.create").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		cols.GET("", h.List).
			Name("collections.list").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		cols.GET("/tree", h.GetTree).
			Name("collections.tree").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))

		// Single collection operations
		cols.GET("/:cid", h.Get).
			Name("collections.show").
			WhereNumber("cid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		cols.PUT("/:cid", h.Update).
			Name("collections.update").
			WhereNumber("cid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		cols.DELETE("/:cid", h.Delete).
			Name("collections.delete").
			WhereNumber("cid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))

		// Move collection
		cols.PATCH("/:cid/move", h.Move).
			Name("collections.move").
			WhereNumber("cid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
	})
}
