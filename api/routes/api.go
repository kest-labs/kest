package routes

import (
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

	// 2. Register Module Routes
	for _, m := range handlers.Modules() {
		m.RegisterRoutes(r)
	}
}
