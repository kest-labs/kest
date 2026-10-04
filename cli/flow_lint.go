package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/cobra"
)

// Lint severities.
const (
	lintError   = "error"
	lintWarning = "warning"
	lintInfo    = "info"
)

// LintFinding is one problem reported by `kest lint`. Secret values are never
// stored in a finding.
type LintFinding struct {
	Rule       string `json:"rule"`
	Severity   string `json:"severity"`
	File       string `json:"file"`
	Line       int    `json:"line,omitempty"`
	Step       string `json:"step,omitempty"`
	Message    string `json:"message"`
	Suggestion string `json:"suggestion,omitempty"`
	Fixable    bool   `json:"fixable,omitempty"`
}

// lintFile is a flow file loaded for linting.
type lintFile struct {
	Path    string
	Content string
	Lines   []string
	Blocks  []FlowBlock
	Doc     FlowDoc
	Legacy  []KestBlock
}

func newLintFile(path, content string) *lintFile {
	f := &lintFile{Path: path, Content: content, Lines: strings.Split(content, "\n")}
	quietly(func() {
		f.Blocks = ParseFlowMarkdown(content)
		f.Doc, f.Legacy = ParseFlowDocument(content)
	})
	return f
}

// quietly runs fn with stdout discarded: the flow parser prints warnings that
// would corrupt `kest lint --json`.
func quietly(fn func()) {
	devNull, err := os.OpenFile(os.DevNull, os.O_WRONLY, 0)
	if err != nil {
		fn()
		return
	}
	old := os.Stdout
	os.Stdout = devNull
	defer func() {
		os.Stdout = old
		devNull.Close()
	}()
	fn()
}

// isFlowMode mirrors the decision in runScenarioWithResult: a markdown file
// with any flow block (or a flow id) runs as a flow document and its legacy
// blocks are ignored; otherwise the legacy blocks run one by one.
func (f *lintFile) isFlowMode() bool {
	d := f.Doc
	return len(d.Setup) > 0 || len(d.Steps) > 0 || len(d.Teardown) > 0 || len(d.Edges) > 0 || d.Meta.ID != ""
}

// lintRule describes one rule. Check runs per file, CheckAll once over the
// whole linted set, Fix (optional) rewrites a file's content.
type lintRule struct {
	Name        string
	Severity    string
	Description string
	Check       func(f *lintFile) []LintFinding
	CheckAll    func(files []*lintFile) []LintFinding
	Fix         func(f *lintFile) fixResult
}

// fixResult is the outcome of one fixer on one file.
type fixResult struct {
	Content string        // new content (equal to the input when nothing changed)
	Fixed   []LintFinding // findings that were fixed
	Skipped []LintFinding // findings that were reported fixable-in-principle but not fixed; Message holds the reason
}

// lintRules returns all rules in reporting order.
func lintRules() []lintRule {
	return []lintRule{
		{Name: "invalid-flow", Severity: lintError, Description: "steps without METHOD/URL, edges to unknown steps, duplicate step ids, broken @use", Check: checkInvalidFlow},
		{Name: "redundant-edge", Severity: lintWarning, Description: "edge that only links a step to the next one with @on success (flows are sequential by default)", Check: checkRedundantEdge, Fix: fixRedundantEdge},
		{Name: "trailing-delete-cleanup", Severity: lintWarning, Description: "trailing DELETE steps that clean up captured resources; move them into a teardown block", Check: checkTrailingDelete, Fix: fixTrailingDelete},
		{Name: "inline-secret", Severity: lintWarning, Description: "literal password/token/secret/api key/Authorization value; use {{$env.NAME}}", Check: checkInlineSecret},
		{Name: "legacy-format", Severity: lintWarning, Description: "legacy ```kest block format; convert to ```step", Check: checkLegacyFormat, Fix: fixLegacyFormat},
		{Name: "duplicate-step-block", Severity: lintInfo, Description: "identical request block repeated in 3+ files; share it with @use", CheckAll: checkDuplicateBlocks},
		{Name: "missing-assert", Severity: lintWarning, Description: "HTTP step with no assertions", Check: checkMissingAssert},
		{Name: "unreferenced-capture", Severity: lintWarning, Description: "captured variable that no later step uses", Check: checkUnreferencedCapture},
	}
}

