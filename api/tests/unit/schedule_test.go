package unit

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/schedule"
)

func TestEvent_EveryMinute(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).EveryMinute()

	// Should be due at any minute
	now := time.Now()
	if !event.IsDue(now) {
		t.Error("EveryMinute event should be due")
	}
}

func TestEvent_Hourly(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).Hourly()

	// Should be due at minute 0
	atZero := time.Date(2024, 1, 1, 10, 0, 0, 0, time.Local)
	if !event.IsDue(atZero) {
		t.Error("Hourly event should be due at minute 0")
	}

	// Should not be due at other minutes
	atFive := time.Date(2024, 1, 1, 10, 5, 0, 0, time.Local)
	if event.IsDue(atFive) {
		t.Error("Hourly event should not be due at minute 5")
	}
}

func TestEvent_HourlyAt(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).HourlyAt(30)

	// Should be due at minute 30
	at30 := time.Date(2024, 1, 1, 10, 30, 0, 0, time.Local)
	if !event.IsDue(at30) {
		t.Error("HourlyAt(30) event should be due at minute 30")
	}

	// Should not be due at minute 0
	atZero := time.Date(2024, 1, 1, 10, 0, 0, 0, time.Local)
	if event.IsDue(atZero) {
		t.Error("HourlyAt(30) event should not be due at minute 0")
	}
}

func TestEvent_Daily(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).Daily()

	// Should be due at midnight
	midnight := time.Date(2024, 1, 1, 0, 0, 0, 0, time.Local)
	if !event.IsDue(midnight) {
		t.Error("Daily event should be due at midnight")
	}

	// Should not be due at noon
	noon := time.Date(2024, 1, 1, 12, 0, 0, 0, time.Local)
	if event.IsDue(noon) {
		t.Error("Daily event should not be due at noon")
	}
}

func TestEvent_DailyAt(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).DailyAt(9, 30)

	// Should be due at 9:30
	at930 := time.Date(2024, 1, 1, 9, 30, 0, 0, time.Local)
	if !event.IsDue(at930) {
		t.Error("DailyAt(9, 30) event should be due at 9:30")
	}

	// Should not be due at 10:30
	at1030 := time.Date(2024, 1, 1, 10, 30, 0, 0, time.Local)
	if event.IsDue(at1030) {
		t.Error("DailyAt(9, 30) event should not be due at 10:30")
	}
}

func TestEvent_Weekly(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).Weekly()

	// Should be due on Sunday at midnight
	sunday := time.Date(2024, 1, 7, 0, 0, 0, 0, time.Local) // Sunday
	if !event.IsDue(sunday) {
		t.Error("Weekly event should be due on Sunday at midnight")
	}

	// Should not be due on Monday
	monday := time.Date(2024, 1, 8, 0, 0, 0, 0, time.Local) // Monday
	if event.IsDue(monday) {
		t.Error("Weekly event should not be due on Monday")
	}
}

func TestEvent_Mondays(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).Mondays().At(9, 0)

	// Should be due on Monday at 9:00
	monday := time.Date(2024, 1, 8, 9, 0, 0, 0, time.Local) // Monday
	if !event.IsDue(monday) {
		t.Error("Mondays event should be due on Monday at 9:00")
	}

	// Should not be due on Tuesday
	tuesday := time.Date(2024, 1, 9, 9, 0, 0, 0, time.Local) // Tuesday
	if event.IsDue(tuesday) {
		t.Error("Mondays event should not be due on Tuesday")
	}
}

func TestEvent_Weekdays(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).Weekdays().At(9, 0)

	// Should be due on Wednesday
	wednesday := time.Date(2024, 1, 10, 9, 0, 0, 0, time.Local) // Wednesday
	if !event.IsDue(wednesday) {
		t.Error("Weekdays event should be due on Wednesday")
	}

	// Should not be due on Saturday
	saturday := time.Date(2024, 1, 13, 9, 0, 0, 0, time.Local) // Saturday
	if event.IsDue(saturday) {
		t.Error("Weekdays event should not be due on Saturday")
	}
}

