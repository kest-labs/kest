package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kest-labs/kest/cli/internal/output"
)

// runSelection holds the flags that choose which flows and steps `kest run`
// executes.
type runSelection struct {
	tags   []string
	only   []string
	from   string
	skip   []string
	noDeps bool
	list   bool
}

var runSel runSelection

func init() {
	flags := runCmd.Flags()
	flags.StringSliceVar(&runSel.tags, "tag", nil, "Run only flow files whose @tags include any of these tags (comma separated)")
	flags.StringSliceVar(&runSel.only, "only", nil, "Run only these step ids of a single flow file (comma separated)")
	flags.StringVar(&runSel.from, "from", "", "Run from this step id onward in a single flow file")
	flags.StringSliceVar(&runSel.skip, "skip", nil, "Skip these step ids of a single flow file (comma separated)")
	flags.BoolVar(&runSel.noDeps, "no-deps", false, "With --only/--from: run exactly the selected steps, without setup, teardown or the earlier steps that capture variables they need")
	flags.BoolVar(&runSel.list, "list", false, "List flows and steps (honoring --tag/--only/--from/--skip) without executing anything")
}

func (s runSelection) clone() runSelection {
	s.tags = append([]string(nil), s.tags...)
	s.only = append([]string(nil), s.only...)
	s.skip = append([]string(nil), s.skip...)
	return s
}

// hasStepSelection reports whether any flag narrows the steps of a file.
func (s runSelection) hasStepSelection() bool {
	return len(s.only) > 0 || s.from != "" || len(s.skip) > 0
}

// parseFlowQuiet parses flow content without the parser's warnings reaching
// stdout, for passes (--tag, --list) that run before the real run.
func parseFlowQuiet(content string) (FlowDoc, []KestBlock) {
	devNull, err := os.OpenFile(os.DevNull, os.O_WRONLY, 0)
	if err != nil {
		return ParseFlowDocument(content)
	}
	defer devNull.Close()
	previous := os.Stdout
	os.Stdout = devNull
	defer func() { os.Stdout = previous }()
	return ParseFlowDocument(content)
}

func loadFlowQuiet(path string) (FlowDoc, []KestBlock, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return FlowDoc{}, nil, err
	}
	if !strings.HasSuffix(path, ".md") {
		return FlowDoc{}, nil, nil
	}
	doc, legacy := parseFlowQuiet(string(content))
	return doc, legacy, nil
}

func isFlowDoc(doc FlowDoc) bool {
	return len(doc.Setup) > 0 || len(doc.Steps) > 0 || len(doc.Teardown) > 0 || len(doc.Edges) > 0 || doc.Meta.ID != ""
}

func normalizeTag(tag string) string {
	return strings.ToLower(strings.TrimPrefix(strings.TrimSpace(tag), "#"))
}

func docHasAnyTag(doc FlowDoc, wanted map[string]bool) bool {
	for _, tag := range doc.Meta.Tags {
		if wanted[normalizeTag(tag)] {
			return true
		}
	}
	return false
}

// filterTargetsByTag keeps the flow files whose @tags include any wanted tag.
// With a single target the flag validates instead of silently running
// nothing: a non-matching file is an error that lists its tags.
func filterTargetsByTag(targets []string, tags []string) ([]string, error) {
	wanted := map[string]bool{}
	for _, tag := range tags {
		if t := normalizeTag(tag); t != "" {
			wanted[t] = true
		}
	}
	if len(wanted) == 0 {
		return targets, nil
	}
	var kept []string
	known := map[string]bool{}
	for _, target := range targets {
		doc, _, err := loadFlowQuiet(target)
		if err != nil {
			// Unreadable files are reported by the run itself.
			kept = append(kept, target)
			continue
		}
		for _, tag := range doc.Meta.Tags {
			known[normalizeTag(tag)] = true
		}
		if docHasAnyTag(doc, wanted) {
			kept = append(kept, target)
		}
	}
	if len(kept) == 0 {
		available := make([]string, 0, len(known))
		for tag := range known {
			available = append(available, tag)
		}
		sort.Strings(available)
		hint := "none of the flow files declare @tags"
		if len(available) > 0 {
			hint = "tags in use: " + strings.Join(available, ", ")
		}
		return nil, fmt.Errorf("no flow files matched --tag %s (%s)", strings.Join(tags, ","), hint)
	}
	return kept, nil
}

// varProvidedExplicitly reports whether a variable comes from --var or the
// active environment config, which a failed or missing capture cannot change.
func varProvidedExplicitly(cliVars map[string]string, name string) bool {
	if _, ok := cliVars[name]; ok {
		return true
	}
	if conf := loadConfigWarn(); conf != nil {
		if env := conf.GetActiveEnv(); env.Variables != nil {
			if _, ok := env.Variables[name]; ok {
				return true
			}
		}
	}
	return false
}

