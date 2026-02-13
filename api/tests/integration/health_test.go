package integration

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/health"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestChecker_Register(t *testing.T) {
	checker := health.New()

	checker.Register("test", health.Up("test check"))

	ctx := context.Background()
	results := checker.Check(ctx)

	if _, ok := results["test"]; !ok {
		t.Error("Expected 'test' check to be registered")
	}
}

func TestChecker_Unregister(t *testing.T) {
	checker := health.New()

	checker.Register("test", health.Up("test check"))
	checker.Unregister("test")

	ctx := context.Background()
	results := checker.Check(ctx)

	if _, ok := results["test"]; ok {
		t.Error("Expected 'test' check to be unregistered")
	}
}

func TestChecker_Check(t *testing.T) {
	checker := health.New()

	checker.Register("up", health.Up("up check"))
	checker.Register("down", health.Down("down check"))

	ctx := context.Background()
	results := checker.Check(ctx)

	if results["up"].Status != health.StatusUp {
		t.Error("Expected 'up' check to be up")
	}
	if results["down"].Status != health.StatusDown {
		t.Error("Expected 'down' check to be down")
	}
}

func TestChecker_IsHealthy(t *testing.T) {
	checker := health.New()

	// All up
	checker.Register("check1", health.Up("ok"))
	checker.Register("check2", health.Up("ok"))

	ctx := context.Background()
	if !checker.IsHealthy(ctx) {
		t.Error("Expected all up checks to be healthy")
	}

	// One down
	checker.Register("check3", health.Down("failed"))
	if checker.IsHealthy(ctx) {
		t.Error("Expected one down check to make unhealthy")
	}
}

func TestChecker_GetHealth(t *testing.T) {
	checker := health.New()

	checker.Register("db", health.Up("database ok"))
	checker.Register("cache", health.Up("cache ok"))

	ctx := context.Background()
	response := checker.GetHealth(ctx)

	if response.Status != health.StatusUp {
		t.Errorf("Expected status up, got %s", response.Status)
	}
	if len(response.Checks) != 2 {
		t.Errorf("Expected 2 checks, got %d", len(response.Checks))
	}
	if response.Timestamp.IsZero() {
		t.Error("Expected timestamp to be set")
	}
}

func TestChecker_GetHealth_Unhealthy(t *testing.T) {
	checker := health.New()

	checker.Register("db", health.Up("database ok"))
	checker.Register("critical", health.Down("service down"))

	ctx := context.Background()
	response := checker.GetHealth(ctx)

	if response.Status != health.StatusDown {
		t.Errorf("Expected status down, got %s", response.Status)
	}
}

func TestCheck_Up(t *testing.T) {
	check := health.Up("all good")
	ctx := context.Background()
	result := check(ctx)

	if result.Status != health.StatusUp {
		t.Errorf("Expected status up, got %s", result.Status)
	}
	if result.Message != "all good" {
		t.Errorf("Expected message 'all good', got '%s'", result.Message)
	}
}

func TestCheck_Down(t *testing.T) {
	check := health.Down("service unavailable")
	ctx := context.Background()
	result := check(ctx)

	if result.Status != health.StatusDown {
		t.Errorf("Expected status down, got %s", result.Status)
	}
	if result.Message != "service unavailable" {
		t.Errorf("Expected message 'service unavailable', got '%s'", result.Message)
	}
}

func TestCheck_Custom(t *testing.T) {
	// Passing check
	passingCheck := health.Custom(func(ctx context.Context) error {
		return nil
	})
	ctx := context.Background()
	result := passingCheck(ctx)
	if result.Status != health.StatusUp {
		t.Error("Expected passing check to be up")
	}

	// Failing check
	failingCheck := health.Custom(func(ctx context.Context) error {
		return errors.New("something went wrong")
	})
	result = failingCheck(ctx)
	if result.Status != health.StatusDown {
		t.Error("Expected failing check to be down")
	}
	if result.Message != "something went wrong" {
		t.Errorf("Expected error message, got '%s'", result.Message)
	}
}

func TestCheck_Timeout(t *testing.T) {
	slowCheck := func(ctx context.Context) health.CheckResult {
		time.Sleep(200 * time.Millisecond)
		return health.CheckResult{Status: health.StatusUp}
	}

	timedOutCheck := health.Timeout(slowCheck, 50*time.Millisecond)
	ctx := context.Background()
	result := timedOutCheck(ctx)

	if result.Status != health.StatusDown {
		t.Error("Expected timed out check to be down")
	}
	if result.Message != "check timed out" {
		t.Errorf("Expected timeout message, got '%s'", result.Message)
	}
}

