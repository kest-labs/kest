package member

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

type Handler struct {
	contracts.BaseModule
	service Service
}

func (h *Handler) Name() string {
	return "member"
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers member routes on the fluent router
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/workspaces/:id/members", func(members *router.Router) {
		members.WithMiddleware("auth")

		members.GET("", h.List).
			Middleware(middleware.RequireWorkspaceRole(h.service, RoleRead))
		members.GET("/me", h.GetMyRole).
			Middleware(middleware.RequireWorkspaceRole(h.service, RoleRead))
		members.PATCH("/:uid", h.Update).
			Middleware(middleware.RequireWorkspaceRole(h.service, RoleAdmin))
		members.DELETE("/:uid", h.Delete).
			Middleware(middleware.RequireWorkspaceRole(h.service, RoleAdmin))
	})
}

func (h *Handler) ListMembers(c *gin.Context) {
	workspaceID := c.Param("id")
	if workspaceID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid workspace ID")
		return
	}

	members, err := h.service.ListMembers(c.Request.Context(), workspaceID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, members)
}

func (h *Handler) UpdateMember(c *gin.Context) {
	workspaceID := c.Param("id")
	if workspaceID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid workspace ID")
		return
	}

	userID, ok := handler.ParseID(c, "uid")
	if !ok {
		return
	}

	var req UpdateMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	member, err := h.service.UpdateMember(c.Request.Context(), workspaceID, userID, &req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, member)
}

func (h *Handler) RemoveMember(c *gin.Context) {
	workspaceID := c.Param("id")
	if workspaceID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid workspace ID")
		return
	}

	userID, ok := handler.ParseID(c, "uid")
	if !ok {
		return
	}

	if err := h.service.RemoveMember(c.Request.Context(), workspaceID, userID); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// Convenience methods for router registration
func (h *Handler) List(c *gin.Context) {
	h.ListMembers(c)
}

func (h *Handler) Update(c *gin.Context) {
	h.UpdateMember(c)
}

func (h *Handler) Delete(c *gin.Context) {
	h.RemoveMember(c)
}

// GetMyRole returns the current user's role in the workspace
func (h *Handler) GetMyRole(c *gin.Context) {
	workspaceID := c.Param("id")
	if workspaceID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid workspace ID")
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	member, err := h.service.GetMember(c.Request.Context(), workspaceID, userID)
	if err != nil {
		response.Error(c, http.StatusNotFound, "Not a member of this workspace")
		return
	}

	response.Success(c, member)
}
