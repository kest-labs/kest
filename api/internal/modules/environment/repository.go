package environment

import (
	"context"
	"errors"

	"github.com/kest-labs/kest/api/pkg/dbutil"
	"gorm.io/gorm"
)

// Repository defines the interface for environment data access
type Repository interface {
	Create(ctx context.Context, env *EnvironmentPO) error
	GetByID(ctx context.Context, id string) (*EnvironmentPO, error)
	GetByProjectAndName(ctx context.Context, projectID string, name string) (*EnvironmentPO, error)
	ListByProject(ctx context.Context, projectID string) ([]*EnvironmentPO, error)
	Update(ctx context.Context, env *EnvironmentPO) error
	Delete(ctx context.Context, id string) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new environment repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create creates a new environment
func (r *repository) Create(ctx context.Context, env *EnvironmentPO) error {
	return r.db.WithContext(ctx).Create(env).Error
}

// GetByID gets an environment by ID
func (r *repository) GetByID(ctx context.Context, id string) (*EnvironmentPO, error) {
	var env EnvironmentPO
	err := dbutil.ByID(r.db.WithContext(ctx), id).First(&env).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &env, nil
}

// GetByProjectAndName gets an environment by project ID and name
func (r *repository) GetByProjectAndName(ctx context.Context, projectID string, name string) (*EnvironmentPO, error) {
	var env EnvironmentPO
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND name = ?", projectID, name).
		First(&env).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &env, nil
}

// ListByProject lists all environments for a project
func (r *repository) ListByProject(ctx context.Context, projectID string) ([]*EnvironmentPO, error) {
	var envs []*EnvironmentPO
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("name ASC").
		Find(&envs).Error
	if err != nil {
		return nil, err
	}
	return envs, nil
}

// Update updates an environment
func (r *repository) Update(ctx context.Context, env *EnvironmentPO) error {
	return r.db.WithContext(ctx).Save(env).Error
}

// Delete deletes an environment (soft delete)
func (r *repository) Delete(ctx context.Context, id string) error {
	return dbutil.DeleteByID(r.db.WithContext(ctx), &EnvironmentPO{}, id).Error
}
