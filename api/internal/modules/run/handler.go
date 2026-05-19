package run

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/modules/request"
	"github.com/kest-labs/kest/api/internal/modules/runner"
	"github.com/kest-labs/kest/api/internal/modules/variable"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

type Handler struct {
	contracts.BaseModule
	requestService   request.Service
	workspaceService workspace.Service
	runner           runner.Runner
}

func NewHandler(requestService request.Service, workspaceService workspace.Service, runner runner.Runner) *Handler {
	return &Handler{
		requestService:   requestService,
		workspaceService: workspaceService,
		runner:           runner,
	}
}

func (h *Handler) Name() string {
	return "run"
}

type RunRequest struct {
	EnvironmentID *string           `json:"environment_id"`
	Variables     map[string]string `json:"variables"`
}

func (h *Handler) Run(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	collectionID, ok := handler.ParseID(c, "cid")
	if !ok {
		return
	}

	requestID, ok := handler.ParseID(c, "rid")
	if !ok {
		return
	}

	var req RunRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	reqModel, err := h.requestService.GetByID(c.Request.Context(), requestID, collectionID, workspaceID)
	if err != nil {
		if err == request.ErrRequestNotFound {
			response.NotFound(c, err.Error())
			return
		}
		if err == request.ErrInvalidCollection {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	vars := variable.Variables{}
	if req.Variables != nil {
		vars = req.Variables
	}

	resp, err := h.runner.Run(reqModel, vars)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	response.Success(c, resp)
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
