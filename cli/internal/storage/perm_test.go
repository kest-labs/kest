package storage

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

func TestNewStoreRestrictsPermissions(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	// Simulate a directory left world-readable by an older version.
	dir := filepath.Join(home, ".kest")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}

	if _, err := NewStore(); err != nil {
		t.Fatal(err)
	}

	for path, want := range map[string]os.FileMode{
		dir:                              0700,
		filepath.Join(dir, "records.db"): 0600,
	} {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != want {
			t.Errorf("%s mode = %o, want %o", path, got, want)
		}
	}
}

func TestNewStoreAddsFailureColumnToOldDatabase(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	dir := filepath.Join(home, ".kest")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	// Schema written by versions before the failure column existed.
	old, err := sql.Open("sqlite", filepath.Join(dir, "records.db"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := old.Exec(`CREATE TABLE records (
		id INTEGER PRIMARY KEY AUTOINCREMENT, method VARCHAR(10) NOT NULL, url TEXT NOT NULL,
		base_url TEXT, path TEXT, query_params TEXT, request_headers TEXT, request_body TEXT,
		response_status INTEGER, response_headers TEXT, response_body TEXT, duration_ms INTEGER,
		environment VARCHAR(50), project VARCHAR(100), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	if _, err := old.Exec(`INSERT INTO records (method, url, base_url, path, query_params, request_headers, request_body,
		response_status, response_headers, response_body, duration_ms, environment, project)
		VALUES ('GET', 'http://old', '', '/', '{}', '{}', '', 200, '{}', '', 1, '', '')`); err != nil {
		t.Fatal(err)
	}
	old.Close()

	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	id, err := store.SaveRecord(&Record{Method: "GET", URL: "http://new", ResponseStatus: 200, Failure: "assertion failed"})
	if err != nil {
		t.Fatal(err)
	}
	got, err := store.GetRecord(id)
	if err != nil || got.Failure != "assertion failed" {
		t.Fatalf("GetRecord = %+v, %v", got, err)
	}
	if prev, err := store.GetRecord(1); err != nil || prev.Failure != "" {
		t.Fatalf("old record = %+v, %v", prev, err)
	}
	// Opening again must not try to add the column twice.
	again, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	again.Close()
}
