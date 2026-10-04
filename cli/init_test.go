package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kest-labs/kest/cli/internal/summary"
)

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	orig := os.Stdout
	os.Stdout = w
	defer func() { os.Stdout = orig }()
	fn()
	w.Close()
	out, _ := io.ReadAll(r)
	return string(out)
}

func TestInitCreatesRunnableSampleFlow(t *testing.T) {
	work := isolateKest(t)
	server := newAPIServer(t)

	out := captureStdout(t, func() {
		if err := initWorkspace(work, server.URL+"/"); err != nil {
			t.Fatal(err)
		}
	})
	for _, want := range []string{"smoke.flow.md", "kest run .kest/flow/smoke.flow.md", "claude mcp add kest -- kest mcp", server.URL} {
		if !strings.Contains(out, want) {
			t.Fatalf("init output missing %q:\n%s", want, out)
		}
	}

	cfg, err := os.ReadFile(filepath.Join(work, ".kest", "config.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(cfg), "base_url: "+server.URL+"\n") {
		t.Fatalf("base_url not written:\n%s", cfg)
	}
	flowCfg, err := os.ReadFile(filepath.Join(work, ".kest", "flow.config.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(flowCfg), "5119") {
		t.Fatalf("flow.config.yaml overrides base_url:\n%s", flowCfg)
	}

	// `kest run` with no arguments picks up the sample flow and sends it to
	// the base_url from config.yaml (the same server `kest get` uses).
	raw, err := runJSON(t, nil, "")
	if err != nil {
		t.Fatalf("sample flow failed: %v\n%s", err, raw)
	}
	if !strings.Contains(string(raw), `"passed": 1`) || !strings.Contains(string(raw), server.URL) {
		t.Fatalf("unexpected run result:\n%s", raw)
	}

	// Running init again keeps existing files.
	if err := os.WriteFile(filepath.Join(work, ".kest", "flow", "smoke.flow.md"), []byte("custom"), 0644); err != nil {
		t.Fatal(err)
	}
	captureStdout(t, func() {
		if err := initWorkspace(work, ""); err != nil {
			t.Fatal(err)
		}
	})
	if got, _ := os.ReadFile(filepath.Join(work, ".kest", "flow", "smoke.flow.md")); string(got) != "custom" {
		t.Fatalf("init overwrote the sample flow: %q", got)
	}
}

func TestDefaultLocalProfileInheritsConfigBaseURL(t *testing.T) {
	local := defaultFlowRunConfig().Profiles["local"]
	if local.BaseURL != "" || local.Env != "" {
		t.Fatalf("default local profile must not override env/base_url, got env=%q base_url=%q", local.Env, local.BaseURL)
	}
}

func TestFailedStepHintPointsAtRecord(t *testing.T) {
	summ := summary.NewSummary()
	summ.AddResult(summary.TestResult{Name: "login", Success: true, RecordID: 4})
	summ.AddResult(summary.TestResult{Name: "profile", Success: false, RecordID: 5})
	out := captureStdout(t, func() { printFailedStepHint(summ) })
	for _, want := range []string{"profile failed", "kest show 5", "kest why 5", "kest replay 5"} {
		if !strings.Contains(out, want) {
			t.Fatalf("hint missing %q:\n%s", want, out)
		}
	}
	if out := captureStdout(t, func() { printFailedStepHint(summary.NewSummary()) }); out != "" {
		t.Fatalf("unexpected hint for passing run: %q", out)
	}
}
