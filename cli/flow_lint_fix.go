package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
)

func asIncludeError(err error, target **FlowIncludeError) bool {
	return errors.As(err, target)
}

// ---- plans -------------------------------------------------------------------

// lintPlan is the execution plan of a file as `kest run` would see it: the
// flow plan in flow mode, otherwise the legacy blocks run one by one.
func lintPlan(f *lintFile) []FlowPlanEntry {
	if f.isFlowMode() {
		return BuildFlowPlan(f.Doc)
	}
	plan := []FlowPlanEntry{}
	for i, kb := range f.Legacy {
		opts, err := ParseBlock(kb.Raw)
		e := FlowPlanEntry{Phase: "step", ID: fmt.Sprintf("step-%d", i+1)}
		if err == nil {
			e.Method = strings.ToUpper(opts.Method)
			e.URL = opts.URL
			e.Headers = opts.Headers
			e.Queries = opts.Queries
			e.Body = opts.Data
			e.Captures = opts.Captures
			e.Asserts = opts.Asserts
			e.SoftAsserts = opts.SoftAsserts
		} else {
			e.Command = "INVALID: " + err.Error()
		}
		plan = append(plan, e)
	}
	return plan
}

// lintPlansEquivalent proves that rewriting a into b did not change what runs.
// Crossing the legacy -> flow boundary ignores trailing whitespace of bodies,
// which the two parsers trim differently.
func lintPlansEquivalent(a, b *lintFile) bool {
	pa, pb := lintPlan(a), lintPlan(b)
	if a.isFlowMode() != b.isFlowMode() {
		for i := range pa {
			pa[i].Body = strings.TrimSpace(pa[i].Body)
		}
		for i := range pb {
			pb[i].Body = strings.TrimSpace(pb[i].Body)
		}
	}
	if !flowPlansEquivalent(pa, pb) {
		return false
	}
	// Metadata (id, env, defaults, includes) must be untouched.
	return reflect.DeepEqual(a.Doc.Meta, b.Doc.Meta)
}

// ---- driver ------------------------------------------------------------------

// fixLintFile runs the enabled fixers on f in order, proving after each one
// that the execution plan is unchanged, and writes the file if anything
// changed. It returns the (possibly rewritten) file.
func fixLintFile(orig *lintFile, rules []lintRule, report *LintReport) *lintFile {
	byName := map[string]lintRule{}
	for _, r := range rules {
		byName[r.Name] = r
	}
	cur := orig
	var appliedRules []string
	applied := 0
	for _, name := range fixOrder {
		r, ok := byName[name]
		if !ok || r.Fix == nil {
			continue
		}
		res := r.Fix(cur)
		for _, s := range res.Skipped {
			report.Skipped = append(report.Skipped, LintSkippedFix{File: cur.Path, Rule: s.Rule, Line: s.Line, Reason: s.Message})
		}
		if res.Content == cur.Content {
			continue
		}
		next := newLintFile(cur.Path, res.Content)
		if !lintPlansEquivalent(cur, next) {
			for _, fx := range res.Fixed {
				report.Skipped = append(report.Skipped, LintSkippedFix{File: cur.Path, Rule: name, Line: fx.Line, Reason: "fix could not be proven to leave the execution plan unchanged; file left as is"})
			}
			continue
		}
		cur = next
		appliedRules = append(appliedRules, name)
		applied += len(res.Fixed)
	}
	if cur != orig {
		fx := LintFileFix{File: cur.Path, Rules: appliedRules, Applied: applied}
		if err := writeFileAtomic(cur.Path, cur.Content); err == nil {
			fx.Written = true
		} else {
			report.Skipped = append(report.Skipped, LintSkippedFix{File: cur.Path, Rule: "fix", Reason: "could not write file: " + err.Error()})
			return orig
		}
		report.Fixes = append(report.Fixes, fx)
	}
	return cur
}

func writeFileAtomic(path, content string) error {
	mode := os.FileMode(0o644)
	if info, err := os.Stat(path); err == nil {
		mode = info.Mode().Perm()
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".kest-lint-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	if _, err := tmp.WriteString(content); err != nil {
		tmp.Close()
		os.Remove(name)
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(name)
		return err
	}
	if err := os.Chmod(name, mode); err != nil {
		os.Remove(name)
		return err
	}
	return os.Rename(name, path)
}

// ---- line editing helpers ----------------------------------------------------

