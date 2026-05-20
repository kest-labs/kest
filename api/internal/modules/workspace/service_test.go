package workspace

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

type testWorkspaceRepo struct {
	workspace     *WorkspacePO
	token         *WorkspaceCLIToken
	tokenHash     string
	lastTouchedAt *time.Time
}

func (r *testWorkspaceRepo) Create(workspace *WorkspacePO) error { return nil }
func (r *testWorkspaceRepo) Update(workspace *WorkspacePO) error {
	r.workspace = workspace
	return nil
}
func (r *testWorkspaceRepo) Delete(id string) error              { return nil }
func (r *testWorkspaceRepo) FindByID(id string) (*WorkspacePO, error) {
	if r.workspace == nil || r.workspace.ID != id {
		return nil, nil
	}
	return r.workspace, nil
}
func (r *testWorkspaceRepo) FindBySlug(slug string) (*WorkspacePO, error) { return nil, nil }
func (r *testWorkspaceRepo) FindByOwnerID(ownerID string) ([]*WorkspacePO, error) {
	return nil, nil
}
func (r *testWorkspaceRepo) ListByUserID(userID string, isSuperAdmin bool) ([]*WorkspacePO, error) {
	return nil, nil
}
func (r *testWorkspaceRepo) AddMember(member *WorkspaceMemberPO) error { return nil }
func (r *testWorkspaceRepo) RemoveMember(workspaceID, userID string) error {
	return nil
}
func (r *testWorkspaceRepo) UpdateMemberRole(workspaceID, userID string, role string) error {
	return nil
}
func (r *testWorkspaceRepo) FindMember(workspaceID, userID string) (*WorkspaceMemberPO, error) {
	return &WorkspaceMemberPO{WorkspaceID: workspaceID, UserID: userID, Role: RoleOwner}, nil
}
func (r *testWorkspaceRepo) ListMembers(workspaceID string) ([]*WorkspaceMemberPO, error) {
	return nil, nil
}
func (r *testWorkspaceRepo) CreateCLIToken(ctx context.Context, token *WorkspaceCLIToken, tokenHash string) error {
	token.ID = "99"
	token.CreatedAt = time.Now().UTC()
	token.UpdatedAt = token.CreatedAt
	r.token = token
	r.tokenHash = tokenHash
	return nil
}
func (r *testWorkspaceRepo) GetCLITokenByHash(ctx context.Context, tokenHash string) (*WorkspaceCLIToken, error) {
	if tokenHash != r.tokenHash {
		return nil, nil
	}
	return r.token, nil
}
func (r *testWorkspaceRepo) ListCLITokens(ctx context.Context, workspaceID string) ([]*WorkspaceCLIToken, error) {
	return []*WorkspaceCLIToken{r.token}, nil
}
func (r *testWorkspaceRepo) TouchCLIToken(ctx context.Context, id string, usedAt time.Time) error {
	r.lastTouchedAt = &usedAt
	return nil
}
func (r *testWorkspaceRepo) CheckPermission(workspaceID, userID string, isSuperAdmin bool) (string, error) {
	return RoleOwner, nil
}
func (r *testWorkspaceRepo) HasPermission(workspaceID, userID string, requiredRole string, isSuperAdmin bool) (bool, error) {
	return true, nil
}

func TestGenerateCLITokenDefaults(t *testing.T) {
	repo := &testWorkspaceRepo{
		workspace: &WorkspacePO{ID: "12", Name: "Catalog Workspace"},
	}
	svc := NewService(repo)

	resp, err := svc.GenerateCLIToken(context.Background(), "12", "7", &GenerateWorkspaceCLITokenRequest{})
	if err != nil {
		t.Fatalf("GenerateCLIToken returned error: %v", err)
	}

	if resp.Token == "" {
		t.Fatal("expected raw token to be returned")
	}
	if resp.TokenType != "bearer" {
		t.Fatalf("expected token type bearer, got %q", resp.TokenType)
	}
	if got, want := resp.TokenInfo.Name, "Catalog Workspace CLI token"; got != want {
		t.Fatalf("expected default name %q, got %q", want, got)
	}
	if got, want := resp.WorkspaceID, "12"; got != want {
		t.Fatalf("expected workspace id %q, got %q", want, got)
	}
	if got, want := resp.TokenInfo.WorkspaceID, "12"; got != want {
		t.Fatalf("expected token workspace id %q, got %q", want, got)
	}
	if repo.tokenHash != hashCLIToken(resp.Token) {
		t.Fatal("expected repo to store hashed token")
	}
	if resp.TokenInfo.TokenPrefix == "" {
		t.Fatal("expected token prefix to be populated")
	}

	expectedScopes := []string{
		CLITokenScopeCollectionRead,
		CLITokenScopeCollectionRun,
		CLITokenScopeEnvironmentRead,
		CLITokenScopeTestCaseRun,
		CLITokenScopeFlowRun,
	}
	if len(resp.TokenInfo.Scopes) != len(expectedScopes) {
		t.Fatalf("expected %d default scopes, got %#v", len(expectedScopes), resp.TokenInfo.Scopes)
	}
	for i, scope := range expectedScopes {
		if resp.TokenInfo.Scopes[i] != scope {
			t.Fatalf("expected default scopes %#v, got %#v", expectedScopes, resp.TokenInfo.Scopes)
		}
	}
}

