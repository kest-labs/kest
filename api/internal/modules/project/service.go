package project

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/kest-labs/kest/api/internal/modules/member"
)

// Common errors
var (
	ErrProjectNotFound   = errors.New("project not found")
	ErrSlugAlreadyExists = errors.New("project slug already exists")
	ErrInvalidPublicKey  = errors.New("invalid public key")
	ErrProjectDisabled   = errors.New("project is disabled")
)

// Service defines the interface for project business logic
type Service interface {
	Create(ctx context.Context, userID uint, req *CreateProjectRequest) (*Project, error)
	GetByID(ctx context.Context, id uint) (*Project, error)
	GetByPublicKey(ctx context.Context, publicKey string) (*Project, error)
	ValidateKey(ctx context.Context, projectID string, publicKey string) (*Project, error)
	Update(ctx context.Context, id uint, req *UpdateProjectRequest) (*Project, error)
	Delete(ctx context.Context, id uint) error
	List(ctx context.Context, page, perPage int) ([]*Project, int64, error)
	GetStats(ctx context.Context, projectID uint) (*ProjectStats, error)
}

// service implements Service interface
type service struct {
	repo          Repository
	memberService member.Service
}

// NewService creates a new project service
func NewService(repo Repository, memberService member.Service) Service {
	return &service{
		repo:          repo,
		memberService: memberService,
	}
}

func (s *service) Create(ctx context.Context, userID uint, req *CreateProjectRequest) (*Project, error) {
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

	// Create project with generated keys
	project := &Project{
		Name:               req.Name,
		Slug:               slug,
		PublicKey:          GenerateKey(),
		SecretKey:          GenerateKey(),
		Platform:           req.Platform,
		Status:             1, // Active by default
		RateLimitPerMinute: 1000,
	}

	if err := s.repo.Create(ctx, project); err != nil {
		return nil, err
	}

	// Auto-assign creator as Owner
	_, err = s.memberService.AddMember(ctx, project.ID, &member.AddMemberRequest{
		UserID: userID,
		Role:   member.RoleOwner,
	})
	if err != nil {
		// Rollback project creation? For now, we just log or return error
		return nil, fmt.Errorf("failed to assign owner: %w", err)
	}

	return project, nil
}

func (s *service) GetByID(ctx context.Context, id uint) (*Project, error) {
	project, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrProjectNotFound
	}
	return project, nil
}

func (s *service) GetByPublicKey(ctx context.Context, publicKey string) (*Project, error) {
	project, err := s.repo.GetByPublicKey(ctx, publicKey)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrProjectNotFound
	}
	return project, nil
}

// ValidateKey validates that the project ID and public key match
// This is the core authentication method for SDK requests
func (s *service) ValidateKey(ctx context.Context, projectID string, publicKey string) (*Project, error) {
	if publicKey == "" {
		return nil, ErrInvalidPublicKey
	}

	// Get project by public key
	project, err := s.repo.GetByPublicKey(ctx, publicKey)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrProjectNotFound
	}

	// Verify project ID matches
	id, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil || uint(id) != project.ID {
		return nil, ErrProjectNotFound
	}

	// Check if project is active
	if project.Status != 1 {
		return nil, ErrProjectDisabled
	}

	return project, nil
}

func (s *service) Update(ctx context.Context, id uint, req *UpdateProjectRequest) (*Project, error) {
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
	if req.RateLimitPerMinute != nil {
		project.RateLimitPerMinute = *req.RateLimitPerMinute
	}

	if err := s.repo.Update(ctx, project); err != nil {
		return nil, err
	}

	return project, nil
}

func (s *service) Delete(ctx context.Context, id uint) error {
	project, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if project == nil {
		return ErrProjectNotFound
	}

	return s.repo.Delete(ctx, id)
}

func (s *service) List(ctx context.Context, page, perPage int) ([]*Project, int64, error) {
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
	return s.repo.List(ctx, offset, perPage)
}

func (s *service) GetStats(ctx context.Context, projectID uint) (*ProjectStats, error) {
	return s.repo.GetStats(ctx, projectID)
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
		slug = fmt.Sprintf("project-%s", GenerateKey()[:8])
	}

	return slug
}
