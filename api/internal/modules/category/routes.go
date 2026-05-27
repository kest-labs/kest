package category

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers category routes
func RegisterRoutes(r *router.Router, handler *Handler) {
	r.Group("/workspaces/:id/categories", func(categories *router.Router) {
		categories.WithMiddleware("auth")

		categories.GET("", handler.List).WhereUUIDOrNumber("id")
		categories.POST("", handler.Create).WhereUUIDOrNumber("id")
		categories.PUT("/sort", handler.Sort).WhereUUIDOrNumber("id")

		categories.GET("/:cid", handler.Get).WhereUUIDOrNumber("id", "cid")
		categories.PATCH("/:cid", handler.Update).WhereUUIDOrNumber("id", "cid")
		categories.DELETE("/:cid", handler.Delete).WhereUUIDOrNumber("id", "cid")
	})
}
