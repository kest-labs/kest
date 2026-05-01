package history

import (
	"context"
	"errors"

	"github.com/kest-labs/kest/api/pkg/dbutil"
	"gorm.io/gorm"
)

// Repository defines data access for history
type Repository interface {
	Create(ctx context.Context, history *History) error
	GetByID(ctx context.Context, id string) (*History, error)
	GetBySourceEvent(ctx context.Context, projectID, source, sourceEventID string) (*History, error)
	ListByEntity(ctx context.Context, projectID string, entityType string, entityID string, page, perPage int) ([]*History, int64, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new history repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, history *History) error {
	po := newHistoryPO(history)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}
	history.ID = po.ID
	history.CreatedAt = po.CreatedAt
	return nil
}

func (r *repository) GetByID(ctx context.Context, id string) (*History, error) {
	var po HistoryPO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) GetBySourceEvent(ctx context.Context, projectID, source, sourceEventID string) (*History, error) {
	var po HistoryPO
	if err := r.db.WithContext(ctx).
		Where("project_id = ? AND source = ? AND source_event_id = ?", projectID, source, sourceEventID).
		First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) ListByEntity(ctx context.Context, projectID string, entityType string, entityID string, page, perPage int) ([]*History, int64, error) {
	var poList []*HistoryPO
	var total int64

	query := r.db.WithContext(ctx).Model(&HistoryPO{}).Where("project_id = ?", projectID)

	if entityType != "" {
		query = query.Where("entity_type = ?", entityType)
	}
	if entityID != "" {
		query = query.Where("entity_id = ?", entityID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	if err := query.Order("created_at DESC").Offset(offset).Limit(perPage).Find(&poList).Error; err != nil {
		return nil, 0, err
	}

	return toDomainList(poList), total, nil
}
