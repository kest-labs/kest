package testing

import (
	"context"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/events"
)

// EventRecorder records events for testing
type EventRecorder struct {
	mu     sync.RWMutex
	events []events.Event
}

// NewEventRecorder creates a new event recorder
func NewEventRecorder() *EventRecorder {
	return &EventRecorder{
		events: make([]events.Event, 0),
	}
}

// Record records an event
func (r *EventRecorder) Record(event events.Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, event)
}

// Handler returns an event handler that records events
func (r *EventRecorder) Handler() events.EventHandler {
	return func(ctx context.Context, event events.Event) error {
		r.Record(event)
		return nil
	}
}

// Events returns all recorded events
func (r *EventRecorder) Events() []events.Event {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]events.Event, len(r.events))
	copy(result, r.events)
	return result
}

// EventsNamed returns events with the specified name
func (r *EventRecorder) EventsNamed(name string) []events.Event {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []events.Event
	for _, e := range r.events {
		if e.EventName() == name {
			result = append(result, e)
		}
	}
	return result
}

// Count returns the number of recorded events
func (r *EventRecorder) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.events)
}

// CountNamed returns the number of events with the specified name
func (r *EventRecorder) CountNamed(name string) int {
	return len(r.EventsNamed(name))
}

// Clear removes all recorded events
func (r *EventRecorder) Clear() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = make([]events.Event, 0)
}

// Last returns the last recorded event
func (r *EventRecorder) Last() events.Event {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.events) == 0 {
		return nil
	}
	return r.events[len(r.events)-1]
}

// First returns the first recorded event
func (r *EventRecorder) First() events.Event {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.events) == 0 {
		return nil
	}
	return r.events[0]
}

// EventAssertion provides assertions for events
type EventAssertion struct {
	t        *testing.T
	recorder *EventRecorder
}

// NewEventAssertion creates a new event assertion helper
func NewEventAssertion(t *testing.T, recorder *EventRecorder) *EventAssertion {
	return &EventAssertion{t: t, recorder: recorder}
}

// AssertPublished asserts that an event with the given name was published
func (a *EventAssertion) AssertPublished(eventName string) *EventAssertion {
	if a.recorder.CountNamed(eventName) == 0 {
		a.t.Errorf("Expected event %q to be published, but it was not", eventName)
	}
	return a
}

// AssertNotPublished asserts that an event with the given name was not published
func (a *EventAssertion) AssertNotPublished(eventName string) *EventAssertion {
	if a.recorder.CountNamed(eventName) > 0 {
		a.t.Errorf("Expected event %q to not be published, but it was", eventName)
	}
	return a
}

// AssertPublishedTimes asserts that an event was published a specific number of times
func (a *EventAssertion) AssertPublishedTimes(eventName string, times int) *EventAssertion {
	count := a.recorder.CountNamed(eventName)
	if count != times {
		a.t.Errorf("Expected event %q to be published %d times, but was published %d times",
			eventName, times, count)
	}
	return a
}

// AssertPublishedOnce asserts that an event was published exactly once
func (a *EventAssertion) AssertPublishedOnce(eventName string) *EventAssertion {
	return a.AssertPublishedTimes(eventName, 1)
}

// AssertCount asserts the total number of events
func (a *EventAssertion) AssertCount(expected int) *EventAssertion {
	count := a.recorder.Count()
	if count != expected {
		a.t.Errorf("Expected %d events, got %d", expected, count)
	}
	return a
}

// AssertEmpty asserts that no events were published
func (a *EventAssertion) AssertEmpty() *EventAssertion {
	return a.AssertCount(0)
}

// AssertWithPayload asserts that an event was published with a specific payload
func (a *EventAssertion) AssertWithPayload(eventName string, expected interface{}) *EventAssertion {
	evts := a.recorder.EventsNamed(eventName)
	if len(evts) == 0 {
		a.t.Errorf("Expected event %q to be published, but it was not", eventName)
		return a
	}

	for _, e := range evts {
		if reflect.DeepEqual(e, expected) {
			return a
		}
	}

	a.t.Errorf("Expected event %q with payload %v, but no matching event found", eventName, expected)
	return a
}

