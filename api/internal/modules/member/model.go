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
	ID        uint           `gorm:"primaryKey" json:"id"`
	ProjectID uint           `gorm:"index;uniqueIndex:idx_project_user;not null" json:"project_id"`
	UserID    uint           `gorm:"index;uniqueIndex:idx_project_user;not null" json:"user_id"`
	Username  string         `gorm:"column:username;->;-:migration" json:"username,omitempty"`
	Email     string         `gorm:"column:email;->;-:migration" json:"email,omitempty"`
	Role      string         `gorm:"size:20;not null" json:"role"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ProjectMemberPO) TableName() string {
	return "project_members"
}
