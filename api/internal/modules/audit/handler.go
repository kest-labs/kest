package audit

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for audit logs
type Handler struct {
	contracts.BaseModule
	repo            Repository
	projectReadAuth gin.HandlerFunc
}

// Name returns the module name
func (h *Handler) Name() string {
	return "audit"
}

// NewHandler creates a new audit handler
func NewHandler(repo Repository, projectReadAuth gin.HandlerFunc) *Handler {
	return &Handler{repo: repo, projectReadAuth: projectReadAuth}
}

// RegisterRoutes registers audit log routes on the fluent router
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/audit-logs", func(auditRoutes *router.Router) {
		auditRoutes.WithMiddleware("auth")

		auditRoutes.GET("", h.ListByProject).
			Middleware(h.projectReadAuth)
	})
}

// ListByProject handles GET /v1/projects/:id/audit-logs
func (h *Handler) ListByProject(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	page := 1
	pageSize := 20
	if p := c.Query("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if ps := c.Query("page_size"); ps != "" {
		if parsed, err := strconv.Atoi(ps); err == nil && parsed > 0 && parsed <= 100 {
			pageSize = parsed
		}
	}

	logs, total, err := h.repo.ListByProject(c.Request.Context(), uint(projectID), page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	items := make([]*AuditLogResponse, 0, len(logs))
	for i := range logs {
		items = append(items, logs[i].ToResponse())
	}

	response.Success(c, gin.H{
		"items": items,
		"total": total,
		"page":  page,
	})
}
