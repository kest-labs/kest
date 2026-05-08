package projectinvite

import (
	"context"
	"testing"
	"time"
)

type testProjectInviteRepo struct {
	invitation             *ProjectInvitation
	userInvitations        []*ProjectInvitation
	projectSummary         *ProjectSummary
	projectSummaries       map[string]*ProjectSummary
	acceptedUserID         string
	acceptedAt             *time.Time
	hasProjectMember       bool
	revokedDirectProjectID string
	revokedDirectUserID    string
}

func (r *testProjectInviteRepo) CreateInvitation(
	_ context.Context,
	invitation *ProjectInvitation,
	_ string,
) error {
	invitation.ID = "9"
	invitation.CreatedAt = time.Now().UTC()
	invitation.UpdatedAt = invitation.CreatedAt
	r.invitation = invitation
	return nil
}

func (r *testProjectInviteRepo) ListInvitationsByProject(
	_ context.Context,
	_ string,
) ([]*ProjectInvitation, error) {
	if r.invitation == nil {
		return nil, nil
	}
	return []*ProjectInvitation{r.invitation}, nil
}

func (r *testProjectInviteRepo) ListInvitationsByInvitedUser(
	_ context.Context,
	_ string,
) ([]*ProjectInvitation, error) {
	return r.userInvitations, nil
}

func (r *testProjectInviteRepo) GetInvitationByProject(
	_ context.Context,
	_, invitationID string,
) (*ProjectInvitation, error) {
	if r.invitation == nil || r.invitation.ID != invitationID {
		return nil, nil
	}
	return r.invitation, nil
}

func (r *testProjectInviteRepo) GetInvitationBySlug(_ context.Context, slug string) (*ProjectInvitation, error) {
	if r.invitation == nil || r.invitation.Slug != slug {
		return nil, nil
	}
	return r.invitation, nil
}

func (r *testProjectInviteRepo) UpdateInvitation(
	_ context.Context,
	invitation *ProjectInvitation,
) error {
	r.invitation = invitation
	return nil
}

func (r *testProjectInviteRepo) GetProjectSummary(_ context.Context, projectID string) (*ProjectSummary, error) {
	if r.projectSummaries != nil {
		return r.projectSummaries[projectID], nil
	}
	return r.projectSummary, nil
}