func TestEvent_Weekends(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).Weekends().At(10, 0)

	// Should be due on Saturday
	saturday := time.Date(2024, 1, 13, 10, 0, 0, 0, time.Local) // Saturday
	if !event.IsDue(saturday) {
		t.Error("Weekends event should be due on Saturday")
	}

	// Should not be due on Monday
	monday := time.Date(2024, 1, 8, 10, 0, 0, 0, time.Local) // Monday
	if event.IsDue(monday) {
		t.Error("Weekends event should not be due on Monday")
	}
}

func TestEvent_EveryFiveMinutes(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).EveryFiveMinutes()

	// Should be due at minute 0, 5, 10, etc.
	at0 := time.Date(2024, 1, 1, 10, 0, 0, 0, time.Local)
	if !event.IsDue(at0) {
		t.Error("EveryFiveMinutes should be due at minute 0")
	}

	at5 := time.Date(2024, 1, 1, 10, 5, 0, 0, time.Local)
	if !event.IsDue(at5) {
		t.Error("EveryFiveMinutes should be due at minute 5")
	}

	at3 := time.Date(2024, 1, 1, 10, 3, 0, 0, time.Local)
	if event.IsDue(at3) {
		t.Error("EveryFiveMinutes should not be due at minute 3")
	}
}

func TestEvent_Monthly(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).Monthly()

	// Should be due on the 1st at midnight
	first := time.Date(2024, 2, 1, 0, 0, 0, 0, time.Local)
	if !event.IsDue(first) {
		t.Error("Monthly event should be due on the 1st")
	}

	// Should not be due on the 15th
	fifteenth := time.Date(2024, 2, 15, 0, 0, 0, 0, time.Local)
	if event.IsDue(fifteenth) {
		t.Error("Monthly event should not be due on the 15th")
	}
}

func TestEvent_Run(t *testing.T) {
	var executed bool

	event := schedule.Call("test", func(ctx context.Context) error {
		executed = true
		return nil
	})

	ctx := context.Background()
	err := event.Run(ctx)

	if err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	if !executed {
		t.Error("Task should have been executed")
	}
}

func TestEvent_WithoutOverlapping(t *testing.T) {
	var counter int32

	event := schedule.Call("test", func(ctx context.Context) error {
		atomic.AddInt32(&counter, 1)
		time.Sleep(100 * time.Millisecond)
		return nil
	}).WithoutOverlapping()

	ctx := context.Background()

	// Start first run in background
	go event.Run(ctx)
	time.Sleep(10 * time.Millisecond)

	// Second run should be skipped
	event.Run(ctx)

	time.Sleep(150 * time.Millisecond)

	if atomic.LoadInt32(&counter) != 1 {
		t.Errorf("Expected 1 execution with WithoutOverlapping, got %d", counter)
	}
}

func TestEvent_Callbacks(t *testing.T) {
	var beforeCalled, afterCalled, successCalled bool

	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).Before(func() {
		beforeCalled = true
	}).After(func() {
		afterCalled = true
	}).OnSuccess(func() {
		successCalled = true
	})

	ctx := context.Background()
	event.Run(ctx)

	if !beforeCalled {
		t.Error("Before callback should have been called")
	}
	if !afterCalled {
		t.Error("After callback should have been called")
	}
	if !successCalled {
		t.Error("OnSuccess callback should have been called")
	}
}

func TestScheduler_Register(t *testing.T) {
	scheduler := schedule.New()

	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	})

	scheduler.Register(event)

	events := scheduler.Events()
	if len(events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(events))
	}
}

