package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/kest-labs/kest/cli/internal/output"
)

// seenRequest is one request recorded by recordingServer.
type seenRequest struct {
	Method  string
	Path    string
	Header  http.Header
	Body    string
	Authrzn string
}

// recordingServer answers every request with {"ok":true,"token":"tok-123"}
// (201 for paths ending in /created, 404 for /missing, 204 for DELETE) and
// records what it saw, in order.
type recordingServer struct {
	*httptest.Server
	mu   sync.Mutex
	seen []seenRequest
}

func newRecordingServer(t *testing.T) *recordingServer {
	t.Helper()
	rs := &recordingServer{}
	rs.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		rs.mu.Lock()
		rs.seen = append(rs.seen, seenRequest{Method: r.Method, Path: r.URL.RequestURI(), Header: r.Header.Clone(), Body: string(body), Authrzn: r.Header.Get("Authorization")})
		rs.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(r.URL.Path, "/missing"):
			w.WriteHeader(http.StatusNotFound)
		case r.Method == http.MethodDelete:
			w.WriteHeader(http.StatusNoContent)
			return
		case strings.HasSuffix(r.URL.Path, "/created"):
			w.WriteHeader(http.StatusCreated)
		}
		_, _ = w.Write([]byte(`{"ok":true,"token":"tok-123","id":7}`))
	}))
	t.Cleanup(rs.Close)
	return rs
}

func (rs *recordingServer) requests() []seenRequest {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	return append([]seenRequest(nil), rs.seen...)
}

func (rs *recordingServer) paths() []string {
	var out []string
	for _, r := range rs.requests() {
		out = append(out, r.Method+" "+r.Path)
	}
	return out
}

// runFlowFile writes content under dir and runs it against baseURL, returning
// the versioned run result.
func runFlowFile(t *testing.T, dir, name, content, baseURL string) (*output.Result, error) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(filepath.Join(dir, name)), 0o755); err != nil {
		t.Fatal(err)
	}
	writeFlow(t, dir, name, content)
	runBaseURL = baseURL
	return runSuite([]string{filepath.Join(dir, name)}, func(n string) bool { return n == "base-url" })
}

func stepNames(res *output.Result) []string {
	var out []string
	for _, s := range res.Steps {
		out = append(out, s.Name)
	}
	return out
}
