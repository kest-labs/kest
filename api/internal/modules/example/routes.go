package example

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the example module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/collections/:cid/requests/:rid/examples", func(exs *router.Router) {
		exs.WithMiddleware("auth")

		// Example CRUD
		exs.POST("", h.Create).Name("examples.create")
		exs.GET("", h.List).Name("examples.list")

		// Single example operations
		exs.GET("/:eid", h.Get).Name("examples.show").WhereNumber("eid")
		exs.PUT("/:eid", h.Update).Name("examples.update").WhereNumber("eid")
		exs.DELETE("/:eid", h.Delete).Name("examples.delete").WhereNumber("eid")

		// Response operations
		exs.POST("/:eid/response", h.SaveResponse).Name("examples.save_response").WhereNumber("eid")
		exs.POST("/:eid/default", h.SetDefault).Name("examples.set_default").WhereNumber("eid")
	})
}
