package projectinvite

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

type Handler struct {
	contracts.BaseModule
	service          Service
	workspaceService workspace.Service
}

func NewHandler(service Service, workspaceService workspace.Service) *Handler {
	return &Handler{
		service:          service,
		workspaceService: workspaceService,
	}
}

func (h *Handler) Name() string {
	return "projectinvite"
}

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		auth.POST("/workspaces/:id/invitations", h.CreateInvitation).
			Name("workspaces.invitations.create").
			WhereUUIDOrNumber("id")
		auth.GET("/workspaces/:id/invitations", h.ListInvitations).
			Name("workspaces.invitations.list").
			WhereUUIDOrNumber("id")
		auth.DELETE("/workspaces/:id/invitations/:inviteId", h.DeleteInvitation).
			Name("workspaces.invitations.delete").
			WhereUUIDOrNumber("id").
			WhereUUID("inviteId")

		auth.POST("/projects/:id/invitations", h.CreateInvitation).
			Name("projects.invitations.create").
			WhereUUIDOrNumber("id")
		auth.GET("/projects/:id/invitations", h.ListInvitations).
			Name("projects.invitations.list").
			WhereUUIDOrNumber("id")
		auth.DELETE("/projects/:id/invitations/:inviteId", h.DeleteInvitation).
			Name("projects.invitations.delete").
			WhereUUIDOrNumber("id").
			WhereUUID("inviteId")

		auth.GET("/workspace-invitations/received", h.ListReceivedInvitations).
			Name("workspace_invitations.received")
		auth.GET("/project-invitations/received", h.ListReceivedInvitations).
			Name("project_invitations.received")

		auth.POST("/workspace-invitations/:slug/accept", h.AcceptInvitation).
			Name("workspace_invitations.accept")
		auth.POST("/project-invitations/:slug/accept", h.AcceptInvitation).
			Name("project_invitations.accept")
		auth.POST("/workspace-invitations/:slug/reject", h.RejectInvitation).
			Name("workspace_invitations.reject")
		auth.POST("/project-invitations/:slug/reject", h.RejectInvitation).
			Name("project_invitations.reject")
	})

	r.GET("/workspace-invitations/:slug", h.GetInvitation).
		Name("workspace_invitations.show")
	r.GET("/project-invitations/:slug", h.GetInvitation).
		Name("project_invitations.show")
}

func (h *Handler) CreateInvitation(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleAdmin)
	if !ok {
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	var req CreateProjectInvitationRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	baseURL := resolveInvitationBaseURL(c.Request)
	invitation, err := h.service.CreateInvitation(c.Request.Context(), workspaceID, userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, ErrProjectInvitationInvalidRole),
			errors.Is(err, ErrProjectInvitationInvalidUses),
			errors.Is(err, ErrProjectInvitationInvalidExpiry):
			response.BadRequest(c, err.Error(), err)
		default:
			response.InternalServerError(c, err.Error(), err)
		}
		return
	}

	response.Created(c, invitation.withBaseURL(baseURL))
}

func (h *Handler) ListInvitations(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleAdmin)
	if !ok {
		return
	}

	baseURL := resolveInvitationBaseURL(c.Request)
	invitations, err := h.service.ListInvitations(c.Request.Context(), workspaceID)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	for _, invitation := range invitations {
		invitation.withBaseURL(baseURL)
	}
	response.Success(c, invitations)
}

func (h *Handler) DeleteInvitation(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleAdmin)
	if !ok {
		return
	}

	invitationID, ok := handler.ParseID(c, "inviteId")
	if !ok {
		return
	}

	if err := h.service.RevokeInvitation(c.Request.Context(), workspaceID, invitationID); err != nil {
		if errors.Is(err, ErrProjectInvitationNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.NoContent(c)
}

func (h *Handler) ListReceivedInvitations(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	invitations, err := h.service.ListReceivedInvitations(c.Request.Context(), userID)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, invitations)
}

func (h *Handler) GetInvitation(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.BadRequest(c, "Invalid invitation slug")
		return
	}

	invitation, err := h.service.GetInvitationDetail(c.Request.Context(), slug)
	if err != nil {
		if errors.Is(err, ErrProjectInvitationNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, invitation)
}

func (h *Handler) AcceptInvitation(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	slug := c.Param("slug")
	if slug == "" {
		response.BadRequest(c, "Invalid invitation slug")
		return
	}

	result, err := h.service.AcceptInvitation(c.Request.Context(), slug, userID)
	if err != nil {
		switch {
		case errors.Is(err, ErrProjectInvitationNotFound):
			response.NotFound(c, err.Error(), err)
		case errors.Is(err, ErrProjectInvitationExpired),
			errors.Is(err, ErrProjectInvitationRejected),
			errors.Is(err, ErrProjectInvitationRevoked),
			errors.Is(err, ErrProjectInvitationUsedUp),
			errors.Is(err, ErrProjectInvitationAlreadyMember),
			errors.Is(err, ErrProjectInvitationNotRecipient):
			response.ErrorWithDetails(c, http.StatusConflict, err.Error(), err)
		default:
			response.InternalServerError(c, err.Error(), err)
		}
		return
	}

	response.Success(c, result)
}

func (h *Handler) RejectInvitation(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	slug := c.Param("slug")
	if slug == "" {
		response.BadRequest(c, "Invalid invitation slug")
		return
	}

	result, err := h.service.RejectInvitation(c.Request.Context(), slug, userID)
	if err != nil {
		switch {
		case errors.Is(err, ErrProjectInvitationNotFound):
			response.NotFound(c, err.Error(), err)
		case errors.Is(err, ErrProjectInvitationNotRecipient):
			response.ErrorWithDetails(c, http.StatusConflict, err.Error(), err)
		default:
			response.InternalServerError(c, err.Error(), err)
		}
		return
	}

	response.Success(c, result)
}

func (h *Handler) authorizeWorkspace(c *gin.Context, requiredRole string) (string, bool) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return "", false
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		response.Unauthorized(c, "Authentication required")
		return "", false
	}

	allowed, err := h.workspaceService.HasPermission(workspaceID, userID, requiredRole, false)
	if err != nil || !allowed {
		response.Error(c, http.StatusForbidden, "workspace not found or access denied")
		return "", false
	}

	return workspaceID, true
}
