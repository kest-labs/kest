// Package pagination provides Laravel-style pagination for the Eogo framework.
//
// This package implements full-featured pagination with:
//   - Automatic URL generation for pagination links
//   - Query parameter preservation
//   - Cursor-based pagination for large datasets
//   - Integration with GORM and Gin
//
// Basic Usage:
//
//	// From Gin context
//	paginator, err := pagination.New[User](c, db)
//
//	// Manual creation
//	paginator := pagination.NewPaginator(items, total, page, perPage)
//
// With Response:
//
//	users, paginator, _ := pagination.Paginate[User](db, req)
//	response.Paginated(c, users, paginator)
package pagination

import (
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"

	"github.com/kest-labs/kest/api/pkg/response"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Paginator holds pagination state and generates URLs.
// Implements response.PaginatableWithItems interface.
type Paginator[T any] struct {
	items       []T
	total       int64
	perPage     int
	currentPage int
	lastPage    int
	path        string
	query       url.Values
	fragment    string         // URL fragment (#section)
	pageName    string         // Custom page parameter name
	additional  map[string]any // Additional metadata
}

// Ensure Paginator implements PaginatableWithItems
var _ response.PaginatableWithItems = (*Paginator[any])(nil)

// NewPaginator creates a new paginator instance.
//
// Example:
//
//	paginator := pagination.NewPaginator(users, 100, 1, 15)
//	paginator.SetPath("/api/users")
func NewPaginator[T any](items []T, total int64, page, perPage int) *Paginator[T] {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = DefaultPerPage
	}
	if perPage > MaxPerPage {
		perPage = MaxPerPage
	}

	lastPage := int(math.Ceil(float64(total) / float64(perPage)))
	if lastPage < 1 {
		lastPage = 1
	}

	return &Paginator[T]{
		items:       items,
		total:       total,
		perPage:     perPage,
		currentPage: page,
		lastPage:    lastPage,
		query:       make(url.Values),
		pageName:    "page",
		additional:  make(map[string]any),
	}
}

// Items returns the paginated items.
func (p *Paginator[T]) Items() []T {
	return p.items
}

// GetItems returns items as any (for response.PaginatableWithItems interface).
func (p *Paginator[T]) GetItems() any {
	return p.items
}

// Total returns the total number of items.
func (p *Paginator[T]) Total() int64 {
	return p.total
}

// PerPage returns items per page.
func (p *Paginator[T]) PerPage() int {
	return p.perPage
}

// CurrentPage returns the current page number.
func (p *Paginator[T]) CurrentPage() int {
	return p.currentPage
}

// LastPage returns the last page number.
func (p *Paginator[T]) LastPage() int {
	return p.lastPage
}

// From returns the starting item number for current page.
func (p *Paginator[T]) From() int {
	if p.total == 0 {
		return 0
	}
	return (p.currentPage-1)*p.perPage + 1
}

// To returns the ending item number for current page.
func (p *Paginator[T]) To() int {
	if p.total == 0 {
		return 0
	}
	to := p.currentPage * p.perPage
	if int64(to) > p.total {
		return int(p.total)
	}
	return to
}

// HasPages returns true if there are multiple pages.
func (p *Paginator[T]) HasPages() bool {
	return p.lastPage > 1
}

// HasMorePages returns true if there are more pages after current.
func (p *Paginator[T]) HasMorePages() bool {
	return p.currentPage < p.lastPage
}

// OnFirstPage returns true if on the first page.
func (p *Paginator[T]) OnFirstPage() bool {
	return p.currentPage <= 1
}

// OnLastPage returns true if on the last page.
func (p *Paginator[T]) OnLastPage() bool {
	return p.currentPage >= p.lastPage
}

// SetPath sets the base path for URL generation.
func (p *Paginator[T]) SetPath(path string) *Paginator[T] {
	p.path = path
	return p
}