// fixOrder is the order fixers run in. legacy-format first so the other
// fixers see ```step blocks.
var fixOrder = []string{"legacy-format", "redundant-edge", "trailing-delete-cleanup"}

type lintOptions struct {
	Paths  []string
	Fix    bool
	Rules  []string // when non-empty, only these rules run
	Ignore []string // rules to skip
	// FailOn is the lowest severity that makes the run fail: error (default),
	// warning, info or never.
	FailOn string
}

// LintFileFix records what --fix did to one file.
type LintFileFix struct {
	File    string   `json:"file"`
	Rules   []string `json:"rules"`
	Applied int      `json:"applied"`
	Written bool     `json:"written"`
}

// LintSkippedFix explains why a fixable finding was left alone.
type LintSkippedFix struct {
	File   string `json:"file"`
	Rule   string `json:"rule"`
	Line   int    `json:"line,omitempty"`
	Reason string `json:"reason"`
}

// LintReport is the result of linting a set of paths.
type LintReport struct {
	SchemaVersion int              `json:"schema_version"`
	Command       string           `json:"command"`
	OK            bool             `json:"ok"`
	Summary       LintSummary      `json:"summary"`
	Findings      []LintFinding    `json:"findings"`
	Fixes         []LintFileFix    `json:"fixes,omitempty"`
	Skipped       []LintSkippedFix `json:"skipped_fixes,omitempty"`
}

// LintSummary counts files and findings.
type LintSummary struct {
	Files    int `json:"files"`
	Errors   int `json:"errors"`
	Warnings int `json:"warnings"`
	Info     int `json:"info"`
	Fixed    int `json:"fixed"`
}

func selectRules(opts lintOptions) ([]lintRule, error) {
	all := lintRules()
	known := map[string]bool{}
	for _, r := range all {
		known[r.Name] = true
	}
	for _, name := range append(append([]string{}, opts.Rules...), opts.Ignore...) {
		if !known[name] {
			names := make([]string, 0, len(all))
			for _, r := range all {
				names = append(names, r.Name)
			}
			return nil, fmt.Errorf("unknown lint rule %q (available: %s)", name, strings.Join(names, ", "))
		}
	}
	only := map[string]bool{}
	for _, n := range opts.Rules {
		only[n] = true
	}
	skip := map[string]bool{}
	for _, n := range opts.Ignore {
		skip[n] = true
	}
	var out []lintRule
	for _, r := range all {
		if len(only) > 0 && !only[r.Name] {
			continue
		}
		if skip[r.Name] {
			continue
		}
		out = append(out, r)
	}
	return out, nil
}

