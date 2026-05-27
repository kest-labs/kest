package workspace

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestListCLITokensRequiresAdminPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &stubWorkspaceHandlerService{allowed: true}
	h := NewHandler(svc)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/workspaces/7/cli-tokens", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}
	ctx.Set("userID", "42")

	h.ListCLITokens(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if svc.workspaceID != "7" || svc.userID != "42" || svc.requiredRole != RoleAdmin {
		t.Fatalf("unexpected workspace permission check: %#v", svc)
	}
	if svc.listWorkspaceID != "7" {
		t.Fatalf("expected tokens to be listed for workspace 7, got %q", svc.listWorkspaceID)
	}
}

type stubWorkspaceHandlerService struct {
	workspaceID     string
	userID          string
	requiredRole    string
	listWorkspaceID string
	allowed         bool
	err             error
}

func (s *stubWorkspaceHandlerService) CreateWorkspace(*CreateWorkspaceRequest, string) (*Workspace, error) {
	return nil, nil
}

func (s *stubWorkspaceHandlerService) UpdateWorkspace(string, *UpdateWorkspaceRequest, string, bool) (*Workspace, error) {
	return nil, nil
}

func (s *stubWorkspaceHandlerService) DeleteWorkspace(string, string, bool) error {
	return nil
}

func (s *stubWorkspaceHandlerService) GetWorkspace(string, string, bool) (*Workspace, error) {
	return nil, nil
}

func (s *stubWorkspaceHandlerService) ListWorkspaces(string, bool) ([]*Workspace, error) {
	return nil, nil
}

func (s *stubWorkspaceHandlerService) AddMember(string, *AddMemberRequest, string, bool) error {
	return nil
}

func (s *stubWorkspaceHandlerService) RemoveMember(string, string, string, bool) error {
	return nil
}

func (s *stubWorkspaceHandlerService) UpdateMemberRole(string, string, string, string, bool) error {
	return nil
}

func (s *stubWorkspaceHandlerService) ListMembers(string, string, bool) ([]*WorkspaceMember, error) {
	return nil, nil
}

func (s *stubWorkspaceHandlerService) GenerateCLIToken(context.Context, string, string, *GenerateWorkspaceCLITokenRequest) (*GenerateWorkspaceCLITokenResponse, error) {
	return nil, nil
}

func (s *stubWorkspaceHandlerService) ListCLITokens(_ context.Context, workspaceID string) ([]*WorkspaceCLIToken, error) {
	s.listWorkspaceID = workspaceID
	return []*WorkspaceCLIToken{}, nil
}

func (s *stubWorkspaceHandlerService) ValidateCLIToken(context.Context, string, string, []string) (string, string, error) {
	return "", "", nil
}

func (s *stubWorkspaceHandlerService) CheckUserRole(string, string, bool) (string, error) {
	return "", nil
}

func (s *stubWorkspaceHandlerService) HasPermission(workspaceID, userID string, requiredRole string, _ bool) (bool, error) {
	s.workspaceID = workspaceID
	s.userID = userID
	s.requiredRole = requiredRole
	return s.allowed, s.err
}
