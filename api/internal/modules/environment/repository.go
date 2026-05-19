package environment

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/pkg/dbutil"
)

// Repository defines the interface for environment data access
type Repository interface {
	Create(ctx context.Context, env *EnvironmentPO) error
	GetByID(ctx context.Context, id string) (*EnvironmentPO, error)
	GetByIDAndWorkspace(ctx context.Context, id string, workspaceID string) (*EnvironmentPO, error)
	GetByWorkspaceAndName(ctx context.Context, workspaceID string, name string) (*EnvironmentPO, error)
	ListByWorkspace(ctx context.Context, workspaceID string) ([]*EnvironmentPO, error)
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

// GetByIDAndWorkspace gets an environment by ID scoped to a workspace.
func (r *repository) GetByIDAndWorkspace(ctx context.Context, id string, workspaceID string) (*EnvironmentPO, error) {
	var env EnvironmentPO
	err := dbutil.ByID(r.db.WithContext(ctx), id).
		Where("workspace_id = ?", workspaceID).
		First(&env).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &env, nil
}

// GetByWorkspaceAndName gets an environment by workspace ID and name
func (r *repository) GetByWorkspaceAndName(ctx context.Context, workspaceID string, name string) (*EnvironmentPO, error) {
	var env EnvironmentPO
	err := r.db.WithContext(ctx).
		Where("workspace_id = ? AND name = ?", workspaceID, name).
		First(&env).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &env, nil
}

// ListByWorkspace lists all environments for a workspace
func (r *repository) ListByWorkspace(ctx context.Context, workspaceID string) ([]*EnvironmentPO, error) {
	var envs []*EnvironmentPO
	err := r.db.WithContext(ctx).
		Where("workspace_id = ?", workspaceID).
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
