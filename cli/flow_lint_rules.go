package main

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/kest-labs/kest/cli/internal/variable"
)

// duplicateBlockMinFiles is how many files must contain an identical request
// block before duplicate-step-block reports it.
const duplicateBlockMinFiles = 3

// executableKinds are the fenced block kinds kest runs as requests.
var executableKinds = map[string]bool{"step": true, "setup": true, "teardown": true, "kest": true, "http": true, "json": true}

func isSectionHeader(trimmed string) bool {
	switch trimmed {
	case "[Captures]", "[Asserts]", "[Soft Asserts]", "[Wait]", "[Poll]":
		return true
	}
	return false
}

// stepTexts returns every string of a step in which a {{variable}} may appear.
func stepTexts(s FlowStep) []string {
	out := []string{s.Request.URL, s.Request.Data, s.Exec.Command}
	out = append(out, s.Request.Headers...)
	out = append(out, s.Request.Queries...)
	out = append(out, s.Request.Asserts...)
	out = append(out, s.Request.SoftAsserts...)
	out = append(out, s.Request.Forms...)
	return out
}

func stepVarSet(s FlowStep) map[string]bool {
	set := map[string]bool{}
	for _, t := range stepTexts(s) {
		for _, name := range variable.ExtractPlaceholders(t) {
			set[name] = true
		}
	}
	return set
}

func stepCaptureNames(s FlowStep) []string {
	var names []string
	for _, c := range append(append([]string{}, s.Request.Captures...), s.Exec.Captures...) {
		if name, _, ok := ParseCaptureExpr(c); ok && name != "" {
			names = append(names, name)
		}
	}
	return names
}

// executionSteps lists every step in the order the runner executes them.
func executionSteps(doc FlowDoc) []FlowStep {
	var all []FlowStep
	all = append(all, doc.Setup...)
	all = append(all, orderFlowSteps(doc)...)
	all = append(all, doc.Teardown...)
	return all
}

func finding(f *lintFile, rule, severity string, line int, step, msg, suggestion string) LintFinding {
	return LintFinding{Rule: rule, Severity: severity, File: f.Path, Line: line, Step: step, Message: msg, Suggestion: suggestion}
}

func ruleSeverity(name string) string {
	for _, r := range lintRules() {
		if r.Name == name {
			return r.Severity
		}
	}
	return lintWarning
}

// ---- invalid-flow ------------------------------------------------------------

func checkInvalidFlow(f *lintFile) []LintFinding {
	const rule = "invalid-flow"
	var out []LintFinding
	add := func(line int, step, msg, sug string) {
		out = append(out, finding(f, rule, ruleSeverity(rule), line, step, msg, sug))
	}

	if len(f.Doc.Meta.Uses) > 0 {
		if _, err := ExpandFlowIncludes(f.Doc, f.Path); err != nil {
			line := 0
			var ie *FlowIncludeError
			if asIncludeError(err, &ie) {
				line = ie.Line
				add(line, "", ie.Msg, "")
			} else {
				add(0, "", err.Error(), "")
			}
		}
	}

	check := func(steps []FlowStep) {
		for _, s := range steps {
			if s.Type == "exec" {
				if strings.TrimSpace(s.Exec.Command) == "" {
					add(s.LineNum, s.ID, "exec step has no command", "")
				}
				continue
			}
			if s.Request.Method == "" || s.Request.URL == "" {
				add(s.LineNum, s.ID, "step is missing a valid `METHOD URL` request line", "")
			}
		}
	}
	check(f.Doc.Setup)
	check(f.Doc.Steps)
	check(f.Doc.Teardown)

	ids := map[string]int{}
	for _, s := range f.Doc.Steps {
		if prev, dup := ids[s.ID]; dup {
			add(s.LineNum, s.ID, fmt.Sprintf("duplicate step id %q (first used at line %d)", s.ID, prev), "give each step a unique @id")
		} else {
			ids[s.ID] = s.LineNum
		}
	}
	for _, e := range f.Doc.Edges {
		if _, ok := ids[e.From]; !ok {
			add(e.LineNum, "", fmt.Sprintf("edge starts at unknown step %q", e.From), "")
		}
		if _, ok := ids[e.To]; !ok {
			add(e.LineNum, "", fmt.Sprintf("edge points to unknown step %q", e.To), "")
		}
	}
	for _, b := range f.Blocks {
		if b.Kind != "edge" {
			continue
		}
		if e := parseFlowEdge(b); e.From == "" || e.To == "" {
			add(b.LineNum, "", "edge block needs both @from and @to (it is ignored)", "")
		}
	}
	if !f.isFlowMode() { // in flow mode legacy blocks are ignored by the runner
		for _, kb := range f.Legacy {
			if _, err := ParseBlock(kb.Raw); err != nil {
				add(kb.LineNum, "", "invalid request block: "+err.Error(), "")
			}
		}
	}
	return out
}

