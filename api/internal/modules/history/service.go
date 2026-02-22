package history

import (
	"context"
	"errors"
)

var (
	ErrHistoryNotFound = errors.New("history record not found")
)

type Service interface {
	Record(ctx context.Context, req *RecordHistoryRequest) (*History, error)
	GetByID(ctx context.Context, id uint) (*History, error)
	List(ctx context.Context, projectID uint, entityType string, entityID uint, page, perPage int) ([]*History, int64, error)
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
		EntityType: req.EntityType,
		EntityID:   req.EntityID,
		ProjectID:  req.ProjectID,
		UserID:     req.UserID,
		Action:     req.Action,
		Data:       req.Data,
		Diff:       req.Diff,
		Message:    req.Message,
	}

	if err := s.repo.Create(ctx, history); err != nil {
		return nil, err
	}

	return history, nil
}

func (s *service) GetByID(ctx context.Context, id uint) (*History, error) {
	history, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if history == nil {
		return nil, ErrHistoryNotFound
	}
	return history, nil
}

func (s *service) List(ctx context.Context, projectID uint, entityType string, entityID uint, page, perPage int) ([]*History, int64, error) {
	return s.repo.ListByEntity(ctx, projectID, entityType, entityID, page, perPage)
}
