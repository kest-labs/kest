package dotenv

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParse(t *testing.T) {
	got := Parse("# comment\n\nA=1\nexport B = two words # trailing\nC=\"x y\\nz\"\nD='lit #not comment'\nE=\nbad line\n=nokey\nF=a#b\n")
	want := map[string]string{
		"A": "1",
		"B": "two words",
		"C": "x y\nz",
		"D": "lit #not comment",
		"E": "",
		"F": "a#b",
	}
	if len(got) != len(want) {
		t.Fatalf("got %v want %v", got, want)
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %q, want %q", k, got[k], v)
		}
	}
}

func TestReadFileMissingAndCache(t *testing.T) {
	if ReadFile(filepath.Join(t.TempDir(), "nope")) != nil {
		t.Fatal("missing file should yield nil")
	}
	p := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(p, []byte("X=1\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if ReadFile(p)["X"] != "1" {
		t.Fatal("expected X=1")
	}
	if err := os.WriteFile(p, []byte("X=22\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if ReadFile(p)["X"] != "22" {
		t.Fatal("cache should refresh when file changes")
	}
}