// ---- redundant-edge ----------------------------------------------------------

type edgeCand struct {
	Edge  FlowEdge
	Block FlowBlock
	Safe  bool // deleting it (together with the other safe ones) keeps the plan identical
}

func isSuccessOn(on string) bool {
	on = strings.ToLower(strings.TrimSpace(on))
	return on == "" || on == "success"
}

// redundantEdges finds linear `@on success` edges between neighbouring steps
// and decides which of them can be deleted without changing the plan.
func redundantEdges(f *lintFile) []edgeCand {
	steps := f.Doc.Steps
	index := map[string]int{}
	for i, s := range steps {
		index[s.ID] = i
	}
	blockAt := map[int]FlowBlock{}
	for _, b := range f.Blocks {
		if b.Kind == "edge" {
			blockAt[b.LineNum] = b
		}
	}
	var cands []edgeCand
	for _, e := range f.Doc.Edges {
		if !isSuccessOn(e.On) {
			continue
		}
		i, okFrom := index[e.From]
		j, okTo := index[e.To]
		b, okBlock := blockAt[e.LineNum]
		if !okFrom || !okTo || !okBlock || j != i+1 {
			continue
		}
		cands = append(cands, edgeCand{Edge: e, Block: b})
	}
	if len(cands) == 0 {
		return nil
	}

	base := BuildFlowPlan(f.Doc)
	removing := map[int]bool{}
	planWithout := func() []FlowPlanEntry {
		d := f.Doc
		d.Edges = nil
		for _, e := range f.Doc.Edges {
			if !removing[e.LineNum] {
				d.Edges = append(d.Edges, e)
			}
		}
		return BuildFlowPlan(d)
	}
	for _, c := range cands {
		removing[c.Edge.LineNum] = true
	}
	if flowPlansEquivalent(base, planWithout()) {
		for i := range cands {
			cands[i].Safe = true
		}
		return cands
	}
	// Removing everything changes the order (non-linear edges interplay);
	// accept edges one at a time, keeping only those that preserve the plan.
	removing = map[int]bool{}
	for i := range cands {
		removing[cands[i].Edge.LineNum] = true
		if flowPlansEquivalent(base, planWithout()) {
			cands[i].Safe = true
		} else {
			delete(removing, cands[i].Edge.LineNum)
		}
	}
	return cands
}

func checkRedundantEdge(f *lintFile) []LintFinding {
	var out []LintFinding
	for _, c := range redundantEdges(f) {
		fd := finding(f, "redundant-edge", ruleSeverity("redundant-edge"), c.Edge.LineNum, c.Edge.From,
			fmt.Sprintf("edge %s -> %s only links a step to the next one; steps already run in file order", c.Edge.From, c.Edge.To),
			"delete the edge block (kest lint --fix)")
		fd.Fixable = c.Safe
		out = append(out, fd)
	}
	return out
}

// ---- trailing-delete-cleanup -------------------------------------------------

type trailingDelete struct {
	Steps  []FlowStep // in execution order
	Blocks []FlowBlock
	Reason string // non-empty: found, but cannot be moved automatically
}

