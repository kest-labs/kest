package unit

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kest-labs/kest/api/pkg/pagination"
	"github.com/gin-gonic/gin"
)

func TestPaginator_New(t *testing.T) {
	items := []string{"a", "b", "c", "d", "e"}
	p := pagination.New(items, 100, 1, 10)

	if p.Total != 100 {
		t.Errorf("Expected total 100, got %d", p.Total)
	}
	if p.CurrentPage != 1 {
		t.Errorf("Expected current page 1, got %d", p.CurrentPage)
	}
	if p.PerPage != 10 {
		t.Errorf("Expected per page 10, got %d", p.PerPage)
	}
	if p.LastPage != 10 {
		t.Errorf("Expected last page 10, got %d", p.LastPage)
	}
	if len(p.Items) != 5 {
		t.Errorf("Expected 5 items, got %d", len(p.Items))
	}
}

func TestPaginator_FromTo(t *testing.T) {
	items := []string{"a", "b", "c"}
	p := pagination.New(items, 10, 2, 3)

	if p.From != 4 {
		t.Errorf("Expected from 4, got %d", p.From)
	}
	if p.To != 6 {
		t.Errorf("Expected to 6, got %d", p.To)
	}
}

func TestPaginator_EmptyItems(t *testing.T) {
	items := []string{}
	p := pagination.New(items, 0, 1, 10)

	if p.From != 0 {
		t.Errorf("Expected from 0 for empty items, got %d", p.From)
	}
	if p.To != 0 {
		t.Errorf("Expected to 0 for empty items, got %d", p.To)
	}
	if !p.IsEmpty() {
		t.Error("Expected IsEmpty to return true")
	}
}

func TestPaginator_HasMorePages(t *testing.T) {
	items := []string{"a", "b", "c"}

	// Page 1 of 3
	p1 := pagination.New(items, 9, 1, 3)
	if !p1.HasMorePages() {
		t.Error("Page 1 should have more pages")
	}

	// Page 3 of 3
	p3 := pagination.New(items, 9, 3, 3)
	if p3.HasMorePages() {
		t.Error("Last page should not have more pages")
	}
}

func TestPaginator_HasPages(t *testing.T) {
	items := []string{"a", "b", "c"}

	// Multiple pages
	p1 := pagination.New(items, 10, 1, 3)
	if !p1.HasPages() {
		t.Error("Should have multiple pages")
	}

	// Single page
	p2 := pagination.New(items, 3, 1, 10)
	if p2.HasPages() {
		t.Error("Should have single page")
	}
}

func TestPaginator_OnFirstPage(t *testing.T) {
	items := []string{"a", "b", "c"}

	p1 := pagination.New(items, 10, 1, 3)
	if !p1.OnFirstPage() {
		t.Error("Should be on first page")
	}

	p2 := pagination.New(items, 10, 2, 3)
	if p2.OnFirstPage() {
		t.Error("Should not be on first page")
	}
}

func TestPaginator_OnLastPage(t *testing.T) {
	items := []string{"a"}

	p := pagination.New(items, 10, 4, 3)
	if !p.OnLastPage() {
		t.Error("Should be on last page")
	}
}

func TestPaginator_Count(t *testing.T) {
	items := []string{"a", "b", "c", "d", "e"}
	p := pagination.New(items, 100, 1, 10)

	if p.Count() != 5 {
		t.Errorf("Expected count 5, got %d", p.Count())
	}
}

func TestPaginator_WithPath(t *testing.T) {
	items := []string{"a", "b", "c"}
	p := pagination.New(items, 10, 2, 3).WithPath("/api/users")

	if p.NextPageURL == "" {
		t.Error("Expected next page URL to be set")
	}
	if p.PrevPageURL == "" {
		t.Error("Expected prev page URL to be set")
	}
}

func TestPaginator_ToMap(t *testing.T) {
	items := []string{"a", "b", "c"}
	p := pagination.New(items, 10, 1, 3)
	m := p.ToMap()

	if m["total"] != int64(10) {
		t.Errorf("Expected total 10, got %v", m["total"])
	}
	if m["current_page"] != 1 {
		t.Errorf("Expected current_page 1, got %v", m["current_page"])
	}
}

func TestPaginator_InvalidPage(t *testing.T) {
	items := []string{"a", "b", "c"}

	// Negative page should default to 1
	p := pagination.New(items, 10, -1, 3)
	if p.CurrentPage != 1 {
		t.Errorf("Expected page to default to 1, got %d", p.CurrentPage)
	}
}

