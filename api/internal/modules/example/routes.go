package example

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the example module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/workspaces/:id/collections/:cid/requests/:rid/examples", func(exs *router.Router) {
		exs.WithMiddleware("auth")

		// Example CRUD
		exs.POST("", h.Create).Name("examples.create").WhereUUIDOrNumber("id", "cid", "rid")
		exs.GET("", h.List).Name("examples.list").WhereUUIDOrNumber("id", "cid", "rid")

		// Single example operations
		exs.GET("/:eid", h.Get).Name("examples.show").WhereUUIDOrNumber("id", "cid", "rid", "eid")
		exs.PUT("/:eid", h.Update).Name("examples.update").WhereUUIDOrNumber("id", "cid", "rid", "eid")
		exs.DELETE("/:eid", h.Delete).Name("examples.delete").WhereUUIDOrNumber("id", "cid", "rid", "eid")

		// Response operations
		exs.POST("/:eid/response", h.SaveResponse).Name("examples.save_response").WhereUUIDOrNumber("id", "cid", "rid", "eid")
		exs.POST("/:eid/default", h.SetDefault).Name("examples.set_default").WhereUUIDOrNumber("id", "cid", "rid", "eid")
	})
}
