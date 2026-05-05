package importer

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/modules/collection"
	"github.com/kest-labs/kest/api/internal/modules/request"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

type Handler struct {
	contracts.BaseModule
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) Name() string {
	return "importer"
}

// ImportPostman handles POST /projects/:id/collections/import/postman
func (h *Handler) ImportPostman(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	parentID := strings.TrimSpace(c.Query("parent_id"))

	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "file is required")
		return
	}

	if err := h.service.ImportPostman(c.Request.Context(), projectID, parentID, file); err != nil {
		if errors.Is(err, ErrInvalidPostmanCollection) ||
			errors.Is(err, collection.ErrInvalidParent) ||
			errors.Is(err, request.ErrInvalidCollection) {
			response.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, gin.H{"message": "import successful"})
}

// ImportMarkdown handles POST /projects/:id/collections/import/markdown
func (h *Handler) ImportMarkdown(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	parentID := strings.TrimSpace(c.Query("parent_id"))

	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "file is required")
		return
	}

	result, err := h.service.ImportMarkdown(c.Request.Context(), projectID, parentID, file)
	if err != nil {
		if errors.Is(err, ErrInvalidMarkdownDocument) ||
			errors.Is(err, ErrMarkdownBaseURLNotFound) ||
			errors.Is(err, ErrNoImportableEndpoints) ||
			errors.Is(err, collection.ErrInvalidParent) ||
			errors.Is(err, request.ErrInvalidCollection) {
			response.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, result)
}
