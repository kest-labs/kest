package environment

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for environments
type Handler struct {
	contracts.BaseModule
	service       Service
	memberService member.Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "environment"
}

// NewHandler creates a new environment handler
func NewHandler(service Service, memberService member.Service) *Handler {
	return &Handler{service: service, memberService: memberService}
}

// RegisterRoutes registers environment routes on the fluent router
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/environments", func(envs *router.Router) {
		envs.WithMiddleware("auth")

		envs.GET("", h.List).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		envs.POST("", h.Create).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))

		envs.GET("/:eid", h.Get).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		envs.PATCH("/:eid", h.Update).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		envs.DELETE("/:eid", h.Delete).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		envs.POST("/:eid/duplicate", h.Duplicate).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
	})
}

// ListEnvironments handles GET /api/v1/projects/:project_id/environments
func (h *Handler) ListEnvironments(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	envs, err := h.service.ListEnvironments(c.Request.Context(), uint(projectID))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"items": envs,
		"total": len(envs),
	})
}

// CreateEnvironment handles POST /api/v1/projects/:project_id/environments
func (h *Handler) CreateEnvironment(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	var req CreateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// Ensure project_id matches
	req.ProjectID = uint(projectID)

	env, err := h.service.CreateEnvironment(c.Request.Context(), &req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, env)
}

// GetEnvironment handles GET /api/v1/projects/:id/environments/:eid
func (h *Handler) GetEnvironment(c *gin.Context) {
	idStr := c.Param("eid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid environment ID")
		return
	}

	env, err := h.service.GetEnvironment(c.Request.Context(), uint(id))
	if err != nil {
		if err.Error() == "environment not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, env)
}

// UpdateEnvironment handles PATCH /api/v1/projects/:id/environments/:eid
func (h *Handler) UpdateEnvironment(c *gin.Context) {
	idStr := c.Param("eid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid environment ID")
		return
	}

	var req UpdateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	env, err := h.service.UpdateEnvironment(c.Request.Context(), uint(id), &req)
	if err != nil {
		if err.Error() == "environment not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, env)
}

// DeleteEnvironment handles DELETE /api/v1/projects/:id/environments/:eid
func (h *Handler) DeleteEnvironment(c *gin.Context) {
	idStr := c.Param("eid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid environment ID")
		return
	}

	if err := h.service.DeleteEnvironment(c.Request.Context(), uint(id)); err != nil {
		if err.Error() == "environment not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// DuplicateEnvironment handles POST /api/v1/projects/:id/environments/:eid/duplicate
func (h *Handler) DuplicateEnvironment(c *gin.Context) {
	idStr := c.Param("eid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid environment ID")
		return
	}

	var req DuplicateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	env, err := h.service.DuplicateEnvironment(c.Request.Context(), uint(id), &req)
	if err != nil {
		if err.Error() == "source environment not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, env)
}

// Convenience methods for router registration
func (h *Handler) List(c *gin.Context) {
	h.ListEnvironments(c)
}

func (h *Handler) Create(c *gin.Context) {
	h.CreateEnvironment(c)
}

func (h *Handler) Get(c *gin.Context) {
	h.GetEnvironment(c)
}

func (h *Handler) Update(c *gin.Context) {
	h.UpdateEnvironment(c)
}

func (h *Handler) Delete(c *gin.Context) {
	h.DeleteEnvironment(c)
}

func (h *Handler) Duplicate(c *gin.Context) {
	h.DuplicateEnvironment(c)
}
