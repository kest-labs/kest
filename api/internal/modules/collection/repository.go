package collection

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

// CollectionStats holds aggregate counts for a collection
type CollectionStats struct {
	RequestCount int64 `json:"request_count"`
	FolderCount  int64 `json:"folder_count"`
}

// Repository defines the interface for collection data access
type Repository interface {
	Create(ctx context.Context, collection *Collection) error
	GetByID(ctx context.Context, id uint) (*Collection, error)
	GetByIDAndProject(ctx context.Context, id, projectID uint) (*Collection, error)
	Update(ctx context.Context, collection *Collection) error
	Delete(ctx context.Context, id uint) error
	List(ctx context.Context, projectID uint, offset, limit int) ([]*Collection, int64, error)
	GetByParentID(ctx context.Context, projectID uint, parentID *uint) ([]*Collection, error)
	GetStats(ctx context.Context, collectionID uint) (*CollectionStats, error)
}

// repository implements Repository interface
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new collection repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, collection *Collection) error {
	po := newCollectionPO(collection)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}
	collection.ID = po.ID
	collection.CreatedAt = po.CreatedAt
	collection.UpdatedAt = po.UpdatedAt
	return nil
}

func (r *repository) GetByID(ctx context.Context, id uint) (*Collection, error) {
	var po CollectionPO
	if err := r.db.WithContext(ctx).First(&po, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) GetByIDAndProject(ctx context.Context, id, projectID uint) (*Collection, error) {
	var po CollectionPO
	if err := r.db.WithContext(ctx).Where("id = ? AND project_id = ?", id, projectID).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) Update(ctx context.Context, collection *Collection) error {
	po := newCollectionPO(collection)
	return r.db.WithContext(ctx).Model(&CollectionPO{}).Where("id = ?", collection.ID).Updates(po).Error
}

func (r *repository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&CollectionPO{}, id).Error
}

func (r *repository) List(ctx context.Context, projectID uint, offset, limit int) ([]*Collection, int64, error) {
	var poList []*CollectionPO
	var total int64

	if err := r.db.WithContext(ctx).Model(&CollectionPO{}).Where("project_id = ?", projectID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Offset(offset).Limit(limit).Order("sort_order ASC, created_at DESC").Find(&poList).Error; err != nil {
		return nil, 0, err
	}

	return toDomainList(poList), total, nil
}

func (r *repository) GetByParentID(ctx context.Context, projectID uint, parentID *uint) ([]*Collection, error) {
	var poList []*CollectionPO

	query := r.db.WithContext(ctx).Where("project_id = ?", projectID)
	if parentID == nil {
		query = query.Where("parent_id IS NULL")
	} else {
		query = query.Where("parent_id = ?", *parentID)
	}

	if err := query.Order("sort_order ASC, created_at DESC").Find(&poList).Error; err != nil {
		return nil, err
	}

	return toDomainList(poList), nil
}

func (r *repository) GetStats(ctx context.Context, collectionID uint) (*CollectionStats, error) {
	stats := &CollectionStats{}
	db := r.db.WithContext(ctx)

	db.Table("collections").Where("parent_id = ?", collectionID).Count(&stats.FolderCount)

	return stats, nil
}