func TestScheduler_DueEvents(t *testing.T) {
	scheduler := schedule.New()

	// Event that's always due
	event1 := schedule.Call("always", func(ctx context.Context) error {
		return nil
	}).EveryMinute()

	// Event that's never due (at a specific time)
	event2 := schedule.Call("specific", func(ctx context.Context) error {
		return nil
	}).DailyAt(25, 0) // Invalid hour, never due

	scheduler.Register(event1)
	scheduler.Register(event2)

	now := time.Now()
	due := scheduler.DueEvents(now)

	if len(due) != 1 {
		t.Errorf("Expected 1 due event, got %d", len(due))
	}
}

func TestScheduler_Call(t *testing.T) {
	scheduler := schedule.New()

	event := scheduler.Call("inline", func(ctx context.Context) error {
		return nil
	}).EveryMinute()

	if event.Name() != "inline" {
		t.Errorf("Expected name 'inline', got '%s'", event.Name())
	}

	events := scheduler.Events()
	if len(events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(events))
	}
}

func TestScheduler_Clear(t *testing.T) {
	scheduler := schedule.New()

	scheduler.Call("test1", func(ctx context.Context) error { return nil })
	scheduler.Call("test2", func(ctx context.Context) error { return nil })

	scheduler.Clear()

	events := scheduler.Events()
	if len(events) != 0 {
		t.Errorf("Expected 0 events after clear, got %d", len(events))
	}
}

func TestScheduler_Run(t *testing.T) {
	scheduler := schedule.New()
	var executed bool

	scheduler.Call("test", func(ctx context.Context) error {
		executed = true
		return nil
	}).EveryMinute()

	ctx := context.Background()
	scheduler.Run(ctx)

	if !executed {
		t.Error("Scheduled task should have been executed")
	}
}

func TestEvent_TwiceDaily(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).TwiceDaily(8, 18)

	// Should be due at 8:00
	at8 := time.Date(2024, 1, 1, 8, 0, 0, 0, time.Local)
	if !event.IsDue(at8) {
		t.Error("TwiceDaily should be due at 8:00")
	}

	// Should be due at 18:00
	at18 := time.Date(2024, 1, 1, 18, 0, 0, 0, time.Local)
	if !event.IsDue(at18) {
		t.Error("TwiceDaily should be due at 18:00")
	}

	// Should not be due at 12:00
	at12 := time.Date(2024, 1, 1, 12, 0, 0, 0, time.Local)
	if event.IsDue(at12) {
		t.Error("TwiceDaily should not be due at 12:00")
	}
}

func TestGlobal_Schedule(t *testing.T) {
	// Clear any existing events
	schedule.Global().Clear()

	event := schedule.Schedule("global-test", func(ctx context.Context) error {
		return nil
	}).EveryMinute()

	if event.Name() != "global-test" {
		t.Errorf("Expected name 'global-test', got '%s'", event.Name())
	}

	events := schedule.Global().Events()
	if len(events) != 1 {
		t.Errorf("Expected 1 event in global scheduler, got %d", len(events))
	}

	// Cleanup
	schedule.Global().Clear()
}

func TestEvent_RunInBackground(t *testing.T) {
	var executed int32

	event := schedule.Call("bg-test", func(ctx context.Context) error {
		atomic.AddInt32(&executed, 1)
		return nil
	}).RunInBackground()

	ctx := context.Background()
	event.Run(ctx)

	// Give background task time to complete
	time.Sleep(50 * time.Millisecond)

	if atomic.LoadInt32(&executed) != 1 {
		t.Error("Background task should have been executed")
	}
}

func TestEvent_Yearly(t *testing.T) {
	event := schedule.Call("test", func(ctx context.Context) error {
		return nil
	}).Yearly()

	// Should be due on January 1st at midnight
	jan1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.Local)
	if !event.IsDue(jan1) {
		t.Error("Yearly event should be due on January 1st")
	}

	// Should not be due on February 1st
	feb1 := time.Date(2024, 2, 1, 0, 0, 0, 0, time.Local)
	if event.IsDue(feb1) {
		t.Error("Yearly event should not be due on February 1st")
	}
}
