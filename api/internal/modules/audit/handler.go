package audit

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/pkg/response"
)

type WorkspaceBackingResolver interface {
	ResolveBackingIDByWorkspaceID(ctx context.Context, workspaceID string) (string, error)
	ResolveWorkspaceIDByBackingID(ctx context.Context, backingID string) (string, error)
}

// Handler handles HTTP requests for audit logs
type Handler struct {
	contracts.BaseModule
	repo                     Repository
	workspaceBackingResolver WorkspaceBackingResolver
}

// Name returns the module name
func (h *Handler) Name() string {
	return "audit"
}

// NewHandler creates a new audit handler
func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) SetWorkspaceBackingResolver(resolver WorkspaceBackingResolver) {
	h.workspaceBackingResolver = resolver
}

// RegisterRoutes registers audit log routes on the fluent router
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/workspaces/:id/audit-logs", func(auditRoutes *router.Router) {
		auditRoutes.WithMiddleware("auth")
		auditRoutes.Use(h.resolveWorkspaceContext())

		auditRoutes.GET("", h.ListByWorkspace)
	})

	r.Group("/projects/:id/audit-logs", func(auditRoutes *router.Router) {
		auditRoutes.WithMiddleware("auth")
		auditRoutes.Use(h.resolveLegacyWorkspaceContext())

		auditRoutes.GET("", h.ListByWorkspace)
	})
}

func (h *Handler) resolveWorkspaceContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		if h.workspaceBackingResolver == nil {
			response.Error(c, http.StatusServiceUnavailable, "Workspace resolver is not configured")
			c.Abort()
			return
		}

		workspaceID := c.Param("id")
		if workspaceID == "" {
			response.Error(c, http.StatusBadRequest, "Workspace ID missing in request")
			c.Abort()
			return
		}

		backingID, err := h.workspaceBackingResolver.ResolveBackingIDByWorkspaceID(c.Request.Context(), workspaceID)
		if err != nil {
			response.Error(c, http.StatusNotFound, "Workspace not found")
			c.Abort()
			return
		}

		c.Set("workspaceID", workspaceID)
		c.Set("workspaceBackingID", backingID)

		c.Next()
	}
}

func (h *Handler) resolveLegacyWorkspaceContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		if h.workspaceBackingResolver == nil {
			response.Error(c, http.StatusServiceUnavailable, "Workspace resolver is not configured")
			c.Abort()
			return
		}

		backingID := c.Param("id")
		if backingID == "" {
			response.Error(c, http.StatusBadRequest, "Workspace backing ID missing in request")
			c.Abort()
			return
		}

		workspaceID, err := h.workspaceBackingResolver.ResolveWorkspaceIDByBackingID(c.Request.Context(), backingID)
		if err != nil {
			response.Error(c, http.StatusNotFound, "Workspace not found")
			c.Abort()
			return
		}

		c.Set("workspaceID", workspaceID)
		c.Set("workspaceBackingID", backingID)
		c.Next()
	}
}

// ListByWorkspace handles GET /v1/workspaces/:id/audit-logs
func (h *Handler) ListByWorkspace(c *gin.Context) {
	workspaceID := c.Param("id")
	if contextWorkspaceID, ok := c.Get("workspaceID"); ok {
		if id, ok := contextWorkspaceID.(string); ok && id != "" {
			workspaceID = id
		}
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

	logs, total, err := h.repo.ListByWorkspace(c.Request.Context(), workspaceID, page, pageSize)
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
