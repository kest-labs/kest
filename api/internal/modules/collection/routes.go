package collection

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the collection module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/workspaces/:id/collections", func(cols *router.Router) {
		cols.WithMiddleware("auth")

		// Collection CRUD
		cols.POST("", h.Create).
			Name("collections.create").
			WhereUUIDOrNumber("id")
		cols.GET("", h.List).
			Name("collections.list").
			WhereUUIDOrNumber("id")
		cols.GET("/tree", h.GetTree).
			Name("collections.tree").
			WhereUUIDOrNumber("id")

		// Single collection operations
		cols.GET("/:cid", h.Get).
			Name("collections.show").
			WhereUUIDOrNumber("id", "cid")
		cols.PUT("/:cid", h.Update).
			Name("collections.update").
			WhereUUIDOrNumber("id", "cid")
		cols.DELETE("/:cid", h.Delete).
			Name("collections.delete").
			WhereUUIDOrNumber("id", "cid")

		// Move collection
		cols.PATCH("/:cid/move", h.Move).
			Name("collections.move").
			WhereUUIDOrNumber("id", "cid")
	})
}
