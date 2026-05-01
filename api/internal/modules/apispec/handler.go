package apispec

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// TestCaseSaver is a minimal interface to save a generated test case, avoiding import cycles.
type TestCaseSaver interface {
	SaveGeneratedTestCase(ctx context.Context, apiSpecID string, name, flowContent string) error
}

// Handler handles API specification HTTP requests
type Handler struct {
	contracts.BaseModule
	service       Service
	memberService member.Service
	tcSaver       TestCaseSaver
}

// NewHandler creates a new API spec handler
func NewHandler(service Service, memberService member.Service) *Handler {
	return &Handler{
		service:       service,
		memberService: memberService,
	}
}

// SetTestCaseSaver injects the test case saver after construction to avoid import cycles.
func (h *Handler) SetTestCaseSaver(saver TestCaseSaver) {
	h.tcSaver = saver
}

// Name returns the module name
func (h *Handler) Name() string {
	return "apispec"
}

// RegisterRoutes registers API specification routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	RegisterRoutes(r, h, h.memberService)
}

// CreateSpec creates a new API specification
func (h *Handler) CreateSpec(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	var req CreateAPISpecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	req.ProjectID = projectID
	spec, err := h.service.CreateSpec(c.Request.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrSpecAlreadyExists) {
			response.Conflict(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to create API spec", err)
		return
	}

	response.Created(c, spec)
}

// GetSpec gets an API specification by ID
func (h *Handler) GetSpec(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	id, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	spec, err := h.service.GetSpecByID(c.Request.Context(), projectID, id)
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "API spec not found", err)
		return
	}

	response.Success(c, spec)
}

// GetSpecWithExamples gets an API specification with examples
func (h *Handler) GetSpecWithExamples(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	id, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	spec, err := h.service.GetSpecWithExamples(c.Request.Context(), projectID, id)
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "API spec not found", err)
		return
	}

	response.Success(c, spec)
}

// UpdateSpec updates an API specification
func (h *Handler) UpdateSpec(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	id, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	var req UpdateAPISpecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	spec, err := h.service.UpdateSpec(c.Request.Context(), projectID, id, &req)
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to update API spec", err)
		return
	}

	response.Success(c, spec)
}

// DeleteSpec deletes an API specification
func (h *Handler) DeleteSpec(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	id, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	if err := h.service.DeleteSpec(c.Request.Context(), projectID, id); err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to delete API spec", err)
		return
	}

	response.NoContent(c)
}

// ListSpecs lists API specifications
func (h *Handler) ListSpecs(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := &SpecListFilter{
		ProjectID: projectID,
		Version:   c.Query("version"),
		Method:    c.Query("method"),
		Tag:       c.Query("tag"),
		Keyword:   c.Query("keyword"),
		Page:      page,
		PageSize:  pageSize,
	}

	specs, total, err := h.service.ListSpecs(c.Request.Context(), filter)
	if err != nil {
		response.HandleError(c, "Failed to list API specs", err)
		return
	}

	response.Success(c, gin.H{
		"items": specs,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"page_size":   pageSize,
			"total_pages": (total + int64(pageSize) - 1) / int64(pageSize),
		},
	})
}

// CreateAIDraft generates a structured AI draft for an API spec.
func (h *Handler) CreateAIDraft(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	userID, ok := getCurrentUserID(c)
	if !ok {
		response.Unauthorized(c, "Authentication required")
		return
	}

	var req CreateAPISpecAIDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	draft, err := h.service.CreateAIDraft(c.Request.Context(), projectID, userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, ErrAIUnavailable):
			response.Error(c, http.StatusServiceUnavailable, err.Error())
		case errors.Is(err, ErrInvalidSpecData):
			response.BadRequest(c, err.Error(), err)
		default:
			response.HandleError(c, "Failed to create AI draft", err)
		}
		return
	}

	response.Created(c, draft)
}

type aiDraftStreamEvent struct {
	name string
	data interface{}
}

