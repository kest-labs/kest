package workspace

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for workspace operations
type Handler struct {
	contracts.BaseModule
	service Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "workspace"
}

// NewHandler creates a new workspace handler
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Service() Service {
	return h.service
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

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	workspace, err := h.service.CreateWorkspace(&req, userID)
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
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	workspaces, err := h.service.ListWorkspaces(userID, false)
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

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	workspace, err := h.service.GetWorkspace(id, userID, false)
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

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	workspace, err := h.service.UpdateWorkspace(id, &req, userID, false)
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

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteWorkspace(id, userID, false); err != nil {
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

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	if err := h.service.AddMember(id, &req, userID, false); err != nil {
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

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	members, err := h.service.ListMembers(id, userID, false)
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

	currentUserID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	if err := h.service.UpdateMemberRole(workspaceID, userID, req.Role, currentUserID, false); err != nil {
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

	currentUserID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	if err := h.service.RemoveMember(workspaceID, userID, currentUserID, false); err != nil {
		response.Forbidden(c, err.Error())
		return
	}

	response.NoContent(c)
}

// GenerateCLIToken handles POST /workspaces/:id/cli-tokens
func (h *Handler) GenerateCLIToken(c *gin.Context) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	var req GenerateWorkspaceCLITokenRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	allowed, err := h.service.HasPermission(workspaceID, userID, RoleAdmin, false)
	if err != nil || !allowed {
		response.Error(c, http.StatusForbidden, "workspace not found or access denied")
		return
	}

	token, err := h.service.GenerateCLIToken(c.Request.Context(), workspaceID, userID, &req)
	if err != nil {
		if errors.Is(err, ErrUnsupportedCLITokenScope) {
			response.BadRequest(c, err.Error(), err)
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Created(c, token)
}

// ListCLITokens handles GET /workspaces/:id/cli-tokens
func (h *Handler) ListCLITokens(c *gin.Context) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	allowed, err := h.service.HasPermission(workspaceID, userID, RoleAdmin, false)
	if err != nil || !allowed {
		response.Error(c, http.StatusForbidden, "workspace not found or access denied")
		return
	}

	tokens, err := h.service.ListCLITokens(c.Request.Context(), workspaceID)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, FromCLITokenList(tokens))
}
