package export

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

type Handler struct {
	contracts.BaseModule
	service          Service
	workspaceService workspace.Service
}

func NewHandler(service Service, workspaceService workspace.Service) *Handler {
	return &Handler{
		service:          service,
		workspaceService: workspaceService,
	}
}

func (h *Handler) Name() string {
	return "export"
}

// ExportPostman handles GET /workspaces/:id/collections/:cid/export/postman
func (h *Handler) ExportPostman(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleRead)
	if !ok {
		return
	}

	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	data, err := h.service.ExportPostman(c.Request.Context(), workspaceID, collectionID)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	c.Header("Content-Disposition", `attachment; filename="postman_collection.json"`)
	c.Data(200, "application/json", data)
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
