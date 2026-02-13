package project

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for project module
type Handler struct {
	contracts.BaseModule
	service Service
	host    string // Server host for DSN generation
	secure  bool   // Whether to use https in DSN
}

// Name returns the module name
func (h *Handler) Name() string {
	return "project"
}

// NewHandler creates a new project handler
func NewHandler(service Service) *Handler {
	return &Handler{
		service: service,
		host:    "localhost:8025", // Default, should be configured
		secure:  false,
	}
}

// SetHost sets the host for DSN generation
func (h *Handler) SetHost(host string, secure bool) {
	h.host = host
	h.secure = secure
}

// Create handles POST /projects
func (h *Handler) Create(c *gin.Context) {
	var req CreateProjectRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	// Get userID from context (set by Auth middleware)
	userID, _ := c.Get("userID")
	uid := uint(0)
	if userID != nil {
		uid = userID.(uint)
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

	response.Created(c, toResponse(project, h.host, h.secure))
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

	response.Success(c, toResponse(project, h.host, h.secure))
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

	response.Success(c, toResponse(project, h.host, h.secure))
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
	page := handler.QueryInt(c, "page", 1)
	perPage := handler.QueryInt(c, "per_page", 20)

	projects, total, err := h.service.List(c.Request.Context(), page, perPage)
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

// GetDSN handles GET /projects/:id/dsn - returns DSN for a project
func (h *Handler) GetDSN(c *gin.Context) {
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

	dsn := GenerateDSN(project.PublicKey, h.host, project.ID, h.secure)
	response.Success(c, gin.H{
		"dsn":        dsn,
		"public_key": project.PublicKey,
		"project_id": project.ID,
	})
}