// discoverLintFiles expands files and directories into a sorted, de-duplicated
// list of .flow.md paths.
func discoverLintFiles(paths []string) ([]string, error) {
	if len(paths) == 0 {
		paths = []string{"."}
	}
	seen := map[string]bool{}
	var out []string
	add := func(p string) {
		key := normalizeTargetPath(p)
		if !seen[key] {
			seen[key] = true
			out = append(out, p)
		}
	}
	for _, p := range paths {
		info, err := os.Stat(p)
		if err != nil {
			return nil, err
		}
		if !info.IsDir() {
			if !strings.HasSuffix(p, ".flow.md") {
				return nil, fmt.Errorf("%s: not a .flow.md file", p)
			}
			add(p)
			continue
		}
		err = filepath.WalkDir(p, func(cur string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if d.IsDir() {
				switch d.Name() {
				case "node_modules", ".git", "vendor":
					return filepath.SkipDir
				}
				return nil
			}
			if strings.HasSuffix(cur, ".flow.md") {
				add(cur)
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	sort.Strings(out)
	return out, nil
}

// runLint lints (and optionally fixes) the files under opts.Paths.
func runLint(opts lintOptions) (*LintReport, error) {
	rules, err := selectRules(opts)
	if err != nil {
		return nil, err
	}
	paths, err := discoverLintFiles(opts.Paths)
	if err != nil {
		return nil, err
	}

	report := &LintReport{SchemaVersion: 1, Command: "lint", Findings: []LintFinding{}}
	files := make([]*lintFile, 0, len(paths))
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		f := newLintFile(p, string(data))
		if opts.Fix {
			f = fixLintFile(f, rules, report)
		}
		files = append(files, f)
	}

	for _, r := range rules {
		if r.Check != nil {
			for _, f := range files {
				report.Findings = append(report.Findings, r.Check(f)...)
			}
		}
		if r.CheckAll != nil {
			report.Findings = append(report.Findings, r.CheckAll(files)...)
		}
	}
	sort.SliceStable(report.Findings, func(i, j int) bool {
		a, b := report.Findings[i], report.Findings[j]
		if a.File != b.File {
			return a.File < b.File
		}
		if a.Line != b.Line {
			return a.Line < b.Line
		}
		return a.Rule < b.Rule
	})

	report.Summary.Files = len(files)
	for _, f := range report.Findings {
		switch f.Severity {
		case lintError:
			report.Summary.Errors++
		case lintWarning:
			report.Summary.Warnings++
		default:
			report.Summary.Info++
		}
	}
	for _, fx := range report.Fixes {
		report.Summary.Fixed += fx.Applied
	}
	report.OK = !lintFails(report, opts.FailOn)
	return report, nil
}

func lintFails(r *LintReport, failOn string) bool {
	switch failOn {
	case "never":
		return false
	case lintInfo:
		return r.Summary.Errors+r.Summary.Warnings+r.Summary.Info > 0
	case lintWarning:
		return r.Summary.Errors+r.Summary.Warnings > 0
	default:
		return r.Summary.Errors > 0
	}
}

// ---- command ---------------------------------------------------------------

var (
	lintFix    bool
	lintRuleF  []string
	lintIgnore []string
	lintFailOn string
	lintList   bool
)

var lintCmd = &cobra.Command{
	Use:   "lint [paths...]",
	Short: "Lint .flow.md files for boilerplate, secrets and legacy syntax",
	Long: `Check flow files and report problems; --fix rewrites the safe ones.

Rules:
  invalid-flow             (error)   steps without METHOD/URL, edges to unknown steps, duplicate ids, broken @use
  redundant-edge           (warning) edge that only links a step to the next one; flows are sequential by default   [fixable]
  trailing-delete-cleanup  (warning) trailing DELETE steps that should be a teardown block                          [fixable]
  inline-secret            (warning) literal password/token/secret/api key; use {{$env.NAME}}
  legacy-format            (warning) legacy ` + "```kest" + ` blocks                                                       [fixable]
  duplicate-step-block     (info)    identical request block in 3+ files; share it with @use
  missing-assert           (warning) HTTP step with no assertions
  unreferenced-capture     (warning) captured variable no later step uses

--fix never changes what a flow does: every fix is re-parsed and the resulting
execution plan is compared with the original. A fix that cannot be proven
equivalent is skipped and explained.

Exit code: 0 clean, 1 findings at or above --fail-on (default: error), 3 usage error.`,
	Example: `  kest lint
  kest lint .kest/flow --json
  kest lint --fix
  kest lint --fix --rule legacy-format old/
  kest lint --disable missing-assert,unreferenced-capture`,
	SilenceUsage:  true,
	SilenceErrors: true, // findings are the output; exit code carries the verdict
	RunE: func(cmd *cobra.Command, args []string) error {
		if lintList {
			for _, r := range lintRules() {
				fix := ""
				if r.Fix != nil {
					fix = " (fixable)"
				}
				fmt.Printf("%-24s %-8s %s%s\n", r.Name, r.Severity, r.Description, fix)
			}
			return nil
		}
		switch lintFailOn {
		case "", lintError, lintWarning, lintInfo, "never":
		default:
			return &ExitError{Code: ExitConfigError, Err: fmt.Errorf("invalid --fail-on %q (use error, warning, info or never)", lintFailOn)}
		}
		report, err := runLint(lintOptions{
			Paths:  args,
			Fix:    lintFix,
			Rules:  splitCSVs(lintRuleF),
			Ignore: splitCSVs(lintIgnore),
			FailOn: lintFailOn,
		})
		if err != nil {
			return &ExitError{Code: ExitConfigError, Err: err}
		}
		if jsonModeRequested() {
			enc := json.NewEncoder(cmd.OutOrStdout())
			enc.SetIndent("", "  ")
			if err := enc.Encode(report); err != nil {
				return &ExitError{Code: ExitRuntimeError, Err: err}
			}
		} else {
			printLintReport(cmd, report)
		}
		if !report.OK {
			return &ExitError{Code: ExitAssertionFailed, Err: fmt.Errorf("lint found %d error(s), %d warning(s)", report.Summary.Errors, report.Summary.Warnings)}
		}
		return nil
	},
}

func splitCSVs(values []string) []string {
	var out []string
	for _, v := range values {
		out = append(out, splitCSV(v)...)
	}
	return out
}

func printLintReport(cmd *cobra.Command, r *LintReport) {
	w := cmd.OutOrStdout()
	for _, fx := range r.Fixes {
		fmt.Fprintf(w, "fixed %s: %d change(s) (%s)\n", fx.File, fx.Applied, strings.Join(fx.Rules, ", "))
	}
	for _, s := range r.Skipped {
		fmt.Fprintf(w, "not fixed %s:%d [%s] %s\n", s.File, s.Line, s.Rule, s.Reason)
	}
	for _, f := range r.Findings {
		loc := f.File
		if f.Line > 0 {
			loc = fmt.Sprintf("%s:%d", f.File, f.Line)
		}
		fmt.Fprintf(w, "%s: %s [%s] %s\n", loc, f.Severity, f.Rule, f.Message)
		if f.Suggestion != "" {
			fmt.Fprintf(w, "    -> %s\n", f.Suggestion)
		}
	}
	fmt.Fprintf(w, "\n%d file(s): %d error(s), %d warning(s), %d info", r.Summary.Files, r.Summary.Errors, r.Summary.Warnings, r.Summary.Info)
	if r.Summary.Fixed > 0 {
		fmt.Fprintf(w, ", %d fixed", r.Summary.Fixed)
	}
	fmt.Fprintln(w)
	if !lintFix {
		for _, f := range r.Findings {
			if f.Fixable {
				fmt.Fprintln(w, "Some findings are auto-fixable: run `kest lint --fix`.")
				break
			}
		}
	}
}

func init() {
	lintCmd.Flags().BoolVar(&lintFix, "fix", false, "Rewrite files to fix safe findings (redundant-edge, trailing-delete-cleanup, legacy-format)")
	lintCmd.Flags().StringArrayVar(&lintRuleF, "rule", nil, "Only run these rules (repeatable or comma separated)")
	lintCmd.Flags().StringArrayVar(&lintIgnore, "disable", nil, "Skip these rules (repeatable or comma separated)")
	lintCmd.Flags().StringVar(&lintFailOn, "fail-on", "error", "Lowest severity that fails the run: error, warning, info or never")
	lintCmd.Flags().BoolVar(&lintList, "list-rules", false, "List the available rules and exit")
	rootCmd.AddCommand(lintCmd)
}
