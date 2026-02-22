package request

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for request module
type Handler struct {
	contracts.BaseModule
	service Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "request"
}

// NewHandler creates a new request handler
func NewHandler(service Service) *Handler {
	return &Handler{
		service: service,
	}
}

// Create handles POST /projects/:id/collections/:cid/requests
func (h *Handler) Create(c *gin.Context) {
	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	var req CreateRequestRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	req.CollectionID = collectionID

	request, err := h.service.Create(c.Request.Context(), &req)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Created(c, toResponse(request))
}

// Get handles GET /projects/:id/collections/:cid/requests/:rid
func (h *Handler) Get(c *gin.Context) {
	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	request, err := h.service.GetByID(c.Request.Context(), requestID, collectionID)
	if err != nil {
		if errors.Is(err, ErrRequestNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(request))
}

// Update handles PUT /projects/:id/collections/:cid/requests/:rid
func (h *Handler) Update(c *gin.Context) {
	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	var req UpdateRequestRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	request, err := h.service.Update(c.Request.Context(), requestID, collectionID, &req)
	if err != nil {
		if errors.Is(err, ErrRequestNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(request))
}

// Delete handles DELETE /projects/:id/collections/:cid/requests/:rid
func (h *Handler) Delete(c *gin.Context) {
	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), requestID, collectionID); err != nil {
		if errors.Is(err, ErrRequestNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, gin.H{"message": "request deleted"})
}

// List handles GET /projects/:id/collections/:cid/requests
func (h *Handler) List(c *gin.Context) {
	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	page := handler.QueryInt(c, "page", 1)
	perPage := handler.QueryInt(c, "per_page", 20)

	requests, total, err := h.service.List(c.Request.Context(), collectionID, page, perPage)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, gin.H{
		"items": toResponseSlice(requests),
		"meta": gin.H{
			"total":    total,
			"page":     page,
			"per_page": perPage,
			"pages":    (total + int64(perPage) - 1) / int64(perPage),
		},
	})
}

// Move handles PATCH /projects/:id/collections/:cid/requests/:rid/move
func (h *Handler) Move(c *gin.Context) {
	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	var req MoveRequestRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	request, err := h.service.Move(c.Request.Context(), requestID, collectionID, &req)
	if err != nil {
		if errors.Is(err, ErrRequestNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(request))
}
