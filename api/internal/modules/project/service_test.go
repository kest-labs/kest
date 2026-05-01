package project

import (
	"context"
	"testing"
	"time"
)

type testProjectRepo struct {
	project        *Project
	projectBySlug  map[string]*Project
	updatedProject *Project
	token          *ProjectCLIToken
	tokenHash      string
	lastTouchedAt  *time.Time
}

func (r *testProjectRepo) Create(ctx context.Context, project *Project) error { return nil }
func (r *testProjectRepo) GetByID(ctx context.Context, id string) (*Project, error) {
	if r.project == nil || r.project.ID != id {
		return nil, nil
	}
	return r.project, nil
}
func (r *testProjectRepo) GetBySlug(ctx context.Context, slug string) (*Project, error) {
	if r.projectBySlug == nil {
		return nil, nil
	}
	return r.projectBySlug[slug], nil
}
func (r *testProjectRepo) Update(ctx context.Context, project *Project) error {
	projectCopy := *project
	r.project = &projectCopy
	r.updatedProject = &projectCopy
	return nil
}
func (r *testProjectRepo) Delete(ctx context.Context, id string) error { return nil }
func (r *testProjectRepo) List(ctx context.Context, userID string, offset, limit int) ([]*Project, int64, error) {
	return nil, 0, nil
}
func (r *testProjectRepo) GetStats(ctx context.Context, projectID string) (*ProjectStats, error) {
	return &ProjectStats{}, nil
}
func (r *testProjectRepo) CreateCLIToken(ctx context.Context, token *ProjectCLIToken, tokenHash string) error {
	token.ID = "99"
	token.CreatedAt = time.Now().UTC()
	token.UpdatedAt = token.CreatedAt
	r.token = token
	r.tokenHash = tokenHash
	return nil
}
func (r *testProjectRepo) GetCLITokenByHash(ctx context.Context, tokenHash string) (*ProjectCLIToken, error) {
	if tokenHash != r.tokenHash {
		return nil, nil
	}
	return r.token, nil
}
func (r *testProjectRepo) TouchCLIToken(ctx context.Context, id string, usedAt time.Time) error {
	r.lastTouchedAt = &usedAt
	return nil
}

func TestGenerateCLITokenDefaults(t *testing.T) {
	repo := &testProjectRepo{
		project: &Project{ID: "12", Name: "Catalog API"},
	}
	svc := NewService(repo, nil)

	resp, err := svc.GenerateCLIToken(context.Background(), "12", "7", &GenerateProjectCLITokenRequest{})
	if err != nil {
		t.Fatalf("GenerateCLIToken returned error: %v", err)
	}

	if resp.Token == "" {
		t.Fatal("expected raw token to be returned")
	}
	if resp.TokenType != "bearer" {
		t.Fatalf("expected token type bearer, got %q", resp.TokenType)
	}
	if got, want := resp.TokenInfo.Name, "Catalog API CLI token"; got != want {
		t.Fatalf("expected default name %q, got %q", want, got)
	}
	if len(resp.TokenInfo.Scopes) != 1 || resp.TokenInfo.Scopes[0] != CLITokenScopeSpecWrite {
		t.Fatalf("expected default scope %q, got %#v", CLITokenScopeSpecWrite, resp.TokenInfo.Scopes)
	}
	if repo.tokenHash != hashCLIToken(resp.Token) {
		t.Fatal("expected repo to store hashed token")
	}
	if resp.TokenInfo.TokenPrefix == "" {
		t.Fatal("expected token prefix to be populated")
	}
}

func TestValidateCLITokenSuccessTouchesToken(t *testing.T) {
	rawToken := "kest_pat_example"
	repo := &testProjectRepo{
		project: &Project{ID: "12", Name: "Catalog API"},
		token: &ProjectCLIToken{
			ID:        "5",
			ProjectID: "12",
			CreatedBy: "7",
			Name:      "sync token",
			Scopes:    []string{CLITokenScopeSpecWrite},
		},
		tokenHash: hashCLIToken(rawToken),
	}
	svc := NewService(repo, nil)

	tokenID, createdBy, err := svc.ValidateCLIToken(context.Background(), "12", rawToken, []string{CLITokenScopeSpecWrite})
	if err != nil {
		t.Fatalf("ValidateCLIToken returned error: %v", err)
	}
	if tokenID != "5" || createdBy != "7" {
		t.Fatalf("expected token metadata (5,7), got (%s,%s)", tokenID, createdBy)
	}
	if repo.lastTouchedAt == nil {
		t.Fatal("expected token last_used_at to be updated")
	}
}

func TestValidateCLITokenRejectsScopeMismatchAndExpiry(t *testing.T) {
	expiredAt := time.Now().Add(-time.Hour)
	repo := &testProjectRepo{
		project: &Project{ID: "12", Name: "Catalog API"},
		token: &ProjectCLIToken{
			ID:        "5",
			ProjectID: "12",
			CreatedBy: "7",
			Name:      "expired token",
			Scopes:    []string{CLITokenScopeRunWrite},
			ExpiresAt: &expiredAt,
		},
		tokenHash: hashCLIToken("kest_pat_example"),
	}
	svc := NewService(repo, nil)

	if _, _, err := svc.ValidateCLIToken(context.Background(), "12", "kest_pat_example", []string{CLITokenScopeSpecWrite}); err != ErrCLITokenExpired {
		t.Fatalf("expected ErrCLITokenExpired, got %v", err)
	}

	repo.token.ExpiresAt = nil
	if _, _, err := svc.ValidateCLIToken(context.Background(), "12", "kest_pat_example", []string{CLITokenScopeSpecWrite}); err != ErrCLITokenScopeDenied {
		t.Fatalf("expected ErrCLITokenScopeDenied, got %v", err)
	}
}

func TestUpdateProjectAppliesEditableFields(t *testing.T) {
	repo := &testProjectRepo{
		project: &Project{
			ID:       "12",
			Name:     "Catalog API",
			Slug:     "catalog-api",
			Platform: "go",
			Status:   1,
		},
	}
	svc := NewService(repo, nil)
	inactive := 0

	project, err := svc.Update(context.Background(), "12", &UpdateProjectRequest{
		Name:     "Catalog Admin API",
		Platform: "python",
		Status:   &inactive,
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	if project.Name != "Catalog Admin API" {
		t.Fatalf("expected updated name, got %q", project.Name)
	}
	if project.Slug != "catalog-api" {
		t.Fatalf("expected slug to remain unchanged, got %q", project.Slug)
	}
	if project.Platform != "python" {
		t.Fatalf("expected updated platform, got %q", project.Platform)
	}
	if project.Status != inactive {
		t.Fatalf("expected updated status %d, got %d", inactive, project.Status)
	}
	if repo.updatedProject == nil || repo.updatedProject.Slug != "catalog-api" {
		t.Fatal("expected repository update to preserve the original slug")
	}
}
