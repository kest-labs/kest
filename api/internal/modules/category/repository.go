package category

import (
	"context"

	"github.com/kest-labs/kest/api/pkg/dbutil"
	"gorm.io/gorm"
)

// Repository defines the interface for category data access
type Repository interface {
	Create(ctx context.Context, category *CategoryPO) error
	GetByID(ctx context.Context, id string) (*CategoryPO, error)
	GetByIDAndProject(ctx context.Context, id, projectID string) (*CategoryPO, error)
	ListByProject(ctx context.Context, projectID string) ([]*CategoryPO, error)
	Update(ctx context.Context, category *CategoryPO) error
	Delete(ctx context.Context, id string) error
	UpdateSortOrder(ctx context.Context, projectID string, categoryIDs []string) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new category repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, category *CategoryPO) error {
	return r.db.WithContext(ctx).Create(category).Error
}

func (r *repository) GetByID(ctx context.Context, id string) (*CategoryPO, error) {
	var category CategoryPO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&category).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &category, nil
}

func (r *repository) GetByIDAndProject(ctx context.Context, id, projectID string) (*CategoryPO, error) {
	var category CategoryPO
	if err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", id, projectID).
		First(&category).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	return &category, nil
}

func (r *repository) ListByProject(ctx context.Context, projectID string) ([]*CategoryPO, error) {
	var categories []*CategoryPO
	if err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("sort_order ASC, id ASC").
		Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

func (r *repository) Update(ctx context.Context, category *CategoryPO) error {
	return r.db.WithContext(ctx).Save(category).Error
}

func (r *repository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Set parent_id to nil for children
		if err := tx.Model(&CategoryPO{}).Where("parent_id = ?", id).Update("parent_id", nil).Error; err != nil {
			return err
		}
		// Delete the category
		return dbutil.DeleteByID(tx, &CategoryPO{}, id).Error
	})
}

func (r *repository) UpdateSortOrder(ctx context.Context, projectID string, categoryIDs []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for i, id := range categoryIDs {
			if err := tx.Model(&CategoryPO{}).
				Where("id = ? AND project_id = ?", id, projectID).
				Update("sort_order", i).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
