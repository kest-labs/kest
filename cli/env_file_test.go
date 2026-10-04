package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kest-labs/kest/cli/internal/variable"
)

func TestEnvFileFeedsDollarEnv(t *testing.T) {
	work := isolateKest(t)
	captureStdout(t, func() {
		if err := initWorkspace(work, "http://localhost:1"); err != nil {
			t.Fatal(err)
		}
	})

	write := func(path, content string) {
		t.Helper()
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	write(filepath.Join(work, ".kest", ".env"), "KEST_T_FROM_FILE=file-value\nKEST_T_BOTH=from-file\n")
	// An application-level ./.env must never be read.
	write(filepath.Join(work, ".env"), "KEST_T_ROOT_ONLY=leak\n")
	t.Setenv("KEST_T_BOTH", "from-os")

	cases := map[string]string{
		"{{$env.KEST_T_FROM_FILE}}": "file-value",
		"{{$env.KEST_T_BOTH}}":      "from-os", // OS environment wins
		"{{$env.KEST_T_ROOT_ONLY}}": "",        // ./.env is not loaded
		"{{$env.KEST_T_NOPE}}":      "",
	}
	for in, want := range cases {
		if got := variable.Interpolate(in, nil); got != want {
			t.Errorf("Interpolate(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestInitIgnoresDotEnvAndMentionsIt(t *testing.T) {
	work := isolateKest(t)
	out := captureStdout(t, func() {
		if err := initWorkspace(work, ""); err != nil {
			t.Fatal(err)
		}
	})
	gi, err := os.ReadFile(filepath.Join(work, ".kest", ".gitignore"))
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(string(gi), "\n")
	found := false
	for _, l := range lines {
		if strings.TrimSpace(l) == ".env" {
			found = true
		}
	}
	if !found {
		t.Fatalf(".kest/.gitignore does not ignore .env:\n%s", gi)
	}
	if !strings.Contains(out, ".kest/.env") || !strings.Contains(out, "$env.") {
		t.Fatalf("init output should mention .kest/.env and $env:\n%s", out)
	}
}