// CreateAIDraftStream generates a structured AI draft and streams status/token updates over SSE.
func (h *Handler) CreateAIDraftStream(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	userID, ok := getCurrentUserID(c)
	if !ok {
		response.Unauthorized(c, "Authentication required")
		return
	}

	var req CreateAPISpecAIDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Flush()

	events := make(chan aiDraftStreamEvent, 64)
	sendEvent := func(name string, data interface{}) bool {
		select {
		case <-c.Request.Context().Done():
			return false
		case events <- aiDraftStreamEvent{name: name, data: data}:
			return true
		}
	}

	go func() {
		defer close(events)

		draft, err := h.service.CreateAIDraftStream(
			c.Request.Context(),
			projectID,
			userID,
			&req,
			AIDraftStreamCallbacks{
				OnStatus: func(status string) {
					sendEvent("status", gin.H{"message": status})
				},
				OnToken: func(token string) {
					sendEvent("token", gin.H{"content": token})
				},
			},
		)
		if err != nil {
			if errors.Is(err, context.Canceled) && c.Request.Context().Err() != nil {
				return
			}

			sendEvent("error", gin.H{"message": h.streamAIDraftErrorMessage(err)})
			return
		}

		sendEvent("result", draft)
	}()

	c.Stream(func(w io.Writer) bool {
		event, ok := <-events
		if !ok {
			fmt.Fprintf(w, "event: done\ndata: {}\n\n")
			return false
		}

		payload, _ := json.Marshal(event.data)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.name, string(payload))
		return true
	})
}

func (h *Handler) streamAIDraftErrorMessage(err error) string {
	switch {
	case errors.Is(err, ErrAIUnavailable):
		return err.Error()
	case errors.Is(err, ErrInvalidSpecData):
		return err.Error()
	case errors.Is(err, context.DeadlineExceeded):
		return "AI draft generation timed out"
	default:
		return err.Error()
	}
}

// GetAIDraft fetches a stored AI draft by ID.
func (h *Handler) GetAIDraft(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	draftID, ok := handler.ParseID(c, "aid")
	if !ok {
		return
	}

	draft, err := h.service.GetAIDraft(c.Request.Context(), projectID, draftID)
	if err != nil {
		if errors.Is(err, ErrAIDraftNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to load AI draft", err)
		return
	}

	response.Success(c, draft)
}

// RefineAIDraft applies an extra instruction to an existing AI draft.
func (h *Handler) RefineAIDraft(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	draftID, ok := handler.ParseID(c, "aid")
	if !ok {
		return
	}

	var req RefineAPISpecAIDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	draft, err := h.service.RefineAIDraft(c.Request.Context(), projectID, draftID, &req)
	if err != nil {
		switch {
		case errors.Is(err, ErrAIDraftNotFound):
			response.NotFound(c, err.Error(), err)
		case errors.Is(err, ErrAIUnavailable):
			response.Error(c, http.StatusServiceUnavailable, err.Error())
		case errors.Is(err, ErrInvalidSpecData):
			response.BadRequest(c, err.Error(), err)
		default:
			response.HandleError(c, "Failed to refine AI draft", err)
		}
		return
	}

	response.Success(c, draft)
}

// AcceptAIDraft creates a formal API spec from a stored AI draft.
func (h *Handler) AcceptAIDraft(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	draftID, ok := handler.ParseID(c, "aid")
	if !ok {
		return
	}

	var req AcceptAPISpecAIDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	result, err := h.service.AcceptAIDraft(c.Request.Context(), projectID, draftID, &req)
	if err != nil {
		switch {
		case errors.Is(err, ErrAIDraftNotFound):
			response.NotFound(c, err.Error(), err)
		case errors.Is(err, ErrInvalidSpecData):
			response.BadRequest(c, err.Error(), err)
		case errors.Is(err, ErrSpecAlreadyExists):
			response.Conflict(c, err.Error(), err)
		default:
			response.HandleError(c, "Failed to accept AI draft", err)
		}
		return
	}

	response.Success(c, result)
}

// CreateExample creates an API example
func (h *Handler) CreateExample(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	sid, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	var req CreateAPIExampleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	req.APISpecID = sid
	example, err := h.service.CreateExample(c.Request.Context(), projectID, &req)
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to create example", err)
		return
	}

	response.Created(c, example)
}

// ListExamples lists all examples for an API specification
func (h *Handler) ListExamples(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	sid, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	examples, err := h.service.GetExamplesBySpecID(c.Request.Context(), projectID, sid)
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to list examples", err)
		return
	}

	response.Success(c, gin.H{"items": examples, "total": len(examples)})
}

