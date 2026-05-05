package category

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

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
	projectID := c.Param("id")
	if projectID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	var (
		categories []*CategoryResponse
		err        error
	)

	if c.Query("tree") == "true" {
		categories, err = h.service.GetCategoryTree(c.Request.Context(), projectID)
	} else {
		categories, err = h.service.ListCategories(c.Request.Context(), projectID)
	}

	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	if c.Query("tree") == "true" {
		response.Success(c, &CategoryListResponse{
			Items: categories,
			Total: countCategories(categories),
		})
		return
	}

	filteredCategories := filterCategories(categories, c.Query("search"))
	items, pagination := paginateCategories(
		filteredCategories,
		parsePositiveIntQuery(c, "page", 1),
		parsePositiveIntQuery(c, "per_page", 20),
	)

	response.Success(c, &CategoryListResponse{
		Items:      items,
		Total:      len(filteredCategories),
		Pagination: pagination,
	})
}

// CreateCategory handles POST /api/v1/projects/:pid/categories
func (h *Handler) CreateCategory(c *gin.Context) {
	projectID := c.Param("id")
	if projectID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	category, err := h.service.CreateCategory(c.Request.Context(), projectID, &req)
	if err != nil {
		if errors.Is(err, ErrInvalidParentCategory) {
			response.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, category)
}

// GetCategory handles GET /api/v1/projects/:id/categories/:cid
func (h *Handler) GetCategory(c *gin.Context) {
	projectID := c.Param("id")
	if projectID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	id := c.Param("cid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	category, err := h.service.GetCategory(c.Request.Context(), projectID, id)
	if err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
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
	projectID := c.Param("id")
	if projectID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	id := c.Param("cid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var req UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	category, err := h.service.UpdateCategory(c.Request.Context(), projectID, id, &req)
	if err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		if errors.Is(err, ErrInvalidParentCategory) {
			response.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, category)
}

// DeleteCategory handles DELETE /api/v1/projects/:id/categories/:cid
func (h *Handler) DeleteCategory(c *gin.Context) {
	projectID := c.Param("id")
	if projectID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	id := c.Param("cid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	if err := h.service.DeleteCategory(c.Request.Context(), projectID, id); err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
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
	projectID := c.Param("id")
	if projectID == "" {
		response.Error(c, http.StatusBadRequest, "Invalid project ID")
		return
	}

	var req SortCategoriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.SortCategories(c.Request.Context(), projectID, &req); err != nil {
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

func parsePositiveIntQuery(c *gin.Context, key string, defaultValue int) int {
	value := strings.TrimSpace(c.Query(key))
	if value == "" {
		return defaultValue
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return defaultValue
	}

	return parsed
}

func filterCategories(categories []*CategoryResponse, search string) []*CategoryResponse {
	keyword := strings.ToLower(strings.TrimSpace(search))
	if keyword == "" {
		return categories
	}

	categoryNames := make(map[string]string, len(categories))
	for _, category := range categories {
		categoryNames[category.ID] = category.Name
	}

	filtered := make([]*CategoryResponse, 0, len(categories))
	for _, category := range categories {
		parentName := ""
		if category.ParentID != nil {
			parentName = categoryNames[*category.ParentID]
		}

		if strings.Contains(strings.ToLower(category.Name), keyword) ||
			strings.Contains(strings.ToLower(category.Description), keyword) ||
			strings.Contains(strings.ToLower(parentName), keyword) {
			filtered = append(filtered, category)
		}
	}

	return filtered
}

func paginateCategories(categories []*CategoryResponse, page, perPage int) ([]*CategoryResponse, *CategoryPagination) {
	if perPage <= 0 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	if page <= 0 {
		page = 1
	}

	total := len(categories)
	totalPages := 1
	if total > 0 {
		totalPages = (total + perPage - 1) / perPage
	}
	if page > totalPages {
		page = totalPages
	}

	start := (page - 1) * perPage
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}

	return categories[start:end], &CategoryPagination{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
		HasPrev:    page > 1,
	}
}

func countCategories(categories []*CategoryResponse) int {
	total := 0
	for _, category := range categories {
		total++
		total += countCategoryChildren(category.Children)
	}
	return total
}

func countCategoryChildren(categories []CategoryResponse) int {
	total := 0
	for _, category := range categories {
		total++
		total += countCategoryChildren(category.Children)
	}
	return total
}
