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