func TestGenerateCLITokenRejectsUnsupportedScope(t *testing.T) {
	repo := &testWorkspaceRepo{
		workspace: &WorkspacePO{ID: "12", Name: "Catalog Workspace"},
	}
	svc := NewService(repo)

	_, err := svc.GenerateCLIToken(context.Background(), "12", "7", &GenerateWorkspaceCLITokenRequest{
		Scopes: []string{"spec:write"},
	})
	if err == nil {
		t.Fatal("expected unsupported scope error")
	}
}

func TestValidateCLITokenSuccessTouchesToken(t *testing.T) {
	rawToken := "kest_pat_example"
	repo := &testWorkspaceRepo{
		workspace: &WorkspacePO{ID: "12", Name: "Catalog Workspace"},
		token: &WorkspaceCLIToken{
			ID:          "5",
			WorkspaceID: "12",
			CreatedBy:   "7",
			Name:        "sync token",
			Scopes:      []string{CLITokenScopeCollectionRead},
		},
		tokenHash: hashCLIToken(rawToken),
	}
	svc := NewService(repo)

	tokenID, createdBy, err := svc.ValidateCLIToken(context.Background(), "12", rawToken, []string{CLITokenScopeCollectionRead})
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

func TestValidateCLITokenRejectsWorkspaceMismatchScopeMismatchAndExpiry(t *testing.T) {
	expiredAt := time.Now().Add(-time.Hour)
	repo := &testWorkspaceRepo{
		workspace: &WorkspacePO{ID: "12", Name: "Catalog Workspace"},
		token: &WorkspaceCLIToken{
			ID:          "5",
			WorkspaceID: "12",
			CreatedBy:   "7",
			Name:        "expired token",
			Scopes:      []string{CLITokenScopeCollectionRun},
			ExpiresAt:   &expiredAt,
		},
		tokenHash: hashCLIToken("kest_pat_example"),
	}
	svc := NewService(repo)

	if _, _, err := svc.ValidateCLIToken(context.Background(), "99", "kest_pat_example", []string{CLITokenScopeCollectionRun}); err != ErrCLITokenWorkspaceMismatch {
		t.Fatalf("expected ErrCLITokenWorkspaceMismatch, got %v", err)
	}

	if _, _, err := svc.ValidateCLIToken(context.Background(), "12", "kest_pat_example", []string{CLITokenScopeCollectionRead}); err != ErrCLITokenExpired {
		t.Fatalf("expected ErrCLITokenExpired, got %v", err)
	}

	repo.token.ExpiresAt = nil
	if _, _, err := svc.ValidateCLIToken(context.Background(), "12", "kest_pat_example", []string{CLITokenScopeCollectionRead}); err != ErrCLITokenScopeDenied {
		t.Fatalf("expected ErrCLITokenScopeDenied, got %v", err)
	}
}

func TestUpdateWorkspacePersistsSettings(t *testing.T) {
	repo := &testWorkspaceRepo{
		workspace: &WorkspacePO{
			ID:         "12",
			Name:       "Catalog Workspace",
			OwnerID:    "7",
			Visibility: VisibilityTeam,
		},
	}
	svc := NewService(repo)
	settings := map[string]interface{}{
		"runtime": map[string]interface{}{
			"variables": map[string]interface{}{
				"base_url": "https://api.example.com",
				"token":    "secret",
			},
		},
	}

	workspace, err := svc.UpdateWorkspace("12", &UpdateWorkspaceRequest{
		Settings: &settings,
	}, "7", false)
	if err != nil {
		t.Fatalf("UpdateWorkspace returned error: %v", err)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal([]byte(repo.workspace.Settings), &decoded); err != nil {
		t.Fatalf("expected persisted settings JSON, got %v", err)
	}

	if workspace.Settings == nil {
		t.Fatalf("expected domain workspace settings to be populated")
	}
	runtime, ok := workspace.Settings["runtime"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected runtime settings map, got %#v", workspace.Settings["runtime"])
	}
	variables, ok := runtime["variables"].(map[string]interface{})
	if !ok || variables["base_url"] != "https://api.example.com" {
		t.Fatalf("expected runtime variables to round-trip, got %#v", runtime["variables"])
	}
}
