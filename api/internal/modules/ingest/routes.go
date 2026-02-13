package ingest

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the ingest routes
// These routes are PUBLIC and do not require authentication middleware
// Authentication is done via the X-Sentry-Auth header
func (h *Handler) RegisterRoutes(r *router.Router) {
	// Sentry SDK endpoints - these bypass normal groups
	r.Group("/api", func(api *router.Router) {
		// Main envelope endpoint (used by all modern SDKs)
		api.POST("/:project_id/envelope/", h.StoreEnvelope).Name("ingest.envelope")

		// Legacy store endpoint (deprecated but still supported)
		api.POST("/:project_id/store/", h.StoreEvent).Name("ingest.store")
	})
}