// WithQuery adds query parameters to pagination URLs.
// Existing pagination parameters (page, per_page) are excluded.
func (p *Paginator[T]) WithQuery(query url.Values) *Paginator[T] {
	for key, values := range query {
		if key != "page" && key != "per_page" {
			p.query[key] = values
		}
	}
	return p
}

// Append adds a single query parameter.
func (p *Paginator[T]) Append(key, value string) *Paginator[T] {
	if key != "page" && key != "per_page" {
		p.query.Set(key, value)
	}
	return p
}

// Fragment sets the URL fragment (e.g., "#section").
// The fragment will be appended to all pagination URLs.
//
// Example:
//
//	paginator.Fragment("comments")
//	// URLs will be like: /posts?page=2#comments
func (p *Paginator[T]) Fragment(fragment string) *Paginator[T] {
	p.fragment = fragment
	return p
}

// SetPageName sets a custom page parameter name.
// Default is "page".
//
// Example:
//
//	paginator.SetPageName("p")
//	// URLs will be like: /posts?p=2
func (p *Paginator[T]) SetPageName(name string) *Paginator[T] {
	p.pageName = name
	return p
}

// Additional adds extra metadata to the response.
// This data will be merged into the response alongside meta and links.
//
// Example:
//
//	paginator.Additional(map[string]any{
//	    "filters_applied": true,
//	    "sort_by": "created_at",
//	})
func (p *Paginator[T]) Additional(data map[string]any) *Paginator[T] {
	for k, v := range data {
		p.additional[k] = v
	}
	return p
}

// GetAdditional returns the additional metadata.
func (p *Paginator[T]) GetAdditional() map[string]any {
	if len(p.additional) == 0 {
		return nil
	}
	return p.additional
}

// Through transforms each item using the provided function.
// This is useful for converting domain objects to response DTOs.
//
// Example:
//
//	paginator.Through(func(user *domain.User) any {
//	    return map[string]any{
//	        "id":       user.ID,
//	        "username": user.Username,
//	    }
//	})
func (p *Paginator[T]) Through(fn func(T) any) *TransformedPaginator {
	transformed := make([]any, len(p.items))
	for i, item := range p.items {
		transformed[i] = fn(item)
	}
	return &TransformedPaginator{
		items:       transformed,
		total:       p.total,
		perPage:     p.perPage,
		currentPage: p.currentPage,
		lastPage:    p.lastPage,
		path:        p.path,
		query:       p.query,
		fragment:    p.fragment,
		pageName:    p.pageName,
		additional:  p.additional,
	}
}

// TransformedPaginator holds transformed pagination data.
// Created by Paginator.Through().
type TransformedPaginator struct {
	items       []any
	total       int64
	perPage     int
	currentPage int
	lastPage    int
	path        string
	query       url.Values
	fragment    string
	pageName    string
	additional  map[string]any
}

// GetItems returns the transformed items.
func (p *TransformedPaginator) GetItems() any {
	return p.items
}

// GetMeta returns pagination metadata.
func (p *TransformedPaginator) GetMeta() *response.Meta {
	from := 0
	to := 0
	if p.total > 0 {
		from = (p.currentPage-1)*p.perPage + 1
		to = p.currentPage * p.perPage
		if int64(to) > p.total {
			to = int(p.total)
		}
	}
	return &response.Meta{
		CurrentPage: p.currentPage,
		PerPage:     p.perPage,
		Total:       p.total,
		LastPage:    p.lastPage,
		From:        from,
		To:          to,
	}
}

// GetLinks returns pagination links.
func (p *TransformedPaginator) GetLinks() *response.Links {
	buildURL := func(page int) string {
		query := make(url.Values)
		for k, v := range p.query {
			query[k] = v
		}
		pageName := p.pageName
		if pageName == "" {
			pageName = "page"
		}
		query.Set(pageName, strconv.Itoa(page))

		result := p.path
		if result == "" {
			result = "?"
		} else if !strings.Contains(result, "?") {
			result += "?"
		} else {
			result += "&"
		}
		result += query.Encode()
		if p.fragment != "" {
			result += "#" + p.fragment
		}
		return result
	}

	var prev, next *string
	if p.currentPage > 1 {
		url := buildURL(p.currentPage - 1)
		prev = &url
	}
	if p.currentPage < p.lastPage {
		url := buildURL(p.currentPage + 1)
		next = &url
	}

	return &response.Links{
		First: buildURL(1),
		Last:  buildURL(p.lastPage),
		Prev:  prev,
		Next:  next,
	}
}

