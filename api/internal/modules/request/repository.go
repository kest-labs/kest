package request

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

// Repository defines the interface for request data access
type Repository interface {
	Create(ctx context.Context, request *Request) error
	GetByID(ctx context.Context, id uint) (*Request, error)
	GetByIDAndCollection(ctx context.Context, id, collectionID uint) (*Request, error)
	Update(ctx context.Context, request *Request) error
	Delete(ctx context.Context, id uint) error
	List(ctx context.Context, collectionID uint, offset, limit int) ([]*Request, int64, error)
	GetByCollectionID(ctx context.Context, collectionID uint) ([]*Request, error)
}

// repository implements Repository interface
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new request repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, request *Request) error {
	po := newRequestPO(request)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}
	request.ID = po.ID
	request.CreatedAt = po.CreatedAt
	request.UpdatedAt = po.UpdatedAt
	return nil
}

func (r *repository) GetByID(ctx context.Context, id uint) (*Request, error) {
	var po RequestPO
	if err := r.db.WithContext(ctx).First(&po, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) GetByIDAndCollection(ctx context.Context, id, collectionID uint) (*Request, error) {
	var po RequestPO
	if err := r.db.WithContext(ctx).Where("id = ? AND collection_id = ?", id, collectionID).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) Update(ctx context.Context, request *Request) error {
	po := newRequestPO(request)
	return r.db.WithContext(ctx).Model(&RequestPO{}).Where("id = ?", request.ID).Updates(po).Error
}

func (r *repository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&RequestPO{}, id).Error
}

func (r *repository) List(ctx context.Context, collectionID uint, offset, limit int) ([]*Request, int64, error) {
	var poList []*RequestPO
	var total int64

	if err := r.db.WithContext(ctx).Model(&RequestPO{}).Where("collection_id = ?", collectionID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).Where("collection_id = ?", collectionID).Offset(offset).Limit(limit).Order("sort_order ASC, created_at DESC").Find(&poList).Error; err != nil {
		return nil, 0, err
	}

	return toDomainList(poList), total, nil
}

func (r *repository) GetByCollectionID(ctx context.Context, collectionID uint) ([]*Request, error) {
	var poList []*RequestPO
	if err := r.db.WithContext(ctx).Where("collection_id = ?", collectionID).Order("sort_order ASC, created_at DESC").Find(&poList).Error; err != nil {
		return nil, err
	}
	return toDomainList(poList), nil
}
