package audit

import (
	"context"

	"gorm.io/gorm"
)

// Repository defines the interface for audit logging
type Repository interface {
	Create(ctx context.Context, log *AuditLogPO) error
	ListByWorkspace(ctx context.Context, workspaceID string, page, pageSize int) ([]AuditLogPO, int64, error)
	ListAll(ctx context.Context, page, pageSize int) ([]AuditLogPO, int64, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new audit repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create inserts a new audit log
func (r *repository) Create(ctx context.Context, log *AuditLogPO) error {
	return r.db.WithContext(ctx).Create(log).Error
}

// ListByWorkspace retrieves audit logs for a specific workspace
func (r *repository) ListByWorkspace(ctx context.Context, workspaceID string, page, pageSize int) ([]AuditLogPO, int64, error) {
	var logs []AuditLogPO
	var total int64
	offset := (page - 1) * pageSize

	q := r.db.WithContext(ctx).Model(&AuditLogPO{}).Where("workspace_id = ?", workspaceID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

// ListAll retrieves all audit logs with pagination
func (r *repository) ListAll(ctx context.Context, page, pageSize int) ([]AuditLogPO, int64, error) {
	var logs []AuditLogPO
	var total int64
	offset := (page - 1) * pageSize

	q := r.db.WithContext(ctx).Model(&AuditLogPO{})
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}
