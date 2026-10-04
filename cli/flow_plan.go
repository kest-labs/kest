package main

import (
	"encoding/json"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

// FlowPlanEntry is one executable step in the order the runner will execute
// it. It is the stable, comparable description used by `kest lint --fix`
// verification and the hidden `kest flow-plan` command.
type FlowPlanEntry struct {
	Phase       string   `json:"phase"` // setup | step | teardown
	ID          string   `json:"id"`
	Type        string   `json:"type,omitempty"`
	Method      string   `json:"method,omitempty"`
	URL         string   `json:"url,omitempty"`
	Headers     []string `json:"headers,omitempty"`
	Queries     []string `json:"queries,omitempty"`
	Body        string   `json:"body,omitempty"`
	Captures    []string `json:"captures,omitempty"`
	Asserts     []string `json:"asserts,omitempty"`
	SoftAsserts []string `json:"soft_asserts,omitempty"`
	Command     string   `json:"command,omitempty"`
	Retry       int      `json:"retry,omitempty"`
	WaitMs      int      `json:"wait_ms,omitempty"`
}

// BuildFlowPlan returns the execution plan of doc: setup steps, then the
// steps in dependency order (see orderFlowSteps), then teardown steps.
func BuildFlowPlan(doc FlowDoc) []FlowPlanEntry {
	plan := []FlowPlanEntry{}
	add := func(phase string, steps []FlowStep) {
		for _, s := range steps {
			captures := append(append([]string{}, s.Request.Captures...), s.Exec.Captures...)
			plan = append(plan, FlowPlanEntry{
				Phase:       phase,
				ID:          s.ID,
				Type:        s.Type,
				Method:      strings.ToUpper(s.Request.Method),
				URL:         s.Request.URL,
				Headers:     s.Request.Headers,
				Queries:     s.Request.Queries,
				Body:        s.Request.Data,
				Captures:    captures,
				Asserts:     s.Request.Asserts,
				SoftAsserts: s.Request.SoftAsserts,
				Command:     s.Exec.Command,
				Retry:       s.Retry,
				WaitMs:      s.WaitMs,
			})
		}
	}
	add("setup", doc.Setup)
	add("step", orderFlowSteps(doc))
	add("teardown", doc.Teardown)
	return plan
}

// planSequence flattens the plan into the sequence of step descriptions with
// the phase removed, so two documents that run the same requests in the same
// order compare equal even if a step moved between the main phase and
// teardown.
func planSequence(plan []FlowPlanEntry) []string {
	out := make([]string, 0, len(plan))
	for _, e := range plan {
		e.Phase = ""
		b, _ := json.Marshal(e)
		out = append(out, string(b))
	}
	return out
}

// flowPlansEquivalent reports whether a and b run identical steps in the
// identical order (ignoring which phase each step is declared in).
func flowPlansEquivalent(a, b []FlowPlanEntry) bool {
	x, y := planSequence(a), planSequence(b)
	if len(x) != len(y) {
		return false
	}
	for i := range x {
		if x[i] != y[i] {
			return false
		}
	}
	return true
}

var flowPlanCmd = &cobra.Command{
	Use:    "flow-plan <file.flow.md>",
	Short:  "Print the resolved execution plan of a flow as JSON (test/debug helper)",
	Hidden: true,
	Args:   cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		data, err := os.ReadFile(args[0])
		if err != nil {
			return &ExitError{Code: ExitConfigError, Err: err}
		}
		f := newLintFile(args[0], string(data))
		plan := lintPlan(f) // legacy files get their legacy-block plan
		if f.isFlowMode() {
			var doc FlowDoc
			var lerr error
			quietly(func() { doc, _, lerr = loadFlowDocument(args[0]) }) // parser warnings must not corrupt the JSON
			if lerr != nil {
				return &ExitError{Code: ExitConfigError, Err: lerr}
			}
			plan = BuildFlowPlan(doc)
		}
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(plan)
	},
}

func init() {
	rootCmd.AddCommand(flowPlanCmd)
}
