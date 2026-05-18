package history

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

func TestCreateAuthorizesWorkspaceAndRecordsWorkspaceHistory(t *testing.T) {
	gin.SetMode(gin.TestMode)

	historyService := &stubHistoryService{}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(historyService, workspaceService)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/workspaces/7/history",
		bytes.NewBufferString(`{"entity_type":"request","entity_id":"9","action":"run","data":{"status":200}}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}
	ctx.Set("userID", "42")

	handler.Create(ctx)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if workspaceService.workspaceID != "7" || workspaceService.userID != "42" || workspaceService.requiredRole != workspace.RoleWrite {
		t.Fatalf("unexpected workspace permission check: %#v", workspaceService)
	}
	if historyService.recorded == nil {
		t.Fatal("expected history to be recorded")
	}
	if historyService.recorded.WorkspaceID != "7" || historyService.recorded.UserID != "42" {
		t.Fatalf("expected request to use route workspace and current user, got %#v", historyService.recorded)
	}
}

func TestGetDoesNotReturnHistoryFromAnotherWorkspace(t *testing.T) {
	gin.SetMode(gin.TestMode)

	historyService := &stubHistoryService{
		history: &History{
			ID:          "99",
			WorkspaceID: "other-workspace",
			EntityType:  "request",
			EntityID:    "9",
			Action:      "run",
			Data:        map[string]interface{}{"status": 200},
		},
	}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(historyService, workspaceService)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/workspaces/7/history/99", nil)
	ctx.Params = gin.Params{
		{Key: "id", Value: "7"},
		{Key: "hid", Value: "99"},
	}
	ctx.Set("userID", "42")

	handler.Get(ctx)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if workspaceService.requiredRole != workspace.RoleRead {
		t.Fatalf("expected read permission check, got %q", workspaceService.requiredRole)
	}
}

type stubHistoryService struct {
	recorded *RecordHistoryRequest
	history  *History
}

func (s *stubHistoryService) Record(_ context.Context, req *RecordHistoryRequest) (*History, error) {
	copied := *req
	s.recorded = &copied
	return &History{
		ID:          "100",
		WorkspaceID: req.WorkspaceID,
		UserID:      req.UserID,
		EntityType:  req.EntityType,
		EntityID:    req.EntityID,
		Action:      req.Action,
		Data:        req.Data,
	}, nil
}

func (s *stubHistoryService) GetByID(context.Context, string) (*History, error) {
	return s.history, nil
}

func (s *stubHistoryService) List(context.Context, string, string, string, int, int) ([]*History, int64, error) {
	return nil, 0, nil
}

func (s *stubHistoryService) SyncHistoryFromCLI(context.Context, string, string, *CLIHistorySyncInput) (*CLIHistorySyncResult, error) {
	return nil, nil
}

type stubWorkspaceService struct {
	workspaceID  string
	userID       string
	requiredRole string
	allowed      bool
	err          error
}

func (s *stubWorkspaceService) CreateWorkspace(*workspace.CreateWorkspaceRequest, string) (*workspace.Workspace, error) {
	return nil, nil
}

func (s *stubWorkspaceService) UpdateWorkspace(string, *workspace.UpdateWorkspaceRequest, string, bool) (*workspace.Workspace, error) {
	return nil, nil
}

func (s *stubWorkspaceService) DeleteWorkspace(string, string, bool) error {
	return nil
}

func (s *stubWorkspaceService) GetWorkspace(string, string, bool) (*workspace.Workspace, error) {
	return nil, nil
}

func (s *stubWorkspaceService) ListWorkspaces(string, bool) ([]*workspace.Workspace, error) {
	return nil, nil
}

func (s *stubWorkspaceService) AddMember(string, *workspace.AddMemberRequest, string, bool) error {
	return nil
}

func (s *stubWorkspaceService) RemoveMember(string, string, string, bool) error {
	return nil
}

func (s *stubWorkspaceService) UpdateMemberRole(string, string, string, string, bool) error {
	return nil
}

func (s *stubWorkspaceService) ListMembers(string, string, bool) ([]*workspace.WorkspaceMember, error) {
	return nil, nil
}

func (s *stubWorkspaceService) CheckUserRole(string, string, bool) (string, error) {
	return "", nil
}

func (s *stubWorkspaceService) HasPermission(workspaceID, userID string, requiredRole string, _ bool) (bool, error) {
	s.workspaceID = workspaceID
	s.userID = userID
	s.requiredRole = requiredRole
	return s.allowed, s.err
}
