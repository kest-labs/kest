package history

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/workspaces/:id/history", func(hist *router.Router) {
		hist.WithMiddleware("auth")

		hist.POST("", h.Create).
			Name("history.create").
			WhereUUIDOrNumber("id")
		hist.GET("", h.List).
			Name("history.list").
			WhereUUIDOrNumber("id")
		hist.GET("/:hid", h.Get).
			Name("history.show").
			WhereUUIDOrNumber("id", "hid")
	})
}
