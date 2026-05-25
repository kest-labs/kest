package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

const defaultFlowProfileName = "local"

type flowRunConfig struct {
	Version  int                       `yaml:"version"`
	Profiles map[string]flowRunProfile `yaml:"profiles"`
}

type flowRunProfile struct {
	Include  []string          `yaml:"include"`
	Exclude  []string          `yaml:"exclude"`
	Env      string            `yaml:"env"`
	BaseURL  string            `yaml:"base_url"`
	Strict   *bool             `yaml:"strict"`
	FailFast *bool             `yaml:"fail_fast"`
	Sync     *bool             `yaml:"sync"`
	Reports  flowReportTargets `yaml:"reports"`
}

type flowReportTargets struct {
	JSON  string `yaml:"json"`
	JUnit string `yaml:"junit"`
}

func loadFlowRunConfig() (flowRunConfig, string, error) {
	root, _ := findKestWorkspaceRoot()
	cfg := defaultFlowRunConfig()
	if root == "" {
		return cfg, "", nil
	}

	path := filepath.Join(root, ".kest", "flow.config.yaml")
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, root, nil
		}
		return cfg, root, err
	}

	var parsed flowRunConfig
	if err := yaml.Unmarshal(content, &parsed); err != nil {
		return cfg, root, fmt.Errorf("parse %s: %w", path, err)
	}
	if parsed.Version == 0 {
		parsed.Version = 1
	}
	if parsed.Profiles == nil {
		parsed.Profiles = map[string]flowRunProfile{}
	}

	defaults := defaultFlowRunConfig()
	for name, fallback := range defaults.Profiles {
		profile, exists := parsed.Profiles[name]
		if !exists {
			parsed.Profiles[name] = fallback
			continue
		}
		parsed.Profiles[name] = mergeFlowRunProfile(fallback, profile)
	}

	return parsed, root, nil
}

func defaultFlowRunConfig() flowRunConfig {
	strict := true
	failFast := false
	localSync := false
	ciSync := true

	return flowRunConfig{
		Version: 1,
		Profiles: map[string]flowRunProfile{
			"local": {
				Include:  []string{".kest/flow/**/*.flow.md"},
				Env:      "local",
				BaseURL:  "http://127.0.0.1:5119",
				Strict:   &strict,
				FailFast: &failFast,
				Sync:     &localSync,
			},
			"ci": {
				Include:  []string{".kest/flow/**/*.flow.md"},
				Env:      "staging",
				Strict:   &strict,
				FailFast: &failFast,
				Sync:     &ciSync,
				Reports: flowReportTargets{
					JSON:  ".kest/reports/flow-results.json",
					JUnit: ".kest/reports/flow-results.xml",
				},
			},
		},
	}
}

func mergeFlowRunProfile(base, override flowRunProfile) flowRunProfile {
	if len(override.Include) > 0 {
		base.Include = override.Include
	}
	if len(override.Exclude) > 0 {
		base.Exclude = override.Exclude
	}
	if override.Env != "" {
		base.Env = override.Env
	}
	if override.BaseURL != "" {
		base.BaseURL = override.BaseURL
	}
	if override.Strict != nil {
		base.Strict = override.Strict
	}
	if override.FailFast != nil {
		base.FailFast = override.FailFast
	}
	if override.Sync != nil {
		base.Sync = override.Sync
	}
	if override.Reports.JSON != "" {
		base.Reports.JSON = override.Reports.JSON
	}
	if override.Reports.JUnit != "" {
		base.Reports.JUnit = override.Reports.JUnit
	}
	return base
}

func selectFlowRunProfile(cfg flowRunConfig, requested string) (string, flowRunProfile, error) {
	name := strings.TrimSpace(requested)
	if name == "" {
		name = strings.TrimSpace(os.Getenv("KEST_PROFILE"))
	}
	if name == "" {
		name = defaultFlowProfileName
	}

	profile, ok := cfg.Profiles[name]
	if !ok {
		names := make([]string, 0, len(cfg.Profiles))
		for key := range cfg.Profiles {
			names = append(names, key)
		}
		sort.Strings(names)
		return "", flowRunProfile{}, fmt.Errorf("unknown flow profile %q (available: %s)", name, strings.Join(names, ", "))
	}

	return name, profile, nil
}

