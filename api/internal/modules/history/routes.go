package history

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/history", func(hist *router.Router) {
		hist.WithMiddleware("auth")

		hist.POST("", h.Create).
			Name("history.create").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		hist.GET("", h.List).
			Name("history.list").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		hist.GET("/:hid", h.Get).
			Name("history.show").
			WhereNumber("hid").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
	})
}
