package project

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

// ProjectStats holds aggregate counts for a project
type ProjectStats struct {
	APISpecCount     int64 `json:"api_spec_count"`
	FlowCount        int64 `json:"flow_count"`
	EnvironmentCount int64 `json:"environment_count"`
	MemberCount      int64 `json:"member_count"`
	CategoryCount    int64 `json:"category_count"`
}

// Repository defines the interface for project data access
type Repository interface {
	Create(ctx context.Context, project *Project) error
	GetByID(ctx context.Context, id uint) (*Project, error)
	GetBySlug(ctx context.Context, slug string) (*Project, error)
	Update(ctx context.Context, project *Project) error
	Delete(ctx context.Context, id uint) error
	List(ctx context.Context, offset, limit int) ([]*Project, int64, error)
	GetStats(ctx context.Context, projectID uint) (*ProjectStats, error)
}

// repository implements Repository interface
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new project repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, project *Project) error {
	po := newProjectPO(project)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}
	// Copy back the generated ID
	project.ID = po.ID
	project.CreatedAt = po.CreatedAt
	project.UpdatedAt = po.UpdatedAt
	return nil
}

func (r *repository) GetByID(ctx context.Context, id uint) (*Project, error) {
	var po ProjectPO
	if err := r.db.WithContext(ctx).First(&po, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) GetBySlug(ctx context.Context, slug string) (*Project, error) {
	var po ProjectPO
	if err := r.db.WithContext(ctx).Where("slug = ?", slug).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) Update(ctx context.Context, project *Project) error {
	po := newProjectPO(project)
	return r.db.WithContext(ctx).Model(&ProjectPO{}).Where("id = ?", project.ID).Updates(po).Error
}

func (r *repository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&ProjectPO{}, id).Error
}

func (r *repository) List(ctx context.Context, offset, limit int) ([]*Project, int64, error) {
	var poList []*ProjectPO
	var total int64

	if err := r.db.WithContext(ctx).Model(&ProjectPO{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).Offset(offset).Limit(limit).Order("created_at DESC").Find(&poList).Error; err != nil {
		return nil, 0, err
	}

	return toDomainList(poList), total, nil
}

func (r *repository) GetStats(ctx context.Context, projectID uint) (*ProjectStats, error) {
	stats := &ProjectStats{}
	db := r.db.WithContext(ctx)

	db.Table("api_specs").Where("project_id = ?", projectID).Count(&stats.APISpecCount)
	db.Table("api_flows").Where("project_id = ?", projectID).Count(&stats.FlowCount)
	db.Table("api_environments").Where("project_id = ?", projectID).Count(&stats.EnvironmentCount)
	db.Table("project_members").Where("project_id = ?", projectID).Count(&stats.MemberCount)
	db.Table("api_categories").Where("project_id = ?", projectID).Count(&stats.CategoryCount)

	return stats, nil
}
