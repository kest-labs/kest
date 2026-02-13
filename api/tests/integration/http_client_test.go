package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	httpclient "github.com/kest-labs/kest/api/internal/infra/http"
)

func TestHTTPClient_Get(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("Expected GET, got %s", r.Method)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message": "hello"}`))
	}))
	defer server.Close()

	resp, err := httpclient.New().Get(server.URL)
	if err != nil {
		t.Fatalf("Get() error: %v", err)
	}

	if !resp.Ok() {
		t.Errorf("Expected OK response, got %d", resp.StatusCode)
	}

	var result map[string]string
	if err := resp.JSON(&result); err != nil {
		t.Fatalf("JSON() error: %v", err)
	}

	if result["message"] != "hello" {
		t.Errorf("Expected 'hello', got '%s'", result["message"])
	}
}

func TestHTTPClient_Post(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"received": body["name"]})
	}))
	defer server.Close()

	resp, err := httpclient.New().Post(server.URL, map[string]string{"name": "test"})
	if err != nil {
		t.Fatalf("Post() error: %v", err)
	}

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected 201, got %d", resp.StatusCode)
	}
}

func TestHTTPClient_WithHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Custom") != "value" {
			t.Errorf("Expected X-Custom header 'value', got '%s'", r.Header.Get("X-Custom"))
		}
		if r.Header.Get("Accept") != "application/json" {
			t.Errorf("Expected Accept header 'application/json', got '%s'", r.Header.Get("Accept"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	_, err := httpclient.New().
		WithHeader("X-Custom", "value").
		AcceptJSON().
		Get(server.URL)

	if err != nil {
		t.Fatalf("Get() error: %v", err)
	}
}

func TestHTTPClient_WithToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-token" {
			t.Errorf("Expected 'Bearer test-token', got '%s'", auth)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	_, err := httpclient.New().WithToken("test-token").Get(server.URL)
	if err != nil {
		t.Fatalf("Get() error: %v", err)
	}
}

func TestHTTPClient_WithQuery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("page") != "1" {
			t.Errorf("Expected page=1, got '%s'", r.URL.Query().Get("page"))
		}
		if r.URL.Query().Get("limit") != "10" {
			t.Errorf("Expected limit=10, got '%s'", r.URL.Query().Get("limit"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	_, err := httpclient.New().
		WithQuery(map[string]string{"page": "1", "limit": "10"}).
		Get(server.URL)

	if err != nil {
		t.Fatalf("Get() error: %v", err)
	}
}

func TestHTTPClient_BaseURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/users" {
			t.Errorf("Expected path '/api/users', got '%s'", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	_, err := httpclient.New().BaseURL(server.URL).Get("/api/users")
	if err != nil {
		t.Fatalf("Get() error: %v", err)
	}
}

func TestHTTPClient_Timeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	_, err := httpclient.New().Timeout(50 * time.Millisecond).Get(server.URL)
	if err == nil {
		t.Error("Expected timeout error, got nil")
	}
}

func TestHTTPClient_ResponseMethods(t *testing.T) {
	tests := []struct {
		statusCode int
		ok         bool
		clientErr  bool
		serverErr  bool
	}{
		{200, true, false, false},
		{201, true, false, false},
		{400, false, true, false},
		{401, false, true, false},
		{404, false, true, false},
		{500, false, false, true},
		{503, false, false, true},
	}

	for _, tt := range tests {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tt.statusCode)
		}))

		resp, err := httpclient.New().Get(server.URL)
		server.Close()

		if err != nil {
			t.Fatalf("Get() error for status %d: %v", tt.statusCode, err)
		}

		if resp.Ok() != tt.ok {
			t.Errorf("Status %d: Ok() = %v, expected %v", tt.statusCode, resp.Ok(), tt.ok)
		}
		if resp.IsClientError() != tt.clientErr {
			t.Errorf("Status %d: IsClientError() = %v, expected %v", tt.statusCode, resp.IsClientError(), tt.clientErr)
		}
		if resp.IsServerError() != tt.serverErr {
			t.Errorf("Status %d: IsServerError() = %v, expected %v", tt.statusCode, resp.IsServerError(), tt.serverErr)
		}
	}
}

func TestHTTPClient_SpecificStatusChecks(t *testing.T) {
	tests := []struct {
		statusCode   int
		unauthorized bool
		forbidden    bool
		notFound     bool
	}{
		{401, true, false, false},
		{403, false, true, false},
		{404, false, false, true},
		{200, false, false, false},
	}

	for _, tt := range tests {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tt.statusCode)
		}))

		resp, _ := httpclient.New().Get(server.URL)
		server.Close()

		if resp.IsUnauthorized() != tt.unauthorized {
			t.Errorf("Status %d: IsUnauthorized() = %v, expected %v", tt.statusCode, resp.IsUnauthorized(), tt.unauthorized)
		}
		if resp.IsForbidden() != tt.forbidden {
			t.Errorf("Status %d: IsForbidden() = %v, expected %v", tt.statusCode, resp.IsForbidden(), tt.forbidden)
		}
		if resp.IsNotFound() != tt.notFound {
			t.Errorf("Status %d: IsNotFound() = %v, expected %v", tt.statusCode, resp.IsNotFound(), tt.notFound)
		}
	}
}

func TestHTTPClient_Put(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("Expected PUT, got %s", r.Method)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	resp, err := httpclient.New().Put(server.URL, map[string]string{"name": "updated"})
	if err != nil {
		t.Fatalf("Put() error: %v", err)
	}
	if !resp.Ok() {
		t.Errorf("Expected OK response")
	}
}

func TestHTTPClient_Delete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("Expected DELETE, got %s", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	resp, err := httpclient.New().Delete(server.URL)
	if err != nil {
		t.Fatalf("Delete() error: %v", err)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("Expected 204, got %d", resp.StatusCode)
	}
}

func TestHTTPClient_PostForm(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST, got %s", r.Method)
		}
		contentType := r.Header.Get("Content-Type")
		if contentType != "application/x-www-form-urlencoded" {
			t.Errorf("Expected form content type, got %s", contentType)
		}
		r.ParseForm()
		if r.FormValue("username") != "john" {
			t.Errorf("Expected username 'john', got '%s'", r.FormValue("username"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	resp, err := httpclient.New().PostForm(server.URL, map[string]string{"username": "john"})
	if err != nil {
		t.Fatalf("PostForm() error: %v", err)
	}
	if !resp.Ok() {
		t.Errorf("Expected OK response")
	}
}

func TestHTTPClient_String(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("plain text response"))
	}))
	defer server.Close()

	resp, err := httpclient.New().Get(server.URL)
	if err != nil {
		t.Fatalf("Get() error: %v", err)
	}

	if resp.String() != "plain text response" {
		t.Errorf("Expected 'plain text response', got '%s'", resp.String())
	}
}

func TestHTTPClient_PackageFunctions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok": true}`))
	}))
	defer server.Close()

	// Test Get
	resp, err := httpclient.Get(server.URL)
	if err != nil {
		t.Fatalf("Get() error: %v", err)
	}
	if !resp.Ok() {
		t.Error("Expected OK response")
	}

	// Test Post
	resp, err = httpclient.Post(server.URL, map[string]string{"test": "data"})
	if err != nil {
		t.Fatalf("Post() error: %v", err)
	}
	if !resp.Ok() {
		t.Error("Expected OK response")
	}
}
