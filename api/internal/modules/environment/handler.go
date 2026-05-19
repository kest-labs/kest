package environment

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

var errEnvironmentAccessDenied = errors.New("workspace not found or access denied")

// Handler handles HTTP requests for environments
type Handler struct {
	contracts.BaseModule
	service          Service
	workspaceService workspace.Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "environment"
}

// NewHandler creates a new environment handler
func NewHandler(service Service, workspaceService workspace.Service) *Handler {
	return &Handler{service: service, workspaceService: workspaceService}
}

// RegisterRoutes registers environment routes on the fluent router
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/workspaces/:id/environments", func(envs *router.Router) {
		envs.WithMiddleware("auth")

		envs.GET("", h.List).WhereUUIDOrNumber("id")
		envs.POST("", h.Create).WhereUUIDOrNumber("id")

		envs.GET("/:eid", h.Get).WhereUUIDOrNumber("id", "eid")
		envs.PATCH("/:eid", h.Update).WhereUUIDOrNumber("id", "eid")
		envs.DELETE("/:eid", h.Delete).WhereUUIDOrNumber("id", "eid")
		envs.POST("/:eid/duplicate", h.Duplicate).WhereUUIDOrNumber("id", "eid")
	})
}

// ListEnvironments handles GET /api/v1/workspaces/:workspace_id/environments
func (h *Handler) ListEnvironments(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleRead)
	if !ok {
		return
	}

	envs, err := h.service.ListEnvironments(c.Request.Context(), workspaceID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"items": envs,
		"total": len(envs),
	})
}

// CreateEnvironment handles POST /api/v1/workspaces/:workspace_id/environments
func (h *Handler) CreateEnvironment(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	var req CreateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	req.WorkspaceID = workspaceID

	env, err := h.service.CreateEnvironment(c.Request.Context(), &req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, env)
}

// GetEnvironment handles GET /api/v1/workspaces/:id/environments/:eid
func (h *Handler) GetEnvironment(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleRead)
	if !ok {
		return
	}

	id := c.Param("eid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid environment ID")
		return
	}

	env, err := h.service.GetEnvironment(c.Request.Context(), workspaceID, id)
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

// UpdateEnvironment handles PATCH /api/v1/workspaces/:id/environments/:eid
func (h *Handler) UpdateEnvironment(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	id := c.Param("eid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid environment ID")
		return
	}

	var req UpdateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	env, err := h.service.UpdateEnvironment(c.Request.Context(), workspaceID, id, &req)
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

// DeleteEnvironment handles DELETE /api/v1/workspaces/:id/environments/:eid
func (h *Handler) DeleteEnvironment(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	id := c.Param("eid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid environment ID")
		return
	}
	if err := h.service.DeleteEnvironment(c.Request.Context(), workspaceID, id); err != nil {
		if err.Error() == "environment not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// DuplicateEnvironment handles POST /api/v1/workspaces/:id/environments/:eid/duplicate
func (h *Handler) DuplicateEnvironment(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	id := c.Param("eid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid environment ID")
		return
	}

	var req DuplicateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	env, err := h.service.DuplicateEnvironment(c.Request.Context(), workspaceID, id, &req)
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

func (h *Handler) authorizeWorkspace(c *gin.Context, requiredRole string) (string, bool) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return "", false
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		return "", false
	}

	allowed, err := h.workspaceService.HasPermission(
		workspaceID,
		userID,
		requiredRole,
		false,
	)
	if err != nil || !allowed {
		response.Error(c, http.StatusForbidden, errEnvironmentAccessDenied.Error())
		return "", false
	}

	return workspaceID, true
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
