package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func mkdir(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0755); err != nil {
		t.Fatal(err)
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	mkdir(t, filepath.Dir(path))
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestLoadConfigMissingWorkspaceConfigIsSilent(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("KEST_WORKSPACE_ROOT", "")
	root := t.TempDir()
	mkdir(t, filepath.Join(root, ".kest")) // e.g. created by `kest import`
	t.Chdir(root)

	if _, err := LoadConfig(); err != nil {
		t.Fatalf("missing config.yaml should not be an error: %v", err)
	}
	if found, _ := FindWorkspaceRoot(); !sameDir(found, root) {
		t.Fatalf("workspace root = %q, want %q", found, root)
	}
}

func TestHomeKestDirIsNotAWorkspace(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("KEST_WORKSPACE_ROOT", "")
	mkdir(t, filepath.Join(home, ".kest")) // history database lives here
	sub := filepath.Join(home, "code", "api")
	mkdir(t, sub)
	t.Chdir(sub)

	root, err := FindWorkspaceRoot()
	if err != nil {
		t.Fatal(err)
	}
	if root != "" {
		t.Fatalf("~/.kest was detected as a workspace root: %q", root)
	}
	if _, err := LoadConfig(); err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	path, err := ResolveConfigPath()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(path, filepath.Join(".kest", "config.yaml")) || !strings.HasPrefix(path, home) {
		t.Fatalf("config path = %q, want global config", path)
	}
}

func TestGlobalConfigLoadsOutsideWorkspace(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("KEST_WORKSPACE_ROOT", "")
	writeFile(t, filepath.Join(home, ".kest", "config.yaml"), "ai_model: test-model\n")
	sub := filepath.Join(home, "elsewhere")
	mkdir(t, sub)
	t.Chdir(sub)

	conf, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if conf.AIModel != "test-model" {
		t.Fatalf("global config not loaded: %+v", conf)
	}
}

func TestWorkspaceUnderHomeIsStillDetected(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("KEST_WORKSPACE_ROOT", "")
	mkdir(t, filepath.Join(home, ".kest"))
	ws := filepath.Join(home, "api")
	mkdir(t, filepath.Join(ws, ".kest"))
	mkdir(t, filepath.Join(ws, "tests"))
	t.Chdir(filepath.Join(ws, "tests"))

	root, err := FindWorkspaceRoot()
	if err != nil {
		t.Fatal(err)
	}
	if !sameDir(root, ws) {
		t.Fatalf("root = %q, want %q", root, ws)
	}
}

func TestInvalidConfigIsAnError(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("KEST_WORKSPACE_ROOT", "")
	root := t.TempDir()
	writeFile(t, filepath.Join(root, ".kest", "config.yaml"), "environments: [unclosed\n")
	t.Chdir(root)

	if _, err := LoadConfig(); err == nil {
		t.Fatal("expected a parse error for invalid YAML")
	}
}
