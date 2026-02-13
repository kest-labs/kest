package category

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for categories
type Handler struct {
	contracts.BaseModule
	service       Service
	memberService member.Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "category"
}

// NewHandler creates a new category handler
func NewHandler(service Service, memberService member.Service) *Handler {
	return &Handler{
		service:       service,
		memberService: memberService,
	}
}

// RegisterRoutes registers category routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	RegisterRoutes(r, h, h.memberService)
}

// ListCategories handles GET /api/v1/projects/:pid/categories
func (h *Handler) ListCategories(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	var categories []*CategoryResponse

	if c.Query("tree") == "true" {
		categories, err = h.service.GetCategoryTree(c.Request.Context(), uint(projectID))
	} else {
		categories, err = h.service.ListCategories(c.Request.Context(), uint(projectID))
	}

	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"items": categories,
		"total": len(categories),
	})
}

// CreateCategory handles POST /api/v1/projects/:pid/categories
func (h *Handler) CreateCategory(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	category, err := h.service.CreateCategory(c.Request.Context(), uint(projectID), &req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, category)
}

// GetCategory handles GET /api/v1/projects/:id/categories/:cid
func (h *Handler) GetCategory(c *gin.Context) {
	idStr := c.Param("cid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	category, err := h.service.GetCategory(c.Request.Context(), uint(id))
	if err != nil {
		if err.Error() == "category not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, category)
}

// UpdateCategory handles PATCH /api/v1/projects/:id/categories/:cid
func (h *Handler) UpdateCategory(c *gin.Context) {
	idStr := c.Param("cid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var req UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	category, err := h.service.UpdateCategory(c.Request.Context(), uint(id), &req)
	if err != nil {
		if err.Error() == "category not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, category)
}

// DeleteCategory handles DELETE /api/v1/projects/:id/categories/:cid
func (h *Handler) DeleteCategory(c *gin.Context) {
	idStr := c.Param("cid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	if err := h.service.DeleteCategory(c.Request.Context(), uint(id)); err != nil {
		if err.Error() == "category not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// SortCategories handles PUT /api/v1/projects/:pid/categories/sort
func (h *Handler) SortCategories(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	var req SortCategoriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.SortCategories(c.Request.Context(), uint(projectID), &req); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, nil)
}

// Convenience methods for router registration
func (h *Handler) List(c *gin.Context) {
	h.ListCategories(c)
}

func (h *Handler) Create(c *gin.Context) {
	h.CreateCategory(c)
}

func (h *Handler) Get(c *gin.Context) {
	h.GetCategory(c)
}

func (h *Handler) Update(c *gin.Context) {
	h.UpdateCategory(c)
}

func (h *Handler) Delete(c *gin.Context) {
	h.DeleteCategory(c)
}

func (h *Handler) Sort(c *gin.Context) {
	h.SortCategories(c)
}
