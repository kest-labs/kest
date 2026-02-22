package importer

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/collections/import", func(imp *router.Router) {
		imp.WithMiddleware("auth")

		imp.POST("/postman", h.ImportPostman).Name("importer.postman")
	})
}
