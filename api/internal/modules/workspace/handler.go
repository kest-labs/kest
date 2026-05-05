package workspace

import (
	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/domain"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for workspace operations
type Handler struct {
	service Service
}

// NewHandler creates a new workspace handler
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// CreateWorkspace handles workspace creation
// @Summary Create a new workspace
// @Tags Workspace
// @Accept json
// @Produce json
// @Param body body CreateWorkspaceRequest true "Workspace details"
// @Success 201 {object} WorkspaceResponse
// @Router /workspaces [post]
func (h *Handler) CreateWorkspace(c *gin.Context) {
	var req CreateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data", err)
		return
	}

	// Get user from context (set by auth middleware)
	user, exists := c.Get("user")
	if !exists {
		response.Unauthorized(c, "user not authenticated")
		return
	}
	currentUser := user.(*domain.User)

	workspace, err := h.service.CreateWorkspace(&req, currentUser.ID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, FromWorkspace(workspace))
}

// ListWorkspaces lists all workspaces accessible to the current user
// @Summary List workspaces
// @Tags Workspace
// @Produce json
// @Success 200 {array} WorkspaceResponse
// @Router /workspaces [get]
func (h *Handler) ListWorkspaces(c *gin.Context) {
	user, _ := c.Get("user")
	currentUser := user.(*domain.User)

	workspaces, err := h.service.ListWorkspaces(currentUser.ID, currentUser.IsSuperAdmin)
	if err != nil {
		response.InternalServerError(c, "Failed to list workspaces", err)
		return
	}

	response.Success(c, FromWorkspaceList(workspaces))
}

// GetWorkspace gets a workspace by ID
// @Summary Get workspace details
// @Tags Workspace
// @Produce json
// @Param id path string true "Workspace ID"
// @Success 200 {object} WorkspaceResponse
// @Router /workspaces/{id} [get]
func (h *Handler) GetWorkspace(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	user, _ := c.Get("user")
	currentUser := user.(*domain.User)

	workspace, err := h.service.GetWorkspace(id, currentUser.ID, currentUser.IsSuperAdmin)
	if err != nil {
		response.NotFound(c, "Workspace not found", err)
		return
	}

	response.Success(c, FromWorkspace(workspace))
}

// UpdateWorkspace updates a workspace
// @Summary Update workspace
// @Tags Workspace
// @Accept json
// @Produce json
// @Param id path string true "Workspace ID"
// @Param body body UpdateWorkspaceRequest true "Update details"
// @Success 200 {object} WorkspaceResponse
// @Router /workspaces/{id} [patch]
func (h *Handler) UpdateWorkspace(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	var req UpdateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data", err)
		return
	}

	user, _ := c.Get("user")
	currentUser := user.(*domain.User)

	workspace, err := h.service.UpdateWorkspace(id, &req, currentUser.ID, currentUser.IsSuperAdmin)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, FromWorkspace(workspace))
}

// DeleteWorkspace deletes a workspace
// @Summary Delete workspace
// @Tags Workspace
// @Param id path string true "Workspace ID"
// @Success 204 "No Content"
// @Router /workspaces/{id} [delete]
func (h *Handler) DeleteWorkspace(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	user, _ := c.Get("user")
	currentUser := user.(*domain.User)

	if err := h.service.DeleteWorkspace(id, currentUser.ID, currentUser.IsSuperAdmin); err != nil {
		response.Forbidden(c, err.Error())
		return
	}

	response.NoContent(c)
}

// AddMember adds a member to a workspace
// @Summary Add workspace member
// @Tags Workspace
// @Accept json
// @Produce json
// @Param id path string true "Workspace ID"
// @Param body body AddMemberRequest true "Member details"
// @Success 201 "Member added"
// @Router /workspaces/{id}/members [post]
func (h *Handler) AddMember(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	var req AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data", err)
		return
	}

	user, _ := c.Get("user")
	currentUser := user.(*domain.User)

	if err := h.service.AddMember(id, &req, currentUser.ID, currentUser.IsSuperAdmin); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, gin.H{"message": "member added successfully"})
}

// ListMembers lists all members of a workspace
// @Summary List workspace members
// @Tags Workspace
// @Produce json
// @Param id path string true "Workspace ID"
// @Success 200 {array} WorkspaceMemberResponse
// @Router /workspaces/{id}/members [get]
func (h *Handler) ListMembers(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	user, _ := c.Get("user")
	currentUser := user.(*domain.User)

	members, err := h.service.ListMembers(id, currentUser.ID, currentUser.IsSuperAdmin)
	if err != nil {
		response.NotFound(c, "Workspace not found or access denied", err)
		return
	}

	response.Success(c, FromMemberList(members))
}

// UpdateMemberRole updates a member's role
// @Summary Update member role
// @Tags Workspace
// @Accept json
// @Produce json
// @Param id path string true "Workspace ID"
// @Param uid path string true "User ID"
// @Param body body UpdateMemberRoleRequest true "Role update"
// @Success 200 "Role updated"
// @Router /workspaces/{id}/members/{uid} [patch]
func (h *Handler) UpdateMemberRole(c *gin.Context) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	userID, ok := handler.ParseID(c, "uid")
	if !ok {
		return
	}

	var req UpdateMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request data", err)
		return
	}

	user, _ := c.Get("user")
	currentUser := user.(*domain.User)

	if err := h.service.UpdateMemberRole(workspaceID, userID, req.Role, currentUser.ID, currentUser.IsSuperAdmin); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "role updated successfully"})
}

// RemoveMember removes a member from a workspace
// @Summary Remove workspace member
// @Tags Workspace
// @Param id path string true "Workspace ID"
// @Param uid path string true "User ID"
// @Success 204 "Member removed"
// @Router /workspaces/{id}/members/{uid} [delete]
func (h *Handler) RemoveMember(c *gin.Context) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	userID, ok := handler.ParseID(c, "uid")
	if !ok {
		return
	}

	user, _ := c.Get("user")
	currentUser := user.(*domain.User)

	if err := h.service.RemoveMember(workspaceID, userID, currentUser.ID, currentUser.IsSuperAdmin); err != nil {
		response.Forbidden(c, err.Error())
		return
	}

	response.NoContent(c)
}