// findTrailingDeletes locates the maximal suffix of DELETE cleanup steps.
func findTrailingDeletes(f *lintFile) *trailingDelete {
	doc := f.Doc
	if len(doc.Steps) < 2 {
		return nil
	}
	ordered := orderFlowSteps(doc)
	k := 0
	for k < len(ordered)-1 { // keep at least one step in the main body
		s := ordered[len(ordered)-1-k]
		if s.Type == "exec" || strings.ToLower(s.Request.Method) != "delete" {
			break
		}
		k++
	}
	if k == 0 {
		return nil
	}
	tail := ordered[len(ordered)-k:]
	head := ordered[:len(ordered)-k]

	// Variables captured before the cleanup (setup + body).
	captured := map[string]bool{}
	for _, s := range append(append([]FlowStep{}, doc.Setup...), head...) {
		for _, n := range stepCaptureNames(s) {
			captured[n] = true
		}
	}
	for _, s := range tail {
		if len(stepCaptureNames(s)) > 0 {
			return nil // later steps may depend on what the DELETE captures
		}
		vars := stepVarSet(s)
		if len(vars) == 0 {
			return nil // a fixed-URL DELETE is not clearly a cleanup of captured state
		}
		for v := range vars {
			if !captured[v] {
				return nil
			}
		}
	}

	td := &trailingDelete{Steps: tail}
	blockAt := map[int]FlowBlock{}
	for _, b := range f.Blocks {
		if b.Kind == "step" {
			blockAt[b.LineNum] = b
		}
	}
	for _, s := range tail {
		b, ok := blockAt[s.LineNum]
		if !ok {
			td.Reason = "step block not found"
			return td
		}
		td.Blocks = append(td.Blocks, b)
	}

	// They must be the last k steps in file order too, so removing them from
	// the main body leaves the remaining order untouched.
	fileTail := doc.Steps[len(doc.Steps)-k:]
	for i := range tail {
		if fileTail[i].ID != tail[i].ID {
			td.Reason = "the cleanup steps are reordered by edges"
			return td
		}
	}
	moved := map[string]bool{}
	for _, s := range tail {
		moved[s.ID] = true
	}
	for _, e := range doc.Edges {
		if moved[e.From] || moved[e.To] {
			td.Reason = "an edge references a cleanup step"
			return td
		}
	}
	lastMoved := 0
	for _, b := range td.Blocks {
		if b.LineNum > lastMoved {
			lastMoved = b.LineNum
		}
	}
	for _, s := range doc.Teardown {
		if s.LineNum < lastMoved {
			td.Reason = "an existing teardown block comes before the cleanup steps"
			return td
		}
	}
	return td
}

func checkTrailingDelete(f *lintFile) []LintFinding {
	td := findTrailingDeletes(f)
	if td == nil {
		return nil
	}
	ids := make([]string, len(td.Steps))
	for i, s := range td.Steps {
		ids[i] = s.ID
	}
	fd := finding(f, "trailing-delete-cleanup", ruleSeverity("trailing-delete-cleanup"), td.Steps[0].LineNum, td.Steps[0].ID,
		fmt.Sprintf("the last %d step(s) (%s) are DELETE cleanup requests; they should live in a ```teardown block", len(td.Steps), strings.Join(ids, ", ")),
		"move them into ```teardown blocks (kest lint --fix)")
	fd.Fixable = td.Reason == ""
	if td.Reason != "" {
		fd.Message += " (cannot be moved automatically: " + td.Reason + ")"
	}
	return []LintFinding{fd}
}

// ---- inline-secret -----------------------------------------------------------

var (
	secretJSONKV  = regexp.MustCompile(`"([A-Za-z0-9_\-]*)"\s*:\s*"((?:[^"\\]|\\.)*)"`)
	secretHeader  = regexp.MustCompile(`^\s*([A-Za-z][A-Za-z0-9_\-]*)\s*:\s*(\S.*?)\s*$`)
	secretKV      = regexp.MustCompile(`(?i)(?:^|[?&\s])(password|passwd|secret|token|api_key|apikey|access_token|client_secret)\s*=\s*([^&\s"']+)`)
	secretBearer  = regexp.MustCompile(`(?i)\bBearer\s+([A-Za-z0-9._~+/=\-]{21,})`)
	secretNonWord = regexp.MustCompile(`[^A-Za-z0-9]+`)
)

