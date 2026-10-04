package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

// captureStderr runs fn and returns what it wrote to os.Stderr.
func captureStderr(t *testing.T, fn func()) string {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	orig := os.Stderr
	os.Stderr = w
	defer func() { os.Stderr = orig }()
	fn()
	w.Close()
	out, _ := io.ReadAll(r)
	return string(out)
}

func TestLoadConfigWarnSilentWhenConfigMissing(t *testing.T) {
	work := isolateKest(t)
	configWarnOnce = sync.Once{}
	home := os.Getenv("HOME")
	// ~/.kest exists (history db) and the workspace .kest has no config.
	if err := os.MkdirAll(filepath.Join(home, ".kest"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(work, ".kest"), 0755); err != nil {
		t.Fatal(err)
	}

	stderr := captureStderr(t, func() {
		loadConfigWarn()
		loadConfigWarn()
	})
	if strings.Contains(stderr, "Warning") {
		t.Fatalf("missing config should be silent, got %q", stderr)
	}
}

func TestLoadConfigWarnOncePerProcess(t *testing.T) {
	work := isolateKest(t)
	configWarnOnce = sync.Once{}
	t.Cleanup(func() { configWarnOnce = sync.Once{} })
	path := filepath.Join(work, ".kest", "config.yaml")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("environments: [unclosed\n"), 0644); err != nil {
		t.Fatal(err)
	}

	stderr := captureStderr(t, func() {
		conf := loadConfigWarn()
		if conf == nil {
			t.Fatal("loadConfigWarn returned nil")
		}
		loadConfigWarn()
	})
	if n := strings.Count(stderr, "failed to load config"); n != 1 {
		t.Fatalf("warning printed %d times, want 1: %q", n, stderr)
	}
}
