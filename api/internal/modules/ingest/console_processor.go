package ingest

import (
	"context"
	"fmt"
	"strings"

	"github.com/kest-labs/kest/api/internal/modules/envelope"
	"github.com/kest-labs/kest/api/pkg/logger"
)

// ConsoleProcessor is a simple event processor that logs to console
// This is used for development/testing before ClickHouse is integrated
type ConsoleProcessor struct{}

// NewConsoleProcessor creates a new console processor
func NewConsoleProcessor() *ConsoleProcessor {
	return &ConsoleProcessor{}
}

// Process logs the event to console
func (p *ConsoleProcessor) Process(ctx context.Context, projectID uint, event *envelope.Event) error {
	// Build a formatted log message
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("\n=== Event Received ===\n"))
	sb.WriteString(fmt.Sprintf("Project ID: %d\n", projectID))
	sb.WriteString(fmt.Sprintf("Event ID:   %s\n", event.EventID))
	sb.WriteString(fmt.Sprintf("Level:      %s\n", event.Level))
	sb.WriteString(fmt.Sprintf("Platform:   %s\n", event.Platform))
	sb.WriteString(fmt.Sprintf("Timestamp:  %s\n", event.Timestamp))

	if event.ServerName != "" {
		sb.WriteString(fmt.Sprintf("Server:     %s\n", event.ServerName))
	}
	if event.Environment != "" {
		sb.WriteString(fmt.Sprintf("Env:        %s\n", event.Environment))
	}
	if event.Release != "" {
		sb.WriteString(fmt.Sprintf("Release:    %s\n", event.Release))
	}

	if event.Message != "" {
		sb.WriteString(fmt.Sprintf("Message:    %s\n", event.Message))
	}

	// Log exceptions
	if len(event.Exception) > 0 {
		sb.WriteString("Exceptions:\n")
		for i, exc := range event.Exception {
			sb.WriteString(fmt.Sprintf("  [%d] %s: %s\n", i, exc.Type, exc.Value))
			if exc.Stacktrace != nil && len(exc.Stacktrace.Frames) > 0 {
				sb.WriteString("      Stack:\n")
				// Show top 5 frames
				frames := exc.Stacktrace.Frames
				for j := len(frames) - 1; j >= 0 && j >= len(frames)-5; j-- {
					f := frames[j]
					sb.WriteString(fmt.Sprintf("        %s:%d in %s\n", f.Filename, f.Lineno, f.Function))
				}
			}
		}
	}

	// Log tags
	if len(event.Tags) > 0 {
		sb.WriteString("Tags:\n")
		for k, v := range event.Tags {
			sb.WriteString(fmt.Sprintf("  %s: %s\n", k, v))
		}
	}

	sb.WriteString("======================\n")

	logger.Info(sb.String())
	return nil
}

// Verify ConsoleProcessor implements EventProcessor
var _ EventProcessor = (*ConsoleProcessor)(nil)