// ImportSpecs imports multiple API specifications
func (h *Handler) ImportSpecs(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	var req struct {
		Specs []*CreateAPISpecRequest `json:"specs" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := h.service.ImportSpecs(c.Request.Context(), projectID, req.Specs); err != nil {
		response.HandleError(c, "Failed to import specs", err)
		return
	}

	response.Success(c, gin.H{"message": "Specs imported successfully"})
}

// ExportSpecs exports API specifications
func (h *Handler) ExportSpecs(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	format := c.DefaultQuery("format", "json")

	data, err := h.service.ExportSpecs(c.Request.Context(), projectID, format)
	if err != nil {
		response.HandleError(c, "Failed to export specs", err)
		return
	}

	response.Success(c, data)
}

// GenTest generates an AI-powered Kest flow test file for an API specification
func (h *Handler) GenTest(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	id, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	lang := c.DefaultQuery("lang", "en")

	flowContent, err := h.service.GenTest(c.Request.Context(), projectID, id, lang)
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to generate test", err)
		return
	}

	if h.tcSaver != nil {
		specID := id
		go func() {
			_ = h.tcSaver.SaveGeneratedTestCase(context.Background(), specID, "[AI Generated]", flowContent)
		}()
	}

	response.Success(c, map[string]string{
		"flow_content": flowContent,
	})
}

// GenDoc generates AI-powered documentation for an API specification
func (h *Handler) GenDoc(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	id, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	lang := c.DefaultQuery("lang", "en")

	spec, err := h.service.GenDoc(c.Request.Context(), projectID, id, lang)
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to generate documentation", err)
		return
	}

	response.Success(c, spec)
}

// BatchGenDoc triggers AI documentation generation for multiple specs concurrently.
func (h *Handler) BatchGenDoc(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	var req BatchGenDocRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	result, err := h.service.BatchGenDoc(c.Request.Context(), projectID, &req)
	if err != nil {
		response.HandleError(c, "Failed to start batch doc generation", err)
		return
	}

	response.Success(c, result)
}

// GetShare returns the current internal share metadata for a spec.
func (h *Handler) GetShare(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	specID, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	share, err := h.service.GetShareBySpecID(c.Request.Context(), projectID, specID)
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		if errors.Is(err, ErrShareNotFound) {
			response.Success(c, nil)
			return
		}
		response.HandleError(c, "Failed to load share", err)
		return
	}

	response.Success(c, share)
}

// PublishShare creates or refreshes the public share snapshot for a spec.
func (h *Handler) PublishShare(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	specID, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		response.Unauthorized(c, "Authentication required")
		return
	}

	share, err := h.service.PublishShare(c.Request.Context(), projectID, specID, userID)
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to publish share", err)
		return
	}

	response.Success(c, share)
}

// DeleteShare disables a published share.
func (h *Handler) DeleteShare(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	specID, ok := handler.ParseID(c, "sid")
	if !ok {
		return
	}

	if err := h.service.DeleteShareBySpecID(c.Request.Context(), projectID, specID); err != nil {
		if errors.Is(err, ErrSpecNotFound) || errors.Is(err, ErrShareNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to delete share", err)
		return
	}

	response.NoContent(c)
}

// GetPublicShare serves the anonymous share snapshot.
func (h *Handler) GetPublicShare(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		response.BadRequest(c, "Invalid share slug")
		return
	}

	share, err := h.service.GetPublicShareBySlug(c.Request.Context(), slug)
	if err != nil {
		if errors.Is(err, ErrShareNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to load public share", err)
		return
	}

	response.Success(c, share)
}

// Convenience aliases for cleaner route definitions
func (h *Handler) List(c *gin.Context) {
	h.ListSpecs(c)
}

func (h *Handler) Create(c *gin.Context) {
	h.CreateSpec(c)
}

func getCurrentUserID(c *gin.Context) (string, bool) {
	return handler.GetUserID(c)
}

func (h *Handler) Get(c *gin.Context) {
	h.GetSpec(c)
}

func (h *Handler) Update(c *gin.Context) {
	h.UpdateSpec(c)
}

func (h *Handler) Delete(c *gin.Context) {
	h.DeleteSpec(c)
}

func (h *Handler) GetWithExamples(c *gin.Context) {
	h.GetSpecWithExamples(c)
}

func (h *Handler) BatchImport(c *gin.Context) {
	h.ImportSpecs(c)
}

func (h *Handler) AddExample(c *gin.Context) {
	h.CreateExample(c)
}
