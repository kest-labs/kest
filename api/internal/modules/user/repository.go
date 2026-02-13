package user

import (
	"context"

	"github.com/kest-labs/kest/api/internal/domain"
	"gorm.io/gorm"
)

// repository implements domain.UserRepository
// It uses UserPO internally for database operations and converts to domain.User
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new repository instance that implements domain.UserRepository
func NewRepository(db *gorm.DB) *repository {
	return &repository{
		db: db,
	}
}

// Create adds a new user
func (r *repository) Create(ctx context.Context, user *domain.User) error {
	po := newUserPO(user)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}
	// Update the domain user with generated ID
	user.ID = po.ID
	user.CreatedAt = po.CreatedAt
	user.UpdatedAt = po.UpdatedAt
	return nil
}

// Update modifies an existing user
func (r *repository) Update(ctx context.Context, user *domain.User) error {
	po := newUserPO(user)
	if err := r.db.WithContext(ctx).Save(po).Error; err != nil {
		return err
	}
	user.UpdatedAt = po.UpdatedAt
	return nil
}

// Delete removes a user by ID
func (r *repository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&UserPO{}, id).Error
}

// FindByID retrieves a user by ID
func (r *repository) FindByID(ctx context.Context, id uint) (*domain.User, error) {
	var po UserPO
	if err := r.db.WithContext(ctx).First(&po, id).Error; err != nil {
		return nil, err
	}
	return po.toDomain(), nil
}

// FindAll retrieves users with pagination
func (r *repository) FindAll(ctx context.Context, page, pageSize int) ([]*domain.User, int64, error) {
	var poList []*UserPO
	var total int64

	offset := (page - 1) * pageSize
	if err := r.db.WithContext(ctx).Model(&UserPO{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).Offset(offset).Limit(pageSize).Find(&poList).Error; err != nil {
		return nil, 0, err
	}

	return toDomainList(poList), total, nil
}

// FindByUsername retrieves a user by username
func (r *repository) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	var po UserPO
	if err := r.db.WithContext(ctx).Where("username = ?", username).First(&po).Error; err != nil {
		return nil, err
	}
	return po.toDomain(), nil
}

// FindByEmail retrieves a user by email
func (r *repository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	var po UserPO
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&po).Error; err != nil {
		return nil, err
	}
	return po.toDomain(), nil
}

// Search searches users by username, email, or nickname
func (r *repository) Search(ctx context.Context, query string, limit int) ([]*domain.User, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	var poList []*UserPO
	pattern := "%" + query + "%"
	if err := r.db.WithContext(ctx).
		Where("username ILIKE ? OR email ILIKE ? OR nickname ILIKE ?", pattern, pattern, pattern).
		Limit(limit).
		Find(&poList).Error; err != nil {
		return nil, err
	}
	return toDomainList(poList), nil
}
