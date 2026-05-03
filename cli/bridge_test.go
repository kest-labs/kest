package main

import (
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNormalizeBridgeOrigins(t *testing.T) {
	origins := normalizeBridgeOrigins([]string{
		"",
		" http://localhost:3000 ",
		"http://localhost:3000",
		"http://localhost:3001",
	})

	if len(origins) != 2 {
		t.Fatalf("expected 2 origins, got %d: %#v", len(origins), origins)
	}

	if origins[0] != "http://localhost:3000" {
		t.Fatalf("expected first origin to be trimmed localhost:3000, got %q", origins[0])
	}

	if origins[1] != "http://localhost:3001" {
		t.Fatalf("expected second origin to be localhost:3001, got %q", origins[1])
	}
}

func TestBridgeOriginPolicyStrictRejectsUnknownOrigin(t *testing.T) {
	policy := newBridgeOriginPolicy("strict", []string{"http://localhost:3001"})

	if _, ok := policy.resolve("http://localhost:3001"); !ok {
		t.Fatalf("expected explicitly allowed origin to pass in strict mode")
	}

	if _, ok := policy.resolve("http://localhost:3000"); ok {
		t.Fatalf("expected unknown origin to be rejected in strict mode")
	}
}

func TestBridgeOriginPolicyAutoAllowsAndPersistsOrigin(t *testing.T) {
	policy := newBridgeOriginPolicy("auto", nil)

	origin, ok := policy.resolve("http://localhost:3003")
	if !ok {
		t.Fatalf("expected auto mode to allow new origin")
	}
	if origin != "http://localhost:3003" {
		t.Fatalf("expected resolved origin to be preserved, got %q", origin)
	}

	allowedOrigins := policy.listAllowedOrigins()
	if len(allowedOrigins) != 1 || allowedOrigins[0] != "http://localhost:3003" {
		t.Fatalf("expected auto mode to persist allowed origin, got %#v", allowedOrigins)
	}
}

func TestExecuteBridgeRequestSupportsMultipartFormData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(8 << 20); err != nil {
			t.Fatalf("expected multipart form payload: %v", err)
		}

		if got := r.FormValue("note"); got != "hello" {
			t.Fatalf("expected note field, got %q", got)
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			t.Fatalf("expected multipart file field: %v", err)
		}
		defer file.Close()

		body, err := io.ReadAll(file)
		if err != nil {
			t.Fatalf("expected readable file payload: %v", err)
		}

		if header.Filename != "hello.txt" {
			t.Fatalf("expected uploaded filename hello.txt, got %q", header.Filename)
		}
		if string(body) != "hello world" {
			t.Fatalf("expected uploaded file body, got %q", string(body))
		}

		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	resp, err := executeBridgeRequest(bridgeRunRequest{
		Method:  http.MethodPost,
		URL:     server.URL,
		Headers: map[string]string{"X-Test": "1"},
		FormData: []bridgeFormField{
			{
				Key:   "note",
				Type:  "text",
				Value: "hello",
			},
			{
				Key:        "file",
				Type:       "file",
				FileName:   "hello.txt",
				FileBase64: base64.StdEncoding.EncodeToString([]byte("hello world")),
			},
		},
	})
	if err != nil {
		t.Fatalf("expected multipart request to succeed: %v", err)
	}

	if resp.Status != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, resp.Status)
	}
	if resp.Body != "ok" {
		t.Fatalf("expected response body ok, got %q", resp.Body)
	}
}

func TestExecuteBridgeRequestSupportsBinaryBodyBase64(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("expected readable request body: %v", err)
		}

		if got := r.Header.Get("Content-Type"); got != "application/octet-stream" {
			t.Fatalf("expected binary content type, got %q", got)
		}
		if string(body) != "binary-data" {
			t.Fatalf("expected binary body bytes, got %q", string(body))
		}

		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("done"))
	}))
	defer server.Close()

	resp, err := executeBridgeRequest(bridgeRunRequest{
		Method:     http.MethodPost,
		URL:        server.URL,
		Headers:    map[string]string{"Content-Type": "application/octet-stream"},
		BodyBase64: base64.StdEncoding.EncodeToString([]byte("binary-data")),
	})
	if err != nil {
		t.Fatalf("expected binary request to succeed: %v", err)
	}

	if resp.Status != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Status)
	}
	if resp.Body != "done" {
		t.Fatalf("expected response body done, got %q", resp.Body)
	}
}
