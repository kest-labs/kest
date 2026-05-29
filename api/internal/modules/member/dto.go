package member

import (
	"time"

	idpkg "github.com/kest-labs/kest/api/pkg/id"
)

// ========== Request DTOs ==========

type AddMemberRequest struct {
	UserID idpkg.Compatible `json:"user_id" binding:"required" swaggertype:"string"`
	Role   string           `json:"role" binding:"required,oneof=owner admin write read"`
}

type UpdateMemberRequest struct {
	Role string `json:"role" binding:"required,oneof=owner admin write read"`
}

// ========== Response DTOs ==========

type MemberResponse struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username"`
	Email       string    `json:"email"`
	Role        string    `json:"role"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ========== Mapper Functions ==========

func FromMemberPO(po *WorkspaceMemberPO) *MemberResponse {
	if po == nil {
		return nil
	}
	return &MemberResponse{
		ID:          po.ID,
		WorkspaceID: po.WorkspaceID,
		UserID:      po.UserID,
		Username:    po.User.Username,
		Email:       po.User.Email,
		Role:        po.Role,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
	}
}

func FromMemberPOs(pos []WorkspaceMemberPO) []MemberResponse {
	resps := make([]MemberResponse, len(pos))
	for i, po := range pos {
		resps[i] = *FromMemberPO(&po)
	}
	return resps
}