// GetAdditional returns additional metadata.
func (p *TransformedPaginator) GetAdditional() map[string]any {
	if len(p.additional) == 0 {
		return nil
	}
	return p.additional
}

// Ensure TransformedPaginator implements PaginatableWithItems
var _ response.PaginatableWithItems = (*TransformedPaginator)(nil)

// URL generates the URL for a specific page.
func (p *Paginator[T]) URL(page int) string {
	if page < 1 {
		page = 1
	}
	if page > p.lastPage {
		page = p.lastPage
	}

	query := make(url.Values)
	for k, v := range p.query {
		query[k] = v
	}

	pageName := p.pageName
	if pageName == "" {
		pageName = "page"
	}
	query.Set(pageName, strconv.Itoa(page))

	var result string
	if p.path == "" {
		result = "?" + query.Encode()
	} else {
		separator := "?"
		if strings.Contains(p.path, "?") {
			separator = "&"
		}
		result = p.path + separator + query.Encode()
	}

	if p.fragment != "" {
		result += "#" + p.fragment
	}

	return result
}

// FirstPageURL returns the URL for the first page.
func (p *Paginator[T]) FirstPageURL() string {
	return p.URL(1)
}

// LastPageURL returns the URL for the last page.
func (p *Paginator[T]) LastPageURL() string {
	return p.URL(p.lastPage)
}

// PreviousPageURL returns the URL for the previous page, or nil if on first page.
func (p *Paginator[T]) PreviousPageURL() *string {
	if p.OnFirstPage() {
		return nil
	}
	url := p.URL(p.currentPage - 1)
	return &url
}

// NextPageURL returns the URL for the next page, or nil if on last page.
func (p *Paginator[T]) NextPageURL() *string {
	if !p.HasMorePages() {
		return nil
	}
	url := p.URL(p.currentPage + 1)
	return &url
}

// GetMeta returns pagination metadata for API responses.
// Implements response.Paginatable interface.
func (p *Paginator[T]) GetMeta() *response.Meta {
	return &response.Meta{
		CurrentPage: p.currentPage,
		PerPage:     p.perPage,
		Total:       p.total,
		LastPage:    p.lastPage,
		From:        p.From(),
		To:          p.To(),
	}
}

// GetLinks returns pagination links for API responses.
// Implements response.Paginatable interface.
func (p *Paginator[T]) GetLinks() *response.Links {
	return &response.Links{
		First: p.FirstPageURL(),
		Last:  p.LastPageURL(),
		Prev:  p.PreviousPageURL(),
		Next:  p.NextPageURL(),
	}
}

// Links returns an array of page links for UI rendering.
// Includes previous/next and numbered page links.
func (p *Paginator[T]) Links() []PageLink {
	links := make([]PageLink, 0)

	// Previous link
	links = append(links, PageLink{
		URL:    p.PreviousPageURL(),
		Label:  "Previous",
		Active: false,
		Page:   p.currentPage - 1,
	})

	// Page number links with window
	window := p.getURLWindow()
	for _, page := range window {
		if page == -1 {
			// Ellipsis
			links = append(links, PageLink{
				URL:    nil,
				Label:  "...",
				Active: false,
				Page:   0,
			})
		} else {
			url := p.URL(page)
			links = append(links, PageLink{
				URL:    &url,
				Label:  strconv.Itoa(page),
				Active: page == p.currentPage,
				Page:   page,
			})
		}
	}

	// Next link
	links = append(links, PageLink{
		URL:    p.NextPageURL(),
		Label:  "Next",
		Active: false,
		Page:   p.currentPage + 1,
	})

	return links
}

