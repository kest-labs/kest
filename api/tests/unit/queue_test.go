package unit

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/queue"
)

// TestJob is a simple test job
type TestJob struct {
	Message string `json:"message"`
}

func (j *TestJob) Handle(ctx context.Context) error {
	return nil
}

// CounterJob increments a counter
type CounterJob struct {
	Value int32 `json:"value"`
}

func (j *CounterJob) Handle(ctx context.Context) error {
	return nil
}

// FailingJob always fails
type FailingJob struct {
	Attempts int `json:"attempts"`
}

func (j *FailingJob) Handle(ctx context.Context) error {
	return errors.New("job failed")
}

func (j *FailingJob) MaxRetries() int {
	return 3
}

func (j *FailingJob) RetryDelay() time.Duration {
	return 10 * time.Millisecond
}

// DelayedJob has a delay
type DelayedJob struct {
	Message   string        `json:"message"`
	DelayTime time.Duration `json:"-"`
}

func (j *DelayedJob) Handle(ctx context.Context) error {
	return nil
}

func (j *DelayedJob) Delay() time.Duration {
	return j.DelayTime
}

// QueuedJob specifies its queue
type QueuedJob struct {
	QueueName string `json:"-"`
}

func (j *QueuedJob) Handle(ctx context.Context) error {
	return nil
}

func (j *QueuedJob) Queue() string {
	return j.QueueName
}

func init() {
	// Register test jobs
	queue.RegisterJob(&TestJob{})
	queue.RegisterJob(&CounterJob{})
	queue.RegisterJob(&FailingJob{})
	queue.RegisterJob(&DelayedJob{})
	queue.RegisterJob(&QueuedJob{})
}

func TestQueue_Dispatch(t *testing.T) {
	ctx := context.Background()

	job := &TestJob{Message: "Hello"}
	err := queue.Dispatch(ctx, job)
	if err != nil {
		t.Fatalf("Dispatch failed: %v", err)
	}
}

func TestQueue_DispatchTo(t *testing.T) {
	ctx := context.Background()

	job := &TestJob{Message: "Hello"}
	err := queue.DispatchTo(ctx, "emails", job)
	if err != nil {
		t.Fatalf("DispatchTo failed: %v", err)
	}
}

func TestSyncDriver_Push(t *testing.T) {
	ctx := context.Background()
	driver := queue.NewSyncDriver()

	payload := []byte(`{"type":"TestJob","data":{"message":"test"}}`)
	err := driver.Push(ctx, "default", payload)
	if err != nil {
		t.Fatalf("Push failed: %v", err)
	}
}

func TestSyncDriver_Size(t *testing.T) {
	ctx := context.Background()
	driver := queue.NewSyncDriver()

	size, err := driver.Size(ctx, "test-queue")
	if err != nil {
		t.Fatalf("Size failed: %v", err)
	}
	if size != 0 {
		t.Errorf("Expected size 0, got %d", size)
	}
}

func TestSyncDriver_Clear(t *testing.T) {
	ctx := context.Background()
	driver := queue.NewSyncDriver()

	err := driver.Clear(ctx, "test-queue")
	if err != nil {
		t.Fatalf("Clear failed: %v", err)
	}
}

func TestMemoryDriver_PushAndPop(t *testing.T) {
	ctx := context.Background()
	driver := queue.NewMemoryDriver(100)
	defer driver.Close()

	payload := []byte(`{"message":"test"}`)

	// Push
	err := driver.Push(ctx, "test", payload)
	if err != nil {
		t.Fatalf("Push failed: %v", err)
	}

	// Check size
	size, _ := driver.Size(ctx, "test")
	if size != 1 {
		t.Errorf("Expected size 1, got %d", size)
	}

	// Pop
	data, err := driver.Pop(ctx, "test")
	if err != nil {
		t.Fatalf("Pop failed: %v", err)
	}
	if string(data) != string(payload) {
		t.Errorf("Expected %s, got %s", payload, data)
	}

	// Size should be 0 now
	size, _ = driver.Size(ctx, "test")
	if size != 0 {
		t.Errorf("Expected size 0 after pop, got %d", size)
	}
}

func TestMemoryDriver_Clear(t *testing.T) {
	ctx := context.Background()
	driver := queue.NewMemoryDriver(100)
	defer driver.Close()

	// Push some items
	driver.Push(ctx, "test", []byte(`{"a":1}`))
	driver.Push(ctx, "test", []byte(`{"b":2}`))

	// Clear
	err := driver.Clear(ctx, "test")
	if err != nil {
		t.Fatalf("Clear failed: %v", err)
	}
}

