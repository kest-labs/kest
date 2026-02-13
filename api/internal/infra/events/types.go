// Package events provides an enhanced event system with metadata, priority-based
// subscriptions, wildcard matching, and middleware support.
package events

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/kest-labs/kest/api/pkg/events"
)

// Event represents a domain event with metadata support
type Event interface {
	events.Event
	// Metadata returns event metadata for tracing and correlation
	Metadata() EventMetadata
}

// EventMetadata contains event metadata for tracing and correlation
type EventMetadata struct {
	ID            string    // Unique event ID (UUID)
	CorrelationID string    // For tracing related events across services
	CausationID   string    // ID of the event that caused this one
	Timestamp     time.Time // When the event was created
	Source        string    // Source module/service that created the event
}

// EventHandler processes events
type EventHandler func(ctx context.Context, event Event) error

// Subscription represents an active subscription that can be cancelled
type Subscription interface {
	// Unsubscribe removes this subscription
	Unsubscribe()
	// EventName returns the event pattern this subscription listens to
	EventName() string
	// ID returns the unique subscription identifier
	ID() string
}

// SubscribeOption configures subscription behavior
type SubscribeOption func(*subscribeOptions)

// subscribeOptions holds subscription configuration
type subscribeOptions struct {
	priority int
	async    bool
}

// WithPriority sets the handler priority (higher values execute first)
func WithPriority(priority int) SubscribeOption {
	return func(o *subscribeOptions) {
		o.priority = priority
	}
}

// WithAsync marks the handler to be executed asynchronously
func WithAsync() SubscribeOption {
	return func(o *subscribeOptions) {
		o.async = true
	}
}

// BaseEvent provides common event fields with automatic metadata generation
type BaseEvent struct {
	occurredAt time.Time
	metadata   EventMetadata
}

// OccurredAt returns when the event occurred
func (e BaseEvent) OccurredAt() time.Time {
	return e.occurredAt
}

// Metadata returns the event metadata
func (e BaseEvent) Metadata() EventMetadata {
	return e.metadata
}

// WrappedEvent wraps a simple events.Event to satisfy the infra.Event interface
type WrappedEvent struct {
	events.Event
	metadata EventMetadata
}

func (e WrappedEvent) Metadata() EventMetadata {
	return e.metadata
}

// Wrap converts a simple event to an infra event
func Wrap(e events.Event) Event {
	if ie, ok := e.(Event); ok {
		return ie
	}
	return WrappedEvent{
		Event: e,
		metadata: EventMetadata{
			ID:        uuid.New().String(),
			Timestamp: e.OccurredAt(),
		},
	}
}

// NewBaseEvent creates a new base event with auto-generated metadata
func NewBaseEvent() BaseEvent {
	now := time.Now()
	return BaseEvent{
		occurredAt: now,
		metadata: EventMetadata{
			ID:        uuid.New().String(),
			Timestamp: now,
		},
	}
}

// NewBaseEventWithSource creates a new base event with a specified source
func NewBaseEventWithSource(source string) BaseEvent {
	e := NewBaseEvent()
	e.metadata.Source = source
	return e
}

// NewBaseEventWithCorrelation creates a new base event with correlation context
func NewBaseEventWithCorrelation(correlationID, causationID, source string) BaseEvent {
	e := NewBaseEvent()
	e.metadata.CorrelationID = correlationID
	e.metadata.CausationID = causationID
	e.metadata.Source = source
	return e
}

// SetCorrelationID sets the correlation ID for tracing related events
func (e *BaseEvent) SetCorrelationID(id string) {
	e.metadata.CorrelationID = id
}

// SetCausationID sets the causation ID (the event that caused this one)
func (e *BaseEvent) SetCausationID(id string) {
	e.metadata.CausationID = id
}

// SetSource sets the source module/service
func (e *BaseEvent) SetSource(source string) {
	e.metadata.Source = source
}

// handlerEntry represents a registered handler with its configuration
type handlerEntry struct {
	id       string
	pattern  string
	handler  EventHandler
	priority int
	async    bool
}

// subscription implements the Subscription interface
type subscription struct {
	id      string
	pattern string
	bus     *EventBus
}

// Unsubscribe removes this subscription from the event bus
func (s *subscription) Unsubscribe() {
	if s.bus != nil {
		s.bus.unsubscribeByID(s.id)
	}
}

// EventName returns the event pattern this subscription listens to
func (s *subscription) EventName() string {
	return s.pattern
}

// ID returns the unique subscription identifier
func (s *subscription) ID() string {
	return s.id
}
