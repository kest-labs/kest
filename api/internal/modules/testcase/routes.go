package testcase

import (
	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers test case routes
func RegisterRoutes(router *gin.RouterGroup, handler *Handler, memberService member.Service) {
	// All test case operations are now project-scoped
	projects := router.Group("/projects/:id/test-cases")
	{
		projects.GET("", middleware.RequireProjectRole(memberService, member.RoleRead), handler.List)
		projects.POST("", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.Create)
		projects.GET("/:tcid", middleware.RequireProjectRole(memberService, member.RoleRead), handler.Get)
		projects.PATCH("/:tcid", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.Update)
		projects.DELETE("/:tcid", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.Delete)
		projects.POST("/:tcid/duplicate", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.Duplicate)
		projects.POST("/from-spec", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.FromSpec)
		projects.POST("/:tcid/run", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.RunTestCase)
	}
}