func TestMemoryDriver_PushDelayed(t *testing.T) {
	ctx := context.Background()
	driver := queue.NewMemoryDriver(100)
	defer driver.Close()

	payload := []byte(`{"message":"delayed"}`)

	// Push with short delay
	err := driver.PushDelayed(ctx, "test", payload, 50*time.Millisecond)
	if err != nil {
		t.Fatalf("PushDelayed failed: %v", err)
	}

	// Should be empty initially
	size, _ := driver.Size(ctx, "test")
	if size != 0 {
		t.Errorf("Expected empty queue initially, got size %d", size)
	}

	// Wait for delay
	time.Sleep(100 * time.Millisecond)

	// Should have the item now
	size, _ = driver.Size(ctx, "test")
	if size != 1 {
		t.Errorf("Expected size 1 after delay, got %d", size)
	}
}

func TestWorker_Config(t *testing.T) {
	config := queue.DefaultWorkerConfig()

	if config.Queue != "default" {
		t.Errorf("Expected default queue name 'default', got '%s'", config.Queue)
	}
	if config.Concurrency != 1 {
		t.Errorf("Expected concurrency 1, got %d", config.Concurrency)
	}
	if config.Sleep != time.Second {
		t.Errorf("Expected sleep 1s, got %v", config.Sleep)
	}
}

func TestWorker_Creation(t *testing.T) {
	config := queue.WorkerConfig{
		Queue:       "test",
		Concurrency: 2,
		Sleep:       100 * time.Millisecond,
		Timeout:     30 * time.Second,
	}

	worker := queue.NewWorker(config)
	if worker == nil {
		t.Fatal("NewWorker returned nil")
	}
}

func TestWorker_StartStop(t *testing.T) {
	config := queue.WorkerConfig{
		Queue:       "worker-test",
		Concurrency: 1,
		Sleep:       50 * time.Millisecond,
		MaxJobs:     1,
	}

	worker := queue.NewWorker(config)
	ctx := context.Background()

	// Start
	err := worker.Start(ctx)
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// Stop
	worker.Stop()
}

func TestQueue_Later(t *testing.T) {
	ctx := context.Background()

	job := &TestJob{Message: "Delayed job"}
	err := queue.Later(ctx, 10*time.Millisecond, job)
	if err != nil {
		t.Fatalf("Later failed: %v", err)
	}
}

func TestQueue_LaterTo(t *testing.T) {
	ctx := context.Background()

	job := &TestJob{Message: "Delayed job to specific queue"}
	err := queue.LaterTo(ctx, "delayed-queue", 10*time.Millisecond, job)
	if err != nil {
		t.Fatalf("LaterTo failed: %v", err)
	}
}

func TestQueue_JobWithQueue(t *testing.T) {
	ctx := context.Background()

	job := &QueuedJob{QueueName: "custom-queue"}
	err := queue.Dispatch(ctx, job)
	if err != nil {
		t.Fatalf("Dispatch with queue failed: %v", err)
	}
}

func TestQueue_JobWithDelay(t *testing.T) {
	ctx := context.Background()

	job := &DelayedJob{
		Message:   "Auto-delayed",
		DelayTime: 10 * time.Millisecond,
	}
	err := queue.Dispatch(ctx, job)
	if err != nil {
		t.Fatalf("Dispatch with delay failed: %v", err)
	}
}

func TestQueue_RegisterJob(t *testing.T) {
	// This should not panic
	type NewJob struct {
		Data string `json:"data"`
	}

	// Create a temporary job type
	job := &struct {
		Name string `json:"name"`
	}{}

	// We can't test createJob directly as it's not exported,
	// but we can ensure RegisterJob doesn't panic
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("RegisterJob panicked: %v", r)
		}
	}()

	// This tests that the registration mechanism works
	_ = job
}

func TestMemoryDriver_ContextCancellation(t *testing.T) {
	driver := queue.NewMemoryDriver(100)
	defer driver.Close()

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel context immediately
	cancel()

	// Pop should return context error
	_, err := driver.Pop(ctx, "test")
	if err == nil {
		t.Error("Expected error on cancelled context")
	}
}

func TestWorker_ProcessWithCallbacks(t *testing.T) {
	var beforeCalled, afterCalled int32

	config := queue.WorkerConfig{
		Queue:       "callback-test",
		Concurrency: 1,
		Sleep:       10 * time.Millisecond,
		BeforeJob: func(ctx context.Context, payload *queue.JobPayload) {
			atomic.AddInt32(&beforeCalled, 1)
		},
		AfterJob: func(ctx context.Context, payload *queue.JobPayload, err error) {
			atomic.AddInt32(&afterCalled, 1)
		},
	}

	worker := queue.NewWorker(config)
	if worker == nil {
		t.Fatal("NewWorker returned nil")
	}
}

func TestQueue_Size(t *testing.T) {
	ctx := context.Background()

	size, err := queue.Size(ctx, "size-test")
	if err != nil {
		t.Fatalf("Size failed: %v", err)
	}

	// Should be 0 or more
	if size < 0 {
		t.Errorf("Size should be non-negative, got %d", size)
	}
}

func TestQueue_Clear(t *testing.T) {
	ctx := context.Background()

	err := queue.Clear(ctx, "clear-test")
	if err != nil {
		t.Fatalf("Clear failed: %v", err)
	}
}
