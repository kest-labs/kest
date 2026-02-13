package issue

import (
	"errors"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for issue module
type Handler struct {
	contracts.BaseModule
	service Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "issue"
}

// NewHandler creates a new issue handler
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// List handles GET /projects/:id/issues
func (h *Handler) List(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	// Parse query parameters
	opts := ListOptions{
		Page:    handler.QueryInt(c, "page", 1),
		PerPage: handler.QueryInt(c, "per_page", 20),
		Status:  IssueStatus(c.Query("status")),
		Level:   c.Query("level"),
		SortBy:  c.DefaultQuery("sort_by", "last_seen"),
		Order:   c.DefaultQuery("order", "desc"),
	}

	result, err := h.service.ListIssues(c.Request.Context(), uint64(projectID), opts)
	if err != nil {
		response.InternalServerError(c, "failed to list issues", err)
		return
	}

	response.Success(c, result)
}

// Get handles GET /projects/:id/issues/:fingerprint
func (h *Handler) Get(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	fingerprint := c.Param("fingerprint")
	if fingerprint == "" {
		response.Error(c, http.StatusBadRequest, "fingerprint is required")
		return
	}

	// URL decode the fingerprint to handle special characters (spaces, etc.)
	decodedFingerprint, err := url.QueryUnescape(fingerprint)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid fingerprint encoding")
		return
	}

	issue, err := h.service.GetIssue(c.Request.Context(), uint64(projectID), decodedFingerprint)
	if err != nil {
		if errors.Is(err, errors.New("issue not found")) {
			response.NotFound(c, "issue not found")
			return
		}
		response.InternalServerError(c, "failed to get issue", err)
		return
	}

	response.Success(c, issue)
}

// Resolve handles POST /projects/:id/issues/:fingerprint/resolve
func (h *Handler) Resolve(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	fingerprint := c.Param("fingerprint")
	if fingerprint == "" {
		response.Error(c, http.StatusBadRequest, "fingerprint is required")
		return
	}

	// URL decode the fingerprint
	decodedFingerprint, err := url.QueryUnescape(fingerprint)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid fingerprint encoding")
		return
	}

	err = h.service.ResolveIssue(c.Request.Context(), uint64(projectID), decodedFingerprint)
	if err != nil {
		response.InternalServerError(c, "failed to resolve issue", err)
		return
	}

	response.Success(c, gin.H{"message": "issue resolved", "fingerprint": decodedFingerprint})
}

// Ignore handles POST /projects/:id/issues/:fingerprint/ignore
func (h *Handler) Ignore(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	fingerprint := c.Param("fingerprint")
	if fingerprint == "" {
		response.Error(c, http.StatusBadRequest, "fingerprint is required")
		return
	}

	// URL decode the fingerprint
	decodedFingerprint, err := url.QueryUnescape(fingerprint)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid fingerprint encoding")
		return
	}

	err = h.service.IgnoreIssue(c.Request.Context(), uint64(projectID), decodedFingerprint)
	if err != nil {
		response.InternalServerError(c, "failed to ignore issue", err)
		return
	}

	response.Success(c, gin.H{"message": "issue ignored", "fingerprint": decodedFingerprint})
}

// Reopen handles POST /projects/:id/issues/:fingerprint/reopen
func (h *Handler) Reopen(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	fingerprint := c.Param("fingerprint")
	if fingerprint == "" {
		response.Error(c, http.StatusBadRequest, "fingerprint is required")
		return
	}

	// URL decode the fingerprint
	decodedFingerprint, err := url.QueryUnescape(fingerprint)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid fingerprint encoding")
		return
	}

	err = h.service.ReopenIssue(c.Request.Context(), uint64(projectID), decodedFingerprint)
	if err != nil {
		response.InternalServerError(c, "failed to reopen issue", err)
		return
	}

	response.Success(c, gin.H{"message": "issue reopened", "fingerprint": decodedFingerprint})
}

// GetEvents handles GET /projects/:id/issues/:fingerprint/events
func (h *Handler) GetEvents(c *gin.Context) {
	projectID, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	fingerprint := c.Param("fingerprint")
	if fingerprint == "" {
		response.Error(c, http.StatusBadRequest, "fingerprint is required")
		return
	}

	// URL decode the fingerprint
	decodedFingerprint, err := url.QueryUnescape(fingerprint)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid fingerprint encoding")
		return
	}

	opts := EventListOptions{
		Page:    handler.QueryInt(c, "page", 1),
		PerPage: handler.QueryInt(c, "per_page", 10),
		SortBy:  c.DefaultQuery("sort_by", "timestamp"),
		Order:   c.DefaultQuery("order", "desc"),
	}

	result, err := h.service.GetIssueEvents(c.Request.Context(), uint64(projectID), decodedFingerprint, opts)
	if err != nil {
		response.InternalServerError(c, "failed to get issue events", err)
		return
	}

	response.Success(c, result)
}