func TestPaginator_InvalidPerPage(t *testing.T) {
	items := []string{"a", "b", "c"}

	// Zero per page should default to 15
	p := pagination.New(items, 10, 1, 0)
	if p.PerPage != 15 {
		t.Errorf("Expected per page to default to 15, got %d", p.PerPage)
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := pagination.DefaultConfig()

	if cfg.Page != 1 {
		t.Errorf("Expected default page 1, got %d", cfg.Page)
	}
	if cfg.PerPage != 15 {
		t.Errorf("Expected default per page 15, got %d", cfg.PerPage)
	}
	if cfg.MaxPerPage != 100 {
		t.Errorf("Expected default max per page 100, got %d", cfg.MaxPerPage)
	}
}

func TestFromContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		cfg := pagination.FromContext(c)
		c.JSON(http.StatusOK, gin.H{
			"page":     cfg.Page,
			"per_page": cfg.PerPage,
		})
	})

	// With query params
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test?page=3&per_page=25", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestFromContext_Defaults(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	var cfg pagination.Config

	router.GET("/test", func(c *gin.Context) {
		cfg = pagination.FromContext(c)
		c.Status(http.StatusOK)
	})

	// Without query params
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if cfg.Page != 1 {
		t.Errorf("Expected default page 1, got %d", cfg.Page)
	}
	if cfg.PerPage != 15 {
		t.Errorf("Expected default per page 15, got %d", cfg.PerPage)
	}
}

func TestCursorPaginator_New(t *testing.T) {
	items := []string{"a", "b", "c"}
	p := pagination.NewCursor(items, 10, true)

	if len(p.Items) != 3 {
		t.Errorf("Expected 3 items, got %d", len(p.Items))
	}
	if p.PerPage != 10 {
		t.Errorf("Expected per page 10, got %d", p.PerPage)
	}
	if !p.HasMore {
		t.Error("Expected has more to be true")
	}
}

func TestCursorPaginator_WithCursors(t *testing.T) {
	items := []string{"a", "b", "c"}
	p := pagination.NewCursor(items, 10, true).WithCursors("next123", "prev456")

	if p.NextCursor != "next123" {
		t.Errorf("Expected next cursor 'next123', got '%s'", p.NextCursor)
	}
	if p.PrevCursor != "prev456" {
		t.Errorf("Expected prev cursor 'prev456', got '%s'", p.PrevCursor)
	}
}

func TestDefaultCursorConfig(t *testing.T) {
	cfg := pagination.DefaultCursorConfig()

	if cfg.PerPage != 15 {
		t.Errorf("Expected default per page 15, got %d", cfg.PerPage)
	}
	if cfg.MaxPerPage != 100 {
		t.Errorf("Expected default max per page 100, got %d", cfg.MaxPerPage)
	}
	if cfg.CursorCol != "id" {
		t.Errorf("Expected default cursor col 'id', got '%s'", cfg.CursorCol)
	}
}

func TestCursorFromContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	var cfg pagination.CursorConfig

	router.GET("/test", func(c *gin.Context) {
		cfg = pagination.CursorFromContext(c)
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test?cursor=abc123&per_page=20", nil)
	router.ServeHTTP(w, req)

	if cfg.Cursor != "abc123" {
		t.Errorf("Expected cursor 'abc123', got '%s'", cfg.Cursor)
	}
	if cfg.PerPage != 20 {
		t.Errorf("Expected per page 20, got %d", cfg.PerPage)
	}
}

func TestSimplePaginator(t *testing.T) {
	// Test the struct directly since we don't have a DB
	p := &pagination.SimplePaginator[string]{
		Items:       []string{"a", "b", "c"},
		PerPage:     10,
		CurrentPage: 1,
		HasMore:     true,
	}

	if len(p.Items) != 3 {
		t.Errorf("Expected 3 items, got %d", len(p.Items))
	}
	if !p.HasMore {
		t.Error("Expected has more to be true")
	}
}

func TestPaginator_LastPageCalculation(t *testing.T) {
	testCases := []struct {
		total    int64
		perPage  int
		lastPage int
	}{
		{100, 10, 10},
		{101, 10, 11},
		{99, 10, 10},
		{10, 10, 1},
		{0, 10, 1},
		{1, 10, 1},
	}

	for _, tc := range testCases {
		p := pagination.New([]string{}, tc.total, 1, tc.perPage)
		if p.LastPage != tc.lastPage {
			t.Errorf("Total %d, PerPage %d: expected last page %d, got %d",
				tc.total, tc.perPage, tc.lastPage, p.LastPage)
		}
	}
}

func TestPaginator_NoURLsWithoutPath(t *testing.T) {
	items := []string{"a", "b", "c"}
	p := pagination.New(items, 10, 2, 3)

	if p.NextPageURL != "" {
		t.Error("Expected no next URL without path")
	}
	if p.PrevPageURL != "" {
		t.Error("Expected no prev URL without path")
	}
}

func TestPaginator_FirstPageNoPrevURL(t *testing.T) {
	items := []string{"a", "b", "c"}
	p := pagination.New(items, 10, 1, 3).WithPath("/api/items")

	if p.PrevPageURL != "" {
		t.Error("First page should not have prev URL")
	}
	if p.NextPageURL == "" {
		t.Error("First page should have next URL when more pages exist")
	}
}

func TestPaginator_LastPageNoNextURL(t *testing.T) {
	items := []string{"a"}
	p := pagination.New(items, 10, 4, 3).WithPath("/api/items")

	if p.NextPageURL != "" {
		t.Error("Last page should not have next URL")
	}
	if p.PrevPageURL == "" {
		t.Error("Last page should have prev URL")
	}
}
