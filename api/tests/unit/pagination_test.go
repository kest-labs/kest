package unit

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/pkg/pagination"
)

func TestNewPaginatorBuildsMetadata(t *testing.T) {
	p := pagination.NewPaginator([]string{"a", "b", "c"}, 10, 2, 3)

	if p.Total() != 10 {
		t.Fatalf("expected total 10, got %d", p.Total())
	}
	if p.CurrentPage() != 2 {
		t.Fatalf("expected page 2, got %d", p.CurrentPage())
	}
	if p.PerPage() != 3 {
		t.Fatalf("expected per page 3, got %d", p.PerPage())
	}
	if p.LastPage() != 4 {
		t.Fatalf("expected last page 4, got %d", p.LastPage())
	}
	if p.From() != 4 || p.To() != 6 {
		t.Fatalf("expected range 4-6, got %d-%d", p.From(), p.To())
	}
}

func TestNewPaginatorClampsInvalidValues(t *testing.T) {
	p := pagination.NewPaginator([]string{}, 0, -1, 0)

	if p.CurrentPage() != 1 {
		t.Fatalf("expected page to clamp to 1, got %d", p.CurrentPage())
	}
	if p.PerPage() != pagination.DefaultPerPage {
		t.Fatalf("expected per page to default to %d, got %d", pagination.DefaultPerPage, p.PerPage())
	}
	if p.LastPage() != 1 {
		t.Fatalf("expected empty paginator last page 1, got %d", p.LastPage())
	}
}

func TestPaginatorBuildsNavigationURLs(t *testing.T) {
	p := pagination.NewPaginator([]string{"a", "b", "c"}, 10, 2, 3).
		SetPath("/api/users").
		Append("keyword", "john")

	prev := p.PreviousPageURL()
	next := p.NextPageURL()

	if prev == nil || *prev != "/api/users?keyword=john&page=1" {
		t.Fatalf("unexpected previous page url: %#v", prev)
	}
	if next == nil || *next != "/api/users?keyword=john&page=3" {
		t.Fatalf("unexpected next page url: %#v", next)
	}
}

func TestFromContextReadsQueryParams(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	var req *pagination.Request

	router.GET("/test", func(c *gin.Context) {
		req = pagination.FromContext(c)
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest("GET", "/test?page=3&per_page=25&keyword=alpha&sort=created_at&order=asc", nil)
	router.ServeHTTP(w, httpReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if req.GetPage() != 3 || req.GetPerPage() != 25 {
		t.Fatalf("unexpected request pagination: %#v", req)
	}
	if req.Keyword != "alpha" || req.GetOrderBy() != "created_at asc" {
		t.Fatalf("unexpected request metadata: %#v", req)
	}
}

func TestCursorPaginatorEncodesLinks(t *testing.T) {
	p := pagination.NewCursorPaginator([]string{"a", "b"}, 10, true)
	p.SetPath("/api/users")
	p.SetNextCursor(&pagination.Cursor{Field: "created_at", Value: "2026-01-01T00:00:00Z", ID: 2, Direction: "next"})
	p.SetPrevCursor(&pagination.Cursor{Field: "created_at", Value: "2025-12-31T00:00:00Z", ID: 1, Direction: "prev"})

	result := p.ToMap()

	if result["has_more"] != true {
		t.Fatalf("expected has_more true, got %#v", result["has_more"])
	}
	if result["next_cursor"] == "" || result["prev_cursor"] == "" {
		t.Fatalf("expected encoded cursors, got %#v", result)
	}
}

func TestCursorFromContextUsesDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	var req *pagination.CursorRequest

	router.GET("/test", func(c *gin.Context) {
		req = pagination.CursorFromContext(c)
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest("GET", "/test?cursor=abc123", nil)
	router.ServeHTTP(w, httpReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if req.Cursor != "abc123" {
		t.Fatalf("expected cursor abc123, got %q", req.Cursor)
	}
	if req.GetPerPage() != pagination.DefaultPerPage {
		t.Fatalf("expected default per page %d, got %d", pagination.DefaultPerPage, req.GetPerPage())
	}
}
