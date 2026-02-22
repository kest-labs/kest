package run

import (
	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/modules/request"
	"github.com/kest-labs/kest/api/internal/modules/runner"
	"github.com/kest-labs/kest/api/internal/modules/variable"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

type Handler struct {
	contracts.BaseModule
	requestService request.Service
	runner         runner.Runner
}

func NewHandler(requestService request.Service, runner runner.Runner) *Handler {
	return &Handler{
		requestService: requestService,
		runner:         runner,
	}
}

func (h *Handler) Name() string {
	return "run"
}

type RunRequest struct {
	EnvironmentID *uint            `json:"environment_id"`
	Variables     map[string]string `json:"variables"`
}

func (h *Handler) Run(c *gin.Context) {
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

	reqModel, err := h.requestService.GetByID(c.Request.Context(), requestID, collectionID)
	if err != nil {
		if err == request.ErrRequestNotFound {
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
