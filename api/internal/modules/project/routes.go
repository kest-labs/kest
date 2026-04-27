package project

import (
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers the project module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	// Protected routes - require authentication
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		// Project CRUD
		auth.POST("/projects", h.Create).Name("projects.create")
		auth.GET("/projects", h.List).Name("projects.list")
		auth.GET("/projects/:id", h.Get).
			Name("projects.show").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		auth.PUT("/projects/:id", h.Update).
			Name("projects.update").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		auth.PATCH("/projects/:id", h.Update).
			Name("projects.patch").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		auth.DELETE("/projects/:id", h.Delete).
			Name("projects.delete").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleAdmin))

		// Stats endpoint
		auth.GET("/projects/:id/stats", h.GetStats).
			Name("projects.stats").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		auth.POST("/projects/:id/cli-tokens", h.GenerateCLIToken).
			Name("projects.cli_tokens.create").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
	})

	r.Group("", func(cli *router.Router) {
		cli.POST("/projects/:id/cli/spec-sync", h.SyncSpecsFromCLI).
			Name("projects.cli.spec_sync").
			WhereUUIDOrNumber("id").
			Middleware(middleware.RequireProjectCLIToken(h.service, CLITokenScopeSpecWrite))
	})
}
