package history

import (
	"errors"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

type Handler struct {
	contracts.BaseModule
	service       Service
	memberService member.Service
}

func NewHandler(service Service, memberService member.Service) *Handler {
	return &Handler{
		service:       service,
		memberService: memberService,
	}
}

func (h *Handler) Name() string {
	return "history"
}

// Create handles POST /projects/:id/history
func (h *Handler) Create(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	var req RecordHistoryRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	req.ProjectID = projectID
	req.UserID = userID

	history, err := h.service.Record(c.Request.Context(), &req)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Created(c, toResponse(history))
}

// List handles GET /projects/:id/history
func (h *Handler) List(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	entityType := c.Query("entity_type")
	entityID := c.Query("entity_id")
	page := handler.QueryInt(c, "page", 1)
	perPage := handler.QueryInt(c, "per_page", 20)

	histories, total, err := h.service.List(c.Request.Context(), projectID, entityType, entityID, page, perPage)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, gin.H{
		"items": toResponseSlice(histories),
		"meta": gin.H{
			"total":    total,
			"page":     page,
			"per_page": perPage,
			"pages":    (total + int64(perPage) - 1) / int64(perPage),
		},
	})
}

// Get handles GET /projects/:id/history/:hid
func (h *Handler) Get(c *gin.Context) {
	historyID, ok := handler.ParseID(c, "hid")
	if !ok {
		return
	}

	history, err := h.service.GetByID(c.Request.Context(), historyID)
	if err != nil {
		if errors.Is(err, ErrHistoryNotFound) {
			response.NotFound(c, err.Error())
			return
		}
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, toResponse(history))
}
