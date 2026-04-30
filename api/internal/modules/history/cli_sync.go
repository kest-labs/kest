package history

import (
	"context"
	"encoding/json"
	"time"

	"github.com/kest-labs/kest/api/internal/modules/project"
)

type CLIHistorySyncInput struct {
	Source   string
	Metadata json.RawMessage
	Entries  []CLIHistorySyncEntryInput
}

type CLIHistorySyncEntryInput struct {
	SourceEventID string
	EventType     string
	OccurredAt    time.Time
	EntityType    string
	EntityID      string
	Action        string
	Message       string
	Data          map[string]interface{}
}

type CLIHistorySyncResult struct {
	Created int
	Updated int
	Skipped int
	Errors  []string
}

func (h *Handler) SyncHistoryFromCLI(ctx context.Context, projectID string, createdBy uint, req *project.CLIHistorySyncRequest) (*project.CLIHistorySyncResponseBody, error) {
	input := &CLIHistorySyncInput{
		Source:   req.Source,
		Metadata: req.Metadata,
		Entries:  make([]CLIHistorySyncEntryInput, 0, len(req.Entries)),
	}

	for _, entry := range req.Entries {
		input.Entries = append(input.Entries, CLIHistorySyncEntryInput{
			SourceEventID: entry.SourceEventID,
			EventType:     entry.EventType,
			OccurredAt:    entry.OccurredAt,
			EntityType:    entry.EntityType,
			EntityID:      entry.EntityID,
			Action:        entry.Action,
			Message:       entry.Message,
			Data:          entry.Data,
		})
	}

	result, err := h.service.SyncHistoryFromCLI(ctx, projectID, createdBy, input)
	if err != nil {
		return nil, err
	}

	return &project.CLIHistorySyncResponseBody{
		Created: result.Created,
		Updated: result.Updated,
		Skipped: result.Skipped,
		Errors:  result.Errors,
	}, nil
}
