package environment

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers environment routes
func RegisterRoutes(rg *gin.RouterGroup, handler *Handler) {
	workspaces := rg.Group("/workspaces/:id/environments")
	{
		workspaces.GET("", handler.List)
		workspaces.POST("", handler.Create)

		workspaces.GET("/:eid", handler.Get)
		workspaces.PATCH("/:eid", handler.Update)
		workspaces.DELETE("/:eid", handler.Delete)
		workspaces.POST("/:eid/duplicate", handler.Duplicate)
	}
}
