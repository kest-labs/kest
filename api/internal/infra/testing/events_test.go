package testing

import (
	"context"
	"testing"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/events"
)

// testEvent for testing
type testEvent struct {
	events.BaseEvent
	name    string
	payload string
}

func (e testEvent) EventName() string {
	return e.name
}

func newTestEvent(name, payload string) testEvent {
	return testEvent{
		BaseEvent: events.NewBaseEvent(),
		name:      name,
		payload:   payload,
	}
}

func TestEventRecorder_Record(t *testing.T) {
	recorder := NewEventRecorder()

	event := newTestEvent("user.created", "payload")
	recorder.Record(event)

	if recorder.Count() != 1 {
		t.Errorf("Expected 1 event, got %d", recorder.Count())
	}
}

func TestEventRecorder_Events(t *testing.T) {
	recorder := NewEventRecorder()

	recorder.Record(newTestEvent("event1", ""))
	recorder.Record(newTestEvent("event2", ""))

	evts := recorder.Events()
	if len(evts) != 2 {
		t.Errorf("Expected 2 events, got %d", len(evts))
	}
}

func TestEventRecorder_EventsNamed(t *testing.T) {
	recorder := NewEventRecorder()

	recorder.Record(newTestEvent("user.created", ""))
	recorder.Record(newTestEvent("user.updated", ""))
	recorder.Record(newTestEvent("user.created", ""))

	evts := recorder.EventsNamed("user.created")
	if len(evts) != 2 {
		t.Errorf("Expected 2 events named 'user.created', got %d", len(evts))
	}
}

func TestEventRecorder_Clear(t *testing.T) {
	recorder := NewEventRecorder()

	recorder.Record(newTestEvent("event", ""))
	recorder.Clear()

	if recorder.Count() != 0 {
		t.Errorf("Expected 0 events after clear, got %d", recorder.Count())
	}
}

func TestEventRecorder_FirstLast(t *testing.T) {
	recorder := NewEventRecorder()

	recorder.Record(newTestEvent("first", ""))
	recorder.Record(newTestEvent("middle", ""))
	recorder.Record(newTestEvent("last", ""))

	if recorder.First().EventName() != "first" {
		t.Errorf("Expected first event to be 'first', got '%s'", recorder.First().EventName())
	}
	if recorder.Last().EventName() != "last" {
		t.Errorf("Expected last event to be 'last', got '%s'", recorder.Last().EventName())
	}
}

func TestEventRecorder_Handler(t *testing.T) {
	recorder := NewEventRecorder()
	handler := recorder.Handler()

	event := newTestEvent("test", "")
	err := handler(context.Background(), event)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if recorder.Count() != 1 {
		t.Errorf("Expected 1 event, got %d", recorder.Count())
	}
}

func TestEventAssertion_AssertPublished(t *testing.T) {
	recorder := NewEventRecorder()
	recorder.Record(newTestEvent("user.created", ""))

	assertion := NewEventAssertion(t, recorder)
	assertion.AssertPublished("user.created")
}

func TestEventAssertion_AssertNotPublished(t *testing.T) {
	recorder := NewEventRecorder()
	recorder.Record(newTestEvent("user.created", ""))

	assertion := NewEventAssertion(t, recorder)
	assertion.AssertNotPublished("user.deleted")
}

func TestEventAssertion_AssertPublishedTimes(t *testing.T) {
	recorder := NewEventRecorder()
	recorder.Record(newTestEvent("user.created", ""))
	recorder.Record(newTestEvent("user.created", ""))

	assertion := NewEventAssertion(t, recorder)
	assertion.AssertPublishedTimes("user.created", 2)
}

func TestEventAssertion_AssertPublishedOnce(t *testing.T) {
	recorder := NewEventRecorder()
	recorder.Record(newTestEvent("user.created", ""))

	assertion := NewEventAssertion(t, recorder)
	assertion.AssertPublishedOnce("user.created")
}

func TestEventAssertion_AssertCount(t *testing.T) {
	recorder := NewEventRecorder()
	recorder.Record(newTestEvent("event1", ""))
	recorder.Record(newTestEvent("event2", ""))

	assertion := NewEventAssertion(t, recorder)
	assertion.AssertCount(2)
}

func TestEventAssertion_AssertEmpty(t *testing.T) {
	recorder := NewEventRecorder()

	assertion := NewEventAssertion(t, recorder)
	assertion.AssertEmpty()
}

func TestEventAssertion_AssertEventsInOrder(t *testing.T) {
	recorder := NewEventRecorder()
	recorder.Record(newTestEvent("first", ""))
	recorder.Record(newTestEvent("second", ""))
	recorder.Record(newTestEvent("third", ""))

	assertion := NewEventAssertion(t, recorder)
	assertion.AssertEventsInOrder("first", "second", "third")
}

func TestEventAssertion_AssertEventBefore(t *testing.T) {
	recorder := NewEventRecorder()
	recorder.Record(newTestEvent("first", ""))
	recorder.Record(newTestEvent("second", ""))

	assertion := NewEventAssertion(t, recorder)
	assertion.AssertEventBefore("first", "second")
}

func TestEventAssertion_AssertEventAfter(t *testing.T) {
	recorder := NewEventRecorder()
	recorder.Record(newTestEvent("first", ""))
	recorder.Record(newTestEvent("second", ""))

	assertion := NewEventAssertion(t, recorder)
	assertion.AssertEventAfter("second", "first")
}

func TestEventAssertion_WaitForEvent(t *testing.T) {
	recorder := NewEventRecorder()

	// Record event in background
	go func() {
		time.Sleep(20 * time.Millisecond)
		recorder.Record(newTestEvent("delayed", ""))
	}()

	assertion := NewEventAssertion(t, recorder)
	assertion.WaitForEvent("delayed", 100*time.Millisecond)
}

func TestEventAssertion_WaitForCount(t *testing.T) {
	recorder := NewEventRecorder()

	// Record events in background
	go func() {
		for i := 0; i < 3; i++ {
			time.Sleep(10 * time.Millisecond)
			recorder.Record(newTestEvent("event", ""))
		}
	}()

	assertion := NewEventAssertion(t, recorder)
	assertion.WaitForCount(3, 100*time.Millisecond)
}

func TestTestEventBus(t *testing.T) {
	bus := NewTestEventBus()

	// Publish an event
	event := newTestEvent("user.created", "test")
	err := bus.Publish(context.Background(), event)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Assert using the built-in recorder
	bus.Assert(t).AssertPublished("user.created")
	bus.Assert(t).AssertCount(1)
}

func TestTestEventBus_Clear(t *testing.T) {
	bus := NewTestEventBus()

	bus.Publish(context.Background(), newTestEvent("event", ""))
	bus.Clear()

	bus.Assert(t).AssertEmpty()
}
