package project

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type testCLIHistorySyncer struct {
	workspaceID string
	createdBy string
	req       *CLIHistorySyncRequest
}

func (s *testCLIHistorySyncer) SyncHistoryFromCLI(ctx context.Context, workspaceID string, createdBy string, req *CLIHistorySyncRequest) (*CLIHistorySyncResponseBody, error) {
	s.workspaceID = workspaceID
	s.createdBy = createdBy
	s.req = req
	return &CLIHistorySyncResponseBody{Created: len(req.Entries)}, nil
}

type testCLISpecSyncer struct {
	workspaceID string
	req       *CLISpecSyncRequest
}

func (s *testCLISpecSyncer) SyncSpecsFromCLI(ctx context.Context, workspaceID string, req *CLISpecSyncRequest) (*CLISpecSyncResponseBody, error) {
	s.workspaceID = workspaceID
	s.req = req
	return &CLISpecSyncResponseBody{Created: len(req.Specs)}, nil
}

func TestSyncSpecsFromCLIUsesInjectedSyncer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	syncer := &testCLISpecSyncer{}
	h := NewHandler(nil, nil)
	h.SetSpecSyncer(syncer)

	router := gin.New()
	router.POST("/workspaces/:id/cli/spec-sync", h.SyncSpecsFromCLI)

	body := `{
		"workspace_id":"12",
		"source":"cli",
		"specs":[{
			"method":"GET",
			"path":"/health",
			"title":"Health check",
			"version":"v1"
		}]
	}`
	req := httptest.NewRequest(http.MethodPost, "/workspaces/12/cli/spec-sync", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if syncer.workspaceID != "12" {
		t.Fatalf("unexpected syncer workspace id: %q", syncer.workspaceID)
	}
	if syncer.req == nil || len(syncer.req.Specs) != 1 {
		t.Fatalf("expected one synced spec, got %#v", syncer.req)
	}

	var envelope struct {
		Data CLISpecSyncResponseBody `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Data.Created != 1 {
		t.Fatalf("expected created count 1, got %+v", envelope.Data)
	}
}

func TestSyncHistoryFromCLIUsesInjectedSyncer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	syncer := &testCLIHistorySyncer{}
	h := NewHandler(nil, nil)
	h.SetHistorySyncer(syncer)

	router := gin.New()
	router.POST("/workspaces/:id/cli/history-sync", func(c *gin.Context) {
		c.Set("cliTokenCreatedBy", "7")
		h.SyncHistoryFromCLI(c)
	})

	body := `{
		"workspace_id":"12",
		"source":"cli",
		"entries":[{
			"source_event_id":"client-1:record:42",
			"event_type":"cli_request",
			"occurred_at":"2026-05-15T10:00:00Z",
			"entity_type":"cli_request",
			"entity_id":"42",
			"action":"run",
			"message":"GET /health -> 200",
			"data":{"request":{"method":"GET"}}
		}]
	}`
	req := httptest.NewRequest(http.MethodPost, "/workspaces/12/cli/history-sync", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if syncer.workspaceID != "12" || syncer.createdBy != "7" {
		t.Fatalf("unexpected syncer args: workspace=%q createdBy=%q", syncer.workspaceID, syncer.createdBy)
	}
	if syncer.req == nil || len(syncer.req.Entries) != 1 {
		t.Fatalf("expected one synced entry, got %#v", syncer.req)
	}

	var envelope struct {
		Data CLIHistorySyncResponseBody `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Data.Created != 1 {
		t.Fatalf("expected created count 1, got %+v", envelope.Data)
	}
}

func TestSyncHistoryFromCLIRejectsProjectMismatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(nil, nil)
	h.SetHistorySyncer(&testCLIHistorySyncer{})

	router := gin.New()
	router.POST("/workspaces/:id/cli/history-sync", func(c *gin.Context) {
		c.Set("cliTokenCreatedBy", "7")
		h.SyncHistoryFromCLI(c)
	})

	body := `{
		"workspace_id":"99",
		"source":"cli",
		"entries":[{
			"source_event_id":"client-1:record:42",
			"event_type":"cli_request",
			"occurred_at":"2026-05-15T10:00:00Z",
			"entity_type":"cli_request",
			"entity_id":"42",
			"action":"run",
			"message":"GET /health -> 200",
			"data":{"request":{"method":"GET"}}
		}]
	}`
	req := httptest.NewRequest(http.MethodPost, "/workspaces/12/cli/history-sync", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}
