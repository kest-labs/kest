package variable

import (
	"testing"
)

// helper: build a minimal JSON body
func body(s string) []byte { return []byte(s) }

// ── exists / not exists ───────────────────────────────────────────────────────

func TestAssertExists(t *testing.T) {
	ok, msg := Assert(200, body(`{"id":1}`), 10, nil, "body.id exists")
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertExistsMissing(t *testing.T) {
	ok, _ := Assert(200, body(`{"id":1}`), 10, nil, "body.name exists")
	if ok {
		t.Error("expected fail for missing path")
	}
}

func TestAssertNotExists(t *testing.T) {
	ok, msg := Assert(200, body(`{"id":1}`), 10, nil, "body.error not exists")
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertNotExistsPresent(t *testing.T) {
	ok, _ := Assert(200, body(`{"error":"oops"}`), 10, nil, "body.error not exists")
	if ok {
		t.Error("expected fail when path exists")
	}
}

// ── contains ─────────────────────────────────────────────────────────────────

func TestAssertContainsString(t *testing.T) {
	ok, msg := Assert(200, body(`{"msg":"hello world"}`), 10, nil, `body.msg contains "world"`)
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertContainsStringFail(t *testing.T) {
	ok, _ := Assert(200, body(`{"msg":"hello"}`), 10, nil, `body.msg contains "world"`)
	if ok {
		t.Error("expected fail")
	}
}

func TestAssertContainsArray(t *testing.T) {
	ok, msg := Assert(200, body(`{"tags":["go","cli","test"]}`), 10, nil, `body.tags contains "cli"`)
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertContainsArrayFail(t *testing.T) {
	ok, _ := Assert(200, body(`{"tags":["go","cli"]}`), 10, nil, `body.tags contains "rust"`)
	if ok {
		t.Error("expected fail for missing array element")
	}
}

// ── startsWith ───────────────────────────────────────────────────────────────

func TestAssertStartsWith(t *testing.T) {
	ok, msg := Assert(200, body(`{"email":"user@example.com"}`), 10, nil, `body.email startsWith "user"`)
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertStartsWithFail(t *testing.T) {
	ok, _ := Assert(200, body(`{"email":"admin@example.com"}`), 10, nil, `body.email startsWith "user"`)
	if ok {
		t.Error("expected fail")
	}
}

// ── endsWith ─────────────────────────────────────────────────────────────────

func TestAssertEndsWith(t *testing.T) {
	ok, msg := Assert(200, body(`{"email":"user@example.com"}`), 10, nil, `body.email endsWith "example.com"`)
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertEndsWithFail(t *testing.T) {
	ok, _ := Assert(200, body(`{"email":"user@other.org"}`), 10, nil, `body.email endsWith "example.com"`)
	if ok {
		t.Error("expected fail")
	}
}

// ── length ───────────────────────────────────────────────────────────────────

func TestAssertLengthArray(t *testing.T) {
	ok, msg := Assert(200, body(`{"items":[1,2,3]}`), 10, nil, "body.items length == 3")
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertLengthArrayFail(t *testing.T) {
	ok, _ := Assert(200, body(`{"items":[1,2]}`), 10, nil, "body.items length == 3")
	if ok {
		t.Error("expected fail")
	}
}

func TestAssertLengthString(t *testing.T) {
	ok, msg := Assert(200, body(`{"token":"abcdef"}`), 10, nil, "body.token length == 6")
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertLengthGte(t *testing.T) {
	ok, msg := Assert(200, body(`{"items":[1,2,3,4]}`), 10, nil, "body.items length >= 3")
	if !ok {
		t.Errorf("expected pass for length >= 3, got: %s", msg)
	}
}

// ── existing operators still work after refactor ──────────────────────────────

func TestAssertStatusEq(t *testing.T) {
	ok, msg := Assert(200, body(`{}`), 10, nil, "status == 200")
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertStatusNeq(t *testing.T) {
	ok, msg := Assert(404, body(`{}`), 10, nil, "status != 200")
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertBodyField(t *testing.T) {
	ok, msg := Assert(200, body(`{"code":0}`), 10, nil, "body.code == 0")
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertMatches(t *testing.T) {
	ok, msg := Assert(200, body(`{"id":"abc-123"}`), 10, nil, `body.id matches "^abc"`)
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

func TestAssertDuration(t *testing.T) {
	ok, msg := Assert(200, body(`{}`), 150, nil, "duration < 200")
	if !ok {
		t.Errorf("expected pass, got: %s", msg)
	}
}

// ── bodyPathQuery helper ──────────────────────────────────────────────────────

func TestBodyPathQuery(t *testing.T) {
	cases := []struct{ in, want string }{
		{"body.id", "id"},
		{"body.data.user", "data.user"},
		{"data.user", "data.user"},
		{"body.items[0].name", "items.0.name"},
	}
	for _, c := range cases {
		got := bodyPathQuery(c.in)
		if got != c.want {
			t.Errorf("bodyPathQuery(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// ── resolveKey helper ─────────────────────────────────────────────────────────

func TestResolveKeyStatus(t *testing.T) {
	got := resolveKey("status", 201, 0, nil)
	if got != "201" {
		t.Errorf("expected '201', got %q", got)
	}
}

func TestResolveKeyDuration(t *testing.T) {
	got := resolveKey("duration", 0, 99, nil)
	if got != "99" {
		t.Errorf("expected '99', got %q", got)
	}
}

func TestResolveKeyBody(t *testing.T) {
	got := resolveKey("body.name", 200, 0, body(`{"name":"kest"}`))
	if got != "kest" {
		t.Errorf("expected 'kest', got %q", got)
	}
}