func isSecretKey(key string) bool {
	n := strings.ToLower(strings.NewReplacer("_", "", "-", "").Replace(key))
	for _, s := range []string{"password", "passwd", "secret", "token", "apikey", "authorization"} {
		if n == s || strings.HasSuffix(n, s) {
			return true
		}
	}
	return false
}

func isLiteralSecretValue(v string) bool {
	v = strings.TrimSpace(v)
	if v == "" || strings.Contains(v, "{{") || strings.HasPrefix(v, "<") || strings.HasPrefix(v, "$") {
		return false
	}
	return true
}

// secretValueIsLiteral decides if the value of a secret-named key is a
// hard-coded credential. Authorization values follow the length rule for
// Bearer tokens.
func secretValueIsLiteral(key, value string) bool {
	if !isLiteralSecretValue(value) {
		return false
	}
	if strings.EqualFold(strings.NewReplacer("_", "", "-", "").Replace(key), "authorization") {
		fields := strings.Fields(value)
		if len(fields) >= 2 && strings.EqualFold(fields[0], "bearer") {
			return len(fields[1]) > 20 && isLiteralSecretValue(fields[1])
		}
		if len(fields) >= 2 {
			return isLiteralSecretValue(fields[1])
		}
	}
	return true
}

func envNameForKey(key string) string {
	if strings.EqualFold(strings.NewReplacer("_", "", "-", "").Replace(key), "authorization") {
		return "AUTH_TOKEN"
	}
	name := strings.ToUpper(strings.Trim(secretNonWord.ReplaceAllString(key, "_"), "_"))
	if name == "" {
		return "SECRET"
	}
	return name
}

func checkInlineSecret(f *lintFile) []LintFinding {
	var out []LintFinding
	seen := map[string]bool{}
	emit := func(line int, key string) {
		id := fmt.Sprintf("%d|%s", line, strings.ToLower(key))
		if seen[id] {
			return
		}
		seen[id] = true
		name := envNameForKey(key)
		out = append(out, finding(f, "inline-secret", ruleSeverity("inline-secret"), line, "",
			fmt.Sprintf("literal value for %q committed in the flow", key),
			fmt.Sprintf("use {{$env.%s}} and set %s in the environment or .kest/.env", name, name)))
	}
	for _, b := range f.Blocks {
		if !executableKinds[b.Kind] {
			continue
		}
		inRequest := true
		for i, raw := range strings.Split(b.Raw, "\n") {
			line := b.LineNum + 1 + i
			trimmed := strings.TrimSpace(raw)
			if isSectionHeader(trimmed) {
				inRequest = false
				continue
			}
			if !inRequest || trimmed == "" || strings.HasPrefix(trimmed, "#") || strings.HasPrefix(trimmed, "@") {
				continue
			}
			for _, m := range secretJSONKV.FindAllStringSubmatch(raw, -1) {
				if isSecretKey(m[1]) && secretValueIsLiteral(m[1], m[2]) {
					emit(line, m[1])
				}
			}
			if !strings.HasPrefix(trimmed, "{") && !strings.HasPrefix(trimmed, "\"") {
				if m := secretHeader.FindStringSubmatch(raw); m != nil && isSecretKey(m[1]) && secretValueIsLiteral(m[1], m[2]) {
					emit(line, m[1])
				}
			}
			for _, m := range secretKV.FindAllStringSubmatch(raw, -1) {
				if isLiteralSecretValue(m[2]) {
					emit(line, m[1])
				}
			}
			if m := secretBearer.FindStringSubmatch(raw); m != nil {
				emit(line, "Authorization")
			}
		}
	}
	return out
}

// ---- legacy-format -----------------------------------------------------------

func checkLegacyFormat(f *lintFile) []LintFinding {
	first, n := 0, 0
	for _, b := range f.Blocks {
		if b.Kind == "kest" {
			if n == 0 {
				first = b.LineNum
			}
			n++
		}
	}
	if n == 0 {
		return nil
	}
	conv := planLegacyConversion(f)
	msg := fmt.Sprintf("%d legacy ```kest block(s); use ```step blocks", n)
	fd := finding(f, "legacy-format", ruleSeverity("legacy-format"), first, "", msg, "convert with: kest lint --fix --rule legacy-format")
	fd.Fixable = conv.Reason == ""
	if conv.Reason != "" {
		fd.Message += " (cannot be converted automatically: " + conv.Reason + ")"
		fd.Suggestion = "convert the blocks by hand"
	}
	return []LintFinding{fd}
}

