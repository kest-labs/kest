package project

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the project module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	// Protected routes - require authentication
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		// Project CRUD
		auth.POST("/projects", h.Create).Name("projects.create")
		auth.GET("/projects", h.List).Name("projects.list")
		auth.GET("/projects/:id", h.Get).Name("projects.show").WhereNumber("id")
		auth.PUT("/projects/:id", h.Update).Name("projects.update").WhereNumber("id")
		auth.PATCH("/projects/:id", h.Update).Name("projects.patch").WhereNumber("id")
		auth.DELETE("/projects/:id", h.Delete).Name("projects.delete").WhereNumber("id")

		// Stats endpoint
		auth.GET("/projects/:id/stats", h.GetStats).Name("projects.stats").WhereNumber("id")

		// DSN endpoint
		auth.GET("/projects/:id/dsn", h.GetDSN).Name("projects.dsn").WhereNumber("id")
	})
}
