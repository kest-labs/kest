package history

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrHistoryNotFound = errors.New("history record not found")
)

type Service interface {
	Record(ctx context.Context, req *RecordHistoryRequest) (*History, error)
	GetByID(ctx context.Context, id string) (*History, error)
	List(ctx context.Context, projectID string, entityType string, entityID string, page, perPage int) ([]*History, int64, error)
	SyncHistoryFromCLI(ctx context.Context, projectID string, createdBy uint, req *CLIHistorySyncInput) (*CLIHistorySyncResult, error)
}

type service struct {
	repo Repository
}

// NewService creates a new history service
func NewService(repo Repository) Service {
	return &service{
		repo: repo,
	}
}

func (s *service) Record(ctx context.Context, req *RecordHistoryRequest) (*History, error) {
	history := &History{
		EntityType:    req.EntityType,
		EntityID:      req.EntityID,
		ProjectID:     req.ProjectID,
		UserID:        req.UserID,
		Source:        defaultHistorySource(strings.TrimSpace(req.Source)),
		SourceEventID: defaultHistorySourceEventID(strings.TrimSpace(req.SourceEventID)),
		Action:        req.Action,
		Data:          req.Data,
		Diff:          req.Diff,
		Message:       req.Message,
	}

	if err := s.repo.Create(ctx, history); err != nil {
		return nil, err
	}

	return history, nil
}

func (s *service) GetByID(ctx context.Context, id string) (*History, error) {
	history, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if history == nil {
		return nil, ErrHistoryNotFound
	}
	return history, nil
}

func (s *service) List(ctx context.Context, projectID string, entityType string, entityID string, page, perPage int) ([]*History, int64, error) {
	return s.repo.ListByEntity(ctx, projectID, entityType, entityID, page, perPage)
}

func (s *service) SyncHistoryFromCLI(ctx context.Context, projectID string, createdBy uint, req *CLIHistorySyncInput) (*CLIHistorySyncResult, error) {
	result := &CLIHistorySyncResult{}

	for _, entry := range req.Entries {
		existing, err := s.repo.GetBySourceEvent(ctx, projectID, req.Source, entry.SourceEventID)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", entry.SourceEventID, err))
			continue
		}
		if existing != nil {
			result.Skipped++
			continue
		}

		history := &History{
			EntityType:    entry.EntityType,
			EntityID:      entry.EntityID,
			ProjectID:     projectID,
			UserID:        createdBy,
			Source:        defaultHistorySource(req.Source),
			SourceEventID: entry.SourceEventID,
			Action:        entry.Action,
			Data:          entry.Data,
			Message:       entry.Message,
			CreatedAt:     entry.OccurredAt.UTC(),
		}

		if err := s.repo.Create(ctx, history); err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) || isDuplicateSourceEventError(err) {
				result.Skipped++
				continue
			}
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", entry.SourceEventID, err))
			continue
		}
		result.Created++
	}

	return result, nil
}

func defaultHistorySource(value string) string {
	if strings.TrimSpace(value) == "" {
		return "web"
	}
	return strings.TrimSpace(value)
}

func defaultHistorySourceEventID(value string) string {
	if strings.TrimSpace(value) == "" {
		return uuid.NewString()
	}
	return strings.TrimSpace(value)
}

func isDuplicateSourceEventError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "duplicate key") || strings.Contains(message, "unique constraint failed")
}