func findKestWorkspaceRoot() (string, error) {
	curr, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		if _, err := os.Stat(filepath.Join(curr, ".kest")); err == nil {
			return curr, nil
		}

		parent := filepath.Dir(curr)
		if parent == curr {
			break
		}
		curr = parent
	}
	return "", nil
}

func resolveRunTargets(args []string, profile flowRunProfile, root string) ([]string, error) {
	patterns := args
	if len(patterns) == 0 {
		patterns = profile.Include
	}
	if len(patterns) == 0 {
		return nil, fmt.Errorf("no flow targets provided and profile has no include patterns")
	}

	var candidates []string
	for _, pattern := range patterns {
		resolved, err := resolveRunTarget(pattern, root)
		if err != nil {
			return nil, err
		}
		candidates = append(candidates, resolved...)
	}

	excluded := make(map[string]struct{})
	for _, pattern := range profile.Exclude {
		resolved, err := resolveRunTarget(pattern, root)
		if err != nil {
			return nil, err
		}
		for _, path := range resolved {
			excluded[normalizeTargetPath(path)] = struct{}{}
		}
	}

	seen := make(map[string]struct{}, len(candidates))
	var targets []string
	for _, path := range candidates {
		key := normalizeTargetPath(path)
		if _, skip := excluded[key]; skip {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		targets = append(targets, path)
	}
	sort.Strings(targets)

	if len(targets) == 0 {
		return nil, fmt.Errorf("no .flow.md or .kest targets matched")
	}
	return targets, nil
}

func resolveRunTarget(target string, root string) ([]string, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return nil, nil
	}

	searchTarget := target
	if root != "" && !filepath.IsAbs(searchTarget) {
		searchTarget = filepath.Join(root, searchTarget)
	}

	if hasGlobMeta(searchTarget) {
		if strings.Contains(searchTarget, "**") {
			return resolveRecursiveGlob(searchTarget)
		}
		matches, err := filepath.Glob(searchTarget)
		if err != nil {
			return nil, err
		}
		var out []string
		for _, match := range matches {
			resolved, err := expandRunPath(match)
			if err != nil {
				return nil, err
			}
			out = append(out, resolved...)
		}
		return out, nil
	}

	return expandRunPath(searchTarget)
}

func resolveRecursiveGlob(pattern string) ([]string, error) {
	prefix := pattern
	if idx := strings.Index(prefix, "**"); idx >= 0 {
		prefix = prefix[:idx]
	}
	prefix = strings.TrimRight(prefix, string(filepath.Separator))
	if prefix == "" {
		prefix = "."
	}
	if hasGlobMeta(prefix) {
		prefix = strings.Split(prefix, "*")[0]
	}
	base := filepath.Clean(prefix)
	if _, err := os.Stat(base); err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	suffix := strings.TrimPrefix(pattern[strings.Index(pattern, "**")+2:], string(filepath.Separator))
	suffix = strings.TrimPrefix(suffix, "/")

	var out []string
	if err := filepath.WalkDir(base, func(current string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			if entry.Name() == "node_modules" || entry.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}
		if suffix != "" {
			matched, err := filepath.Match(suffix, filepath.Base(current))
			if err != nil {
				return err
			}
			if !matched {
				return nil
			}
		}
		if isRunnableFlowPath(current) {
			out = append(out, current)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return out, nil
}

func expandRunPath(path string) ([]string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		if isRunnableFlowPath(path) {
			return []string{path}, nil
		}
		return nil, fmt.Errorf("unsupported run target %s (expected .flow.md or .kest)", path)
	}

	var out []string
	if err := filepath.WalkDir(path, func(current string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			if entry.Name() == "node_modules" || entry.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}
		if isRunnableFlowPath(current) {
			out = append(out, current)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return out, nil
}

func hasGlobMeta(path string) bool {
	return strings.ContainsAny(path, "*?[")
}

func isRunnableFlowPath(path string) bool {
	return strings.HasSuffix(path, ".flow.md") || strings.HasSuffix(path, ".kest")
}

func normalizeTargetPath(path string) string {
	abs, err := filepath.Abs(path)
	if err != nil {
		return filepath.Clean(path)
	}
	return filepath.Clean(abs)
}

func displaySourcePath(path string, root string) string {
	if root != "" {
		if rel, err := filepath.Rel(root, path); err == nil && !strings.HasPrefix(rel, "..") {
			return filepath.ToSlash(rel)
		}
	}
	return filepath.ToSlash(path)
}
