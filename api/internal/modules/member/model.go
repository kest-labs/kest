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

// WorkspaceMemberPO represents a membership of a user in a workspace
type WorkspaceMemberPO struct {
	ID          string         `gorm:"primaryKey" json:"id"`
	WorkspaceID string         `gorm:"index;uniqueIndex:idx_workspace_user;not null" json:"workspace_id"`
	UserID      string         `gorm:"index;uniqueIndex:idx_workspace_user;not null" json:"user_id"`
	User        MemberUserPO   `gorm:"foreignKey:UserID;references:ID" json:"-"`
	Role        string         `gorm:"size:20;not null" json:"role"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (WorkspaceMemberPO) TableName() string {
	return "workspace_members"
}

// MemberUserPO is a lightweight user workspaceion used for member listings.
type MemberUserPO struct {
	ID       string `gorm:"primaryKey"`
	Username string `gorm:"column:username"`
	Email    string `gorm:"column:email"`
}

func (MemberUserPO) TableName() string {
	return "users"
}
