package request

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the request module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/collections/:cid/requests", func(reqs *router.Router) {
		reqs.WithMiddleware("auth")

		// Request CRUD
		reqs.POST("", h.Create).Name("requests.create")
		reqs.GET("", h.List).Name("requests.list")

		// Single request operations
		reqs.GET("/:rid", h.Get).Name("requests.show").WhereNumber("rid")
		reqs.PUT("/:rid", h.Update).Name("requests.update").WhereNumber("rid")
		reqs.DELETE("/:rid", h.Delete).Name("requests.delete").WhereNumber("rid")

		// Move request
		reqs.PATCH("/:rid/move", h.Move).Name("requests.move").WhereNumber("rid")

		// Rollback request
		reqs.POST("/:rid/rollback", h.Rollback).Name("requests.rollback").WhereNumber("rid")
	})
}
