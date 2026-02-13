package member

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
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
	r.Group("/projects/:id/members", func(members *router.Router) {
		members.WithMiddleware("auth")

		members.GET("", h.List).
			Middleware(middleware.RequireProjectRole(h.service, RoleRead))
		members.GET("/me", h.GetMyRole).
			Middleware(middleware.RequireProjectRole(h.service, RoleRead))
		members.POST("", h.Create).
			Middleware(middleware.RequireProjectRole(h.service, RoleAdmin))
		members.PATCH("/:uid", h.Update).
			Middleware(middleware.RequireProjectRole(h.service, RoleAdmin))
		members.DELETE("/:uid", h.Delete).
			Middleware(middleware.RequireProjectRole(h.service, RoleAdmin))
	})
}

func (h *Handler) ListMembers(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	members, err := h.service.ListMembers(c.Request.Context(), uint(projectID))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, members)
}

func (h *Handler) AddMember(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	var req AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	member, err := h.service.AddMember(c.Request.Context(), uint(projectID), &req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, member)
}

func (h *Handler) UpdateMember(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	userIDStr := c.Param("uid")
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req UpdateMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	member, err := h.service.UpdateMember(c.Request.Context(), uint(projectID), uint(userID), &req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, member)
}

func (h *Handler) RemoveMember(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	userIDStr := c.Param("uid")
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	if err := h.service.RemoveMember(c.Request.Context(), uint(projectID), uint(userID)); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// Convenience methods for router registration
func (h *Handler) List(c *gin.Context) {
	h.ListMembers(c)
}

func (h *Handler) Create(c *gin.Context) {
	h.AddMember(c)
}

func (h *Handler) Update(c *gin.Context) {
	h.UpdateMember(c)
}

func (h *Handler) Delete(c *gin.Context) {
	h.RemoveMember(c)
}

// GetMyRole returns the current user's role in the project
func (h *Handler) GetMyRole(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		response.Error(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	uid, ok := userID.(uint)
	if !ok {
		response.Error(c, http.StatusInternalServerError, "Invalid user ID in context")
		return
	}

	member, err := h.service.GetMember(c.Request.Context(), uint(projectID), uid)
	if err != nil {
		response.Error(c, http.StatusNotFound, "Not a member of this project")
		return
	}

	response.Success(c, member)
}
