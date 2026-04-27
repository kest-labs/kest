package project

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for project module
type Handler struct {
	contracts.BaseModule
	service       Service
	memberService member.Service
	specSyncer    SpecSyncer
}

// Name returns the module name
func (h *Handler) Name() string {
	return "project"
}

// NewHandler creates a new project handler
func NewHandler(service Service, memberService member.Service) *Handler {
	return &Handler{
		service:       service,
		memberService: memberService,
	}
}

func (h *Handler) SetSpecSyncer(syncer SpecSyncer) {
	h.specSyncer = syncer
}

// Create handles POST /projects
func (h *Handler) Create(c *gin.Context) {
	var req CreateProjectRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	uid, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	project, err := h.service.Create(c.Request.Context(), uid, &req)
	if err != nil {
		if errors.Is(err, ErrSlugAlreadyExists) {
			response.Error(c, http.StatusConflict, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Created(c, toResponse(project))
}

// Get handles GET /projects/:id
func (h *Handler) Get(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	project, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(project))
}

// Update handles PUT /projects/:id
func (h *Handler) Update(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	var req UpdateProjectRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	project, err := h.service.Update(c.Request.Context(), id, &req)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(project))
}

// Delete handles DELETE /projects/:id
func (h *Handler) Delete(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, gin.H{"message": "project deleted"})
}

// List handles GET /projects
func (h *Handler) List(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	page := handler.QueryInt(c, "page", 1)
	perPage := handler.QueryInt(c, "per_page", 20)

	projects, total, err := h.service.List(c.Request.Context(), userID, page, perPage)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	// Return with pagination metadata
	response.Success(c, gin.H{
		"items": toListResponseSlice(projects),
		"meta": gin.H{
			"total":    total,
			"page":     page,
			"per_page": perPage,
			"pages":    (total + int64(perPage) - 1) / int64(perPage),
		},
	})
}

// GetStats handles GET /projects/:id/stats
func (h *Handler) GetStats(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	stats, err := h.service.GetStats(c.Request.Context(), id)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, stats)
}

// GenerateCLIToken handles POST /projects/:id/cli-tokens
func (h *Handler) GenerateCLIToken(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	var req GenerateProjectCLITokenRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	token, err := h.service.GenerateCLIToken(c.Request.Context(), projectID, userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, ErrProjectNotFound):
			response.NotFound(c, err.Error())
		case errors.Is(err, ErrUnsupportedCLITokenScope):
			response.BadRequest(c, err.Error(), err)
		default:
			response.InternalServerError(c, err.Error(), err)
		}
		return
	}

	response.Created(c, token)
}

// SyncSpecsFromCLI handles POST /projects/:id/cli/spec-sync
func (h *Handler) SyncSpecsFromCLI(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	if h.specSyncer == nil {
		response.Error(c, http.StatusServiceUnavailable, "CLI spec sync is not configured")
		return
	}

	var req CLISpecSyncRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	if req.ProjectID != nil && *req.ProjectID != projectID {
		response.BadRequest(c, "project_id in body must match URL project id")
		return
	}

	result, err := h.specSyncer.SyncSpecsFromCLI(c.Request.Context(), projectID, &req)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, result)
}
