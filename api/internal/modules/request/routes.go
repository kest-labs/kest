package request

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the request module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/workspaces/:id/collections/:cid/requests", func(reqs *router.Router) {
		reqs.WithMiddleware("auth")

		// Request CRUD
		reqs.POST("", h.Create).
			Name("requests.create").
			WhereUUIDOrNumber("id", "cid")
		reqs.GET("", h.List).
			Name("requests.list").
			WhereUUIDOrNumber("id", "cid")

		// Single request operations
		reqs.GET("/:rid", h.Get).
			Name("requests.show").
			WhereUUIDOrNumber("id", "cid", "rid")
		reqs.PUT("/:rid", h.Update).
			Name("requests.update").
			WhereUUIDOrNumber("id", "cid", "rid")
		reqs.DELETE("/:rid", h.Delete).
			Name("requests.delete").
			WhereUUIDOrNumber("id", "cid", "rid")

		// Move request
		reqs.PATCH("/:rid/move", h.Move).
			Name("requests.move").
			WhereUUIDOrNumber("id", "cid", "rid")

		// Rollback request
		reqs.POST("/:rid/rollback", h.Rollback).
			Name("requests.rollback").
			WhereUUIDOrNumber("id", "cid", "rid")
	})
}
