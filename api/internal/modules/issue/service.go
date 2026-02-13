package issue

import (
	"context"
	"fmt"

	"github.com/kest-labs/kest/api/internal/modules/envelope"
)

// Service defines the business logic for issue management
type Service interface {
	// GetIssue retrieves a single issue with recent events
	GetIssue(ctx context.Context, projectID uint64, fingerprint string) (*IssueDetail, error)

	// ListIssues retrieves issues for a project with filters
	ListIssues(ctx context.Context, projectID uint64, opts ListOptions) (*IssueListResponse, error)

	// ResolveIssue marks an issue as resolved
	ResolveIssue(ctx context.Context, projectID uint64, fingerprint string) error

	// IgnoreIssue marks an issue as ignored
	IgnoreIssue(ctx context.Context, projectID uint64, fingerprint string) error

	// ReopenIssue re-opens a resolved/ignored issue
	ReopenIssue(ctx context.Context, projectID uint64, fingerprint string) error

	// GetIssueEvents retrieves events for a specific issue
	GetIssueEvents(ctx context.Context, projectID uint64, fingerprint string, opts EventListOptions) (*EventListResponse, error)
}

// IssueDetail contains issue with recent events
type IssueDetail struct {
	*Issue
	RecentEvents []*envelope.Event `json:"recent_events"`
}

// IssueListResponse contains paginated issues
type IssueListResponse struct {
	Items   []*Issue `json:"items"`
	Total   int64    `json:"total"`
	Page    int      `json:"page"`
	PerPage int      `json:"per_page"`
}

// EventListResponse contains paginated events
type EventListResponse struct {
	Items   []*envelope.Event `json:"items"`
	Total   int64             `json:"total"`
	Page    int               `json:"page"`
	PerPage int               `json:"per_page"`
}

// service implements Service
type service struct {
	repo Repository
}

// NewService creates a new issue service
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// GetIssue retrieves issue details with recent events
func (s *service) GetIssue(ctx context.Context, projectID uint64, fingerprint string) (*IssueDetail, error) {
	issue, err := s.repo.GetByFingerprint(ctx, projectID, fingerprint)
	if err != nil {
		return nil, fmt.Errorf("failed to get issue: %w", err)
	}

	// Get recent events (latest 10)
	events, _, err := s.repo.GetEvents(ctx, projectID, fingerprint, EventListOptions{
		Page:    1,
		PerPage: 10,
		SortBy:  "timestamp",
		Order:   "desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get recent events: %w", err)
	}

	return &IssueDetail{
		Issue:        issue,
		RecentEvents: events,
	}, nil
}

// ListIssues retrieves issues for a project
func (s *service) ListIssues(ctx context.Context, projectID uint64, opts ListOptions) (*IssueListResponse, error) {
	issues, total, err := s.repo.List(ctx, projectID, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to list issues: %w", err)
	}

	return &IssueListResponse{
		Items:   issues,
		Total:   total,
		Page:    opts.Page,
		PerPage: opts.PerPage,
	}, nil
}

// ResolveIssue marks an issue as resolved
func (s *service) ResolveIssue(ctx context.Context, projectID uint64, fingerprint string) error {
	if err := s.repo.UpdateStatus(ctx, projectID, fingerprint, IssueStatusResolved); err != nil {
		return fmt.Errorf("failed to resolve issue: %w", err)
	}
	return nil
}

// IgnoreIssue marks an issue as ignored
func (s *service) IgnoreIssue(ctx context.Context, projectID uint64, fingerprint string) error {
	if err := s.repo.UpdateStatus(ctx, projectID, fingerprint, IssueStatusIgnored); err != nil {
		return fmt.Errorf("failed to ignore issue: %w", err)
	}
	return nil
}

// ReopenIssue re-opens a resolved or ignored issue
func (s *service) ReopenIssue(ctx context.Context, projectID uint64, fingerprint string) error {
	if err := s.repo.UpdateStatus(ctx, projectID, fingerprint, IssueStatusUnresolved); err != nil {
		return fmt.Errorf("failed to reopen issue: %w", err)
	}
	return nil
}

// GetIssueEvents retrieves events for a specific issue
func (s *service) GetIssueEvents(ctx context.Context, projectID uint64, fingerprint string, opts EventListOptions) (*EventListResponse, error) {
	events, total, err := s.repo.GetEvents(ctx, projectID, fingerprint, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get issue events: %w", err)
	}

	return &EventListResponse{
		Items:   events,
		Total:   total,
		Page:    opts.Page,
		PerPage: opts.PerPage,
	}, nil
}
