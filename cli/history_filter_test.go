package main

import (
	"testing"
	"time"

	"github.com/kest-labs/kest/cli/internal/storage"
)

// makeRecord is a helper to create a minimal storage.Record for filter tests.
func makeRecord(method, url string, status int, createdAt time.Time) storage.Record {
	return storage.Record{
		Method:         method,
		URL:            url,
		ResponseStatus: status,
		CreatedAt:      createdAt,
	}
}

func TestApplyHistoryFilters_Method(t *testing.T) {
	records := []storage.Record{
		makeRecord("GET", "/api/users", 200, time.Now()),
		makeRecord("POST", "/api/users", 201, time.Now()),
		makeRecord("DELETE", "/api/users/1", 204, time.Now()),
	}

	historyMethodFilter = "POST"
	historyURLFilter = ""
	historyStatusFilter = ""
	historySince = ""
	defer func() { historyMethodFilter = "" }()

	got := applyHistoryFilters(records)
	if len(got) != 1 || got[0].Method != "POST" {
		t.Errorf("expected 1 POST record, got %d", len(got))
	}
}

func TestApplyHistoryFilters_URL(t *testing.T) {
	records := []storage.Record{
		makeRecord("GET", "/api/users", 200, time.Now()),
		makeRecord("GET", "/api/products", 200, time.Now()),
	}

	historyMethodFilter = ""
	historyURLFilter = "/api/products"
	historyStatusFilter = ""
	historySince = ""
	defer func() { historyURLFilter = "" }()

	got := applyHistoryFilters(records)
	if len(got) != 1 || got[0].URL != "/api/products" {
		t.Errorf("expected 1 record for /api/products, got %d", len(got))
	}
}

func TestApplyHistoryFilters_StatusExact(t *testing.T) {
	records := []storage.Record{
		makeRecord("GET", "/a", 200, time.Now()),
		makeRecord("GET", "/b", 404, time.Now()),
		makeRecord("GET", "/c", 500, time.Now()),
	}

	historyMethodFilter = ""
	historyURLFilter = ""
	historyStatusFilter = "404"
	historySince = ""
	defer func() { historyStatusFilter = "" }()

	got := applyHistoryFilters(records)
	if len(got) != 1 || got[0].ResponseStatus != 404 {
		t.Errorf("expected 1 record with status 404, got %d", len(got))
	}
}

func TestApplyHistoryFilters_StatusClass4xx(t *testing.T) {
	records := []storage.Record{
		makeRecord("GET", "/a", 200, time.Now()),
		makeRecord("GET", "/b", 400, time.Now()),
		makeRecord("GET", "/c", 401, time.Now()),
		makeRecord("GET", "/d", 404, time.Now()),
		makeRecord("GET", "/e", 500, time.Now()),
	}

	historyMethodFilter = ""
	historyURLFilter = ""
	historyStatusFilter = "4xx"
	historySince = ""
	defer func() { historyStatusFilter = "" }()

	got := applyHistoryFilters(records)
	if len(got) != 3 {
		t.Errorf("expected 3 4xx records, got %d", len(got))
	}
}

func TestApplyHistoryFilters_StatusClass5xx(t *testing.T) {
	records := []storage.Record{
		makeRecord("GET", "/a", 200, time.Now()),
		makeRecord("GET", "/b", 500, time.Now()),
		makeRecord("GET", "/c", 503, time.Now()),
	}

	historyMethodFilter = ""
	historyURLFilter = ""
	historyStatusFilter = "5xx"
	historySince = ""
	defer func() { historyStatusFilter = "" }()

	got := applyHistoryFilters(records)
	if len(got) != 2 {
		t.Errorf("expected 2 5xx records, got %d", len(got))
	}
}

func TestApplyHistoryFilters_Since(t *testing.T) {
	now := time.Now()
	records := []storage.Record{
		makeRecord("GET", "/new", 200, now.Add(-10*time.Minute)),
		makeRecord("GET", "/old", 200, now.Add(-2*time.Hour)),
	}

	historyMethodFilter = ""
	historyURLFilter = ""
	historyStatusFilter = ""
	historySince = "1h"
	defer func() { historySince = "" }()

	got := applyHistoryFilters(records)
	if len(got) != 1 || got[0].URL != "/new" {
		t.Errorf("expected only 1 recent record, got %d", len(got))
	}
}

func TestApplyHistoryFilters_NoFilters(t *testing.T) {
	records := []storage.Record{
		makeRecord("GET", "/a", 200, time.Now()),
		makeRecord("POST", "/b", 201, time.Now()),
	}

	historyMethodFilter = ""
	historyURLFilter = ""
	historyStatusFilter = ""
	historySince = ""

	got := applyHistoryFilters(records)
	if len(got) != 2 {
		t.Errorf("expected all 2 records with no filters, got %d", len(got))
	}
}

func TestApplyHistoryFilters_CombinedMethodAndStatus(t *testing.T) {
	records := []storage.Record{
		makeRecord("POST", "/api", 201, time.Now()),
		makeRecord("POST", "/api", 400, time.Now()),
		makeRecord("GET", "/api", 200, time.Now()),
	}

	historyMethodFilter = "POST"
	historyURLFilter = ""
	historyStatusFilter = "201"
	historySince = ""
	defer func() {
		historyMethodFilter = ""
		historyStatusFilter = ""
	}()

	got := applyHistoryFilters(records)
	if len(got) != 1 || got[0].ResponseStatus != 201 {
		t.Errorf("expected 1 POST 201 record, got %d", len(got))
	}
}

// ── matchStatusFilter unit tests ──────────────────────────────────────────────

func TestMatchStatusFilter(t *testing.T) {
	cases := []struct {
		status int
		filter string
		want   bool
	}{
		{200, "200", true},
		{201, "200", false},
		{404, "4xx", true},
		{400, "4xx", true},
		{499, "4xx", true},
		{500, "4xx", false},
		{500, "5xx", true},
		{503, "5xx", true},
		{200, "2xx", true},
		{299, "2xx", true},
		{300, "2xx", false},
		{200, "invalid", false},
	}

	for _, c := range cases {
		got := matchStatusFilter(c.status, c.filter)
		if got != c.want {
			t.Errorf("matchStatusFilter(%d, %q) = %v, want %v", c.status, c.filter, got, c.want)
		}
	}
}
