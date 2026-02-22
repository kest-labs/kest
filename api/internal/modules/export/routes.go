package export

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/collections/:cid/export", func(ex *router.Router) {
		ex.WithMiddleware("auth")

		ex.GET("/postman", h.ExportPostman).Name("export.postman")
	})
}
