package importer

import (
	"errors"
	"net/http"

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

	parentID := handler.QueryInt(c, "parent_id", 0)

	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "file is required")
		return
	}

	if err := h.service.ImportPostman(c.Request.Context(), projectID, uint(parentID), file); err != nil {
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
