package main

import (
	"runtime"
	"strconv"
	"strings"
	"sync"

	"github.com/tidwall/gjson"
)

// VariableSource tracks where a variable came from and its status
type VariableSource struct {
	Value      string
	SourceStep string // which step captured this variable
	StepStatus string // "success" or "failed"
	SourceType string // "cli", "capture", "config", "builtin"
}

// RunContext holds all runtime state for a single kest run invocation.
// It replaces the previous global CLIVars map with a properly scoped,
// thread-safe variable store that supports the full resolution chain:
//
//	config env vars → runtime captured vars → CLI --var flags → exec captures
type RunContext struct {
	mu      sync.RWMutex
	vars    map[string]string          // accumulated variables (CLI + exec captures)
	sources map[string]*VariableSource // track variable sources and status
}

// NewRunContext creates a RunContext seeded with CLI --var flags.
func NewRunContext(cliVars map[string]string) *RunContext {
	vars := make(map[string]string, len(cliVars))
	sources := make(map[string]*VariableSource, len(cliVars))
	for k, v := range cliVars {
		vars[k] = v
		sources[k] = &VariableSource{
			Value:      v,
			SourceType: "cli",
			StepStatus: "success",
		}
	}
	return &RunContext{
		vars:    vars,
		sources: sources,
	}
}

// Get returns a variable value and whether it exists.
func (rc *RunContext) Get(key string) (string, bool) {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	v, ok := rc.vars[key]
	return v, ok
}

// Set stores a variable (used by exec captures and request captures).
func (rc *RunContext) Set(key, value string) {
	rc.SetWithSource(key, value, "", "success", "capture")
}

// SetWithSource stores a variable with source tracking.
func (rc *RunContext) SetWithSource(key, value, stepName, stepStatus, sourceType string) {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	rc.vars[key] = value
	rc.sources[key] = &VariableSource{
		Value:      value,
		SourceStep: stepName,
		StepStatus: stepStatus,
		SourceType: sourceType,
	}
}

// GetSource returns the source information for a variable.
func (rc *RunContext) GetSource(key string) (*VariableSource, bool) {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	src, ok := rc.sources[key]
	return src, ok
}

// MarkStepFailed marks all variables from a step as failed.
func (rc *RunContext) MarkStepFailed(stepName string) {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	for _, src := range rc.sources {
		if src.SourceStep == stepName {
			src.StepStatus = "failed"
		}
	}
}

// All returns a copy of all variables.
func (rc *RunContext) All() map[string]string {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	out := make(map[string]string, len(rc.vars))
	for k, v := range rc.vars {
		out[k] = v
	}
	return out
}

// ActiveRunCtx is the current run context. It is set at the start of
// runScenario and cleared when the run completes. Ad-hoc commands
// (kest get/post) work fine when this is nil — they simply have no
// CLI vars to inject.
var ActiveRunCtx *RunContext

// ParseCaptureExpr splits a capture expression like "token=data.auth.key"
// into (varName, query). Supports both "=" and ":" as separators.
func ParseCaptureExpr(expr string) (varName, query string, ok bool) {
	sep := "="
	if !strings.Contains(expr, "=") && strings.Contains(expr, ":") {
		sep = ":"
	}
	parts := strings.SplitN(expr, sep, 2)
	if len(parts) != 2 {
		return "", "", false
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), true
}

// ResolveExecCapture extracts a value from exec stdout based on the query.
//
// Supported query formats:
//   - $stdout        → entire stdout
//   - $line.N        → Nth line (0-indexed)
//   - <gjson path>   → parse stdout as JSON, extract via gjson
func ResolveExecCapture(output string, query string) string {
	lines := strings.Split(output, "\n")

	switch {
	case query == "$stdout":
		return output

	case strings.HasPrefix(query, "$line."):
		idxStr := strings.TrimPrefix(query, "$line.")
		idx, err := strconv.Atoi(idxStr)
		if err != nil || idx < 0 || idx >= len(lines) {
			return ""
		}
		return strings.TrimSpace(lines[idx])

	default:
		// Try gjson on stdout (if stdout is JSON)
		r := gjson.Get(output, query)
		if r.Exists() {
			return r.String()
		}
		return ""
	}
}

// ShellCommand returns the platform-appropriate shell and flag for exec steps.
func ShellCommand() (shell string, flag string) {
	if runtime.GOOS == "windows" {
		return "cmd", "/C"
	}
	return "sh", "-c"
}
