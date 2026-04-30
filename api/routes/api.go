package routes

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/app"
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterAPI registers all API routes using fluent router
func RegisterAPI(r *router.Router, handlers *app.Handlers) {
	// 1. Health Checks
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": "v1"})
	}).Name("health")

	if handlers == nil {
		return
	}

	if handlers.Project != nil && handlers.APISpec != nil {
		handlers.Project.SetSpecSyncer(handlers.APISpec)
	}
	if handlers.Project != nil && handlers.History != nil {
		handlers.Project.SetHistorySyncer(handlers.History)
	}

	// 2. Register Module Routes
	for _, m := range handlers.Modules() {
		if m == nil {
			continue
		}
		log.Printf("[ROUTER] Registering module: %s", m.Name())
		m.RegisterRoutes(r)
	}
}