func (r *testProjectInviteRepo) AcceptInvitation(
	_ context.Context,
	invitation *ProjectInvitation,
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

func (r *testProjectInviteRepo) RevokeActiveInvitationsForUser(
	_ context.Context,
	projectID, userID string,
) error {
	r.revokedDirectProjectID = projectID
	r.revokedDirectUserID = userID
	return nil
}

func (r *testProjectInviteRepo) HasProjectMember(
	_ context.Context,
	_, _ string,
) (bool, error) {
	return r.hasProjectMember, nil
}

func TestCreateInvitationDefaults(t *testing.T) {
	repo := &testProjectInviteRepo{}
	svc := NewService(repo)

	resp, err := svc.CreateInvitation(context.Background(), "12", "7", &CreateProjectInvitationRequest{
		Role: memberRoleRead,
	})
	if err != nil {
		t.Fatalf("CreateInvitation returned error: %v", err)
	}

	if resp.ProjectID != "12" {
		t.Fatalf("expected project id 12, got %s", resp.ProjectID)
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
	repo := &testProjectInviteRepo{}
	svc := NewService(repo)

	resp, err := svc.CreateInvitation(context.Background(), "12", "7", &CreateProjectInvitationRequest{
		Role:          memberRoleRead,
		MaxUses:       intPtr(0),
		InvitedUserID: "99",
	})
	if err != nil {
		t.Fatalf("CreateInvitation returned error: %v", err)
	}

	if repo.revokedDirectProjectID != "12" || repo.revokedDirectUserID != "99" {
		t.Fatalf("expected previous direct invites to be revoked, got project=%q user=%q", repo.revokedDirectProjectID, repo.revokedDirectUserID)
	}
	if resp.MaxUses != 1 {
		t.Fatalf("expected direct invite to force single use, got %d", resp.MaxUses)
	}
	if repo.invitation == nil || repo.invitation.InvitedUserID == nil || *repo.invitation.InvitedUserID != "99" {
		t.Fatalf("expected direct invite recipient to be stored, got %#v", repo.invitation)
	}
}

func TestAcceptInvitationRejectsAlreadyUsedUpLink(t *testing.T) {
	repo := &testProjectInviteRepo{
		invitation: &ProjectInvitation{
			ID:        "3",
			ProjectID: "12",
			Slug:      "pji_usedup",
			Role:      memberRoleRead,
			Status:    InvitationStatusActive,
			MaxUses:   1,
			UsedCount: 1,
		},
	}
	svc := NewService(repo)

	if _, err := svc.AcceptInvitation(context.Background(), "pji_usedup", "99"); err != ErrProjectInvitationUsedUp {
		t.Fatalf("expected ErrProjectInvitationUsedUp, got %v", err)
	}
}

func TestAcceptInvitationReturnsRedirect(t *testing.T) {
	repo := &testProjectInviteRepo{
		invitation: &ProjectInvitation{
			ID:        "4",
			ProjectID: "18",
			Slug:      "pji_accept",
			Role:      memberRoleWrite,
			Status:    InvitationStatusActive,
			MaxUses:   1,
		},
	}
	svc := NewService(repo)

	resp, err := svc.AcceptInvitation(context.Background(), "pji_accept", "42")
	if err != nil {
		t.Fatalf("AcceptInvitation returned error: %v", err)
	}

	if resp.ProjectID != "18" {
		t.Fatalf("expected project id 18, got %s", resp.ProjectID)
	}
	if resp.Member.UserID != "42" || resp.Member.Role != memberRoleWrite {
		t.Fatalf("unexpected member payload: %#v", resp.Member)
	}
	if resp.RedirectTo != "/project/18" {
		t.Fatalf("expected redirect /project/18, got %q", resp.RedirectTo)
	}
	if repo.acceptedAt == nil {
		t.Fatal("expected accept time to be recorded")
	}
}

func TestAcceptInvitationRejectsWrongRecipient(t *testing.T) {
	invitedUserID := "88"
	repo := &testProjectInviteRepo{
		invitation: &ProjectInvitation{
			ID:            "5",
			ProjectID:     "18",
			Slug:          "pji_direct",
			Role:          memberRoleWrite,
			Status:        InvitationStatusActive,
			MaxUses:       1,
			InvitedUserID: &invitedUserID,
		},
	}
	svc := NewService(repo)

	if _, err := svc.AcceptInvitation(context.Background(), "pji_direct", "42"); err != ErrProjectInvitationNotRecipient {
		t.Fatalf("expected ErrProjectInvitationNotRecipient, got %v", err)
	}
}

func TestRejectInvitationMarksDirectInviteRejected(t *testing.T) {
	invitedUserID := "42"
	repo := &testProjectInviteRepo{
		invitation: &ProjectInvitation{
			ID:            "6",
			ProjectID:     "18",
			Slug:          "pji_reject",
			Role:          memberRoleRead,
			Status:        InvitationStatusActive,
			MaxUses:       1,
			InvitedUserID: &invitedUserID,
		},
	}
	svc := NewService(repo)

	resp, err := svc.RejectInvitation(context.Background(), "pji_reject", "42")
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
	repo := &testProjectInviteRepo{
		userInvitations: []*ProjectInvitation{
			{
				ID:            "7",
				ProjectID:     "18",
				Slug:          "pji_active",
				Role:          memberRoleRead,
				Status:        InvitationStatusActive,
				MaxUses:       1,
				InvitedUserID: &invitedUserID,
			},
			{
				ID:            "8",
				ProjectID:     "19",
				Slug:          "pji_rejected",
				Role:          memberRoleRead,
				Status:        InvitationStatusRejected,
				MaxUses:       1,
				InvitedUserID: &invitedUserID,
			},
		},
		projectSummaries: map[string]*ProjectSummary{
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
	if resp[0].ProjectSlug != "payments" || resp[0].Slug != "pji_active" {
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
