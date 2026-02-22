package request

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// RollbackRequest handles POST /projects/:id/collections/:cid/requests/:rid/rollback
func (h *Handler) Rollback(c *gin.Context) {
	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	var req RollbackRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	request, err := h.service.Rollback(c.Request.Context(), requestID, collectionID, req.VersionID)
	if err != nil {
		if errors.Is(err, ErrRequestNotFound) || errors.Is(err, ErrVersionNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(request))
}

type RollbackRequest struct {
	VersionID uint `json:"version_id" binding:"required"`
}
