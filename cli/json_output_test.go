package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kest-labs/kest/cli/internal/output"
)

var updateGolden = flag.Bool("update", false, "rewrite golden files in testdata/")

// isolateKest points HOME, the working directory and every Kest environment
// override at temporary locations so tests never touch the user's history
// database or workspace config.
func isolateKest(t *testing.T) string {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	for _, key := range []string{
		"KEST_ENV", "KEST_BASE_URL", "KEST_PROFILE", "KEST_WORKSPACE_ROOT",
		"KEST_PLATFORM_URL", "KEST_PLATFORM_TOKEN", "KEST_PLATFORM_WORKSPACE_ID",
	} {
		t.Setenv(key, "")
	}
	work := t.TempDir()
	t.Chdir(work)

	previous := captureRunSettings()
	previousJSON := output.JSONOutput
	defaultRunSettings().apply()
	output.JSONOutput = true // keep decorative output out of test logs
	t.Cleanup(func() {
		previous.apply()
		output.JSONOutput = previousJSON
	})
	return work
}

// newAPIServer serves a tiny API used by the JSON/MCP/JUnit tests.
func newAPIServer(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"version":"1.2.3"}`))
	})
	mux.HandleFunc("/items", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"name is required","access_token":"leaked-secret"}`))
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

const passingFlow = "# Health\n\n" +
	"```flow\n@flow id=health\n@name Health\n```\n\n" +
	"```step\n@id health\n@name Health check\nGET /health\n\n" +
	"[Asserts]\nstatus == 200\nbody.ok == true\n\n" +
	"[Captures]\nversion = version\n```\n"

const failingFlow = "# Items\n\n" +
	"```flow\n@flow id=items\n@name Items\n```\n\n" +
	"```step\n@id health\n@name Health check\nGET /health\n\n" +
	"[Asserts]\nstatus == 200\n```\n\n" +
	"```step\n@id create\n@name Create item\nPOST /items\n" +
	"Authorization: Bearer super-secret-token\nContent-Type: application/json\n\n" +
	"{\"name\": \"\"}\n\n" +
	"[Asserts]\nstatus == 201\nbody.error == \"name is required\"\n```\n"

func writeFlow(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write flow: %v", err)
	}
	return name
}

// normalizeResultJSON removes volatile values (durations, ports, dates, ids)
// so the document can be compared with a golden file.
func normalizeResultJSON(t *testing.T, raw []byte, serverURL string) []byte {
	t.Helper()
	var doc any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("output is not a single JSON document: %v\n%s", err, raw)
	}
	var walk func(v any) any
	walk = func(v any) any {
		switch typed := v.(type) {
		case map[string]any:
			for key, value := range typed {
				switch key {
				case "duration_ms":
					typed[key] = 0
				case "record_id":
					typed[key] = "<record_id>"
				case "Date", "Content-Length":
					delete(typed, key)
				default:
					typed[key] = walk(value)
				}
			}
			return typed
		case []any:
			for i := range typed {
				typed[i] = walk(typed[i])
			}
			return typed
		case string:
			return strings.ReplaceAll(typed, serverURL, "http://SERVER")
		default:
			return v
		}
	}
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(walk(doc)); err != nil {
		t.Fatalf("marshal normalized: %v", err)
	}
	return buf.Bytes()
}

func assertGolden(t *testing.T, name string, got []byte) {
	t.Helper()
	path := filepath.Join(goldenDir(t), name)
	if *updateGolden {
		if err := os.WriteFile(path, got, 0o644); err != nil {
			t.Fatalf("update golden: %v", err)
		}
		return
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden %s (run with -update to create): %v", path, err)
	}
	if !bytes.Equal(want, got) {
		t.Fatalf("JSON output does not match %s (run `go test -run %s -update`)\n--- got ---\n%s\n--- want ---\n%s", path, t.Name(), got, want)
	}
}

var testdataRoot string

func init() {
	wd, err := os.Getwd()
	if err == nil {
		testdataRoot = filepath.Join(wd, "testdata")
	}
}

func goldenDir(t *testing.T) string {
	t.Helper()
	if testdataRoot == "" {
		t.Fatal("testdata directory not resolved")
	}
	return testdataRoot
}

