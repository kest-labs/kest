package example

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for example module
type Handler struct {
	contracts.BaseModule
	service Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "example"
}

// NewHandler creates a new example handler
func NewHandler(service Service) *Handler {
	return &Handler{
		service: service,
	}
}

// Create handles POST /projects/:id/collections/:cid/requests/:rid/examples
func (h *Handler) Create(c *gin.Context) {
	requestID, ok := handler.ParseID(c, "rid")
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

// Get handles GET /projects/:id/collections/:cid/requests/:rid/examples/:eid
func (h *Handler) Get(c *gin.Context) {
	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	exampleID, ok := handler.ParseID(c, "eid")
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

// Update handles PUT /projects/:id/collections/:cid/requests/:rid/examples/:eid
func (h *Handler) Update(c *gin.Context) {
	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	exampleID, ok := handler.ParseID(c, "eid")
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

// Delete handles DELETE /projects/:id/collections/:cid/requests/:rid/examples/:eid
func (h *Handler) Delete(c *gin.Context) {
	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	exampleID, ok := handler.ParseID(c, "eid")
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

// List handles GET /projects/:id/collections/:cid/requests/:rid/examples
func (h *Handler) List(c *gin.Context) {
	requestID, ok := handler.ParseID(c, "rid")
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

// SaveResponse handles POST /projects/:id/collections/:cid/requests/:rid/examples/:eid/response
func (h *Handler) SaveResponse(c *gin.Context) {
	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	exampleID, ok := handler.ParseID(c, "eid")
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

// SetDefault handles POST /projects/:id/collections/:cid/requests/:rid/examples/:eid/default
func (h *Handler) SetDefault(c *gin.Context) {
	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	exampleID, ok := handler.ParseID(c, "eid")
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
