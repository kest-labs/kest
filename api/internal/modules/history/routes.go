package history

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/history", func(hist *router.Router) {
		hist.WithMiddleware("auth")

		hist.GET("", h.List).Name("history.list")
		hist.GET("/:hid", h.Get).Name("history.show").WhereNumber("hid")
	})
}
