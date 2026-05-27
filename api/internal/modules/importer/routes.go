package importer

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/workspaces/:id/collections/import", func(imp *router.Router) {
		imp.WithMiddleware("auth")

		imp.POST("/postman", h.ImportPostman).
			Name("importer.postman").
			WhereUUIDOrNumber("id")
		imp.POST("/markdown", h.ImportMarkdown).
			Name("importer.markdown").
			WhereUUIDOrNumber("id")
	})
}
