package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveRunTargetsFromProfileInclude(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, ".kest", "flow", "auth"), 0755); err != nil {
		t.Fatalf("mkdir flow dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, ".kest", "flow", "auth", "login.flow.md"), []byte("# login"), 0644); err != nil {
		t.Fatalf("write flow: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, ".kest", "flow", "auth", "notes.md"), []byte("# notes"), 0644); err != nil {
		t.Fatalf("write notes: %v", err)
	}

	strict := true
	profile := flowRunProfile{
		Include: []string{".kest/flow/**/*.flow.md"},
		Strict:  &strict,
	}

	targets, err := resolveRunTargets(nil, profile, root)
	if err != nil {
		t.Fatalf("resolveRunTargets returned error: %v", err)
	}
	if len(targets) != 1 {
		t.Fatalf("expected one flow target, got %#v", targets)
	}
	if got := filepath.Base(targets[0]); got != "login.flow.md" {
		t.Fatalf("expected login.flow.md, got %s", got)
	}
}

func TestResolveRunTargetsIgnoresMissingIncludeDirectories(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "api", ".kest", "flow"), 0755); err != nil {
		t.Fatalf("mkdir api flow dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "api", ".kest", "flow", "smoke.flow.md"), []byte("# smoke"), 0644); err != nil {
		t.Fatalf("write flow: %v", err)
	}

	profile := flowRunProfile{
		Include: []string{
			".kest/flow/**/*.flow.md",
			"api/.kest/flow/**/*.flow.md",
		},
	}

	targets, err := resolveRunTargets(nil, profile, root)
	if err != nil {
		t.Fatalf("resolveRunTargets returned error: %v", err)
	}
	if len(targets) != 1 {
		t.Fatalf("expected one flow target, got %#v", targets)
	}
	if got := filepath.Base(targets[0]); got != "smoke.flow.md" {
		t.Fatalf("expected smoke.flow.md, got %s", got)
	}
}

func TestDefaultCIProfileIncludesAllFlowMarkdownFiles(t *testing.T) {
	root := t.TempDir()
	paths := []string{
		filepath.Join(root, ".kest", "flow", "auth", "login.flow.md"),
		filepath.Join(root, "api", "examples", "user_registration.flow.md"),
	}
	for _, path := range paths {
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
		}
		if err := os.WriteFile(path, []byte("# flow"), 0644); err != nil {
			t.Fatalf("write flow %s: %v", path, err)
		}
	}

	cfg := defaultFlowRunConfig()
	targets, err := resolveRunTargets(nil, cfg.Profiles["ci"], root)
	if err != nil {
		t.Fatalf("resolveRunTargets returned error: %v", err)
	}
	if len(targets) != 2 {
		t.Fatalf("expected two flow targets, got %#v", targets)
	}
}

func TestSelectFlowRunProfileUsesEnv(t *testing.T) {
	t.Setenv("KEST_PROFILE", "ci")

	cfg := defaultFlowRunConfig()
	name, profile, err := selectFlowRunProfile(cfg, "")
	if err != nil {
		t.Fatalf("selectFlowRunProfile returned error: %v", err)
	}
	if name != "ci" {
		t.Fatalf("expected ci profile, got %s", name)
	}
	if profile.Sync == nil || !*profile.Sync {
		t.Fatalf("expected ci profile to sync by default")
	}
}
