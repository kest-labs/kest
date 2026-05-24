package project

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
	idpkg "github.com/kest-labs/kest/api/pkg/id"
)

// Common errors
var (
	ErrProjectNotFound   = errors.New("project not found")
	ErrSlugAlreadyExists = errors.New("project slug already exists")
)

// Service defines the interface for project business logic
type Service interface {
	Create(ctx context.Context, userID string, req *CreateProjectRequest) (*Project, error)
	GetByID(ctx context.Context, id string) (*Project, error)
	GetByWorkspaceID(ctx context.Context, workspaceID string) (*Project, error)
	ResolveBackingIDByWorkspaceID(ctx context.Context, workspaceID string) (string, error)
	ResolveWorkspaceIDByBackingID(ctx context.Context, backingID string) (string, error)
	Update(ctx context.Context, id string, req *UpdateProjectRequest) (*Project, error)
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, userID string, page, perPage int) ([]*Project, int64, error)
	GetStats(ctx context.Context, projectID string) (*ProjectStats, error)
}

// service implements Service interface
type service struct {
	repo             Repository
	memberService    member.Service
	workspaceService workspace.Service
}

// NewService creates a new project service
func NewService(repo Repository, memberService member.Service, workspaceService workspace.Service) Service {
	return &service{
		repo:             repo,
		memberService:    memberService,
		workspaceService: workspaceService,
	}
}

func (s *service) Create(ctx context.Context, userID string, req *CreateProjectRequest) (*Project, error) {
	// Generate slug from name if not provided
	slug := req.Slug
	if slug == "" {
		slug = generateSlug(req.Name)
	}

	// Check if slug already exists
	existing, err := s.repo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrSlugAlreadyExists
	}

	// Generate public key
	publicKey, err := generatePublicKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate public key: %w", err)
	}

	projectWorkspace, err := s.createProjectWorkspace(req.Name, slug, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to create project workspace: %w", err)
	}

	// Create project
	project := &Project{
		WorkspaceID: projectWorkspace.ID,
		Name:        req.Name,
		Slug:        slug,
		Platform:    req.Platform,
		PublicKey:   publicKey,
		Status:      1, // Active by default
	}

	if err := s.repo.Create(ctx, project); err != nil {
		_ = s.workspaceService.DeleteWorkspace(projectWorkspace.ID, userID, false)
		return nil, err
	}

	// Auto-assign creator as Owner
	_, err = s.memberService.AddMember(ctx, project.ID, &member.AddMemberRequest{
		UserID: idpkg.Compatible(userID),
		Role:   member.RoleOwner,
	})
	if err != nil {
		_ = s.repo.Delete(ctx, project.ID, projectWorkspace.ID)
		_ = s.workspaceService.DeleteWorkspace(projectWorkspace.ID, userID, false)
		return nil, fmt.Errorf("failed to assign owner: %w", err)
	}

	return project, nil
}

func (s *service) GetByID(ctx context.Context, id string) (*Project, error) {
	project, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrProjectNotFound
	}
	return project, nil
}

func (s *service) GetByWorkspaceID(ctx context.Context, workspaceID string) (*Project, error) {
	project, err := s.repo.GetByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrProjectNotFound
	}
	return project, nil
}

func (s *service) ResolveBackingIDByWorkspaceID(ctx context.Context, workspaceID string) (string, error) {
	backing, err := s.GetByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return "", err
	}
	return backing.ID, nil
}

func (s *service) ResolveWorkspaceIDByBackingID(ctx context.Context, backingID string) (string, error) {
	backing, err := s.GetByID(ctx, backingID)
	if err != nil {
		return "", err
	}
	if backing.WorkspaceID == "" {
		return "", ErrProjectNotFound
	}
	return backing.WorkspaceID, nil
}

func (s *service) Update(ctx context.Context, id string, req *UpdateProjectRequest) (*Project, error) {
	project, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrProjectNotFound
	}

	// Apply updates
	if req.Name != "" {
		project.Name = req.Name
	}
	if req.Platform != "" {
		project.Platform = req.Platform
	}
	if req.Status != nil {
		project.Status = *req.Status
	}

	if err := s.repo.Update(ctx, project); err != nil {
		return nil, err
	}

	return project, nil
}

func (s *service) Delete(ctx context.Context, id string) error {
	backing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if backing == nil {
		return ErrProjectNotFound
	}

	return s.repo.Delete(ctx, id, backing.WorkspaceID)
}

func (s *service) List(ctx context.Context, userID string, page, perPage int) ([]*Project, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	offset := (page - 1) * perPage
	return s.repo.List(ctx, userID, offset, perPage)
}

func (s *service) GetStats(ctx context.Context, projectID string) (*ProjectStats, error) {
	return s.repo.GetStats(ctx, projectID)
}

func (s *service) createProjectWorkspace(name string, baseSlug string, ownerID string) (*workspace.Workspace, error) {
	for attempt := 0; attempt < 5; attempt++ {
		workspaceSlug := buildWorkspaceSlugCandidate(baseSlug, attempt)
		projectWorkspace, err := s.workspaceService.CreateWorkspace(&workspace.CreateWorkspaceRequest{
			Name:       name,
			Slug:       workspaceSlug,
			Type:       workspace.TypePersonal,
			Visibility: workspace.VisibilityPrivate,
		}, ownerID)
		if err == nil {
			return projectWorkspace, nil
		}

		if !isWorkspaceSlugConflict(err) {
			return nil, err
		}
	}

	return nil, errors.New("workspace slug already exists")
}

// generateSlug creates a URL-safe slug from a name
func generateSlug(name string) string {
	// Convert to lowercase
	slug := strings.ToLower(name)

	// Replace spaces with hyphens
	slug = strings.ReplaceAll(slug, " ", "-")

	// Remove non-alphanumeric characters except hyphens
	re := regexp.MustCompile(`[^a-z0-9-]`)
	slug = re.ReplaceAllString(slug, "")

	// Remove duplicate hyphens
	re = regexp.MustCompile(`-+`)
	slug = re.ReplaceAllString(slug, "-")

	// Trim hyphens from ends
	slug = strings.Trim(slug, "-")

	// Limit length
	if len(slug) > 50 {
		slug = slug[:50]
	}

	// Add random suffix if empty
	if slug == "" {
		slug = fmt.Sprintf("workspace-%d", time.Now().UnixNano()%100000000)
	}

	return slug
}

// generatePublicKey generates a random public key for the project
func generatePublicKey() (string, error) {
	bytes := make([]byte, 16) // 16 bytes = 32 hex characters (fits in varchar(64))
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func isWorkspaceSlugConflict(err error) bool {
	return err != nil && strings.Contains(err.Error(), "workspace slug already exists")
}

func buildWorkspaceSlugCandidate(baseSlug string, attempt int) string {
	if attempt == 0 {
		return baseSlug
	}

	suffix := fmt.Sprintf("-%d", attempt+1)
	trimmedBase := strings.Trim(baseSlug, "-")
	maxBaseLength := 50 - len(suffix)
	if maxBaseLength < 1 {
		maxBaseLength = 1
	}
	if len(trimmedBase) > maxBaseLength {
		trimmedBase = strings.Trim(trimmedBase[:maxBaseLength], "-")
	}
	if trimmedBase == "" {
		trimmedBase = "workspace"
	}

	return trimmedBase + suffix
}