func eolOf(content string) string {
	if strings.Contains(content, "\r\n") {
		return "\r\n"
	}
	return "\n"
}

func isBlankLine(l string) bool { return strings.TrimSpace(l) == "" }

// deleteBlockLines removes lines [start,end] (1-based, inclusive) from lines,
// collapsing the blank line the removal would otherwise leave doubled.
func deleteBlockLines(lines []string, start, end int) []string {
	out := append(append([]string{}, lines[:start-1]...), lines[end:]...)
	i := start - 1
	if i < len(out) && i >= 1 && isBlankLine(out[i]) && isBlankLine(out[i-1]) {
		out = append(out[:i], out[i+1:]...)
	}
	return out
}

// ---- redundant-edge fixer ----------------------------------------------------

func fixRedundantEdge(f *lintFile) fixResult {
	res := fixResult{Content: f.Content}
	cands := redundantEdges(f)
	var blocks []edgeCand
	for _, c := range cands {
		if c.Safe {
			blocks = append(blocks, c)
		} else {
			res.Skipped = append(res.Skipped, LintFinding{Rule: "redundant-edge", Line: c.Edge.LineNum, Message: "removing this edge would change the step order"})
		}
	}
	if len(blocks) == 0 {
		return res
	}
	lines := append([]string{}, f.Lines...)
	// Delete bottom-up so earlier line numbers stay valid.
	for i := len(blocks) - 1; i >= 0; i-- {
		c := blocks[i]
		lines = deleteBlockLines(lines, c.Block.LineNum, c.Block.EndLine)
		res.Fixed = append(res.Fixed, LintFinding{Rule: "redundant-edge", File: f.Path, Line: c.Edge.LineNum})
	}
	res.Content = strings.Join(lines, "\n")
	return res
}

// ---- trailing-delete-cleanup fixer -------------------------------------------

var (
	stepFenceRe = regexp.MustCompile("^(\\s*(?:```|~~~)\\s*)step\\b")
	idDirective = regexp.MustCompile(`(?m)^\s*@id\b`)
)

func fixTrailingDelete(f *lintFile) fixResult {
	res := fixResult{Content: f.Content}
	td := findTrailingDeletes(f)
	if td == nil {
		return res
	}
	if td.Reason != "" {
		res.Skipped = append(res.Skipped, LintFinding{Rule: "trailing-delete-cleanup", Line: td.Steps[0].LineNum, Message: td.Reason})
		return res
	}
	eol := eolOf(f.Content)
	cr := ""
	if eol == "\r\n" {
		cr = "\r"
	}
	index := map[int]int{} // block line -> position among doc.Steps
	for i, s := range f.Doc.Steps {
		index[s.LineNum] = i
	}
	lines := append([]string{}, f.Lines...)
	for i := len(td.Blocks) - 1; i >= 0; i-- { // bottom-up: inserts shift later lines only
		b := td.Blocks[i]
		fence := lines[b.LineNum-1]
		if !stepFenceRe.MatchString(fence) {
			return fixResult{Content: f.Content, Skipped: []LintFinding{{Rule: "trailing-delete-cleanup", Line: b.LineNum, Message: "unexpected fence format"}}}
		}
		lines[b.LineNum-1] = stepFenceRe.ReplaceAllString(fence, "${1}teardown")
		if !idDirective.MatchString(b.Raw) {
			// Keep the implicit id ("step-N" by position) so the step is
			// still identified the same way in reports.
			id := fmt.Sprintf("@id step-%d", index[b.LineNum]+1)
			lines = append(lines[:b.LineNum], append([]string{id + cr}, lines[b.LineNum:]...)...)
		}
		res.Fixed = append(res.Fixed, LintFinding{Rule: "trailing-delete-cleanup", File: f.Path, Line: b.LineNum, Step: td.Steps[i].ID})
	}
	res.Content = strings.Join(lines, "\n")
	return res
}

// ---- legacy-format fixer -----------------------------------------------------

type legacyConversion struct {
	Blocks []FlowBlock
	Reason string // non-empty: no faithful conversion exists
}

