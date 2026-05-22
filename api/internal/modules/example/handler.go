package example

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/modules/request"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for example module
type Handler struct {
	contracts.BaseModule
	service          Service
	requestService   request.Service
	workspaceService workspace.Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "example"
}

// NewHandler creates a new example handler
func NewHandler(service Service, requestService request.Service, workspaceService workspace.Service) *Handler {
	return &Handler{
		service:          service,
		requestService:   requestService,
		workspaceService: workspaceService,
	}
}

// Create handles POST /workspaces/:id/collections/:cid/requests/:rid/examples
func (h *Handler) Create(c *gin.Context) {
	_, _, requestID, ok := h.authorizeRequest(c, workspace.RoleWrite)
	if !ok {
		return
	}

	var req CreateExampleRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	req.RequestID = requestID

	example, err := h.service.Create(c.Request.Context(), &req)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Created(c, toResponse(example))
}

// Get handles GET /workspaces/:id/collections/:cid/requests/:rid/examples/:eid
func (h *Handler) Get(c *gin.Context) {
	_, _, requestID, exampleID, ok := h.authorizeExample(c, workspace.RoleRead)
	if !ok {
		return
	}

	example, err := h.service.GetByID(c.Request.Context(), exampleID, requestID)
	if err != nil {
		if errors.Is(err, ErrExampleNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(example))
}

// Update handles PUT /workspaces/:id/collections/:cid/requests/:rid/examples/:eid
func (h *Handler) Update(c *gin.Context) {
	_, _, requestID, exampleID, ok := h.authorizeExample(c, workspace.RoleWrite)
	if !ok {
		return
	}

	var req UpdateExampleRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	example, err := h.service.Update(c.Request.Context(), exampleID, requestID, &req)
	if err != nil {
		if errors.Is(err, ErrExampleNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(example))
}

// Delete handles DELETE /workspaces/:id/collections/:cid/requests/:rid/examples/:eid
func (h *Handler) Delete(c *gin.Context) {
	_, _, requestID, exampleID, ok := h.authorizeExample(c, workspace.RoleWrite)
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), exampleID, requestID); err != nil {
		if errors.Is(err, ErrExampleNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, gin.H{"message": "example deleted"})
}

// List handles GET /workspaces/:id/collections/:cid/requests/:rid/examples
func (h *Handler) List(c *gin.Context) {
	_, _, requestID, ok := h.authorizeRequest(c, workspace.RoleRead)
	if !ok {
		return
	}

	examples, err := h.service.List(c.Request.Context(), requestID)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponseSlice(examples))
}

// SaveResponse handles POST /workspaces/:id/collections/:cid/requests/:rid/examples/:eid/response
func (h *Handler) SaveResponse(c *gin.Context) {
	_, _, requestID, exampleID, ok := h.authorizeExample(c, workspace.RoleWrite)
	if !ok {
		return
	}

	var req SaveResponseRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	example, err := h.service.SaveResponse(c.Request.Context(), exampleID, requestID, &req)
	if err != nil {
		if errors.Is(err, ErrExampleNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(example))
}

// SetDefault handles POST /workspaces/:id/collections/:cid/requests/:rid/examples/:eid/default
func (h *Handler) SetDefault(c *gin.Context) {
	_, _, requestID, exampleID, ok := h.authorizeExample(c, workspace.RoleWrite)
	if !ok {
		return
	}

	example, err := h.service.SetDefault(c.Request.Context(), exampleID, requestID)
	if err != nil {
		if errors.Is(err, ErrExampleNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(example))
}

func (h *Handler) authorizeExample(c *gin.Context, requiredRole string) (string, string, string, string, bool) {
	workspaceID, collectionID, requestID, ok := h.authorizeRequest(c, requiredRole)
	if !ok {
		return "", "", "", "", false
	}

	exampleID, ok := handler.ParseID(c, "eid")
	if !ok {
		return "", "", "", "", false
	}

	return workspaceID, collectionID, requestID, exampleID, true
}

func (h *Handler) authorizeRequest(c *gin.Context, requiredRole string) (string, string, string, bool) {
	workspaceID, ok := h.authorizeWorkspace(c, requiredRole)
	if !ok {
		return "", "", "", false
	}

	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return "", "", "", false
	}

	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return "", "", "", false
	}

	if _, err := h.requestService.GetByID(c.Request.Context(), requestID, collectionID, workspaceID); err != nil {
		if errors.Is(err, request.ErrRequestNotFound) || errors.Is(err, request.ErrInvalidCollection) {
			response.NotFound(c, err.Error())
			return "", "", "", false
		}
		response.InternalServerError(c, err.Error(), err)
		return "", "", "", false
	}

	return workspaceID, collectionID, requestID, true
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

	allowed, err := h.workspaceService.HasPermission(workspaceID, userID, requiredRole, false)
	if err != nil || !allowed {
		response.Error(c, http.StatusForbidden, "workspace not found or access denied")
		return "", false
	}

	return workspaceID, true
}
