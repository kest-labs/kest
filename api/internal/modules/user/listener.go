package user

import (
	"context"

	"github.com/kest-labs/kest/api/internal/domain"
	"github.com/kest-labs/kest/api/internal/infra/email"
	"github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/kest-labs/kest/api/pkg/logger"
)

// HandleUserCreated handles the welcome email when a user is created.
// It matches the events.EventHandler signature.
func HandleUserCreated(ctx context.Context, e events.Event) error {
	var user *domain.User

	// Try to get the underlying domain event
	// The infra layer wraps simple domain events in WrappedEvent
	var underlying any = e
	if wrapped, ok := e.(events.WrappedEvent); ok {
		underlying = wrapped.Event
	}

	// Double check the type
	if userEvent, ok := underlying.(domain.UserCreatedEvent); ok {
		user = userEvent.User
	}

	if user == nil {
		return nil
	}

	if err := email.SendWelcomeEmail(user.Email, user.Username); err != nil {
		logger.Error("failed to send welcome email", map[string]any{
			"error": err,
			"user":  user.Username,
		})
		return err
	}

	return nil
}
