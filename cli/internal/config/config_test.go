package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfigPrefersProjectConfigOverGlobalConfig(t *testing.T) {
	home := t.TempDir()
	if err := os.Setenv("HOME", home); err != nil {
		t.Fatal(err)
	}
	t.Setenv("HOME", home)

	globalDir := filepath.Join(home, ".kest")
	if err := os.MkdirAll(globalDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(globalDir, "config.yaml"), []byte("platform_url: https://api.kest.dev/v1\nplatform_workspace_id: global\n"), 0644); err != nil {
		t.Fatal(err)
	}

	workspaceRoot := t.TempDir()
	workspaceDir := filepath.Join(workspaceRoot, ".kest")
	if err := os.MkdirAll(workspaceDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspaceDir, "config.yaml"), []byte("platform_url: http://127.0.0.1:8025/v1\nplatform_workspace_id: local\n"), 0644); err != nil {
		t.Fatal(err)
	}

	previousWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(previousWd)
	})
	if err := os.Chdir(workspaceRoot); err != nil {
		t.Fatal(err)
	}

	conf, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}

	if conf.PlatformURL != "http://127.0.0.1:8025/v1" {
		t.Fatalf("expected workspace platform URL, got %q", conf.PlatformURL)
	}
	if conf.PlatformWorkspaceID != "local" {
		t.Fatalf("expected workspace ID, got %q", conf.PlatformWorkspaceID)
	}
}
