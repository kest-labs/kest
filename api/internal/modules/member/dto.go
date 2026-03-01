package member

import "time"

// ========== Request DTOs ==========

type AddMemberRequest struct {
	UserID uint   `json:"user_id" binding:"required"`
	Role   string `json:"role" binding:"required,oneof=owner admin write read"`
}

type UpdateMemberRequest struct {
	Role string `json:"role" binding:"required,oneof=owner admin write read"`
}

// ========== Response DTOs ==========

type MemberResponse struct {
	ID        uint      `json:"id"`
	ProjectID uint      `json:"project_id"`
	UserID    uint      `json:"user_id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ========== Mapper Functions ==========

func FromMemberPO(po *ProjectMemberPO) *MemberResponse {
	if po == nil {
		return nil
	}
	return &MemberResponse{
		ID:        po.ID,
		ProjectID: po.ProjectID,
		UserID:    po.UserID,
		Username:  po.Username,
		Email:     po.Email,
		Role:      po.Role,
		CreatedAt: po.CreatedAt,
		UpdatedAt: po.UpdatedAt,
	}
}

func FromMemberPOs(pos []ProjectMemberPO) []MemberResponse {
	resps := make([]MemberResponse, len(pos))
	for i, po := range pos {
		resps[i] = *FromMemberPO(&po)
	}
	return resps
}
