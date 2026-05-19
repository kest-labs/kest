package category

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/modules/workspace"
)

func TestFilterCategoriesMatchesParentName(t *testing.T) {
	parentID := "1"
	categories := []*CategoryResponse{
		{ID: parentID, Name: "Payments"},
		{ID: "2", Name: "Webhook", ParentID: &parentID},
	}

	filtered := filterCategories(categories, "payments")
	if len(filtered) != 2 {
		t.Fatalf("expected parent-name search to keep both related categories, got %d", len(filtered))
	}
}

func TestPaginateCategoriesBuildsPaginationMetadata(t *testing.T) {
	categories := []*CategoryResponse{
		{ID: "1"},
		{ID: "2"},
		{ID: "3"},
	}

	items, pagination := paginateCategories(categories, 2, 2)
	if len(items) != 1 || items[0].ID != "3" {
		t.Fatalf("expected second page to contain only the last item, got %#v", items)
	}
	if pagination.Page != 2 || pagination.TotalPages != 2 || pagination.Total != 3 {
		t.Fatalf("unexpected pagination metadata: %#v", pagination)
	}
	if pagination.HasNext {
		t.Fatalf("expected second page to be the last page, got %#v", pagination)
	}
	if !pagination.HasPrev {
		t.Fatalf("expected second page to have previous page, got %#v", pagination)
	}
}

func TestListCategoriesReturnsPaginatedFlatResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	categoryService := &stubCategoryService{
		listCategories: []*CategoryResponse{
			{ID: "1", Name: "Payments"},
			{ID: "2", Name: "Webhook", Description: "Receives callbacks"},
			{ID: "3", Name: "Invoices"},
		},
	}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(&stubCategoryService{
		listCategories: categoryService.listCategories,
	}, workspaceService)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/workspaces/9/categories?search=hook&page=1&per_page=1", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "9"}}
	ctx.Set("userID", "42")
	handler.ListCategories(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", recorder.Code)
	}

	var payload struct {
		Data CategoryListResponse `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if payload.Data.Total != 1 || len(payload.Data.Items) != 1 || payload.Data.Items[0].ID != "2" {
		t.Fatalf("unexpected response payload: %#v", payload.Data)
	}
	if payload.Data.Pagination == nil || payload.Data.Pagination.PerPage != 1 {
		t.Fatalf("expected pagination metadata, got %#v", payload.Data.Pagination)
	}
	if workspaceService.workspaceID != "9" || workspaceService.userID != "42" || workspaceService.requiredRole != workspace.RoleRead {
		t.Fatalf("unexpected workspace permission check: %#v", workspaceService)
	}
}

func TestCreateCategoryAuthorizesWorkspaceWrite(t *testing.T) {
	gin.SetMode(gin.TestMode)

	categoryService := &stubCategoryService{}
	workspaceService := &stubWorkspaceService{allowed: true}
	handler := NewHandler(categoryService, workspaceService)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/workspaces/9/categories",
		bytes.NewBufferString(`{"name":"Payments"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: "9"}}
	ctx.Set("userID", "42")

	handler.CreateCategory(ctx)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if workspaceService.workspaceID != "9" || workspaceService.requiredRole != workspace.RoleWrite {
		t.Fatalf("unexpected workspace permission check: %#v", workspaceService)
	}
	if categoryService.createdWorkspaceID != "9" {
		t.Fatalf("expected category to be created in workspace 9, got %q", categoryService.createdWorkspaceID)
	}
}

type stubCategoryService struct {
	listCategories     []*CategoryResponse
	treeCategories     []*CategoryResponse
	createdWorkspaceID string
}

func (s *stubCategoryService) CreateCategory(_ context.Context, workspaceID string, req *CreateCategoryRequest) (*CategoryResponse, error) {
	s.createdWorkspaceID = workspaceID
	return &CategoryResponse{
		ID:          "10",
		WorkspaceID: workspaceID,
		Name:        req.Name,
	}, nil
}

func (s *stubCategoryService) GetCategory(_ context.Context, _, _ string) (*CategoryResponse, error) {
	return nil, nil
}

func (s *stubCategoryService) ListCategories(_ context.Context, _ string) ([]*CategoryResponse, error) {
	return s.listCategories, nil
}

func (s *stubCategoryService) GetCategoryTree(_ context.Context, _ string) ([]*CategoryResponse, error) {
	return s.treeCategories, nil
}

func (s *stubCategoryService) UpdateCategory(_ context.Context, _, _ string, _ *UpdateCategoryRequest) (*CategoryResponse, error) {
	return nil, nil
}

func (s *stubCategoryService) DeleteCategory(_ context.Context, _, _ string) error {
	return nil
}

func (s *stubCategoryService) SortCategories(_ context.Context, _ string, _ *SortCategoriesRequest) error {
	return nil
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
