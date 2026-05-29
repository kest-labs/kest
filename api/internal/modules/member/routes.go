package member

import (
	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/infra/middleware"
)

// RegisterRoutes registers member routes
func RegisterRoutes(rg *gin.RouterGroup, handler *Handler, memberService Service) {
	// Workspace based member routes
	workspaces := rg.Group("/workspaces/:id/members")
	workspaces.Use(middleware.RequireWorkspaceRole(memberService, RoleAdmin))
	{
		workspaces.GET("", middleware.RequireWorkspaceRole(memberService, RoleRead), handler.List)
		workspaces.PATCH("/:uid", handler.Update)
		workspaces.DELETE("/:uid", handler.Delete)
	}
}