func TestCheck_Timeout_Passes(t *testing.T) {
	fastCheck := func(ctx context.Context) health.CheckResult {
		return health.CheckResult{Status: health.StatusUp, Message: "fast"}
	}

	timedCheck := health.Timeout(fastCheck, time.Second)
	ctx := context.Background()
	result := timedCheck(ctx)

	if result.Status != health.StatusUp {
		t.Error("Expected fast check to pass")
	}
}

func TestCheck_DiskSpace(t *testing.T) {
	check := health.DiskSpace("/", 1024*1024)
	ctx := context.Background()
	result := check(ctx)

	if result.Status != health.StatusUp {
		t.Error("Expected disk space check to pass")
	}
	if result.Details == nil {
		t.Error("Expected details to be set")
	}
}

func TestCheck_Memory(t *testing.T) {
	check := health.Memory(90.0)
	ctx := context.Background()
	result := check(ctx)

	if result.Status != health.StatusUp {
		t.Error("Expected memory check to pass")
	}
}

func TestHandler(t *testing.T) {
	// Setup
	checker := health.New()
	checker.Register("test", health.Up("ok"))

	// Use global for handler
	health.Register("handler_test", health.Up("ok"))
	defer health.Unregister("handler_test")

	router := gin.New()
	router.GET("/health", health.Handler())

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestHandler_Unhealthy(t *testing.T) {
	health.Register("failing", health.Down("service down"))
	defer health.Unregister("failing")

	router := gin.New()
	router.GET("/health", health.Handler())

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", w.Code)
	}
}

func TestLivenessHandler(t *testing.T) {
	router := gin.New()
	router.GET("/health/live", health.LivenessHandler())

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health/live", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestReadinessHandler_Ready(t *testing.T) {
	// Clear and add passing check
	health.Global().Unregister("failing")
	health.Register("ready_test", health.Up("ok"))
	defer health.Unregister("ready_test")

	router := gin.New()
	router.GET("/health/ready", health.ReadinessHandler())

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health/ready", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestReadinessHandler_NotReady(t *testing.T) {
	health.Register("not_ready", health.Down("not ready"))
	defer health.Unregister("not_ready")

	router := gin.New()
	router.GET("/health/ready", health.ReadinessHandler())

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health/ready", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", w.Code)
	}
}

func TestRegisterRoutes(t *testing.T) {
	router := gin.New()
	health.RegisterRoutes(router)

	// Test /health
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK && w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected health endpoint to respond, got %d", w.Code)
	}

	// Test /health/live
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/health/live", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected liveness endpoint to respond 200, got %d", w.Code)
	}

	// Test /health/ready
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/health/ready", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK && w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected readiness endpoint to respond, got %d", w.Code)
	}
}

func TestCheckResult_Duration(t *testing.T) {
	checker := health.New()

	checker.Register("slow", func(ctx context.Context) health.CheckResult {
		time.Sleep(50 * time.Millisecond)
		return health.CheckResult{Status: health.StatusUp}
	})

	ctx := context.Background()
	results := checker.Check(ctx)

	if results["slow"].Duration < 50*time.Millisecond {
		t.Error("Expected duration to be at least 50ms")
	}
}

func TestCheckResult_Timestamp(t *testing.T) {
	checker := health.New()
	checker.Register("test", health.Up("ok"))

	ctx := context.Background()
	before := time.Now()
	results := checker.Check(ctx)
	after := time.Now()

	ts := results["test"].Timestamp
	if ts.Before(before) || ts.After(after) {
		t.Error("Expected timestamp to be within check execution time")
	}
}

func TestHealth_GlobalFunctions(t *testing.T) {
	// Clear any existing checks
	health.Unregister("test_global")

	health.Register("test_global", health.Up("global test"))
	defer health.Unregister("test_global")

	ctx := context.Background()

	if !health.IsHealthy(ctx) {
		t.Error("Expected global IsHealthy to return true")
	}

	response := health.GetHealth(ctx)
	if response.Status != health.StatusUp {
		t.Errorf("Expected global status up, got %s", response.Status)
	}
}

func TestParallelChecks(t *testing.T) {
	checker := health.New()

	// Add multiple slow checks
	for i := 0; i < 5; i++ {
		name := "check" + string(rune('0'+i))
		checker.Register(name, func(ctx context.Context) health.CheckResult {
			time.Sleep(50 * time.Millisecond)
			return health.CheckResult{Status: health.StatusUp}
		})
	}

	ctx := context.Background()
	start := time.Now()
	results := checker.Check(ctx)
	duration := time.Since(start)

	// If checks run in parallel, should take ~50ms not ~250ms
	if duration > 150*time.Millisecond {
		t.Errorf("Expected parallel execution, took %v", duration)
	}

	if len(results) != 5 {
		t.Errorf("Expected 5 results, got %d", len(results))
	}
}
