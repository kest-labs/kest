package member

import (
	"time"

	"gorm.io/gorm"
)

const (
	RoleOwner = "owner"
	RoleAdmin = "admin"
	RoleWrite = "write"
	RoleRead  = "read"
)

// RoleLevel defines the hierarchy of roles
var RoleLevel = map[string]int{
	RoleOwner: 40,
	RoleAdmin: 30,
	RoleWrite: 20,
	RoleRead:  10,
}

// ProjectMemberPO represents a membership of a user in a project
type ProjectMemberPO struct {
	ID        string         `gorm:"primaryKey" json:"id"`
	ProjectID string         `gorm:"index;uniqueIndex:idx_project_user;not null" json:"project_id"`
	UserID    uint           `gorm:"index;uniqueIndex:idx_project_user;not null" json:"user_id"`
	User      MemberUserPO   `gorm:"foreignKey:UserID;references:ID" json:"-"`
	Role      string         `gorm:"size:20;not null" json:"role"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ProjectMemberPO) TableName() string {
	return "project_members"
}

// MemberUserPO is a lightweight user projection used for member listings.
type MemberUserPO struct {
	ID       uint   `gorm:"primaryKey"`
	Username string `gorm:"column:username"`
	Email    string `gorm:"column:email"`
}

func (MemberUserPO) TableName() string {
	return "users"
}
