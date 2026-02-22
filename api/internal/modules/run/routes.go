package run

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/collections/:cid/requests/:rid", func(run *router.Router) {
		run.WithMiddleware("auth")

		run.POST("/run", h.Run).Name("run.execute")
	})
}