// ---- duplicate-step-block ----------------------------------------------------

// blockRequestKey returns a normalized fingerprint of the request part of a
// step block (everything before [Captures]/[Asserts]/...), or "" when the
// request is too small to be worth sharing.
func blockRequestKey(raw string) (key string, title string) {
	var lines []string
	started := false
	for _, l := range strings.Split(raw, "\n") {
		t := strings.TrimSpace(l)
		if isSectionHeader(t) {
			break
		}
		if t == "" {
			continue
		}
		if !started && (strings.HasPrefix(t, "@") || strings.HasPrefix(t, "#")) {
			continue
		}
		started = true
		lines = append(lines, t)
	}
	if len(lines) < 3 {
		return "", ""
	}
	sum := sha1.Sum([]byte(strings.Join(lines, "\n")))
	return hex.EncodeToString(sum[:]), lines[0]
}

func checkDuplicateBlocks(files []*lintFile) []LintFinding {
	type occ struct {
		file  *lintFile
		line  int
		title string
	}
	groups := map[string][]occ{}
	for _, f := range files {
		seenInFile := map[string]bool{}
		for _, b := range f.Blocks {
			if b.Kind != "step" && b.Kind != "setup" && b.Kind != "kest" {
				continue
			}
			key, title := blockRequestKey(b.Raw)
			if key == "" || seenInFile[key] {
				continue
			}
			seenInFile[key] = true
			groups[key] = append(groups[key], occ{f, b.LineNum, title})
		}
	}
	var out []LintFinding
	keys := make([]string, 0, len(groups))
	for k := range groups {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		g := groups[k]
		if len(g) < duplicateBlockMinFiles {
			continue
		}
		for _, o := range g {
			out = append(out, finding(o.file, "duplicate-step-block", ruleSeverity("duplicate-step-block"), o.line, "",
				fmt.Sprintf("this request (%s) is identical in %d files", o.title, len(g)),
				"move it into a shared flow file and include it with `@use ./path/to/shared.flow.md`"))
		}
	}
	return out
}

// ---- missing-assert ----------------------------------------------------------

func checkMissingAssert(f *lintFile) []LintFinding {
	var out []LintFinding
	check := func(steps []FlowStep) {
		for _, s := range steps {
			if s.Type == "exec" || s.Request.Method == "" {
				continue
			}
			if len(s.Request.Asserts) == 0 && len(s.Request.SoftAsserts) == 0 {
				out = append(out, finding(f, "missing-assert", ruleSeverity("missing-assert"), s.LineNum, s.ID,
					fmt.Sprintf("step %q has no assertions", s.ID),
					"add an [Asserts] section (e.g. `status == 200`) or a flow-level @default-assert"))
			}
		}
	}
	check(f.Doc.Setup)
	check(f.Doc.Steps)
	if !f.isFlowMode() {
		for _, kb := range f.Legacy {
			opts, err := ParseBlock(kb.Raw)
			if err != nil {
				continue
			}
			if len(opts.Asserts) == 0 && len(opts.SoftAsserts) == 0 {
				out = append(out, finding(f, "missing-assert", ruleSeverity("missing-assert"), kb.LineNum, "",
					"request has no assertions", "add an [Asserts] section"))
			}
		}
	}
	return out
}

// ---- unreferenced-capture ----------------------------------------------------

func checkUnreferencedCapture(f *lintFile) []LintFinding {
	steps := executionSteps(f.Doc)
	var out []LintFinding
	for i, s := range steps {
		for _, name := range stepCaptureNames(s) {
			used := false
			for _, later := range steps[i+1:] {
				if stepVarSet(later)[name] {
					used = true
					break
				}
			}
			if !used {
				out = append(out, finding(f, "unreferenced-capture", ruleSeverity("unreferenced-capture"), s.LineNum, s.ID,
					fmt.Sprintf("variable %q is captured but no later step uses it", name),
					"remove the capture, or ignore this if another flow reads it"))
			}
		}
	}
	return out
}
