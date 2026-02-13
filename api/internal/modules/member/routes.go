package member

import (
	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
)

// RegisterRoutes registers member routes
func RegisterRoutes(rg *gin.RouterGroup, handler *Handler, memberService Service) {
	// Project based member routes
	projects := rg.Group("/projects/:id/members")
	projects.Use(middleware.RequireProjectRole(memberService, RoleAdmin))
	{
		projects.GET("", middleware.RequireProjectRole(memberService, RoleRead), handler.List)
		projects.POST("", handler.Create)
		projects.PATCH("/:uid", handler.Update)
		projects.DELETE("/:uid", handler.Delete)
	}
}
