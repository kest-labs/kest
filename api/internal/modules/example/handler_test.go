package example

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/modules/request"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

func TestCreateAuthorizesWorkspaceRequestBeforeCreatingExample(t *testing.T) {
	gin.SetMode(gin.TestMode)

	exampleService := &stubExampleService{}
	requestService := &stubRequestService{}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(exampleService, requestService, workspaceService)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/workspaces/7/collections/8/requests/9/examples",
		bytes.NewBufferString(`{"name":"Created example"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{
		{Key: "id", Value: "7"},
		{Key: "cid", Value: "8"},
		{Key: "rid", Value: "9"},
	}
	ctx.Set("userID", "42")

	handler.Create(ctx)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if workspaceService.workspaceID != "7" || workspaceService.userID != "42" || workspaceService.requiredRole != workspace.RoleWrite {
		t.Fatalf("unexpected workspace permission check: %#v", workspaceService)
	}
	if requestService.requestID != "9" || requestService.collectionID != "8" || requestService.workspaceID != "7" {
		t.Fatalf("unexpected request lookup: %#v", requestService)
	}
	if exampleService.created == nil || exampleService.created.RequestID != "9" {
		t.Fatalf("expected example to be created for request 9, got %#v", exampleService.created)
	}
}

func TestCreateDoesNotCreateExampleWhenRequestScopeIsInvalid(t *testing.T) {
	gin.SetMode(gin.TestMode)

	exampleService := &stubExampleService{}
	requestService := &stubRequestService{getErr: request.ErrInvalidCollection}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(exampleService, requestService, workspaceService)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/workspaces/7/collections/8/requests/9/examples",
		bytes.NewBufferString(`{"name":"Created example"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{
		{Key: "id", Value: "7"},
		{Key: "cid", Value: "8"},
		{Key: "rid", Value: "9"},
	}
	ctx.Set("userID", "42")

	handler.Create(ctx)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if exampleService.created != nil {
		t.Fatalf("expected example not to be created, got %#v", exampleService.created)
	}
}

type stubExampleService struct {
	created *CreateExampleRequest
}

func (s *stubExampleService) Create(_ context.Context, req *CreateExampleRequest) (*Example, error) {
	copied := *req
	s.created = &copied
	return &Example{
		ID:        "10",
		RequestID: req.RequestID,
		Name:      req.Name,
	}, nil
}

func (s *stubExampleService) GetByID(context.Context, string, string) (*Example, error) {
	return nil, nil
}

func (s *stubExampleService) Update(context.Context, string, string, *UpdateExampleRequest) (*Example, error) {
	return nil, nil
}

func (s *stubExampleService) Delete(context.Context, string, string) error {
	return nil
}

func (s *stubExampleService) List(context.Context, string) ([]*Example, error) {
	return nil, nil
}

func (s *stubExampleService) SaveResponse(context.Context, string, string, *SaveResponseRequest) (*Example, error) {
	return nil, nil
}

func (s *stubExampleService) SetDefault(context.Context, string, string) (*Example, error) {
	return nil, nil
}

type stubRequestService struct {
	requestID    string
	collectionID string
	workspaceID  string
	getErr       error
}

func (s *stubRequestService) Create(context.Context, string, *request.CreateRequestRequest) (*request.Request, error) {
	return nil, nil
}

func (s *stubRequestService) GetByID(_ context.Context, id, collectionID, workspaceID string) (*request.Request, error) {
	s.requestID = id
	s.collectionID = collectionID
	s.workspaceID = workspaceID
	if s.getErr != nil {
		return nil, s.getErr
	}
	return &request.Request{
		ID:           id,
		CollectionID: collectionID,
	}, nil
}

func (s *stubRequestService) Update(context.Context, string, string, string, *request.UpdateRequestRequest) (*request.Request, error) {
	return nil, nil
}

func (s *stubRequestService) Delete(context.Context, string, string, string) error {
	return nil
}

func (s *stubRequestService) List(context.Context, string, string, int, int) ([]*request.Request, int64, error) {
	return nil, 0, nil
}

func (s *stubRequestService) Move(context.Context, string, string, string, *request.MoveRequestRequest) (*request.Request, error) {
	return nil, nil
}

func (s *stubRequestService) Rollback(context.Context, string, string, string) (*request.Request, error) {
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

func (s *stubWorkspaceService) GenerateCLIToken(context.Context, string, string, *workspace.GenerateWorkspaceCLITokenRequest) (*workspace.GenerateWorkspaceCLITokenResponse, error) {
	return nil, nil
}

func (s *stubWorkspaceService) ListCLITokens(context.Context, string) ([]*workspace.WorkspaceCLIToken, error) {
	return nil, nil
}

func (s *stubWorkspaceService) ValidateCLIToken(context.Context, string, string, []string) (string, string, error) {
	return "", "", nil
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
