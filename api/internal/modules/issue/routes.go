package issue

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the issue routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	// Project-scoped issue routes (note: /v1 prefix is already added by root router)
	// Using :id instead of :project_id to match Project routes convention and avoid Gin conflicts
	r.Group("/projects/:id/issues", func(issues *router.Router) {
		// List issues
		issues.GET("/", h.List).Name("issues.list")

		// Issue details
		issues.GET("/:fingerprint", h.Get).Name("issues.get")

		// Status management
		issues.POST("/:fingerprint/resolve", h.Resolve).Name("issues.resolve")
		issues.POST("/:fingerprint/ignore", h.Ignore).Name("issues.ignore")
		issues.POST("/:fingerprint/reopen", h.Reopen).Name("issues.reopen")

		// Get events for an issue
		issues.GET("/:fingerprint/events", h.GetEvents).Name("issues.events")
	})
}