func planLegacyConversion(f *lintFile) legacyConversion {
	var conv legacyConversion
	for _, b := range f.Blocks {
		switch b.Kind {
		case "kest":
			conv.Blocks = append(conv.Blocks, b)
		case "step", "setup", "teardown", "edge":
			conv.Reason = fmt.Sprintf("the file also has ```%s blocks, so `kest run` ignores the legacy blocks today; converting them would start running them", b.Kind)
			return conv
		case "http", "json":
			conv.Reason = fmt.Sprintf("the file also has ```%s blocks that kest runs as legacy requests", b.Kind)
			return conv
		case "flow":
			if !isFlowMetaBlock(b.Raw) {
				conv.Reason = "the file has a non-metadata ```flow block that kest runs as a legacy request"
				return conv
			}
		}
	}
	if f.Doc.Meta.ID != "" {
		conv.Reason = "the flow metadata declares an id, so `kest run` already treats the file as a flow with no steps"
		return conv
	}
	for _, b := range conv.Blocks {
		if first := strings.TrimSpace(strings.SplitN(b.Raw, "\n", 2)[0]); strings.HasPrefix(first, "#") || strings.HasPrefix(first, "@") {
			conv.Reason = fmt.Sprintf("the block at line %d starts with a comment/directive line: the legacy parser sends it as the request line, the step format skips it", b.LineNum)
			return conv
		}
		opts, err := ParseBlock(b.Raw)
		if err != nil {
			conv.Reason = fmt.Sprintf("the block at line %d is not a valid request (%v)", b.LineNum, err)
			return conv
		}
		// The step parser trims the request, the legacy parser keeps a
		// trailing newline in the body. That is invisible for JSON but could
		// matter for other payloads, so only JSON bodies may differ.
		if trimmed := strings.TrimSpace(opts.Data); trimmed != opts.Data && !looksLikeJSON(trimmed) {
			conv.Reason = fmt.Sprintf("the body of the block at line %d has trailing whitespace that the step format would drop", b.LineNum)
			return conv
		}
	}
	return conv
}

// looksLikeJSON is true for valid JSON and for JSON with {{placeholders}} in
// value position, which is not valid JSON until interpolated.
func looksLikeJSON(s string) bool {
	return json.Valid([]byte(s)) || strings.HasPrefix(s, "{") || strings.HasPrefix(s, "[")
}

var kestFenceRe = regexp.MustCompile("(?i)^(\\s*(?:```|~~~)\\s*)kest\\b")

func fixLegacyFormat(f *lintFile) fixResult {
	res := fixResult{Content: f.Content}
	conv := planLegacyConversion(f)
	if len(conv.Blocks) == 0 {
		return res
	}
	if conv.Reason != "" {
		res.Skipped = append(res.Skipped, LintFinding{Rule: "legacy-format", Line: conv.Blocks[0].LineNum, Message: conv.Reason})
		return res
	}
	lines := append([]string{}, f.Lines...)
	for _, b := range conv.Blocks {
		fence := lines[b.LineNum-1]
		if !kestFenceRe.MatchString(fence) {
			return fixResult{Content: f.Content, Skipped: []LintFinding{{Rule: "legacy-format", Line: b.LineNum, Message: "unexpected fence format"}}}
		}
		lines[b.LineNum-1] = kestFenceRe.ReplaceAllString(fence, "${1}step")
		// The legacy parser drops `# trailing comments` from capture and
		// assertion lines; the step parser keeps them. Strip them so the
		// converted step asserts exactly what the legacy block did.
		section := ""
		for ln := b.LineNum + 1; ln < b.EndLine; ln++ {
			trimmed := strings.TrimSpace(lines[ln-1])
			switch trimmed {
			case "[Captures]", "[Asserts]", "[Soft Asserts]":
				section = trimmed
				continue
			case "[Queries]", "[Headers]", "[Body]", "[Data]":
				section = ""
				continue
			}
			if section == "" || trimmed == "" || strings.HasPrefix(trimmed, "#") || !strings.Contains(trimmed, "#") {
				continue
			}
			stripped := strings.TrimSpace(strings.SplitN(trimmed, "#", 2)[0])
			cr := ""
			if strings.HasSuffix(lines[ln-1], "\r") {
				cr = "\r"
			}
			indent := lines[ln-1][:len(lines[ln-1])-len(strings.TrimLeft(lines[ln-1], " \t"))]
			lines[ln-1] = indent + stripped + cr
		}
		res.Fixed = append(res.Fixed, LintFinding{Rule: "legacy-format", File: f.Path, Line: b.LineNum})
	}
	res.Content = strings.Join(lines, "\n")
	return res
}
