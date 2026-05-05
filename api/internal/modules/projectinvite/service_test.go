package projectinvite

import (
	"context"
	"testing"
	"time"
)

type testProjectInviteRepo struct {
	invitation     *ProjectInvitation
	projectSummary *ProjectSummary
	acceptedUserID string
	acceptedAt     *time.Time
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

func (r *testProjectInviteRepo) GetProjectSummary(_ context.Context, _ string) (*ProjectSummary, error) {
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

const (
	memberRoleRead  = "read"
	memberRoleWrite = "write"
)