// selectionPlan is the resolved subset of a flow to run.
type selectionPlan struct {
	doc   FlowDoc    // setup/teardown trimmed when --no-deps is set
	steps []FlowStep // selected main steps in execution order
	// role per entry of steps: "run", "dependency" or "skip" (--skip).
	roles []string
}

const (
	roleRun        = "run"
	roleDependency = "dependency"
	roleSkip       = "skip"
)

// resolveSelection applies --only/--from/--skip to the ordered main steps.
// Without any step flag it returns every step. The error is a usage error.
func resolveSelection(doc FlowDoc, ordered []FlowStep, sel runSelection, cliVars map[string]string) (*selectionPlan, error) {
	plan := &selectionPlan{doc: doc}
	if !sel.hasStepSelection() {
		plan.steps = ordered
		plan.roles = make([]string, len(ordered))
		for i := range plan.roles {
			plan.roles[i] = roleRun
		}
		return plan, nil
	}

	selected := make([]bool, len(ordered))
	for i := range selected {
		selected[i] = true
	}

	if len(sel.only) > 0 {
		for i := range selected {
			selected[i] = false
		}
		for _, id := range sel.only {
			idx, err := matchStepIDs(ordered, id, "--only")
			if err != nil {
				return nil, err
			}
			for _, i := range idx {
				selected[i] = true
			}
		}
	}
	if sel.from != "" {
		idx, err := matchStepIDs(ordered, sel.from, "--from")
		if err != nil {
			return nil, err
		}
		for i := 0; i < idx[0]; i++ {
			selected[i] = false
		}
	}

	skipped := make([]bool, len(ordered))
	for _, id := range sel.skip {
		idx, err := matchStepIDs(ordered, id, "--skip")
		if err != nil {
			return nil, err
		}
		for _, i := range idx {
			skipped[i] = true
		}
	}

	dependency := make([]bool, len(ordered))
	if !sel.noDeps {
		// Pull in the nearest earlier step that captures each variable a
		// selected step needs, transitively.
		var queue []int
		for i := range ordered {
			if selected[i] {
				queue = append(queue, i)
			}
		}
		for len(queue) > 0 {
			i := queue[0]
			queue = queue[1:]
			for _, name := range stepPlaceholders(ordered[i]) {
				if varProvidedExplicitly(cliVars, name) {
					continue
				}
				for j := i - 1; j >= 0; j-- {
					if !stepCaptures(ordered[j], name) {
						continue
					}
					if !selected[j] && !dependency[j] {
						dependency[j] = true
						queue = append(queue, j)
					}
					break
				}
			}
		}
	} else {
		plan.doc.Setup = nil
		plan.doc.Teardown = nil
		if err := checkNoDepsVariables(ordered, selected, skipped, cliVars); err != nil {
			return nil, err
		}
	}

	for i, step := range ordered {
		switch {
		case !selected[i] && !dependency[i]:
			continue
		case skipped[i]:
			plan.steps = append(plan.steps, step)
			plan.roles = append(plan.roles, roleSkip)
		case dependency[i] && !selected[i]:
			plan.steps = append(plan.steps, step)
			plan.roles = append(plan.roles, roleDependency)
		default:
			plan.steps = append(plan.steps, step)
			plan.roles = append(plan.roles, roleRun)
		}
	}
	if len(plan.steps) == 0 {
		return nil, fmt.Errorf("the step selection matched no steps")
	}
	return plan, nil
}

func stepCaptures(step FlowStep, name string) bool {
	for _, captured := range stepCaptureNames(step) {
		if captured == name {
			return true
		}
	}
	return false
}

// checkNoDepsVariables fails early when --no-deps leaves a selected step
// without a source for a variable it needs.
func checkNoDepsVariables(ordered []FlowStep, selected, skipped []bool, cliVars map[string]string) error {
	vars := buildVarChain()
	for i, step := range ordered {
		if !selected[i] || skipped[i] {
			continue
		}
		for _, name := range stepPlaceholders(step) {
			if varProvidedExplicitly(cliVars, name) {
				continue
			}
			if _, ok := vars[name]; ok {
				continue
			}
			provided := false
			for j := 0; j < i; j++ {
				if selected[j] && !skipped[j] && stepCaptures(ordered[j], name) {
					provided = true
					break
				}
			}
			if provided {
				continue
			}
			hint := fmt.Sprintf("pass --var %s=<value>", name)
			for j := i - 1; j >= 0; j-- {
				if stepCaptures(ordered[j], name) {
					hint = fmt.Sprintf("it is captured by step %q which is not selected: drop --no-deps or add it to --only, or %s", ordered[j].ID, hint)
					break
				}
			}
			return fmt.Errorf("step %q needs {{%s}} but --no-deps leaves nothing that provides it (%s)", step.ID, name, hint)
		}
	}
	return nil
}

