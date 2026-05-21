package member

import (
	"context"
	"fmt"
)

type Service interface {
	AddMember(ctx context.Context, workspaceID string, req *AddMemberRequest) (*MemberResponse, error)
	UpdateMember(ctx context.Context, workspaceID string, userID string, req *UpdateMemberRequest) (*MemberResponse, error)
	RemoveMember(ctx context.Context, workspaceID string, userID string) error
	ListMembers(ctx context.Context, workspaceID string) ([]MemberResponse, error)
	GetMember(ctx context.Context, workspaceID string, userID string) (*MemberResponse, error)
	CheckPermission(ctx context.Context, workspaceID string, userID string, requiredRole string) (bool, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) AddMember(ctx context.Context, workspaceID string, req *AddMemberRequest) (*MemberResponse, error) {
	// Check if already a member
	existing, _ := s.repo.GetMember(ctx, workspaceID, req.UserID.String())
	if existing != nil {
		return nil, fmt.Errorf("user is already a member of this workspace")
	}

	po := &WorkspaceMemberPO{
		WorkspaceID: workspaceID,
		UserID:      req.UserID.String(),
		Role:        req.Role,
	}

	if err := s.repo.AddMember(ctx, po); err != nil {
		return nil, err
	}

	return FromMemberPO(po), nil
}

func (s *service) UpdateMember(ctx context.Context, workspaceID string, userID string, req *UpdateMemberRequest) (*MemberResponse, error) {
	po, err := s.repo.GetMember(ctx, workspaceID, userID)
	if err != nil {
		return nil, fmt.Errorf("member not found")
	}

	po.Role = req.Role
	if err := s.repo.UpdateMember(ctx, po); err != nil {
		return nil, err
	}

	return FromMemberPO(po), nil
}

func (s *service) RemoveMember(ctx context.Context, workspaceID string, userID string) error {
	po, err := s.repo.GetMember(ctx, workspaceID, userID)
	if err != nil {
		return fmt.Errorf("member not found")
	}

	// Owner protection - optionally check if it's the last owner
	if po.Role == RoleOwner {
		members, _ := s.repo.ListMembers(ctx, workspaceID)
		ownersCount := 0
		for _, m := range members {
			if m.Role == RoleOwner {
				ownersCount++
			}
		}
		if ownersCount <= 1 {
			return fmt.Errorf("cannot remove the last owner of the workspace")
		}
	}

	return s.repo.DeleteMember(ctx, workspaceID, userID)
}

func (s *service) ListMembers(ctx context.Context, workspaceID string) ([]MemberResponse, error) {
	pos, err := s.repo.ListMembers(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	return FromMemberPOs(pos), nil
}

func (s *service) GetMember(ctx context.Context, workspaceID string, userID string) (*MemberResponse, error) {
	po, err := s.repo.GetMember(ctx, workspaceID, userID)
	if err != nil {
		return nil, fmt.Errorf("member not found")
	}
	return FromMemberPO(po), nil
}

func (s *service) CheckPermission(ctx context.Context, workspaceID string, userID string, requiredRole string) (bool, error) {
	po, err := s.repo.GetMember(ctx, workspaceID, userID)
	if err != nil {
		// No membership means no permissions (unless it's a public workspace, but here we enforce membership)
		return false, nil
	}

	userLevel := RoleLevel[po.Role]
	reqLevel := RoleLevel[requiredRole]

	return userLevel >= reqLevel, nil
}
