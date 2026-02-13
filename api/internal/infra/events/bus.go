package events

import (
	"context"
	"sort"
	"sync"

	"github.com/google/uuid"
	"github.com/kest-labs/kest/api/pkg/events"
)

// EventBus handles event publishing and subscription with priority support,
// wildcard matching, and middleware
type EventBus struct {
	mu         sync.RWMutex
	handlers   []handlerEntry
	middleware []EventMiddleware
	closed     bool
}

// EventMiddleware wraps event handling for cross-cutting concerns
type EventMiddleware func(next EventHandler) EventHandler

// NewEventBus creates a new event bus
func NewEventBus() *EventBus {
	return &EventBus{
		handlers:   make([]handlerEntry, 0),
		middleware: make([]EventMiddleware, 0),
	}
}

// Subscribe registers a handler for an event pattern with optional configuration.
// Patterns support glob-style matching (e.g., "user.*", "*.created", "*").
// Returns a Subscription that can be used to unsubscribe.
func (b *EventBus) Subscribe(pattern string, handler EventHandler, opts ...SubscribeOption) Subscription {
	options := &subscribeOptions{
		priority: 0,
		async:    false,
	}
	for _, opt := range opts {
		opt(options)
	}

	entry := handlerEntry{
		id:       uuid.New().String(),
		pattern:  pattern,
		handler:  handler,
		priority: options.priority,
		async:    options.async,
	}

	b.mu.Lock()
	b.handlers = append(b.handlers, entry)
	// Sort handlers by priority (higher first)
	sort.SliceStable(b.handlers, func(i, j int) bool {
		return b.handlers[i].priority > b.handlers[j].priority
	})
	b.mu.Unlock()

	return &subscription{
		id:      entry.id,
		pattern: pattern,
		bus:     b,
	}
}

// Unsubscribe removes a subscription by its Subscription interface
func (b *EventBus) Unsubscribe(sub Subscription) {
	b.unsubscribeByID(sub.ID())
}

// unsubscribeByID removes a handler by its unique ID
func (b *EventBus) unsubscribeByID(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	for i, entry := range b.handlers {
		if entry.id == id {
			b.handlers = append(b.handlers[:i], b.handlers[i+1:]...)
			return
		}
	}
}

// Use adds middleware to the event bus. Middleware is executed in order.
func (b *EventBus) Use(middleware ...EventMiddleware) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.middleware = append(b.middleware, middleware...)
}

// Publish sends an event to all matching subscribers synchronously.
// If the event does not satisfy the infra.Event interface, it is automatically wrapped with metadata.
func (b *EventBus) Publish(ctx context.Context, e events.Event) error {
	b.mu.RLock()
	if b.closed {
		b.mu.RUnlock()
		return ErrEventBusClosed
	}

	// Ensure event has metadata by wrapping if necessary
	event := Wrap(e)

	// Find matching handlers
	matchingHandlers := b.findMatchingHandlers(event.EventName())
	middleware := make([]EventMiddleware, len(b.middleware))
	copy(middleware, b.middleware)
	b.mu.RUnlock()

	// Execute handlers in priority order
	for _, entry := range matchingHandlers {
		// Check context cancellation before each handler
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Build middleware chain for this handler
		handler := b.buildMiddlewareChain(entry.handler, middleware)

		if entry.async {
			// Async handlers don't block and errors are not propagated
			go func(h EventHandler, e Event) {
				_ = h(ctx, e)
			}(handler, event)
		} else {
			// Sync handlers block and propagate errors
			if err := handler(ctx, event); err != nil {
				return err
			}
		}
	}

	return nil
}

// PublishAsync sends an event to all matching subscribers asynchronously.
// Does not wait for handlers to complete and does not return errors.
func (b *EventBus) PublishAsync(ctx context.Context, e events.Event) {
	go func() {
		_ = b.Publish(ctx, e)
	}()
}

// findMatchingHandlers returns all handlers that match the event name
func (b *EventBus) findMatchingHandlers(eventName string) []handlerEntry {
	var matching []handlerEntry
	for _, entry := range b.handlers {
		if matchPattern(entry.pattern, eventName) {
			matching = append(matching, entry)
		}
	}
	return matching
}

// buildMiddlewareChain wraps a handler with all middleware
func (b *EventBus) buildMiddlewareChain(handler EventHandler, middleware []EventMiddleware) EventHandler {
	// Apply middleware in reverse order so they execute in registration order
	for i := len(middleware) - 1; i >= 0; i-- {
		handler = middleware[i](handler)
	}
	return handler
}

// HasSubscribers checks if an event has any matching subscribers
func (b *EventBus) HasSubscribers(eventName string) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, entry := range b.handlers {
		if matchPattern(entry.pattern, eventName) {
			return true
		}
	}
	return false
}

// Close closes the event bus, preventing further publishing
func (b *EventBus) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.closed = true
}

// Clear removes all handlers and middleware
func (b *EventBus) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers = make([]handlerEntry, 0)
	b.middleware = make([]EventMiddleware, 0)
}

// HandlerCount returns the number of registered handlers
func (b *EventBus) HandlerCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.handlers)
}
