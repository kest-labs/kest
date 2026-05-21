package apispec

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/modules/importer"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

func TestCreateSpecAuthorizesWorkspaceAndUsesRouteWorkspace(t *testing.T) {
	gin.SetMode(gin.TestMode)

	apiSpecService := &stubAPISpecService{}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(apiSpecService, &stubImporterService{}, workspaceService)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/workspaces/7/api-specs",
		bytes.NewBufferString(`{"workspace_id":"ignored","method":"GET","path":"/health","version":"v1"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}
	ctx.Set("userID", "42")

	handler.CreateSpec(ctx)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if workspaceService.workspaceID != "7" || workspaceService.userID != "42" || workspaceService.requiredRole != workspace.RoleWrite {
		t.Fatalf("unexpected workspace permission check: %#v", workspaceService)
	}
	if apiSpecService.created == nil || apiSpecService.created.WorkspaceID != "7" {
		t.Fatalf("expected create request to use route workspace, got %#v", apiSpecService.created)
	}
}

func TestListSpecsUsesWorkspaceReadPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)

	apiSpecService := &stubAPISpecService{}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(apiSpecService, &stubImporterService{}, workspaceService)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/workspaces/7/api-specs", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}
	ctx.Set("userID", "42")

	handler.ListSpecs(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if workspaceService.requiredRole != workspace.RoleRead {
		t.Fatalf("expected read permission check, got %q", workspaceService.requiredRole)
	}
	if apiSpecService.listFilter == nil || apiSpecService.listFilter.WorkspaceID != "7" {
		t.Fatalf("expected list filter to use route workspace, got %#v", apiSpecService.listFilter)
	}
}

type stubAPISpecService struct {
	created             *CreateAPISpecRequest
	listFilter          *SpecListFilter
	markdownDraftResult *ImportMarkdownAIDraftResponse
}

func (s *stubAPISpecService) CreateSpec(_ context.Context, req *CreateAPISpecRequest) (*APISpecResponse, error) {
	copied := *req
	s.created = &copied
	return &APISpecResponse{
		ID:          "spec-1",
		WorkspaceID: req.WorkspaceID,
		Method:      req.Method,
		Path:        req.Path,
		Version:     req.Version,
	}, nil
}

func (s *stubAPISpecService) GetSpecByID(context.Context, string, string) (*APISpecResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) UpdateSpec(context.Context, string, string, *UpdateAPISpecRequest) (*APISpecResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) DeleteSpec(context.Context, string, string) error {
	return nil
}

func (s *stubAPISpecService) ListSpecs(_ context.Context, filter *SpecListFilter) ([]*APISpecResponse, int64, error) {
	copied := *filter
	s.listFilter = &copied
	return []*APISpecResponse{}, 0, nil
}

func (s *stubAPISpecService) GetSpecWithExamples(context.Context, string, string) (*APISpecResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) GenDoc(context.Context, string, string, string) (*APISpecResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) GenTest(context.Context, string, string, string) (string, error) {
	return "", nil
}

func (s *stubAPISpecService) CreateExample(context.Context, string, *CreateAPIExampleRequest) (*APIExampleResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) GetExamplesBySpecID(context.Context, string, string) ([]*APIExampleResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) DeleteExample(context.Context, string) error {
	return nil
}

func (s *stubAPISpecService) CreateAIDraft(context.Context, string, string, *CreateAPISpecAIDraftRequest) (*APISpecAIDraftResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) CreateAIDraftStream(context.Context, string, string, *CreateAPISpecAIDraftRequest, AIDraftStreamCallbacks) (*APISpecAIDraftResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) GetAIDraft(context.Context, string, string) (*APISpecAIDraftResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) RefineAIDraft(context.Context, string, string, *RefineAPISpecAIDraftRequest) (*APISpecAIDraftResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) AcceptAIDraft(context.Context, string, string, *AcceptAPISpecAIDraftRequest) (*AcceptAPISpecAIDraftResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) ImportMarkdownAIDraft(context.Context, *importer.MarkdownParseResult) (*ImportMarkdownAIDraftResponse, error) {
	if s.markdownDraftResult != nil {
		return s.markdownDraftResult, nil
	}
	return &ImportMarkdownAIDraftResponse{}, nil
}

func (s *stubAPISpecService) GetShareBySpecID(context.Context, string, string) (*APISpecShareResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) PublishShare(context.Context, string, string, string) (*APISpecShareResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) DeleteShareBySpecID(context.Context, string, string) error {
	return nil
}

func (s *stubAPISpecService) GetPublicShareBySlug(context.Context, string) (*PublicAPISpecShareResponse, error) {
	return nil, nil
}

func (s *stubAPISpecService) ImportSpecs(context.Context, string, []*CreateAPISpecRequest) error {
	return nil
}

func (s *stubAPISpecService) SyncSpecsFromCLI(context.Context, string, *CLISpecSyncInput) (*CLISpecSyncResult, error) {
	return nil, nil
}

func (s *stubAPISpecService) ExportSpecs(context.Context, string, string) (interface{}, error) {
	return nil, nil
}

func (s *stubAPISpecService) BatchGenDoc(context.Context, string, *BatchGenDocRequest) (*BatchGenDocResponse, error) {
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

type stubImporterService struct {
	parseResult *importer.MarkdownParseResult
	parseErr    error
}

func (s *stubImporterService) ImportPostman(context.Context, string, string, *multipart.FileHeader) error {
	return nil
}

func (s *stubImporterService) ImportMarkdown(context.Context, string, string, *multipart.FileHeader, string) (*importer.MarkdownImportResult, error) {
	return nil, nil
}

func (s *stubImporterService) ParseMarkdownFile(_ *multipart.FileHeader, _ string) (*importer.MarkdownParseResult, error) {
	if s.parseErr != nil {
		return nil, s.parseErr
	}
	if s.parseResult != nil {
		return s.parseResult, nil
	}
	return &importer.MarkdownParseResult{}, nil
}

func TestImportMarkdownAIDraftParsesUploadedMarkdownAndReturnsPreview(t *testing.T) {
	gin.SetMode(gin.TestMode)

	apiSpecService := &stubAPISpecService{
		markdownDraftResult: &ImportMarkdownAIDraftResponse{
			DocumentTitle: "Authentication & Users API",
			EndpointCount: 1,
			DraftCount:    1,
			Drafts: []ImportMarkdownAIDraftItem{
				{
					ModuleName: "Authentication",
					AuthType:   "public",
					Confidence: 0.95,
					Draft: APISpecAIDraftSpec{
						Method:  "POST",
						Path:    "/register",
						Summary: "Register",
						Version: "v1",
					},
				},
			},
		},
	}
	importerService := &stubImporterService{
		parseResult: &importer.MarkdownParseResult{
			Title: "Authentication & Users API",
			Modules: []importer.MarkdownParseModule{
				{Name: "Authentication", Endpoints: []importer.MarkdownParseEndpoint{{Method: "POST", Path: "/register"}}},
			},
		},
	}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(apiSpecService, importerService, workspaceService)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "auth.md")
	if err != nil {
		t.Fatalf("failed to create multipart file: %v", err)
	}
	if _, err := part.Write([]byte("# doc")); err != nil {
		t.Fatalf("failed to write multipart file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart body: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/workspaces/7/api-specs/import/markdown-ai", body)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}
	ctx.Set("userID", "42")

	handler.ImportMarkdownAIDraft(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var resp struct {
		Code int                           `json:"code"`
		Data ImportMarkdownAIDraftResponse `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp.Data.DraftCount != 1 || resp.Data.Drafts[0].Draft.Path != "/register" {
		t.Fatalf("unexpected response payload: %#v", resp.Data)
	}
	if workspaceService.requiredRole != workspace.RoleWrite {
		t.Fatalf("expected write authorization, got %q", workspaceService.requiredRole)
	}
}

func TestImportMarkdownAIDraftRejectsInvalidMarkdown(t *testing.T) {
	gin.SetMode(gin.TestMode)

	apiSpecService := &stubAPISpecService{}
	importerService := &stubImporterService{parseErr: importer.ErrNoImportableEndpoints}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(apiSpecService, importerService, workspaceService)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "invalid.md")
	if err != nil {
		t.Fatalf("failed to create multipart file: %v", err)
	}
	if _, err := part.Write([]byte(strings.Repeat("x", 1))); err != nil {
		t.Fatalf("failed to write multipart file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart body: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/workspaces/7/api-specs/import/markdown-ai", body)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Params = gin.Params{{Key: "id", Value: "7"}}
	ctx.Set("userID", "42")

	handler.ImportMarkdownAIDraft(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d: %s", recorder.Code, recorder.Body.String())
	}
}
