package importer

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/modules/collection"
	"github.com/kest-labs/kest/api/internal/modules/request"
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
	return "importer"
}

// ImportPostman handles POST /workspaces/:id/collections/import/postman
func (h *Handler) ImportPostman(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	parentID := strings.TrimSpace(c.Query("parent_id"))

	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "file is required")
		return
	}

	if err := h.service.ImportPostman(c.Request.Context(), workspaceID, parentID, file); err != nil {
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

// ImportMarkdown handles POST /workspaces/:id/collections/import/markdown
func (h *Handler) ImportMarkdown(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	parentID := strings.TrimSpace(c.Query("parent_id"))

	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "file is required")
		return
	}

	result, err := h.service.ImportMarkdown(c.Request.Context(), workspaceID, parentID, file)
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
