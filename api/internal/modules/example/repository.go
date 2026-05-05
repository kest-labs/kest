package example

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/pkg/dbutil"
)

// Repository defines the interface for example data access
type Repository interface {
	Create(ctx context.Context, example *Example) error
	GetByID(ctx context.Context, id string) (*Example, error)
	GetByIDAndRequest(ctx context.Context, id, requestID string) (*Example, error)
	Update(ctx context.Context, example *Example) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, requestID string) ([]*Example, error)
	GetDefault(ctx context.Context, requestID string) (*Example, error)
	ClearDefault(ctx context.Context, requestID string) error
}

// repository implements Repository interface
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new example repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, example *Example) error {
	po := newExamplePO(example)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}
	example.ID = po.ID
	example.CreatedAt = po.CreatedAt
	example.UpdatedAt = po.UpdatedAt
	return nil
}

func (r *repository) GetByID(ctx context.Context, id string) (*Example, error) {
	var po ExamplePO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) GetByIDAndRequest(ctx context.Context, id, requestID string) (*Example, error) {
	var po ExamplePO
	if err := r.db.WithContext(ctx).Where("id = ? AND request_id = ?", id, requestID).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) Update(ctx context.Context, example *Example) error {
	po := newExamplePO(example)
	return r.db.WithContext(ctx).Model(&ExamplePO{}).Where("id = ?", example.ID).Updates(po).Error
}

func (r *repository) Delete(ctx context.Context, id string) error {
	return dbutil.DeleteByID(r.db.WithContext(ctx), &ExamplePO{}, id).Error
}

func (r *repository) List(ctx context.Context, requestID string) ([]*Example, error) {
	var poList []*ExamplePO
	if err := r.db.WithContext(ctx).Where("request_id = ?", requestID).Order("sort_order ASC, created_at DESC").Find(&poList).Error; err != nil {
		return nil, err
	}
	return toDomainList(poList), nil
}

func (r *repository) GetDefault(ctx context.Context, requestID string) (*Example, error) {
	var po ExamplePO
	if err := r.db.WithContext(ctx).Where("request_id = ? AND is_default = ?", requestID, true).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) ClearDefault(ctx context.Context, requestID string) error {
	return r.db.WithContext(ctx).Model(&ExamplePO{}).Where("request_id = ?", requestID).Update("is_default", false).Error
}
