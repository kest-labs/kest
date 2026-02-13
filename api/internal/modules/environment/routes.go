package environment

import (
	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers environment routes
func RegisterRoutes(rg *gin.RouterGroup, handler *Handler, memberService member.Service) {
	// All environment operations are now project-scoped
	projects := rg.Group("/projects/:id/environments")
	{
		projects.GET("", middleware.RequireProjectRole(memberService, member.RoleRead), handler.List)
		projects.POST("", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.Create)

		projects.GET("/:eid", middleware.RequireProjectRole(memberService, member.RoleRead), handler.Get)
		projects.PATCH("/:eid", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.Update)
		projects.DELETE("/:eid", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.Delete)
		projects.POST("/:eid/duplicate", middleware.RequireProjectRole(memberService, member.RoleWrite), handler.Duplicate)
	}
}
