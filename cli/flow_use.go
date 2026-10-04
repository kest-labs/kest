package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kest-labs/kest/cli/internal/summary"
)

// FlowIncludeError is a problem with an `@use` directive (missing file, cycle,
// duplicate namespace, unparsable include). It is a configuration error.
type FlowIncludeError struct {
	File string // file containing the @use
	Line int    // line of the @use directive (0 when unknown)
	Msg  string
}

func (e *FlowIncludeError) Error() string {
	if e.Line > 0 {
		return fmt.Sprintf("%s:%d: @use: %s", e.File, e.Line, e.Msg)
	}
	return fmt.Sprintf("%s: @use: %s", e.File, e.Msg)
}

func isFlowIncludeError(err error) bool {
	var ie *FlowIncludeError
	return errors.As(err, &ie)
}

// parseFlowUse parses the value of `@use <path> [as <alias>]`.
func parseFlowUse(val string, line int) (FlowUse, bool) {
	fields := strings.Fields(val)
	if len(fields) == 0 {
		return FlowUse{}, false
	}
	use := FlowUse{Path: fields[0], LineNum: line}
	if len(fields) >= 3 && strings.EqualFold(fields[1], "as") {
		use.Alias = fields[2]
	}
	return use, true
}

// ExpandFlowIncludes resolves the `@use` directives of doc (read from path).
//
// The included files' setup and step blocks are placed at the front of
// doc.Setup, so they run before the including file's own steps; their
// teardown blocks are appended to doc.Teardown. Step ids are namespaced
// ("login.step-id"); variables are not (captures are shared).
func ExpandFlowIncludes(doc FlowDoc, path string) (FlowDoc, error) {
	if len(doc.Meta.Uses) == 0 {
		return doc, nil
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return doc, err
	}
	ex := &flowExpander{topAbs: abs, rootDir: filepath.Dir(abs), display: path}
	setup, steps, teardown, err := ex.expand(doc, abs, []string{abs})
	if err != nil {
		return doc, err
	}
	included := append(setup, steps...)
	for i := range included {
		finishIncludedStep(&included[i])
	}
	for i := range teardown {
		finishIncludedStep(&teardown[i])
	}
	doc.Setup = append(included, doc.Setup...)
	doc.Teardown = append(doc.Teardown, teardown...)
	return doc, nil
}

// finishIncludedStep gives an included step a human display name carrying its
// namespace, e.g. "[login] Sign in".
func finishIncludedStep(s *FlowStep) {
	base := s.Name
	if base == "" {
		base = strings.TrimPrefix(s.ID, s.Namespace+".")
	}
	s.Name = "[" + s.Namespace + "] " + base
}

type flowExpander struct {
	topAbs  string // absolute path of the top-level file
	rootDir string // directory of the top-level file; included_from is relative to it
	display string // top-level path as given by the user, for error messages
}

// expand returns the included steps of doc (not doc's own). IDs are relative
// to doc: nested includes are already namespaced by their own prefix.
func (ex *flowExpander) expand(doc FlowDoc, abs string, stack []string) (setup, steps, teardown []FlowStep, err error) {
	usedNS := map[string]int{}
	shown := ex.errName(abs)
	for _, use := range doc.Meta.Uses {
		fail := func(format string, a ...any) error {
			return &FlowIncludeError{File: shown, Line: use.LineNum, Msg: fmt.Sprintf(format, a...)}
		}
		target := use.Path
		if !filepath.IsAbs(target) {
			target = filepath.Join(filepath.Dir(abs), target)
		}
		target = filepath.Clean(target)

		ns := use.Alias
		if ns == "" {
			ns = defaultNamespace(target)
		}
		if ns == "" || strings.ContainsAny(ns, " \t.") {
			return nil, nil, nil, fail("invalid namespace %q (use `as <alias>` with letters, digits, - and _)", ns)
		}
		if prev, dup := usedNS[ns]; dup {
			return nil, nil, nil, fail("namespace %q is already used by the @use on line %d; add `as <alias>`", ns, prev)
		}
		usedNS[ns] = use.LineNum

		for i, s := range stack {
			if s == target {
				chain := append(append([]string{}, stack[i:]...), target)
				names := make([]string, len(chain))
				for j, c := range chain {
					names[j] = ex.errName(c)
				}
				return nil, nil, nil, fail("include cycle: %s", strings.Join(names, " -> "))
			}
		}

		content, rerr := os.ReadFile(target)
		if rerr != nil {
			if os.IsNotExist(rerr) {
				return nil, nil, nil, fail("file not found: %s", use.Path)
			}
			return nil, nil, nil, fail("cannot read %s: %v", use.Path, rerr)
		}
		inc, legacy := ParseFlowDocument(string(content))
		if len(inc.Setup) == 0 && len(inc.Steps) == 0 {
			reason := "contains no setup or step blocks"
			if len(legacy) > 0 {
				reason += " (it uses the legacy ```kest format; run `kest lint --fix --rule legacy-format` first)"
			}
			return nil, nil, nil, fail("%s %s", use.Path, reason)
		}

		// Nested includes come before the included file's own blocks.
		nSetup, nSteps, nTeardown, nerr := ex.expand(inc, target, append(append([]string{}, stack...), target))
		if nerr != nil {
			return nil, nil, nil, nerr
		}
		var own []FlowStep
		own = append(own, inc.Setup...)
		own = append(own, orderFlowSteps(inc)...)

		rel := ex.relName(target)
		group := append(append(append([]FlowStep{}, nSetup...), nSteps...), own...)
		for i := range group {
			if group[i].IncludedFrom == "" {
				group[i].IncludedFrom = rel
			}
			namespaceStep(&group[i], ns)
		}
		tdown := append(append([]FlowStep{}, nTeardown...), inc.Teardown...)
		for i := range tdown {
			if tdown[i].IncludedFrom == "" {
				tdown[i].IncludedFrom = rel
			}
			namespaceStep(&tdown[i], ns)
		}
		setup = append(setup, group...)
		teardown = append(teardown, tdown...)
	}
	return setup, nil, teardown, nil
}

func namespaceStep(s *FlowStep, ns string) {
	s.ID = ns + "." + s.ID
	if s.Namespace == "" {
		s.Namespace = ns
	} else {
		s.Namespace = ns + "." + s.Namespace
	}
}

func defaultNamespace(target string) string {
	base := filepath.Base(target)
	base = strings.TrimSuffix(base, ".flow.md")
	base = strings.TrimSuffix(base, ".md")
	return strings.ReplaceAll(base, ".", "_")
}

func (ex *flowExpander) relName(target string) string {
	if rel, err := filepath.Rel(ex.rootDir, target); err == nil {
		return filepath.ToSlash(rel)
	}
	return filepath.ToSlash(target)
}

// errName renders a file for error messages: the user-supplied path for the
// top-level file, a path relative to it otherwise.
func (ex *flowExpander) errName(abs string) string {
	if abs == ex.topAbs {
		return ex.display
	}
	return ex.relName(abs)
}

// annotateIncludedResults copies each included step's IncludedFrom onto its
// result so console summaries, JSON, JUnit and HTML can show it distinctly.
func annotateIncludedResults(summ *summary.Summary, doc FlowDoc) {
	from := map[string]string{}
	for _, group := range [][]FlowStep{doc.Setup, doc.Steps, doc.Teardown} {
		for _, s := range group {
			if s.IncludedFrom != "" {
				from[s.ID] = s.IncludedFrom
			}
		}
	}
	if len(from) == 0 {
		return
	}
	for i := range summ.Results {
		summ.Results[i].IncludedFrom = from[summ.Results[i].StepID]
	}
}
