package workspaceinvite

import (
	"context"
	"testing"
	"time"
)

type testWorkspaceInviteRepo struct {
	invitation               *WorkspaceInvitation
	userInvitations          []*WorkspaceInvitation
	workspaceSummary         *WorkspaceSummary
	workspaceSummaries       map[string]*WorkspaceSummary
	acceptedUserID           string
	acceptedAt               *time.Time
	hasWorkspaceMember       bool
	revokedDirectWorkspaceID string
	revokedDirectUserID      string
}

func (r *testWorkspaceInviteRepo) CreateInvitation(
	_ context.Context,
	invitation *WorkspaceInvitation,
	_ string,
) error {
	invitation.ID = "9"
	invitation.CreatedAt = time.Now().UTC()
	invitation.UpdatedAt = invitation.CreatedAt
	r.invitation = invitation
	return nil
}

func (r *testWorkspaceInviteRepo) ListInvitationsByWorkspace(
	_ context.Context,
	_ string,
) ([]*WorkspaceInvitation, error) {
	if r.invitation == nil {
		return nil, nil
	}
	return []*WorkspaceInvitation{r.invitation}, nil
}

func (r *testWorkspaceInviteRepo) ListInvitationsByInvitedUser(
	_ context.Context,
	_ string,
) ([]*WorkspaceInvitation, error) {
	return r.userInvitations, nil
}

func (r *testWorkspaceInviteRepo) GetInvitationByWorkspace(
	_ context.Context,
	_, invitationID string,
) (*WorkspaceInvitation, error) {
	if r.invitation == nil || r.invitation.ID != invitationID {
		return nil, nil
	}
	return r.invitation, nil
}

func (r *testWorkspaceInviteRepo) GetInvitationBySlug(_ context.Context, slug string) (*WorkspaceInvitation, error) {
	if r.invitation == nil || r.invitation.Slug != slug {
		return nil, nil
	}
	return r.invitation, nil
}

func (r *testWorkspaceInviteRepo) UpdateInvitation(
	_ context.Context,
	invitation *WorkspaceInvitation,
) error {
	r.invitation = invitation
	return nil
}

func (r *testWorkspaceInviteRepo) GetWorkspaceSummary(_ context.Context, workspaceID string) (*WorkspaceSummary, error) {
	if r.workspaceSummaries != nil {
		return r.workspaceSummaries[workspaceID], nil
	}
	return r.workspaceSummary, nil
}

func (r *testWorkspaceInviteRepo) AcceptInvitation(
	_ context.Context,
	invitation *WorkspaceInvitation,
	userID string,
	acceptedAt time.Time,
) error {
	if err := validateInvitationCanBeAccepted(invitation, acceptedAt); err != nil {
		return err
	}
	r.acceptedUserID = userID
	r.acceptedAt = &acceptedAt
	invitation.UsedCount++
	return nil
}

func (r *testWorkspaceInviteRepo) RevokeActiveInvitationsForUser(
	_ context.Context,
	workspaceID, userID string,
) error {
	r.revokedDirectWorkspaceID = workspaceID
	r.revokedDirectUserID = userID
	return nil
}

func (r *testWorkspaceInviteRepo) HasWorkspaceMember(
	_ context.Context,
	_, _ string,
) (bool, error) {
	return r.hasWorkspaceMember, nil
}

func TestCreateInvitationDefaults(t *testing.T) {
	repo := &testWorkspaceInviteRepo{}
	svc := NewService(repo)

	resp, err := svc.CreateInvitation(context.Background(), "12", "7", &CreateWorkspaceInvitationRequest{
		Role: memberRoleRead,
	})
	if err != nil {
		t.Fatalf("CreateInvitation returned error: %v", err)
	}

	if resp.WorkspaceID != "12" {
		t.Fatalf("expected workspace id 12, got %s", resp.WorkspaceID)
	}
	if resp.Role != memberRoleRead {
		t.Fatalf("expected role %q, got %q", memberRoleRead, resp.Role)
	}
	if resp.MaxUses != 1 {
		t.Fatalf("expected default max uses 1, got %d", resp.MaxUses)
	}
	if resp.ExpiresAt == nil {
		t.Fatal("expected default expiry to be populated")
	}
	if resp.InviteURL == "" {
		t.Fatal("expected invite url to be populated")
	}
	if repo.invitation == nil || repo.invitation.Slug == "" {
		t.Fatal("expected repo to receive generated slug")
	}
}

func TestCreateInvitationDirectInviteForcesSingleUse(t *testing.T) {
	repo := &testWorkspaceInviteRepo{}
	svc := NewService(repo)

	resp, err := svc.CreateInvitation(context.Background(), "12", "7", &CreateWorkspaceInvitationRequest{
		Role:          memberRoleRead,
		MaxUses:       intPtr(0),
		InvitedUserID: "99",
	})
	if err != nil {
		t.Fatalf("CreateInvitation returned error: %v", err)
	}

	if repo.revokedDirectWorkspaceID != "12" || repo.revokedDirectUserID != "99" {
		t.Fatalf("expected previous direct invites to be revoked, got workspace=%q user=%q", repo.revokedDirectWorkspaceID, repo.revokedDirectUserID)
	}
	if resp.MaxUses != 1 {
		t.Fatalf("expected direct invite to force single use, got %d", resp.MaxUses)
	}
	if repo.invitation == nil || repo.invitation.InvitedUserID == nil || *repo.invitation.InvitedUserID != "99" {
		t.Fatalf("expected direct invite recipient to be stored, got %#v", repo.invitation)
	}
}

