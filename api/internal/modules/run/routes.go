package run

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/collections/:cid/requests/:rid", func(run *router.Router) {
		run.WithMiddleware("auth")

		run.POST("/run", h.Run).
			Name("run.execute").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
	})
}
