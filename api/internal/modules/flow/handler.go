package flow

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for flows
type Handler struct {
	contracts.BaseModule
	service                  Service
	memberService            member.Service
	workspaceBackingResolver middleware.WorkspaceBackingResolver
	workspaceTokenValidator  middleware.WorkspaceCLITokenValidator
}

// Name returns the module name
func (h *Handler) Name() string {
	return "flow"
}

// NewHandler creates a new flow handler
func NewHandler(service Service, memberService member.Service) *Handler {
	return &Handler{
		service:       service,
		memberService: memberService,
	}
}

func (h *Handler) SetWorkspaceBackingResolver(resolver middleware.WorkspaceBackingResolver) {
	h.workspaceBackingResolver = resolver
}

func (h *Handler) SetWorkspaceTokenValidator(validator middleware.WorkspaceCLITokenValidator) {
	h.workspaceTokenValidator = validator
}

// RegisterRoutes registers flow routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	RegisterRoutes(r, h, h.memberService)
}

// --- helpers ---

func (h *Handler) workspaceID(c *gin.Context) (string, bool) {
	if workspaceID, ok := c.Get("workspaceID"); ok {
		if id, ok := workspaceID.(string); ok && id != "" {
			return id, true
		}
	}
	return handler.ParseID(c, "id")
}

func (h *Handler) flowID(c *gin.Context) (string, bool) {
	return handler.ParseID(c, "fid")
}

func (h *Handler) stepID(c *gin.Context) (string, bool) {
	return handler.ParseID(c, "sid")
}

func (h *Handler) edgeID(c *gin.Context) (string, bool) {
	return handler.ParseID(c, "eid")
}

func (h *Handler) runID(c *gin.Context) (string, bool) {
	return handler.ParseID(c, "rid")
}

func (h *Handler) userID(c *gin.Context) string {
	userID, _ := handler.GetUserID(c)
	return userID
}

func resolveRunBaseURL(c *gin.Context) (string, error) {
	requestedBaseURL := strings.TrimSpace(c.Query("base_url"))
	if requestedBaseURL != "" {
		parsed, err := url.Parse(requestedBaseURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return "", errors.New("Invalid base_url query parameter")
		}
		if parsed.Scheme != "http" && parsed.Scheme != "https" {
			return "", errors.New("Invalid base_url query parameter")
		}
		return strings.TrimRight(parsed.String(), "/"), nil
	}

	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s", scheme, c.Request.Host), nil
}

func respondFlowError(c *gin.Context, err error) {
	var flowErr *FlowError
	if errors.As(err, &flowErr) {
		response.Error(c, flowErr.Status, flowErr.Message)
		return
	}

	response.Error(c, http.StatusInternalServerError, err.Error())
}

// --- Flow handlers ---

// ListFlows handles GET /workspaces/:id/flows
func (h *Handler) ListFlows(c *gin.Context) {
	workspaceID, ok := h.workspaceID(c)
	if !ok {
		return
	}

	flows, err := h.service.ListFlows(c.Request.Context(), workspaceID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"items": flows,
		"total": len(flows),
	})
}

// CreateFlow handles POST /workspaces/:id/flows
func (h *Handler) CreateFlow(c *gin.Context) {
	workspaceID, ok := h.workspaceID(c)
	if !ok {
		return
	}

	var req CreateFlowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	flow, err := h.service.CreateFlow(c.Request.Context(), workspaceID, h.userID(c), &req)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Created(c, flow)
}

// ImportFlowMarkdown handles POST /workspaces/:id/flows/import-markdown
func (h *Handler) ImportFlowMarkdown(c *gin.Context) {
	workspaceID, ok := h.workspaceID(c)
	if !ok {
		return
	}

	var req ImportFlowMarkdownRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	flow, err := h.service.ImportFlowMarkdown(c.Request.Context(), workspaceID, h.userID(c), &req)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Created(c, flow)
}

// GetFlow handles GET /workspaces/:id/flows/:fid
func (h *Handler) GetFlow(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	flow, err := h.service.GetFlow(c.Request.Context(), fid)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Success(c, flow)
}

// UpdateFlow handles PATCH /workspaces/:id/flows/:fid
func (h *Handler) UpdateFlow(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	var req UpdateFlowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	flow, err := h.service.UpdateFlow(c.Request.Context(), fid, &req)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Success(c, flow)
}

// UpdateFlowMarkdown handles PUT /workspaces/:id/flows/:fid/markdown
func (h *Handler) UpdateFlowMarkdown(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	var req UpdateFlowMarkdownRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	flow, err := h.service.UpdateFlowMarkdown(c.Request.Context(), fid, &req)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Success(c, flow)
}

