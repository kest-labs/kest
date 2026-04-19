package projectinvite

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

type Handler struct {
	contracts.BaseModule
	service       Service
	memberService member.Service
}

func NewHandler(service Service, memberService member.Service) *Handler {
	return &Handler{
		service:       service,
		memberService: memberService,
	}
}

func (h *Handler) Name() string {
	return "projectinvite"
}

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		auth.POST("/projects/:id/invitations", h.CreateInvitation).
			Name("projects.invitations.create").
			WhereNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleAdmin))
		auth.GET("/projects/:id/invitations", h.ListInvitations).
			Name("projects.invitations.list").
			WhereNumber("id").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleAdmin))
		auth.DELETE("/projects/:id/invitations/:inviteId", h.DeleteInvitation).
			Name("projects.invitations.delete").
			WhereNumber("id", "inviteId").
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleAdmin))

		auth.POST("/project-invitations/:slug/accept", h.AcceptInvitation).
			Name("project_invitations.accept")
		auth.POST("/project-invitations/:slug/reject", h.RejectInvitation).
			Name("project_invitations.reject")
	})

	r.GET("/project-invitations/:slug", h.GetInvitation).
		Name("project_invitations.show")
}

func (h *Handler) CreateInvitation(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
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

	invitation, err := h.service.CreateInvitation(c.Request.Context(), projectID, userID, &req)
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

	response.Created(c, invitation)
}

func (h *Handler) ListInvitations(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	invitations, err := h.service.ListInvitations(c.Request.Context(), projectID)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, invitations)
}

func (h *Handler) DeleteInvitation(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	invitationID, ok := handler.ParseID(c, "inviteId")
	if !ok {
		return
	}

	if err := h.service.RevokeInvitation(c.Request.Context(), projectID, invitationID); err != nil {
		if errors.Is(err, ErrProjectInvitationNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.NoContent(c)
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
			errors.Is(err, ErrProjectInvitationRevoked),
			errors.Is(err, ErrProjectInvitationUsedUp),
			errors.Is(err, ErrProjectInvitationAlreadyMember):
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
		if errors.Is(err, ErrProjectInvitationNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, result)
}
