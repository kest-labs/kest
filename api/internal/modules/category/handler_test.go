package category

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
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

	handler := NewHandler(&stubCategoryService{
		listCategories: []*CategoryResponse{
			{ID: "1", Name: "Payments"},
			{ID: "2", Name: "Webhook", Description: "Receives callbacks"},
			{ID: "3", Name: "Invoices"},
		},
	}, nil)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/projects/9/categories?search=hook&page=1&per_page=1", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "9"}}
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
}

type stubCategoryService struct {
	listCategories []*CategoryResponse
	treeCategories []*CategoryResponse
}

func (s *stubCategoryService) CreateCategory(_ context.Context, _ string, _ *CreateCategoryRequest) (*CategoryResponse, error) {
	return nil, nil
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