// DeleteFlow handles DELETE /workspaces/:id/flows/:fid
func (h *Handler) DeleteFlow(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteFlow(c.Request.Context(), fid); err != nil {
		respondFlowError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// SaveFlow handles PUT /workspaces/:id/flows/:fid (full save with steps + edges)
func (h *Handler) SaveFlow(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	var req SaveFlowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	flow, err := h.service.SaveFlow(c.Request.Context(), fid, &req)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Success(c, flow)
}

// --- Step handlers ---

// CreateStep handles POST /workspaces/:id/flows/:fid/steps
func (h *Handler) CreateStep(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	var req CreateStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	step, err := h.service.CreateStep(c.Request.Context(), fid, &req)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Created(c, step)
}

// UpdateStep handles PATCH /projects/:id/flows/:fid/steps/:sid
func (h *Handler) UpdateStep(c *gin.Context) {
	sid, ok := h.stepID(c)
	if !ok {
		return
	}

	var req UpdateStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	step, err2 := h.service.UpdateStep(c.Request.Context(), sid, &req)
	if err2 != nil {
		respondFlowError(c, err2)
		return
	}

	response.Success(c, step)
}

// DeleteStep handles DELETE /projects/:id/flows/:fid/steps/:sid
func (h *Handler) DeleteStep(c *gin.Context) {
	sid, ok := h.stepID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteStep(c.Request.Context(), sid); err != nil {
		respondFlowError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// --- Edge handlers ---

// CreateEdge handles POST /projects/:id/flows/:fid/edges
func (h *Handler) CreateEdge(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	var req CreateEdgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	edge, err := h.service.CreateEdge(c.Request.Context(), fid, &req)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Created(c, edge)
}

// DeleteEdge handles DELETE /projects/:id/flows/:fid/edges/:eid
func (h *Handler) DeleteEdge(c *gin.Context) {
	eid, ok := h.edgeID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteEdge(c.Request.Context(), eid); err != nil {
		respondFlowError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// --- Run handlers ---

// ExecuteFlowSSE handles GET /projects/:id/flows/:fid/runs/:rid/events (SSE)
// Streams real-time step execution events to the client
func (h *Handler) ExecuteFlowSSE(c *gin.Context) {
	rid, ok := h.runID(c)
	if !ok {
		return
	}

	baseURL, err := resolveRunBaseURL(c)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// Set SSE headers
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
	c.Writer.Flush()

	events := make(chan StepEvent, 10)

	// Start execution in background
	go func() {
		_ = h.service.ExecuteFlow(c.Request.Context(), rid, baseURL, events)
	}()

	// Stream events to client
	c.Stream(func(w io.Writer) bool {
		event, ok := <-events
		if !ok {
			// Channel closed, send done event
			fmt.Fprintf(w, "event: done\ndata: {}\n\n")
			return false
		}

		data, _ := json.Marshal(event)
		fmt.Fprintf(w, "event: step\ndata: %s\n\n", string(data))
		return true
	})
}

// RunFlow handles POST /projects/:id/flows/:fid/run
func (h *Handler) RunFlow(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	run, err := h.service.RunFlow(c.Request.Context(), fid, h.userID(c))
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Created(c, run)
}

// GetRun handles GET /projects/:id/flows/:fid/runs/:rid
func (h *Handler) GetRun(c *gin.Context) {
	rid, ok := h.runID(c)
	if !ok {
		return
	}

	run, err2 := h.service.GetRun(c.Request.Context(), rid)
	if err2 != nil {
		respondFlowError(c, err2)
		return
	}

	response.Success(c, run)
}

// ListRuns handles GET /projects/:id/flows/:fid/runs
func (h *Handler) ListRuns(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	runs, err := h.service.ListRuns(c.Request.Context(), fid)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Success(c, gin.H{
		"items": runs,
		"total": len(runs),
	})
}

func (h *Handler) SyncFlowsFromCLI(c *gin.Context) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	var req CLIFlowSyncRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	createdBy, ok := getCLITokenCreatedBy(c)
	if !ok {
		response.Unauthorized(c)
		return
	}

	result, err := h.service.SyncFlowsFromCLI(c.Request.Context(), workspaceID, createdBy, &req)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Success(c, result)
}

func (h *Handler) ListRunnableFlowsForCLI(c *gin.Context) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	flows, err := h.service.ListRunnableFlowsForCLI(c.Request.Context(), workspaceID)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Success(c, gin.H{
		"items": flows,
		"total": len(flows),
	})
}

func (h *Handler) SyncFlowRunFromCLI(c *gin.Context) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	var req CLIFlowRunSyncRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	createdBy, ok := getCLITokenCreatedBy(c)
	if !ok {
		response.Unauthorized(c)
		return
	}

	result, err := h.service.SyncFlowRunFromCLI(c.Request.Context(), workspaceID, createdBy, &req)
	if err != nil {
		respondFlowError(c, err)
		return
	}

	response.Success(c, result)
}

func getCLITokenCreatedBy(c *gin.Context) (string, bool) {
	value, exists := c.Get("cliTokenCreatedBy")
	if !exists {
		return "", false
	}
	createdBy, ok := value.(string)
	return createdBy, ok && createdBy != ""
}
