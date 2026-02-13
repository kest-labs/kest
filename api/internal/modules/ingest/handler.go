package ingest

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/modules/envelope"
	"github.com/kest-labs/kest/api/internal/modules/project"
	"github.com/kest-labs/kest/api/pkg/logger"
)

// EventProcessor defines the interface for processing events
// This allows for different backends (ClickHouse, PostgreSQL, etc.)
type EventProcessor interface {
	Process(ctx context.Context, projectID uint, event *envelope.Event) error
}

// Handler handles Sentry compatible ingestion requests
type Handler struct {
	contracts.BaseModule
	projectService project.Service
	processor      EventProcessor
}

// Name returns the module name
func (h *Handler) Name() string {
	return "ingest"
}

// NewHandler creates a new ingest handler
func NewHandler(projectService project.Service, processor EventProcessor) *Handler {
	return &Handler{
		projectService: projectService,
		processor:      processor,
	}
}

// StoreEnvelope handles POST /api/:project_id/envelope/
// This is the main endpoint that Sentry SDKs send events to
func (h *Handler) StoreEnvelope(c *gin.Context) {
	ctx := c.Request.Context()
	projectID := c.Param("project_id")

	// 1. Extract public key from X-Sentry-Auth header
	authHeader := c.GetHeader("X-Sentry-Auth")
	publicKey := envelope.ExtractPublicKeyFromAuth(authHeader)

	// Fallback: try DSN in query string (legacy support)
	if publicKey == "" {
		if dsnParam := c.Query("sentry_key"); dsnParam != "" {
			publicKey = dsnParam
		}
	}

	if publicKey == "" {
		logger.Warn("Missing sentry_key in request", map[string]any{"project_id": projectID})
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authentication"})
		return
	}

	// 2. Validate project and public key
	proj, err := h.projectService.ValidateKey(ctx, projectID, publicKey)
	if err != nil {
		switch err {
		case project.ErrProjectNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		case project.ErrInvalidPublicKey:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid key"})
		case project.ErrProjectDisabled:
			c.JSON(http.StatusForbidden, gin.H{"error": "project disabled"})
		default:
			logger.Error("Failed to validate project key", map[string]any{
				"error":      err.Error(),
				"project_id": projectID,
			})
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		}
		return
	}

	// 3. Read request body (limit to 40MB)
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, envelope.MaxPayloadSize))
	if err != nil {
		logger.Error("Failed to read request body", map[string]any{"error": err.Error()})
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	// 4. Parse envelope
	env, err := envelope.ParseBytes(body)
	if err != nil {
		logger.Warn("Failed to parse envelope", map[string]any{
			"error":      err.Error(),
			"project_id": projectID,
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid envelope: %v", err)})
		return
	}

	// 5. Process each item
	var processedCount int
	var lastEventID string

	for _, item := range env.Items {
		switch item.Header.Type {
		case envelope.ItemTypeEvent:
			event, err := envelope.ParseEvent(item.Payload)
			if err != nil {
				logger.Warn("Failed to parse event", map[string]any{"error": err.Error()})
				continue
			}
			lastEventID = event.EventID

			// Process the event
			if h.processor != nil {
				if err := h.processor.Process(ctx, proj.ID, event); err != nil {
					logger.Error("Failed to process event", map[string]any{
						"error":    err.Error(),
						"event_id": event.EventID,
					})
					continue
				}
			}
			processedCount++
			logger.Debug("Processed event", map[string]any{
				"event_id": event.EventID,
				"level":    event.Level,
			})

		case envelope.ItemTypeTransaction:
			// TODO: Implement transaction (performance) processing
			logger.Debug("Received transaction (not yet implemented)", map[string]any{"project_id": proj.ID})

		case envelope.ItemTypeSession:
			// TODO: Implement session processing
			logger.Debug("Received session (not yet implemented)", map[string]any{"project_id": proj.ID})

		default:
			logger.Debug("Received unknown item type", map[string]any{"type": string(item.Header.Type)})
		}
	}

	// 6. Return success response
	// Sentry SDKs expect a response with the event_id
	if lastEventID == "" && env.Header.EventID != "" {
		lastEventID = env.Header.EventID
	}

	c.JSON(http.StatusOK, gin.H{"id": lastEventID})
}

// StoreEvent handles POST /api/:project_id/store/
// This is the deprecated store endpoint for backwards compatibility
func (h *Handler) StoreEvent(c *gin.Context) {
	// The store endpoint expects a single JSON event
	// Convert it to an envelope and process
	h.StoreEnvelope(c)
}

// Health check endpoint
func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "trac-ingest",
	})
}
