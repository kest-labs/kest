package routes

import (
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"github.com/kest-labs/kest/api/internal/app"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/monitor"
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// Setup configures all application routes using the fluent router API
func Setup(engine *gin.Engine, handlers *app.Handlers) *router.Router {
	r := router.New(engine)

	// Register middleware groups
	r.MiddlewareGroup("web", gin.Logger(), gin.Recovery())
	r.MiddlewareGroup("api", gin.Logger(), gin.Recovery())
	r.MiddlewareGroup("auth", middleware.JWTAuth())

	// Register middleware aliases
	r.AliasMiddleware("jwt", middleware.JWTAuth())

	// Apply global middleware
	r.Use(gin.Logger(), gin.Recovery())

	// Swagger documentation
	engine.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Root endpoint - Welcome page
	RegisterWelcome(engine)

	// === Sentry SDK Compatible Routes ===
	// These routes are registered at root level (without /v1 prefix)
	// because Sentry SDK sends to /api/:project_id/envelope/
	if handlers.Ingest != nil {
		handlers.Ingest.RegisterRoutes(r)
	}

	// Register V1 API Routes
	r.Group("/v1", func(api *router.Router) {
		RegisterAPI(api, handlers)
	})

	// Register Monitor
	monitor.RegisterRoutes(engine)

	return r
}
