package export

import (
	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
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
	return "export"
}

// ExportPostman handles GET /projects/:id/collections/:cid/export/postman
func (h *Handler) ExportPostman(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	data, err := h.service.ExportPostman(c.Request.Context(), projectID, collectionID)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	c.Header("Content-Disposition", `attachment; filename="postman_collection.json"`)
	c.Data(200, "application/json", data)
}
