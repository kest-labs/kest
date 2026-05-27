package category

import (
	"context"
	"errors"
	"fmt"
)

var (
	ErrCategoryNotFound      = errors.New("category not found")
	ErrInvalidParentCategory = errors.New("invalid parent category")
)

// Service defines the interface for category business logic
type Service interface {
	CreateCategory(ctx context.Context, workspaceID string, req *CreateCategoryRequest) (*CategoryResponse, error)
	GetCategory(ctx context.Context, workspaceID, id string) (*CategoryResponse, error)
	ListCategories(ctx context.Context, workspaceID string) ([]*CategoryResponse, error)
	GetCategoryTree(ctx context.Context, workspaceID string) ([]*CategoryResponse, error)
	UpdateCategory(ctx context.Context, workspaceID, id string, req *UpdateCategoryRequest) (*CategoryResponse, error)
	DeleteCategory(ctx context.Context, workspaceID, id string) error
	SortCategories(ctx context.Context, workspaceID string, req *SortCategoriesRequest) error
}

type service struct {
	repo Repository
}

// NewService creates a new category service
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) CreateCategory(ctx context.Context, workspaceID string, req *CreateCategoryRequest) (*CategoryResponse, error) {
	if req.ParentID != nil {
		parent, err := s.repo.GetByIDAndWorkspace(ctx, *req.ParentID, workspaceID)
		if err != nil {
			return nil, fmt.Errorf("failed to get parent category: %w", err)
		}
		if parent == nil {
			return nil, ErrInvalidParentCategory
		}
	}

	category := ToCategoryPO(workspaceID, req)
	if err := s.repo.Create(ctx, category); err != nil {
		return nil, fmt.Errorf("failed to create category: %w", err)
	}
	return FromCategoryPO(category), nil
}

func (s *service) GetCategory(ctx context.Context, workspaceID, id string) (*CategoryResponse, error) {
	category, err := s.repo.GetByIDAndWorkspace(ctx, id, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get category: %w", err)
	}
	if category == nil {
		return nil, ErrCategoryNotFound
	}
	return FromCategoryPO(category), nil
}

func (s *service) ListCategories(ctx context.Context, workspaceID string) ([]*CategoryResponse, error) {
	categories, err := s.repo.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to list categories: %w", err)
	}
	return ToResponseList(categories), nil
}

func (s *service) GetCategoryTree(ctx context.Context, workspaceID string) ([]*CategoryResponse, error) {
	categories, err := s.repo.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to list categories for tree: %w", err)
	}

	resps := ToResponseList(categories)
	return buildTree(resps, nil), nil
}

func buildTree(categories []*CategoryResponse, parentID *string) []*CategoryResponse {
	var tree []*CategoryResponse
	for _, cat := range categories {
		if (parentID == nil && cat.ParentID == nil) || (parentID != nil && cat.ParentID != nil && *cat.ParentID == *parentID) {
			cat.Children = make([]CategoryResponse, 0)
			children := buildTree(categories, &cat.ID)
			for _, child := range children {
				cat.Children = append(cat.Children, *child)
			}
			tree = append(tree, cat)
		}
	}
	return tree
}

func (s *service) UpdateCategory(ctx context.Context, workspaceID, id string, req *UpdateCategoryRequest) (*CategoryResponse, error) {
	category, err := s.repo.GetByIDAndWorkspace(ctx, id, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get category for update: %w", err)
	}
	if category == nil {
		return nil, ErrCategoryNotFound
	}

	if req.Name != nil {
		category.Name = *req.Name
	}
	if req.ParentID != nil {
		if *req.ParentID != nil {
			parentID := **req.ParentID
			if parentID == id {
				return nil, ErrInvalidParentCategory
			}

			parent, err := s.repo.GetByIDAndWorkspace(ctx, parentID, workspaceID)
			if err != nil {
				return nil, fmt.Errorf("failed to get parent category for update: %w", err)
			}
			if parent == nil {
				return nil, ErrInvalidParentCategory
			}
		}

		category.ParentID = *req.ParentID
	}
	if req.Description != nil {
		category.Description = *req.Description
	}
	if req.SortOrder != nil {
		category.SortOrder = *req.SortOrder
	}

	if err := s.repo.Update(ctx, category); err != nil {
		return nil, fmt.Errorf("failed to update category: %w", err)
	}
	return FromCategoryPO(category), nil
}

func (s *service) DeleteCategory(ctx context.Context, workspaceID, id string) error {
	category, err := s.repo.GetByIDAndWorkspace(ctx, id, workspaceID)
	if err != nil {
		return err
	}
	if category == nil {
		return ErrCategoryNotFound
	}
	return s.repo.Delete(ctx, id)
}

func (s *service) SortCategories(ctx context.Context, workspaceID string, req *SortCategoriesRequest) error {
	return s.repo.UpdateSortOrder(ctx, workspaceID, req.CategoryIDs)
}
