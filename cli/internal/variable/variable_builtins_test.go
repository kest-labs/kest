package variable

import (
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// ── $env.VAR_NAME ────────────────────────────────────────────────────────────

func TestEnvVarBuiltin(t *testing.T) {
	const key = "KEST_TEST_ENV_VAR"
	t.Setenv(key, "hello_from_env")

	result := Interpolate("{{$env.KEST_TEST_ENV_VAR}}", nil)
	if result != "hello_from_env" {
		t.Errorf("expected 'hello_from_env', got %q", result)
	}
}

func TestEnvVarBuiltinMissing(t *testing.T) {
	os.Unsetenv("KEST_DEFINITELY_NOT_SET_VAR")
	result := Interpolate("{{$env.KEST_DEFINITELY_NOT_SET_VAR}}", nil)
	if result != "" {
		t.Errorf("expected empty string for unset env var, got %q", result)
	}
}

func TestEnvVarIsBuiltin(t *testing.T) {
	if !isBuiltinVar("$env.MY_VAR") {
		t.Error("expected $env.MY_VAR to be recognised as builtin")
	}
	if isBuiltinVar("$envXYZ") {
		t.Error("$envXYZ should NOT be recognised as builtin")
	}
}

// ── $uuid ────────────────────────────────────────────────────────────────────

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func TestUUIDFormat(t *testing.T) {
	for i := 0; i < 20; i++ {
		uuid := generateUUID()
		if !uuidPattern.MatchString(uuid) {
			t.Errorf("invalid UUID v4 format: %q", uuid)
		}
	}
}

func TestUUIDUnique(t *testing.T) {
	seen := make(map[string]bool, 100)
	for i := 0; i < 100; i++ {
		u := generateUUID()
		if seen[u] {
			t.Errorf("UUID collision detected: %q", u)
		}
		seen[u] = true
	}
}

func TestUUIDInterpolate(t *testing.T) {
	result := Interpolate("id={{$uuid}}", nil)
	parts := strings.SplitN(result, "=", 2)
	if len(parts) != 2 || !uuidPattern.MatchString(parts[1]) {
		t.Errorf("interpolated UUID has wrong format: %q", result)
	}
}

// ── $randomEmail ─────────────────────────────────────────────────────────────

func TestRandomEmail(t *testing.T) {
	for i := 0; i < 10; i++ {
		email := resolveBuiltin("$randomEmail")
		if !strings.Contains(email, "@") || !strings.HasSuffix(email, "@example.com") {
			t.Errorf("unexpected email format: %q", email)
		}
	}
}

// ── $randomString ─────────────────────────────────────────────────────────────

func TestRandomString(t *testing.T) {
	s := generateRandomString(12)
	if len(s) != 12 {
		t.Errorf("expected length 12, got %d", len(s))
	}
	// Should be hex characters only
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("non-hex character %q in random string", c)
		}
	}
}

func TestRandomStringUnique(t *testing.T) {
	seen := make(map[string]bool, 50)
	for i := 0; i < 50; i++ {
		s := generateRandomString(12)
		if seen[s] {
			t.Errorf("random string collision: %q", s)
		}
		seen[s] = true
	}
}

// ── $isoDate ─────────────────────────────────────────────────────────────────

func TestIsoDate(t *testing.T) {
	before := time.Now().UTC().Add(-2 * time.Second)
	result := resolveBuiltin("$isoDate")
	after := time.Now().UTC().Add(2 * time.Second)

	parsed, err := time.Parse(time.RFC3339, result)
	if err != nil {
		t.Fatalf("$isoDate is not valid RFC3339: %q (%v)", result, err)
	}
	if parsed.Before(before) || parsed.After(after) {
		t.Errorf("$isoDate out of expected time window: %q", result)
	}
}

// ── $unixMs ──────────────────────────────────────────────────────────────────

func TestUnixMs(t *testing.T) {
	before := time.Now().UnixMilli()
	result := resolveBuiltin("$unixMs")
	after := time.Now().UnixMilli()

	v, err := strconv.ParseInt(result, 10, 64)
	if err != nil {
		t.Fatalf("$unixMs is not a valid integer: %q", result)
	}
	if v < before || v > after {
		t.Errorf("$unixMs value %d outside window [%d, %d]", v, before, after)
	}
}

// ── isBuiltinVar completeness ─────────────────────────────────────────────────

func TestIsBuiltinVarAllNew(t *testing.T) {
	builtins := []string{"$uuid", "$randomEmail", "$randomString", "$isoDate", "$unixMs"}
	for _, name := range builtins {
		if !isBuiltinVar(name) {
			t.Errorf("expected %q to be a builtin variable", name)
		}
	}
}

// ── concurrent safety for new builtins ───────────────────────────────────────

func TestNewBuiltinsConcurrent(t *testing.T) {
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = resolveBuiltin("$uuid")
			_ = resolveBuiltin("$randomEmail")
			_ = resolveBuiltin("$randomString")
			_ = resolveBuiltin("$isoDate")
			_ = resolveBuiltin("$unixMs")
		}()
	}
	wg.Wait()
}