// matchStepIDs resolves one id (or step name) to the indexes of matching
// steps. Unknown ids produce an error listing close matches.
func matchStepIDs(steps []FlowStep, id, flag string) ([]int, error) {
	id = strings.TrimSpace(id)
	var idx []int
	for i, step := range steps {
		if step.ID == id {
			idx = append(idx, i)
		}
	}
	if len(idx) == 0 {
		for i, step := range steps {
			if strings.EqualFold(step.ID, id) || (step.Name != "" && strings.EqualFold(step.Name, id)) {
				idx = append(idx, i)
			}
		}
	}
	if len(idx) > 0 {
		return idx, nil
	}

	var labels []string
	for _, step := range steps {
		labels = append(labels, step.ID)
	}
	msg := fmt.Sprintf("unknown step id %q for %s", id, flag)
	if near := closeMatches(id, steps); len(near) > 0 {
		msg += fmt.Sprintf("; did you mean: %s?", strings.Join(near, ", "))
	}
	if len(labels) <= 12 {
		msg += fmt.Sprintf(" Steps in this flow: %s", strings.Join(labels, ", "))
	} else {
		msg += fmt.Sprintf(" (%d steps; list them with `kest run <file> --list`)", len(labels))
	}
	return nil, fmt.Errorf("%s", msg)
}

// closeMatches returns up to three step ids that look like the unknown one.
func closeMatches(id string, steps []FlowStep) []string {
	type scored struct {
		id    string
		score int
	}
	needle := strings.ToLower(id)
	var found []scored
	for _, step := range steps {
		candidates := []string{strings.ToLower(step.ID)}
		if step.Name != "" {
			candidates = append(candidates, strings.ToLower(step.Name))
		}
		best := -1
		for _, cand := range candidates {
			d := editDistance(needle, cand)
			limit := 2
			if n := len(needle) / 3; n > limit {
				limit = n
			}
			if strings.Contains(cand, needle) || strings.Contains(needle, cand) {
				d = 1
			}
			if d <= limit && (best < 0 || d < best) {
				best = d
			}
		}
		if best >= 0 {
			found = append(found, scored{step.ID, best})
		}
	}
	sort.SliceStable(found, func(i, j int) bool { return found[i].score < found[j].score })
	var out []string
	for _, f := range found {
		out = append(out, f.id)
		if len(out) == 3 {
			break
		}
	}
	return out
}

func editDistance(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	prev := make([]int, len(rb)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		cur := make([]int, len(rb)+1)
		cur[0] = i
		for j := 1; j <= len(rb); j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			cur[j] = minInt(minInt(prev[j]+1, cur[j-1]+1), prev[j-1]+cost)
		}
		prev = cur
	}
	return prev[len(rb)]
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// validateStepSelection runs before anything executes so selection mistakes
// are usage errors (exit 3) rather than mid-run failures.
func validateStepSelection(targets []string, sel runSelection, cliVars map[string]string) error {
	if !sel.hasStepSelection() && !sel.noDeps {
		return nil
	}
	if !sel.hasStepSelection() && sel.noDeps {
		return fmt.Errorf("--no-deps only applies together with --only, --from or --skip")
	}
	if len(targets) != 1 {
		return fmt.Errorf("--only, --from and --skip work on a single flow file; %d files were selected (use --list to see step ids)", len(targets))
	}
	doc, _, err := loadFlowQuiet(targets[0])
	if err != nil {
		return nil // reported by the run
	}
	if !isFlowDoc(doc) {
		return fmt.Errorf("--only, --from and --skip need a .flow.md file with step blocks; %s has none", targets[0])
	}
	_, err = resolveSelection(doc, orderFlowSteps(doc), sel, cliVars)
	return err
}

// ---- --list ----

type listedStep struct {
	ID       string   `json:"id"`
	Name     string   `json:"name,omitempty"`
	Phase    string   `json:"phase"`
	Line     int      `json:"line"`
	Type     string   `json:"type"`
	Method   string   `json:"method,omitempty"`
	URL      string   `json:"url,omitempty"`
	Captures []string `json:"captures,omitempty"`
	Needs    []string `json:"needs,omitempty"`
	// Selection is run, dependency or skip for the current flags.
	Selection string `json:"selection"`
}

