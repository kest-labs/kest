package flow

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for flows
type Handler struct {
	contracts.BaseModule
	service       Service
	memberService member.Service
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

// RegisterRoutes registers flow routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	RegisterRoutes(r, h, h.memberService)
}

// --- helpers ---

func (h *Handler) projectID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return 0, false
	}
	return uint(id), true
}

func (h *Handler) flowID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("fid"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid flow ID")
		return 0, false
	}
	return uint(id), true
}

func (h *Handler) userID(c *gin.Context) uint {
	uid, _ := c.Get("userID")
	switch v := uid.(type) {
	case uint:
		return v
	case float64:
		return uint(v)
	case int:
		return uint(v)
	}
	return 0
}

// --- Flow handlers ---

// ListFlows handles GET /projects/:id/flows
func (h *Handler) ListFlows(c *gin.Context) {
	pid, ok := h.projectID(c)
	if !ok {
		return
	}

	flows, err := h.service.ListFlows(c.Request.Context(), pid)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"items": flows,
		"total": len(flows),
	})
}

// CreateFlow handles POST /projects/:id/flows
func (h *Handler) CreateFlow(c *gin.Context) {
	pid, ok := h.projectID(c)
	if !ok {
		return
	}

	var req CreateFlowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	flow, err := h.service.CreateFlow(c.Request.Context(), pid, h.userID(c), &req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, flow)
}

// GetFlow handles GET /projects/:id/flows/:fid
func (h *Handler) GetFlow(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	flow, err := h.service.GetFlow(c.Request.Context(), fid)
	if err != nil {
		if err.Error() == "flow not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, flow)
}

// UpdateFlow handles PATCH /projects/:id/flows/:fid
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
		if err.Error() == "flow not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, flow)
}

// DeleteFlow handles DELETE /projects/:id/flows/:fid
func (h *Handler) DeleteFlow(c *gin.Context) {
	fid, ok := h.flowID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteFlow(c.Request.Context(), fid); err != nil {
		if err.Error() == "flow not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// SaveFlow handles PUT /projects/:id/flows/:fid (full save with steps + edges)
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
		if err.Error() == "flow not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, flow)
}

// --- Step handlers ---

// CreateStep handles POST /projects/:id/flows/:fid/steps
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
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, step)
}

// UpdateStep handles PATCH /projects/:id/flows/:fid/steps/:sid
func (h *Handler) UpdateStep(c *gin.Context) {
	sid, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid step ID")
		return
	}

	var req UpdateStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	step, err2 := h.service.UpdateStep(c.Request.Context(), uint(sid), &req)
	if err2 != nil {
		if err2.Error() == "step not found" {
			response.Error(c, http.StatusNotFound, err2.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err2.Error())
		return
	}

	response.Success(c, step)
}

// DeleteStep handles DELETE /projects/:id/flows/:fid/steps/:sid
func (h *Handler) DeleteStep(c *gin.Context) {
	sid, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid step ID")
		return
	}

	if err := h.service.DeleteStep(c.Request.Context(), uint(sid)); err != nil {
		if err.Error() == "step not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
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
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, edge)
}

// DeleteEdge handles DELETE /projects/:id/flows/:fid/edges/:eid
func (h *Handler) DeleteEdge(c *gin.Context) {
	eid, err := strconv.ParseUint(c.Param("eid"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid edge ID")
		return
	}

	if err := h.service.DeleteEdge(c.Request.Context(), uint(eid)); err != nil {
		if err.Error() == "edge not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// --- Run handlers ---

// ExecuteFlowSSE handles GET /projects/:id/flows/:fid/runs/:rid/events (SSE)
// Streams real-time step execution events to the client
func (h *Handler) ExecuteFlowSSE(c *gin.Context) {
	rid, err := strconv.ParseUint(c.Param("rid"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid run ID")
		return
	}

	// Determine base URL from request
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	// Set SSE headers
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
	c.Writer.Flush()

	events := make(chan StepEvent, 10)

	// Start execution in background
	go func() {
		_ = h.service.ExecuteFlow(c.Request.Context(), uint(rid), baseURL, events)
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
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, run)
}

// GetRun handles GET /projects/:id/flows/:fid/runs/:rid
func (h *Handler) GetRun(c *gin.Context) {
	rid, err := strconv.ParseUint(c.Param("rid"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid run ID")
		return
	}

	run, err2 := h.service.GetRun(c.Request.Context(), uint(rid))
	if err2 != nil {
		if err2.Error() == "run not found" {
			response.Error(c, http.StatusNotFound, err2.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err2.Error())
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
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"items": runs,
		"total": len(runs),
	})
}