// AssertEventsInOrder asserts that events were published in a specific order
func (a *EventAssertion) AssertEventsInOrder(eventNames ...string) *EventAssertion {
	allEvents := a.recorder.Events()

	if len(allEvents) < len(eventNames) {
		a.t.Errorf("Expected at least %d events, got %d", len(eventNames), len(allEvents))
		return a
	}

	eventIndex := 0
	for _, e := range allEvents {
		if eventIndex >= len(eventNames) {
			break
		}
		if e.EventName() == eventNames[eventIndex] {
			eventIndex++
		}
	}

	if eventIndex != len(eventNames) {
		a.t.Errorf("Events not in expected order. Expected: %v", eventNames)
	}
	return a
}

// AssertEventBefore asserts that eventA was published before eventB
func (a *EventAssertion) AssertEventBefore(eventA, eventB string) *EventAssertion {
	allEvents := a.recorder.Events()

	indexA := -1
	indexB := -1

	for i, e := range allEvents {
		if e.EventName() == eventA && indexA == -1 {
			indexA = i
		}
		if e.EventName() == eventB && indexB == -1 {
			indexB = i
		}
	}

	if indexA == -1 {
		a.t.Errorf("Event %q was not published", eventA)
		return a
	}
	if indexB == -1 {
		a.t.Errorf("Event %q was not published", eventB)
		return a
	}
	if indexA >= indexB {
		a.t.Errorf("Expected event %q to be published before %q", eventA, eventB)
	}
	return a
}

// AssertEventAfter asserts that eventA was published after eventB
func (a *EventAssertion) AssertEventAfter(eventA, eventB string) *EventAssertion {
	return a.AssertEventBefore(eventB, eventA)
}

// AssertCorrelation asserts that events share a correlation ID
func (a *EventAssertion) AssertCorrelation(eventNames ...string) *EventAssertion {
	if len(eventNames) < 2 {
		return a
	}

	var correlationID string
	for _, name := range eventNames {
		evts := a.recorder.EventsNamed(name)
		if len(evts) == 0 {
			a.t.Errorf("Event %q was not published", name)
			return a
		}

		meta := evts[0].Metadata()
		if correlationID == "" {
			correlationID = meta.CorrelationID
		} else if meta.CorrelationID != correlationID {
			a.t.Errorf("Events do not share correlation ID. Expected %q, got %q for event %q",
				correlationID, meta.CorrelationID, name)
			return a
		}
	}
	return a
}

// WaitForEvent waits for an event to be published within a timeout
func (a *EventAssertion) WaitForEvent(eventName string, timeout time.Duration) *EventAssertion {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if a.recorder.CountNamed(eventName) > 0 {
			return a
		}
		time.Sleep(10 * time.Millisecond)
	}
	a.t.Errorf("Timed out waiting for event %q", eventName)
	return a
}

// WaitForCount waits for a specific number of events within a timeout
func (a *EventAssertion) WaitForCount(count int, timeout time.Duration) *EventAssertion {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if a.recorder.Count() >= count {
			return a
		}
		time.Sleep(10 * time.Millisecond)
	}
	a.t.Errorf("Timed out waiting for %d events, got %d", count, a.recorder.Count())
	return a
}

// TestEventBus creates an event bus with a recorder attached
type TestEventBus struct {
	*events.EventBus
	Recorder *EventRecorder
}

// NewTestEventBus creates a new test event bus with recording
func NewTestEventBus() *TestEventBus {
	bus := events.NewEventBus()
	recorder := NewEventRecorder()

	// Subscribe recorder to all events
	bus.Subscribe("*", recorder.Handler())

	return &TestEventBus{
		EventBus: bus,
		Recorder: recorder,
	}
}

// Assert returns an event assertion helper
func (b *TestEventBus) Assert(t *testing.T) *EventAssertion {
	return NewEventAssertion(t, b.Recorder)
}

// Clear clears the recorder
func (b *TestEventBus) Clear() {
	b.Recorder.Clear()
}
