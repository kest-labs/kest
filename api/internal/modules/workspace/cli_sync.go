package workspace

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/pkg/handler"
	idpkg "github.com/kest-labs/kest/api/pkg/id"
	"github.com/kest-labs/kest/api/pkg/response"
)

type SpecSyncer interface {
	SyncSpecsFromCLI(ctx context.Context, workspaceID string, req *CLISpecSyncRequest) (*CLISpecSyncResponseBody, error)
}

type HistorySyncer interface {
	SyncHistoryFromCLI(ctx context.Context, workspaceID string, createdBy string, req *CLIHistorySyncRequest) (*CLIHistorySyncResponseBody, error)
}

type CLISpecSyncRequest struct {
	WorkspaceID *string           `json:"workspace_id,omitempty"`
	Source      string            `json:"source"`
	Metadata    json.RawMessage   `json:"metadata,omitempty"`
	Specs       []CLISpecSyncSpec `json:"specs" binding:"required,min=1"`
}

type CLISpecSyncSpec struct {
	Method      string                         `json:"method" binding:"required,oneof=GET POST PUT DELETE PATCH HEAD OPTIONS"`
	Path        string                         `json:"path" binding:"required,max=500"`
	Title       string                         `json:"title" binding:"required,max=500"`
	Summary     string                         `json:"summary,omitempty"`
	Description string                         `json:"description,omitempty"`
	Version     string                         `json:"version" binding:"required,max=50"`
	RequestBody *CLISpecSyncRequestBody        `json:"request_body,omitempty"`
	Parameters  []CLISpecSyncParameter         `json:"parameters,omitempty"`
	Responses   map[string]CLISpecSyncResponse `json:"responses,omitempty"`
	Examples    []CLISpecSyncExample           `json:"examples,omitempty"`
}

type CLISpecSyncRequestBody struct {
	Description string                 `json:"description,omitempty"`
	Required    bool                   `json:"required"`
	ContentType string                 `json:"content_type"`
	Schema      map[string]interface{} `json:"schema"`
}

type CLISpecSyncParameter struct {
	Name        string                 `json:"name"`
	In          string                 `json:"in"`
	Description string                 `json:"description,omitempty"`
	Required    bool                   `json:"required"`
	Schema      map[string]interface{} `json:"schema"`
	Example     interface{}            `json:"example,omitempty"`
}

type CLISpecSyncResponse struct {
	Description string                 `json:"description"`
	ContentType string                 `json:"content_type"`
	Schema      map[string]interface{} `json:"schema"`
}

type CLISpecSyncExample struct {
	Name           string            `json:"name"`
	RequestHeaders map[string]string `json:"request_headers,omitempty"`
	RequestBody    string            `json:"request_body,omitempty"`
	ResponseStatus int               `json:"response_status"`
	ResponseBody   string            `json:"response_body,omitempty"`
	DurationMs     int64             `json:"duration_ms"`
}

type CLISpecSyncResponseBody struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

type CLIHistorySyncRequest struct {
	WorkspaceID *string               `json:"workspace_id,omitempty"`
	Source      string                `json:"source"`
	Metadata    json.RawMessage       `json:"metadata,omitempty"`
	Entries     []CLIHistorySyncEntry `json:"entries" binding:"required,min=1"`
}

type CLIHistorySyncEntry struct {
	SourceEventID string                 `json:"source_event_id" binding:"required,max=191"`
	EventType     string                 `json:"event_type" binding:"required,max=50"`
	OccurredAt    time.Time              `json:"occurred_at" binding:"required"`
	EntityType    string                 `json:"entity_type" binding:"required,max=50"`
	EntityID      string                 `json:"entity_id" binding:"required"`
	Action        string                 `json:"action" binding:"required,max=20"`
	Message       string                 `json:"message" binding:"required,max=255"`
	Data          map[string]interface{} `json:"data" binding:"required"`
}

type CLIHistorySyncResponseBody struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

func (h *Handler) SetSpecSyncer(syncer SpecSyncer) {
	h.specSyncer = syncer
}

func (h *Handler) SetHistorySyncer(syncer HistorySyncer) {
	h.historySyncer = syncer
}

func (h *Handler) SyncSpecsFromCLI(c *gin.Context) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	if h.specSyncer == nil {
		response.Error(c, http.StatusServiceUnavailable, "CLI spec sync is not configured")
		return
	}

	var req CLISpecSyncRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	if req.WorkspaceID != nil && *req.WorkspaceID != workspaceID {
		response.BadRequest(c, "workspace_id in body must match URL workspace id")
		return
	}

	result, err := h.specSyncer.SyncSpecsFromCLI(c.Request.Context(), workspaceID, &req)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, result)
}

func (h *Handler) SyncHistoryFromCLI(c *gin.Context) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	if h.historySyncer == nil {
		response.Error(c, http.StatusServiceUnavailable, "CLI history sync is not configured")
		return
	}

	var req CLIHistorySyncRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	if req.WorkspaceID != nil && *req.WorkspaceID != workspaceID {
		response.BadRequest(c, "workspace_id in body must match URL workspace id")
		return
	}

	createdBy, ok := getCLITokenCreatedBy(c)
	if !ok {
		response.Unauthorized(c)
		return
	}

	result, err := h.historySyncer.SyncHistoryFromCLI(c.Request.Context(), workspaceID, createdBy, &req)
	if err != nil {
		response.InternalServerError(c, err.Error(), err)
		return
	}

	response.Success(c, result)
}

func getCLITokenCreatedBy(c *gin.Context) (string, bool) {
	value, exists := c.Get("cliTokenCreatedBy")
	if !exists {
		return "", false
	}

	createdBy, err := idpkg.Normalize(value)
	if err != nil {
		return "", false
	}

	return createdBy, true
}
