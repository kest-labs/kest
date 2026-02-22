package collection

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for collection module
type Handler struct {
	contracts.BaseModule
	service Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "collection"
}

// NewHandler creates a new collection handler
func NewHandler(service Service) *Handler {
	return &Handler{
		service: service,
	}
}

// Create handles POST /projects/:id/collections
func (h *Handler) Create(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	var req CreateCollectionRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	req.ProjectID = projectID

	collection, err := h.service.Create(c.Request.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrInvalidParent) {
			response.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Created(c, toResponse(collection))
}

// Get handles GET /projects/:id/collections/:cid
func (h *Handler) Get(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	collection, err := h.service.GetByID(c.Request.Context(), collectionID, projectID)
	if err != nil {
		if errors.Is(err, ErrCollectionNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(collection))
}

// Update handles PUT /projects/:id/collections/:cid
func (h *Handler) Update(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	var req UpdateCollectionRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	collection, err := h.service.Update(c.Request.Context(), collectionID, projectID, &req)
	if err != nil {
		if errors.Is(err, ErrCollectionNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		if errors.Is(err, ErrInvalidParent) {
			response.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(collection))
}

// Delete handles DELETE /projects/:id/collections/:cid
func (h *Handler) Delete(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), collectionID, projectID); err != nil {
		if errors.Is(err, ErrCollectionNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, gin.H{"message": "collection deleted"})
}

// List handles GET /projects/:id/collections
func (h *Handler) List(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	page := handler.QueryInt(c, "page", 1)
	perPage := handler.QueryInt(c, "per_page", 20)

	collections, total, err := h.service.List(c.Request.Context(), projectID, page, perPage)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, gin.H{
		"items": toResponseSlice(collections),
		"meta": gin.H{
			"total":    total,
			"page":     page,
			"per_page": perPage,
			"pages":    (total + int64(perPage) - 1) / int64(perPage),
		},
	})
}

// GetTree handles GET /projects/:id/collections/tree
func (h *Handler) GetTree(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	tree, err := h.service.GetTree(c.Request.Context(), projectID)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, tree)
}

// Move handles PATCH /projects/:id/collections/:cid/move
func (h *Handler) Move(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	var req MoveCollectionRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	collection, err := h.service.Move(c.Request.Context(), collectionID, projectID, &req)
	if err != nil {
		if errors.Is(err, ErrCollectionNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		if errors.Is(err, ErrInvalidParent) {
			response.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(collection))
}
