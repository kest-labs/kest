package event

import (
	"context"
	"fmt"
	"time"

	"github.com/kest-labs/kest/api/internal/modules/envelope"
)

// Service defines the business logic for events
type Service interface {
	Process(ctx context.Context, projectID uint, event *envelope.Event) error
}

type service struct {
	repo Repository
}

// NewService creates a new event service
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// Process implements ingest.EventProcessor
func (s *service) Process(ctx context.Context, projectID uint, event *envelope.Event) error {
	// 1. Validate event (ensure required fields)
	if event.EventID == "" {
		return fmt.Errorf("missing event_id")
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}

	// 2. Save to ClickHouse
	return s.repo.Save(ctx, projectID, event)
}
