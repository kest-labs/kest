package member

import (
	"context"

	"gorm.io/gorm"
)

type Repository interface {
	AddMember(ctx context.Context, member *WorkspaceMemberPO) error
	UpdateMember(ctx context.Context, member *WorkspaceMemberPO) error
	DeleteMember(ctx context.Context, workspaceID string, userID string) error
	GetMember(ctx context.Context, workspaceID string, userID string) (*WorkspaceMemberPO, error)
	ListMembers(ctx context.Context, workspaceID string) ([]WorkspaceMemberPO, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) AddMember(ctx context.Context, member *WorkspaceMemberPO) error {
	return r.db.WithContext(ctx).Create(member).Error
}

func (r *repository) UpdateMember(ctx context.Context, member *WorkspaceMemberPO) error {
	return r.db.WithContext(ctx).Save(member).Error
}

func (r *repository) DeleteMember(ctx context.Context, workspaceID string, userID string) error {
	return r.db.WithContext(ctx).
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Delete(&WorkspaceMemberPO{}).Error
}

func (r *repository) GetMember(ctx context.Context, workspaceID string, userID string) (*WorkspaceMemberPO, error) {
	var member WorkspaceMemberPO
	err := r.db.WithContext(ctx).
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Preload("User").
		First(&member).Error
	if err != nil {
		return nil, err
	}
	return &member, nil
}

func (r *repository) ListMembers(ctx context.Context, workspaceID string) ([]WorkspaceMemberPO, error) {
	var members []WorkspaceMemberPO
	err := r.db.WithContext(ctx).
		Where("workspace_id = ?", workspaceID).
		Preload("User").
		Find(&members).Error
	return members, err
}
