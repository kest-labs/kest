package permission

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles permission-related HTTP requests and implements contracts.Module
type Handler struct {
	contracts.BaseModule
	service Service
}

// NewHandler creates a new permission handler
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// Name returns the module name
func (h *Handler) Name() string {
	return "permission"
}

// CreateRole creates a new role
// @Summary Create a new role
// @Tags Roles
// @Accept json
// @Produce json
// @Param request body CreateRoleRequest true "Role details"
// @Success 201 {object} RoleResponse
// @Router /api/v1/roles [post]
func (h *Handler) CreateRole(c *gin.Context) {
	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request", err)
		return
	}

	role, err := h.service.CreateRole(c.Request.Context(), &req)
	if err != nil {
		response.InternalServerError(c, "Failed to create role", err)
		return
	}

	c.JSON(http.StatusCreated, role)
}

// GetRole gets a role by ID
// @Summary Get a role
// @Tags Roles
// @Produce json
// @Param id path int true "Role ID"
// @Success 200 {object} RoleResponse
// @Router /api/v1/roles/{id} [get]
func (h *Handler) GetRole(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid role ID", err)
		return
	}

	role, err := h.service.GetRole(c.Request.Context(), uint(id))
	if err != nil {
		response.NotFound(c, "Role not found", err)
		return
	}

	c.JSON(http.StatusOK, role)
}

// ListRoles lists all roles
// @Summary List all roles
// @Tags Roles
// @Produce json
// @Success 200 {array} RoleResponse
// @Router /api/v1/roles [get]
func (h *Handler) ListRoles(c *gin.Context) {
	roles, err := h.service.ListRoles(c.Request.Context())
	if err != nil {
		response.InternalServerError(c, "Failed to list roles", err)
		return
	}

	c.JSON(http.StatusOK, roles)
}

// UpdateRole updates a role
// @Summary Update a role
// @Tags Roles
// @Accept json
// @Produce json
// @Param id path int true "Role ID"
// @Param request body UpdateRoleRequest true "Role details"
// @Success 200 {object} RoleResponse
// @Router /api/v1/roles/{id} [put]
func (h *Handler) UpdateRole(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid role ID", err)
		return
	}

	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request", err)
		return
	}

	role, err := h.service.UpdateRole(c.Request.Context(), uint(id), &req)
	if err != nil {
		response.InternalServerError(c, "Failed to update role", err)
		return
	}

	c.JSON(http.StatusOK, role)
}

// DeleteRole deletes a role
// @Summary Delete a role
// @Tags Roles
// @Param id path int true "Role ID"
// @Success 204
// @Router /api/v1/roles/{id} [delete]
func (h *Handler) DeleteRole(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid role ID", err)
		return
	}

	if err := h.service.DeleteRole(c.Request.Context(), uint(id)); err != nil {
		response.InternalServerError(c, "Failed to delete role", err)
		return
	}

	c.Status(http.StatusNoContent)
}

// AssignRole assigns a role to a user
// @Summary Assign role to user
// @Tags Roles
// @Accept json
// @Param request body AssignRoleRequest true "Assignment details"
// @Success 204
// @Router /api/v1/roles/assign [post]
func (h *Handler) AssignRole(c *gin.Context) {
	var req AssignRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request", err)
		return
	}

	if err := h.service.AssignRoleToUser(c.Request.Context(), req.UserID, req.RoleID); err != nil {
		response.InternalServerError(c, "Failed to assign role", err)
		return
	}

	c.Status(http.StatusNoContent)
}

// RemoveRole removes a role from a user
// @Summary Remove role from user
// @Tags Roles
// @Accept json
// @Param request body AssignRoleRequest true "Assignment details"
// @Success 204
// @Router /api/v1/roles/remove [post]
func (h *Handler) RemoveRole(c *gin.Context) {
	var req AssignRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request", err)
		return
	}

	if err := h.service.RemoveRoleFromUser(c.Request.Context(), req.UserID, req.RoleID); err != nil {
		response.InternalServerError(c, "Failed to remove role", err)
		return
	}

	c.Status(http.StatusNoContent)
}

// GetUserRoles gets all roles for a user
// @Summary Get user roles
// @Tags Roles
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} UserRolesResponse
// @Router /api/v1/users/{id}/roles [get]
func (h *Handler) GetUserRoles(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid user ID", err)
		return
	}

	roles, err := h.service.GetUserRoles(c.Request.Context(), uint(userID))
	if err != nil {
		response.InternalServerError(c, "Failed to get user roles", err)
		return
	}

	c.JSON(http.StatusOK, UserRolesResponse{
		UserID: uint(userID),
		Roles:  roles,
	})
}

// ListPermissions lists all permissions
// @Summary List all permissions
// @Tags Permissions
// @Produce json
// @Success 200 {array} PermissionResponse
// @Router /api/v1/permissions [get]
func (h *Handler) ListPermissions(c *gin.Context) {
	perms, err := h.service.ListPermissions(c.Request.Context())
	if err != nil {
		response.InternalServerError(c, "Failed to list permissions", err)
		return
	}

	c.JSON(http.StatusOK, perms)
}