// getURLWindow calculates which page numbers to show.
// Returns -1 for ellipsis positions.
func (p *Paginator[T]) getURLWindow() []int {
	onEachSide := 3
	window := make([]int, 0)

	if p.lastPage <= (onEachSide*2 + 6) {
		// Show all pages
		for i := 1; i <= p.lastPage; i++ {
			window = append(window, i)
		}
		return window
	}

	// First pages
	if p.currentPage <= onEachSide+3 {
		for i := 1; i <= onEachSide*2+2; i++ {
			window = append(window, i)
		}
		window = append(window, -1) // ellipsis
		window = append(window, p.lastPage-1, p.lastPage)
		return window
	}

	// Last pages
	if p.currentPage >= p.lastPage-onEachSide-2 {
		window = append(window, 1, 2)
		window = append(window, -1) // ellipsis
		for i := p.lastPage - onEachSide*2 - 1; i <= p.lastPage; i++ {
			window = append(window, i)
		}
		return window
	}

	// Middle pages
	window = append(window, 1, 2)
	window = append(window, -1) // ellipsis
	for i := p.currentPage - onEachSide; i <= p.currentPage+onEachSide; i++ {
		window = append(window, i)
	}
	window = append(window, -1) // ellipsis
	window = append(window, p.lastPage-1, p.lastPage)

	return window
}

// PageLink represents a single pagination link.
type PageLink struct {
	URL    *string `json:"url"`
	Label  string  `json:"label"`
	Active bool    `json:"active"`
	Page   int     `json:"page"`
}

// ToMap converts paginator to a map for JSON serialization.
func (p *Paginator[T]) ToMap() map[string]any {
	return map[string]any{
		"data":           p.items,
		"current_page":   p.currentPage,
		"per_page":       p.perPage,
		"total":          p.total,
		"last_page":      p.lastPage,
		"from":           p.From(),
		"to":             p.To(),
		"first_page_url": p.FirstPageURL(),
		"last_page_url":  p.LastPageURL(),
		"prev_page_url":  p.PreviousPageURL(),
		"next_page_url":  p.NextPageURL(),
		"path":           p.path,
		"links":          p.Links(),
	}
}

// ============================================================================
// GORM Integration
// ============================================================================

// Paginate executes a paginated query on GORM.
//
// Example:
//
//	req := pagination.FromContext(c)
//	users, paginator, err := pagination.Paginate[User](db.Where("active = ?", true), req)
func Paginate[T any](db *gorm.DB, req *Request) ([]T, *Paginator[T], error) {
	var items []T
	var total int64

	// Clone db for counting to avoid affecting the original query
	countDB := db.Session(&gorm.Session{})
	if err := countDB.Count(&total).Error; err != nil {
		return nil, nil, fmt.Errorf("failed to count: %w", err)
	}

	// Get items with pagination
	offset := req.GetOffset()
	if err := db.Offset(offset).Limit(req.GetPageSize()).Find(&items).Error; err != nil {
		return nil, nil, fmt.Errorf("failed to fetch items: %w", err)
	}

	paginator := NewPaginator(items, total, req.GetPage(), req.GetPageSize())
	return items, paginator, nil
}

// PaginateWithPath executes pagination and sets the URL path.
func PaginateWithPath[T any](db *gorm.DB, req *Request, path string) ([]T, *Paginator[T], error) {
	items, paginator, err := Paginate[T](db, req)
	if err != nil {
		return nil, nil, err
	}
	paginator.SetPath(path)
	return items, paginator, nil
}

// ============================================================================
// Gin Integration
// ============================================================================

