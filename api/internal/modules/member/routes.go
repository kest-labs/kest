package member

import "github.com/gin-gonic/gin"

// RegisterRoutes registers member routes
func RegisterRoutes(rg *gin.RouterGroup, handler *Handler, memberService Service) {
	_ = rg
	_ = handler
	_ = memberService
}
