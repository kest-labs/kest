package collection

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the collection module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/collections", func(cols *router.Router) {
		cols.WithMiddleware("auth")

		// Collection CRUD
		cols.POST("", h.Create).Name("collections.create")
		cols.GET("", h.List).Name("collections.list")
		cols.GET("/tree", h.GetTree).Name("collections.tree")

		// Single collection operations
		cols.GET("/:cid", h.Get).Name("collections.show").WhereNumber("cid")
		cols.PUT("/:cid", h.Update).Name("collections.update").WhereNumber("cid")
		cols.DELETE("/:cid", h.Delete).Name("collections.delete").WhereNumber("cid")

		// Move collection
		cols.PATCH("/:cid/move", h.Move).Name("collections.move").WhereNumber("cid")
	})
}