// New creates a paginator from Gin context and GORM query.
// Automatically extracts pagination parameters and sets the request path.
//
// Example:
//
//	func (h *Handler) List(c *gin.Context) {
//	    users, paginator, err := pagination.New[User](c, h.db.Model(&User{}))
//	    if err != nil {
//	        response.HandleError(c, "Failed to list users", err)
//	        return
//	    }
//	    response.Paginated(c, users, paginator)
//	}
func New[T any](c *gin.Context, db *gorm.DB) ([]T, *Paginator[T], error) {
	req := FromContext(c)
	items, paginator, err := Paginate[T](db, req)
	if err != nil {
		return nil, nil, err
	}

	// Set path from request
	paginator.SetPath(c.Request.URL.Path)
	paginator.WithQuery(c.Request.URL.Query())

	return items, paginator, nil
}

// NewWithScope creates a paginator with a custom scope function.
//
// Example:
//
//	users, paginator, err := pagination.NewWithScope[User](c, h.db, func(db *gorm.DB) *gorm.DB {
//	    return db.Where("status = ?", "active").Order("created_at DESC")
//	})
func NewWithScope[T any](c *gin.Context, db *gorm.DB, scope func(*gorm.DB) *gorm.DB) ([]T, *Paginator[T], error) {
	return New[T](c, scope(db.Model(new(T))))
}

// ============================================================================
// Simple API (AI-Friendly / Vibe Coding)
// ============================================================================

// Auto creates a paginator with automatic path and query setup.
// This is the simplest way to paginate - just pass gin.Context and GORM query.
//
// Example (Handler - just 2 lines!):
//
//	func (h *Handler) List(c *gin.Context) {
//	    paginator, err := pagination.Auto(c, h.db.Model(&User{}))
//	    if err != nil {
//	        response.HandleError(c, "Failed to list", err)
//	        return
//	    }
//	    response.Success(c, paginator)
//	}
func Auto[T any](c *gin.Context, db *gorm.DB) (*Paginator[T], error) {
	_, paginator, err := New[T](c, db)
	return paginator, err
}

// AutoWithScope creates a paginator with scope and automatic setup.
//
// Example:
//
//	paginator, err := pagination.AutoWithScope[User](c, h.db, func(db *gorm.DB) *gorm.DB {
//	    return db.Where("status = ?", "active").Order("created_at DESC")
//	})
func AutoWithScope[T any](c *gin.Context, db *gorm.DB, scope func(*gorm.DB) *gorm.DB) (*Paginator[T], error) {
	_, paginator, err := NewWithScope[T](c, db, scope)
	return paginator, err
}

// ============================================================================
// Service Layer Helper
// ============================================================================

// Result wraps paginated data for service layer returns.
// Use this when service needs to return paginated data to handler.
//
// Example (Service):
//
//	func (s *service) List(ctx context.Context, page, perPage int) (*pagination.Result[*domain.User], error) {
//	    users, total, err := s.repo.FindAll(ctx, page, perPage)
//	    if err != nil {
//	        return nil, err
//	    }
//	    return pagination.NewResult(users, total, page, perPage), nil
//	}
//
// Example (Handler):
//
//	func (h *Handler) List(c *gin.Context) {
//	    req := pagination.FromContext(c)
//	    result, err := h.service.List(c.Request.Context(), req.GetPage(), req.GetPerPage())
//	    if err != nil {
//	        response.HandleError(c, "Failed to list", err)
//	        return
//	    }
//	    response.Success(c, result.ToPaginator(c))
//	}
type Result[T any] struct {
	Items   []T
	Total   int64
	Page    int
	PerPage int
}

// NewResult creates a pagination result from service layer.
func NewResult[T any](items []T, total int64, page, perPage int) *Result[T] {
	return &Result[T]{
		Items:   items,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	}
}

// ToPaginator converts Result to Paginator with path from gin.Context.
func (r *Result[T]) ToPaginator(c *gin.Context) *Paginator[T] {
	p := NewPaginator(r.Items, r.Total, r.Page, r.PerPage)
	p.SetPath(c.Request.URL.Path)
	p.WithQuery(c.Request.URL.Query())
	return p
}
