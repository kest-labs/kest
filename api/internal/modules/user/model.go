package user

import (
	"time"

	"github.com/kest-labs/kest/api/internal/domain"
	"gorm.io/gorm"
)

// UserPO is the persistent object for database operations (internal to repository)
// This struct contains GORM tags and is NOT exposed outside the repository layer.
// JSON tags are removed to prevent accidental exposure of database structure.
type UserPO struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
	Username  string         `gorm:"size:50;not null"`
	Password  string         `gorm:"size:100;not null"`
	Email     string         `gorm:"size:100;not null;unique"`
	Nickname  string         `gorm:"size:50"`
	Avatar    string         `gorm:"size:255"`
	Phone     string         `gorm:"size:20"`
	Bio       string         `gorm:"size:500"`
	Status    int            `gorm:"default:1"` // 1: active, 0: disabled
	LastLogin *time.Time
}

// TableName specifies the database table name
func (UserPO) TableName() string {
	return "users"
}

// toDomain converts UserPO to domain.User
func (po *UserPO) toDomain() *domain.User {
	if po == nil {
		return nil
	}
	return &domain.User{
		ID:        po.ID,
		Username:  po.Username,
		Email:     po.Email,
		Password:  po.Password,
		Nickname:  po.Nickname,
		Avatar:    po.Avatar,
		Phone:     po.Phone,
		Bio:       po.Bio,
		Status:    po.Status,
		LastLogin: po.LastLogin,
		CreatedAt: po.CreatedAt,
		UpdatedAt: po.UpdatedAt,
	}
}

// newUserPO converts domain.User to UserPO for database operations
func newUserPO(u *domain.User) *UserPO {
	if u == nil {
		return nil
	}
	return &UserPO{
		ID:        u.ID,
		Username:  u.Username,
		Email:     u.Email,
		Password:  u.Password,
		Nickname:  u.Nickname,
		Avatar:    u.Avatar,
		Phone:     u.Phone,
		Bio:       u.Bio,
		Status:    u.Status,
		LastLogin: u.LastLogin,
	}
}

// toDomainList converts a slice of UserPO to domain.User slice
func toDomainList(poList []*UserPO) []*domain.User {
	result := make([]*domain.User, len(poList))
	for i, po := range poList {
		result[i] = po.toDomain()
	}
	return result
}
