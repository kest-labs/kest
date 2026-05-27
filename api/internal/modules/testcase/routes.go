package testcase

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers test case routes
func RegisterRoutes(router *gin.RouterGroup, handler *Handler) {
	workspaces := router.Group("/workspaces/:id/test-cases")
	{
		workspaces.GET("", handler.List)
		workspaces.POST("", handler.Create)
		workspaces.GET("/:tcid", handler.Get)
		workspaces.PATCH("/:tcid", handler.Update)
		workspaces.DELETE("/:tcid", handler.Delete)
		workspaces.POST("/:tcid/duplicate", handler.Duplicate)
		workspaces.POST("/from-spec", handler.FromSpec)
		workspaces.POST("/:tcid/run", handler.RunTestCase)
	}
}
