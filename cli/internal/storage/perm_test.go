package storage

import (
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
	// Simulate a database written before the failure column existed: create
	// the current schema, save a record, then drop the column.
	seed, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := seed.SaveRecord(&Record{Method: "GET", URL: "http://old", ResponseStatus: 200}); err != nil {
		t.Fatal(err)
	}
	if _, err := seed.db.Exec(`ALTER TABLE records DROP COLUMN failure`); err != nil {
		t.Fatal(err)
	}
	seed.Close()

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