// runJSON runs a flow through the same path as `kest run --json` and
// returns the emitted bytes and the command error.
func runJSON(t *testing.T, args []string, baseURL string) ([]byte, error) {
	t.Helper()
	runBaseURL = baseURL
	var buf bytes.Buffer
	restore := output.SetJSONSink(&buf)
	defer restore()
	res, err := runSuite(args, func(name string) bool { return name == "base-url" && baseURL != "" })
	err = finishJSON("run", res, err)
	return buf.Bytes(), err
}

func TestRunJSONPassingGolden(t *testing.T) {
	work := isolateKest(t)
	server := newAPIServer(t)
	flowName := writeFlow(t, work, "health.flow.md", passingFlow)

	raw, err := runJSON(t, []string{flowName}, server.URL)
	if err != nil {
		t.Fatalf("expected passing run, got %v", err)
	}
	if bytes.Count(bytes.TrimSpace(raw), []byte("\n{")) != 0 || !json.Valid(raw) {
		t.Fatalf("expected exactly one JSON document, got:\n%s", raw)
	}
	assertGolden(t, "run_pass.golden.json", normalizeResultJSON(t, raw, server.URL))
}

func TestRunJSONFailingGolden(t *testing.T) {
	work := isolateKest(t)
	server := newAPIServer(t)
	flowName := writeFlow(t, work, "items.flow.md", failingFlow)

	raw, err := runJSON(t, []string{flowName}, server.URL)
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitAssertionFailed {
		t.Fatalf("expected assertion exit code %d, got %v", ExitAssertionFailed, err)
	}
	if strings.Contains(string(raw), "super-secret-token") || strings.Contains(string(raw), "leaked-secret") {
		t.Fatalf("secrets leaked into JSON output:\n%s", raw)
	}
	assertGolden(t, "run_fail.golden.json", normalizeResultJSON(t, raw, server.URL))
}

func TestRunJSONMissingFileIsConfigError(t *testing.T) {
	isolateKest(t)
	raw, err := runJSON(t, []string{"does-not-exist.flow.md"}, "")
	var exitErr *ExitError
	if !errors.As(err, &exitErr) || exitErr.Code != ExitConfigError {
		t.Fatalf("expected config exit code %d, got %v", ExitConfigError, err)
	}
	var res output.Result
	if err := json.Unmarshal(raw, &res); err != nil {
		t.Fatalf("invalid JSON: %v\n%s", err, raw)
	}
	if res.OK || res.ExitCode != ExitConfigError || res.Error == nil || res.Error.Kind != output.ErrorKindConfig {
		t.Fatalf("unexpected result: %+v", res)
	}
}

func TestRequestJSONNetworkErrorKind(t *testing.T) {
	isolateKest(t)
	server := httptest.NewServer(http.NotFoundHandler())
	url := server.URL + "/gone"
	server.Close()

	started := time.Now()
	tr, err := ExecuteRequest(RequestOptions{Method: "get", URL: url, SilentOutput: true, NoRecord: true})
	res := finalizeResult("request", buildRequestResult(tr, started, time.Now()), err)
	if res.OK || res.ExitCode != ExitRuntimeError {
		t.Fatalf("expected runtime failure, got ok=%v exit=%d", res.OK, res.ExitCode)
	}
	if len(res.Steps) != 1 || res.Steps[0].Error == nil || res.Steps[0].Error.Kind != output.ErrorKindNetwork {
		t.Fatalf("expected network error kind, got %+v", res.Steps)
	}
}

func TestExitCodeForResultUsesFirstFailure(t *testing.T) {
	res := output.NewResult("run")
	res.AddStep(output.Step{Name: "a", OK: true})
	res.AddStep(output.Step{Name: "b", Error: &output.Error{Kind: output.ErrorKindAssertion}})
	res.AddStep(output.Step{Name: "c", Error: &output.Error{Kind: output.ErrorKindVariable}})
	if got := exitCodeForResult(res); got != ExitAssertionFailed {
		t.Fatalf("expected %d, got %d", ExitAssertionFailed, got)
	}
}