type listedFlow struct {
	Source string       `json:"source"`
	FlowID string       `json:"flow_id,omitempty"`
	Name   string       `json:"name,omitempty"`
	Tags   []string     `json:"tags"`
	Steps  []listedStep `json:"steps"`
	Legacy bool         `json:"legacy,omitempty"`
}

func describeStep(step FlowStep, phase, selection string) listedStep {
	item := listedStep{
		ID:        step.ID,
		Name:      step.Name,
		Phase:     phase,
		Line:      step.LineNum,
		Type:      "http",
		Captures:  stepCaptureNames(step),
		Needs:     stepPlaceholders(step),
		Selection: selection,
	}
	if step.Type == "exec" {
		item.Type = "exec"
	} else {
		item.Method = strings.ToUpper(step.Request.Method)
		item.URL = step.Request.URL
	}
	return item
}

// buildFlowListing resolves the plan for one file the same way a run would.
func buildFlowListing(path string, sel runSelection, cliVars map[string]string) (listedFlow, error) {
	listing := listedFlow{Source: path, Tags: []string{}, Steps: []listedStep{}}
	doc, legacy, err := loadFlowQuiet(path)
	if err != nil {
		return listing, err
	}
	if !isFlowDoc(doc) {
		listing.Legacy = true
		for _, block := range legacy {
			listing.Steps = append(listing.Steps, listedStep{
				ID: fmt.Sprintf("line-%d", block.LineNum), Phase: phaseStep, Line: block.LineNum,
				Type: "http", Selection: roleRun,
			})
		}
		return listing, nil
	}
	listing.FlowID = doc.Meta.ID
	listing.Name = doc.Meta.Name
	if len(doc.Meta.Tags) > 0 {
		listing.Tags = doc.Meta.Tags
	}
	plan, err := resolveSelection(doc, orderFlowSteps(doc), sel, cliVars)
	if err != nil {
		return listing, err
	}
	for _, step := range plan.doc.Setup {
		listing.Steps = append(listing.Steps, describeStep(step, phaseSetup, roleRun))
	}
	for i, step := range plan.steps {
		listing.Steps = append(listing.Steps, describeStep(step, phaseStep, plan.roles[i]))
	}
	for _, step := range plan.doc.Teardown {
		listing.Steps = append(listing.Steps, describeStep(step, phaseTeardown, roleRun))
	}
	return listing, nil
}

// listFlows implements `kest run --list`: it prints the plan and executes
// nothing.
func listFlows(targets []string, sel runSelection, cliVars map[string]string) (*output.Result, error) {
	flows := make([]listedFlow, 0, len(targets))
	for _, target := range targets {
		listing, err := buildFlowListing(target, sel, cliVars)
		if err != nil {
			return nil, &ExitError{Code: ExitConfigError, Err: fmt.Errorf("%s: %w", target, err)}
		}
		flows = append(flows, listing)
	}

	for _, flow := range flows {
		printFlowListing(flow)
	}
	res := output.NewResult("run")
	res.Data = map[string]any{"list": true, "flows": flows}
	return res, nil
}

func printFlowListing(flow listedFlow) {
	header := filepath.ToSlash(flow.Source)
	if flow.Name != "" {
		header += "  " + flow.Name
	}
	if flow.FlowID != "" {
		header += fmt.Sprintf("  (id: %s)", flow.FlowID)
	}
	fmt.Println(header)
	if len(flow.Tags) > 0 {
		fmt.Printf("  tags: %s\n", strings.Join(flow.Tags, ", "))
	}
	if flow.Legacy {
		fmt.Printf("  legacy scenario with %d request(s)\n", len(flow.Steps))
	}
	for _, step := range flow.Steps {
		marker := " "
		switch step.Selection {
		case roleSkip:
			marker = "-"
		case roleDependency:
			marker = "+"
		}
		what := step.Method + " " + step.URL
		if step.Type == "exec" {
			what = "exec"
		}
		name := step.Name
		if name == "" {
			name = step.ID
		}
		line := fmt.Sprintf("  %s %-8s %-24s line %-4d %s  %s", marker, step.Phase, step.ID, step.Line, strings.TrimSpace(what), name)
		if len(step.Captures) > 0 {
			line += "  captures: " + strings.Join(step.Captures, ", ")
		}
		if step.Selection == roleDependency {
			line += "  (dependency)"
		}
		if step.Selection == roleSkip {
			line += "  (skipped by --skip)"
		}
		fmt.Println(strings.TrimRight(line, " "))
	}
	fmt.Println()
}
