package category

import (
	"context"
	"errors"
	"testing"
)

func TestServiceGetCategoryRespectsWorkspaceScope(t *testing.T) {
	repo := &stubCategoryRepository{
		categories: map[string]*CategoryPO{
			"7": {
				ID:          "7",
				WorkspaceID: "2",
				Name:        "Foreign",
			},
		},
	}

	service := NewService(repo)
	_, err := service.GetCategory(context.Background(), "1", "7")
	if !errors.Is(err, ErrCategoryNotFound) {
		t.Fatalf("expected ErrCategoryNotFound, got %v", err)
	}
}

func TestServiceUpdateCategoryRejectsCrossWorkspaceParent(t *testing.T) {
	workspaceID := "1"
	categoryID := "10"
	foreignParentID := "99"

	repo := &stubCategoryRepository{
		categories: map[string]*CategoryPO{
			categoryID: {
				ID:          categoryID,
				WorkspaceID: workspaceID,
				Name:        "Orders",
			},
			foreignParentID: {
				ID:          foreignParentID,
				WorkspaceID: "2",
				Name:        "Foreign Parent",
			},
		},
	}

	service := NewService(repo)
	req := &UpdateCategoryRequest{
		ParentID: ptrToPtr(foreignParentID),
	}

	_, err := service.UpdateCategory(context.Background(), workspaceID, categoryID, req)
	if !errors.Is(err, ErrInvalidParentCategory) {
		t.Fatalf("expected ErrInvalidParentCategory, got %v", err)
	}
}

func TestServiceDeleteCategoryRespectsWorkspaceScope(t *testing.T) {
	repo := &stubCategoryRepository{
		categories: map[string]*CategoryPO{
			"8": {
				ID:          "8",
				WorkspaceID: "2",
				Name:        "Foreign",
			},
		},
	}

	service := NewService(repo)
	err := service.DeleteCategory(context.Background(), "1", "8")
	if !errors.Is(err, ErrCategoryNotFound) {
		t.Fatalf("expected ErrCategoryNotFound, got %v", err)
	}
}

type stubCategoryRepository struct {
	categories map[string]*CategoryPO
}

func (r *stubCategoryRepository) Create(_ context.Context, category *CategoryPO) error {
	r.categories[category.ID] = cloneCategory(category)
	return nil
}

func (r *stubCategoryRepository) GetByID(_ context.Context, id string) (*CategoryPO, error) {
	return cloneCategory(r.categories[id]), nil
}

func (r *stubCategoryRepository) GetByIDAndWorkspace(_ context.Context, id, workspaceID string) (*CategoryPO, error) {
	category := r.categories[id]
	if category == nil || category.WorkspaceID != workspaceID {
		return nil, nil
	}

	return cloneCategory(category), nil
}

func (r *stubCategoryRepository) ListByWorkspace(_ context.Context, workspaceID string) ([]*CategoryPO, error) {
	var categories []*CategoryPO
	for _, category := range r.categories {
		if category.WorkspaceID == workspaceID {
			categories = append(categories, cloneCategory(category))
		}
	}
	return categories, nil
}

func (r *stubCategoryRepository) Update(_ context.Context, category *CategoryPO) error {
	r.categories[category.ID] = cloneCategory(category)
	return nil
}

func (r *stubCategoryRepository) Delete(_ context.Context, id string) error {
	delete(r.categories, id)
	return nil
}

func (r *stubCategoryRepository) UpdateSortOrder(_ context.Context, workspaceID string, categoryIDs []string) error {
	for i, id := range categoryIDs {
		category := r.categories[id]
		if category == nil || category.WorkspaceID != workspaceID {
			continue
		}
		category.SortOrder = i
	}
	return nil
}

func cloneCategory(category *CategoryPO) *CategoryPO {
	if category == nil {
		return nil
	}

	cloned := *category
	if category.ParentID != nil {
		parentID := *category.ParentID
		cloned.ParentID = &parentID
	}

	return &cloned
}

func ptrToPtr(value string) **string {
	ptr := &value
	return &ptr
}