func TestAcceptInvitationRejectsAlreadyUsedUpLink(t *testing.T) {
	repo := &testWorkspaceInviteRepo{
		invitation: &WorkspaceInvitation{
			ID:          "3",
			WorkspaceID: "12",
			Slug:        "wsi_usedup",
			Role:        memberRoleRead,
			Status:      InvitationStatusActive,
			MaxUses:     1,
			UsedCount:   1,
		},
	}
	svc := NewService(repo)

	if _, err := svc.AcceptInvitation(context.Background(), "wsi_usedup", "99"); err != ErrWorkspaceInvitationUsedUp {
		t.Fatalf("expected ErrWorkspaceInvitationUsedUp, got %v", err)
	}
}

func TestAcceptInvitationReturnsRedirect(t *testing.T) {
	repo := &testWorkspaceInviteRepo{
		invitation: &WorkspaceInvitation{
			ID:          "4",
			WorkspaceID: "18",
			Slug:        "wsi_accept",
			Role:        memberRoleWrite,
			Status:      InvitationStatusActive,
			MaxUses:     1,
		},
	}
	svc := NewService(repo)

	resp, err := svc.AcceptInvitation(context.Background(), "wsi_accept", "42")
	if err != nil {
		t.Fatalf("AcceptInvitation returned error: %v", err)
	}

	if resp.WorkspaceID != "18" {
		t.Fatalf("expected workspace id 18, got %s", resp.WorkspaceID)
	}
	if resp.Member.UserID != "42" || resp.Member.Role != memberRoleWrite {
		t.Fatalf("unexpected member payload: %#v", resp.Member)
	}
	if resp.RedirectTo != "/workspace/18" {
		t.Fatalf("expected redirect /workspace/18, got %q", resp.RedirectTo)
	}
	if repo.acceptedAt == nil {
		t.Fatal("expected accept time to be recorded")
	}
}

func TestAcceptInvitationRejectsWrongRecipient(t *testing.T) {
	invitedUserID := "88"
	repo := &testWorkspaceInviteRepo{
		invitation: &WorkspaceInvitation{
			ID:            "5",
			WorkspaceID:   "18",
			Slug:          "wsi_direct",
			Role:          memberRoleWrite,
			Status:        InvitationStatusActive,
			MaxUses:       1,
			InvitedUserID: &invitedUserID,
		},
	}
	svc := NewService(repo)

	if _, err := svc.AcceptInvitation(context.Background(), "wsi_direct", "42"); err != ErrWorkspaceInvitationNotRecipient {
		t.Fatalf("expected ErrWorkspaceInvitationNotRecipient, got %v", err)
	}
}

func TestRejectInvitationMarksDirectInviteRejected(t *testing.T) {
	invitedUserID := "42"
	repo := &testWorkspaceInviteRepo{
		invitation: &WorkspaceInvitation{
			ID:            "6",
			WorkspaceID:   "18",
			Slug:          "wsi_reject",
			Role:          memberRoleRead,
			Status:        InvitationStatusActive,
			MaxUses:       1,
			InvitedUserID: &invitedUserID,
		},
	}
	svc := NewService(repo)

	resp, err := svc.RejectInvitation(context.Background(), "wsi_reject", "42")
	if err != nil {
		t.Fatalf("RejectInvitation returned error: %v", err)
	}

	if resp.Status != "rejected" {
		t.Fatalf("expected rejected status, got %q", resp.Status)
	}
	if repo.invitation.Status != InvitationStatusRejected {
		t.Fatalf("expected invitation status %q, got %q", InvitationStatusRejected, repo.invitation.Status)
	}
}

func TestListReceivedInvitationsReturnsOnlyActiveDirectInvites(t *testing.T) {
	invitedUserID := "42"
	repo := &testWorkspaceInviteRepo{
		userInvitations: []*WorkspaceInvitation{
			{
				ID:            "7",
				WorkspaceID:   "18",
				Slug:          "wsi_active",
				Role:          memberRoleRead,
				Status:        InvitationStatusActive,
				MaxUses:       1,
				InvitedUserID: &invitedUserID,
			},
			{
				ID:            "8",
				WorkspaceID:   "19",
				Slug:          "wsi_rejected",
				Role:          memberRoleRead,
				Status:        InvitationStatusRejected,
				MaxUses:       1,
				InvitedUserID: &invitedUserID,
			},
		},
		workspaceSummaries: map[string]*WorkspaceSummary{
			"18": {ID: "18", Name: "Payments", Slug: "payments"},
			"19": {ID: "19", Name: "Orders", Slug: "orders"},
		},
	}
	svc := NewService(repo)

	resp, err := svc.ListReceivedInvitations(context.Background(), "42")
	if err != nil {
		t.Fatalf("ListReceivedInvitations returned error: %v", err)
	}

	if len(resp) != 1 {
		t.Fatalf("expected 1 active direct invite, got %d", len(resp))
	}
	if resp[0].WorkspaceSlug != "payments" || resp[0].Slug != "wsi_active" {
		t.Fatalf("unexpected response payload: %#v", resp[0])
	}
}

const (
	memberRoleRead  = "read"
	memberRoleWrite = "write"
)

func intPtr(value int) *int {
	return &value
}
