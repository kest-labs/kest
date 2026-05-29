package testcase

import (
	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers test case routes
func RegisterRoutes(router *gin.RouterGroup, handler *Handler, memberService member.Service) {
	// All test case operations are now workspace-scoped
	workspaces := router.Group("/workspaces/:id/test-cases")
	{
		workspaces.GET("", middleware.RequireWorkspaceRole(memberService, member.RoleRead), handler.List)
		workspaces.POST("", middleware.RequireWorkspaceRole(memberService, member.RoleWrite), handler.Create)
		workspaces.GET("/:tcid", middleware.RequireWorkspaceRole(memberService, member.RoleRead), handler.Get)
		workspaces.PATCH("/:tcid", middleware.RequireWorkspaceRole(memberService, member.RoleWrite), handler.Update)
		workspaces.DELETE("/:tcid", middleware.RequireWorkspaceRole(memberService, member.RoleWrite), handler.Delete)
		workspaces.POST("/:tcid/duplicate", middleware.RequireWorkspaceRole(memberService, member.RoleWrite), handler.Duplicate)
		workspaces.POST("/from-spec", middleware.RequireWorkspaceRole(memberService, member.RoleWrite), handler.FromSpec)
		workspaces.POST("/batch-from-specs", middleware.RequireWorkspaceRole(memberService, member.RoleWrite), handler.BatchFromSpecs)
		workspaces.POST("/:tcid/run", middleware.RequireWorkspaceRole(memberService, member.RoleWrite), handler.RunTestCase)
	}
}
