package main

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/kest-labs/kest/cli/internal/logger"
	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/kest-labs/kest/cli/internal/summary"
	"github.com/kest-labs/kest/cli/internal/variable"
	"github.com/tidwall/gjson"
)

// Flow step phases. They are reported on every step result.
const (
	phaseSetup    = "setup"
	phaseStep     = "step"
	phaseTeardown = "teardown"
)

// Step outcomes tracked while a flow runs.
const (
	stateFailed  = "failed"
	statePassed  = "passed"
	stateSkipped = "skipped"
)

// flowStepRef is one step of a flow in execution order.
type flowStepRef struct {
	key   string
	phase string
	step  FlowStep
}

func (r flowStepRef) name() string { return stepName(r.step) }

// stepOutcome is what happened to a step that already ran (or was skipped).
type stepOutcome struct {
	state string
	// root is the step that is the real cause: the step itself when it
	// failed, otherwise the root of the step it was skipped for.
	root *flowStepRef
}

// skipDecision explains why a step must not run.
type skipDecision struct {
	reason string
	root   *flowStepRef
}

// flowRunner executes the steps of one flow document and tracks which steps
// failed or were skipped, so steps that depend on them are skipped instead of
// failing with a confusing "variable was not captured" error.
type flowRunner struct {
	doc      FlowDoc
	summ     *summary.Summary
	cliVars  map[string]string
	steps    []flowStepRef
	byKey    map[string]*flowStepRef
	idToKey  map[string]string // main-phase step id -> key, for @on edges
	origins  map[string][]string
	state    map[string]*stepOutcome
	captured map[string]bool

	firstFailed *flowStepRef
	// stopReason is set when the remaining steps are not run: "--fail-fast"
	// or "interrupted". Teardown still runs.
	stopReason string
	// ctx is cancelled by Ctrl-C / SIGTERM; stepCtx is the context the
	// current step runs with (a separate grace context during teardown).
	ctx     context.Context
	stepCtx context.Context
}

func newFlowRunner(doc FlowDoc, steps []FlowStep, summ *summary.Summary, cliVars map[string]string) *flowRunner {
	r := &flowRunner{
		doc:      doc,
		summ:     summ,
		cliVars:  cliVars,
		byKey:    map[string]*flowStepRef{},
		idToKey:  map[string]string{},
		origins:  map[string][]string{},
		state:    map[string]*stepOutcome{},
		captured: map[string]bool{},
		ctx:      currentRunCtx(),
	}
	r.stepCtx = r.ctx
	add := func(phase string, list []FlowStep) {
		for i, step := range list {
			key := fmt.Sprintf("%s:%d", phase, i)
			r.steps = append(r.steps, flowStepRef{key: key, phase: phase, step: step})
			if phase == phaseStep && step.ID != "" {
				if _, dup := r.idToKey[step.ID]; !dup {
					r.idToKey[step.ID] = key
				}
			}
		}
	}
	add(phaseSetup, doc.Setup)
	add(phaseStep, steps)
	add(phaseTeardown, doc.Teardown)
	for i := range r.steps {
		ref := &r.steps[i]
		r.byKey[ref.key] = ref
		for _, name := range stepCaptureNames(ref.step) {
			r.origins[name] = append(r.origins[name], ref.key)
		}
	}
	return r
}

// stepCaptureNames lists the variables a step captures.
func stepCaptureNames(step FlowStep) []string {
	var names []string
	for _, expr := range append(append([]string{}, step.Request.Captures...), step.Exec.Captures...) {
		if name, _, ok := ParseCaptureExpr(expr); ok && name != "" {
			names = append(names, name)
		}
	}
	return names
}

// stepPlaceholders returns the sorted variable names a step references.
func stepPlaceholders(step FlowStep) []string {
	seen := map[string]struct{}{}
	collect := func(text string) {
		for _, name := range variable.ExtractPlaceholders(text) {
			seen[name] = struct{}{}
		}
	}
	collect(step.Request.URL)
	collect(step.Request.Data)
	for _, h := range step.Request.Headers {
		collect(h)
	}
	for _, q := range step.Request.Queries {
		collect(q)
	}
	for _, a := range step.Request.Asserts {
		collect(a)
	}
	for _, a := range step.Request.SoftAsserts {
		collect(a)
	}
	collect(step.Exec.Command)
	names := make([]string, 0, len(seen))
	for name := range seen {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// providedExplicitly reports whether a variable comes from --var or the
// active environment config, which a failed capture cannot invalidate.
func (r *flowRunner) providedExplicitly(name string) bool {
	if _, ok := r.cliVars[name]; ok {
		return true
	}
	conf := loadConfigWarn()
	if conf != nil {
		if env := conf.GetActiveEnv(); env.Variables != nil {
			if _, ok := env.Variables[name]; ok {
				return true
			}
		}
	}
	return false
}

// rootOf resolves the root-cause step for a step that failed or was skipped.
func (r *flowRunner) rootOf(key string) *flowStepRef {
	if out, ok := r.state[key]; ok && out.root != nil {
		return out.root
	}
	return r.byKey[key]
}

// decideSkip returns a skip decision when the step depends on a step that
// failed or was skipped. Teardown steps are additionally skipped when a
// variable they need was never captured, because deleting "whatever is left
// in storage from a previous run" is worse than not deleting.
func (r *flowRunner) decideSkip(ref flowStepRef) *skipDecision {
	// Explicit @on success edges.
	if ref.phase == phaseStep {
		for _, edge := range r.doc.Edges {
			if edge.To != ref.step.ID || !strings.EqualFold(strings.TrimSpace(edge.On), "success") {
				continue
			}
			key, ok := r.idToKey[edge.From]
			if !ok || key == ref.key {
				continue
			}
			if out := r.state[key]; out != nil && (out.state == stateFailed || out.state == stateSkipped) {
				src := r.byKey[key]
				return &skipDecision{
					reason: fmt.Sprintf("depends on %s which %s (edge @on success)", src.name(), r.describeState(key, out)),
					root:   r.rootOf(key),
				}
			}
		}
	}

	for _, name := range stepPlaceholders(ref.step) {
		if r.captured[name] || r.providedExplicitly(name) {
			continue
		}
		candidates := r.origins[name]
		if len(candidates) == 0 {
			continue
		}
		// The most recent origin that failed or was skipped explains the gap.
		var blamed string
		for i := len(candidates) - 1; i >= 0; i-- {
			if candidates[i] == ref.key {
				continue
			}
			if out := r.state[candidates[i]]; out != nil && (out.state == stateFailed || out.state == stateSkipped) {
				blamed = candidates[i]
				break
			}
		}
		if blamed != "" {
			src := r.byKey[blamed]
			out := r.state[blamed]
			return &skipDecision{
				reason: fmt.Sprintf("depends on %s which %s (needs {{%s}})", src.name(), r.describeState(blamed, out), name),
				root:   r.rootOf(blamed),
			}
		}
		if ref.phase != phaseTeardown {
			continue
		}
		// Teardown: the variable was never captured by this run.
		for i := len(candidates) - 1; i >= 0; i-- {
			if candidates[i] == ref.key {
				continue
			}
			src := r.byKey[candidates[i]]
			root := r.rootOf(candidates[i])
			verb := fmt.Sprintf("did not capture '%s'", name)
			if r.state[candidates[i]] == nil {
				verb = "did not run"
				if r.firstFailed != nil {
					root = r.firstFailed
				}
			}
			return &skipDecision{
				reason: fmt.Sprintf("depends on %s which %s (needs {{%s}})", src.name(), verb, name),
				root:   root,
			}
		}
	}
	return nil
}

// describeState words a failed or skipped outcome. A skipped step names the
// root cause so the chain reads "which was skipped (caused by Create item)".
func (r *flowRunner) describeState(key string, out *stepOutcome) string {
	if out.state != stateSkipped {
		return "failed"
	}
	if root := r.rootOf(key); root != nil && root.key != key {
		return fmt.Sprintf("was skipped (caused by %s)", root.name())
	}
	return "was skipped"
}

// missingVariableError reports a variable the step needs that no earlier
// step captured and no source provides.
func (r *flowRunner) missingVariableError(ref flowStepRef) error {
	vars := buildVarChain()
	var missing []string
	for _, name := range stepPlaceholders(ref.step) {
		if _, ok := vars[name]; !ok {
			missing = append(missing, name)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	name := missing[0]
	if candidates := r.origins[name]; len(candidates) > 0 {
		return fmt.Errorf("variable '%s' was not captured (expected from %s)", name, r.byKey[candidates[len(candidates)-1]].name())
	}
	return fmt.Errorf("required variable '%s' not provided", name)
}

func (r *flowRunner) recordSkip(ref flowStepRef, d *skipDecision) {
	root := d.root
	if root == nil {
		root = &ref
	}
	r.state[ref.key] = &stepOutcome{state: stateSkipped, root: root}
	r.summ.AddResult(summary.TestResult{
		StepID:           ref.step.ID,
		Name:             ref.name(),
		Phase:            ref.phase,
		Method:           strings.ToUpper(ref.step.Request.Method),
		URL:              ref.step.Request.URL,
		Skipped:          true,
		SkipReason:       d.reason,
		SkippedBecause:   root.name(),
		SkippedBecauseID: root.step.ID,
	})
	fmt.Printf("\n  ○ %s (line %d)\n", ref.name(), ref.step.LineNum)
	fmt.Printf("    ⏭  skipped: %s\n", d.reason)
}

func (r *flowRunner) recordFailure(ref flowStepRef) {
	r.state[ref.key] = &stepOutcome{state: stateFailed, root: r.byKey[ref.key]}
	if r.firstFailed == nil && ref.phase != phaseTeardown {
		r.firstFailed = r.byKey[ref.key]
	}
}

func (r *flowRunner) recordPass(ref flowStepRef, result summary.TestResult) {
	r.state[ref.key] = &stepOutcome{state: statePassed, root: r.byKey[ref.key]}
	for name := range result.Captures {
		r.captured[name] = true
	}
}

// runAll runs setup and the main steps in order, then always runs teardown
// (a "finally" block): after failures, after --fail-fast stops the run and
// after Ctrl-C / SIGTERM. Only the main steps are cut short by --fail-fast.
func (r *flowRunner) runAll() {
	var main, teardown []flowStepRef
	for _, ref := range r.steps {
		if ref.phase == phaseTeardown {
			teardown = append(teardown, ref)
		} else {
			main = append(main, ref)
		}
	}

	for i, ref := range main {
		if r.ctx.Err() != nil {
			r.stopReason = "interrupted"
			fmt.Printf("\n⚠️  Run interrupted; skipping %d remaining step(s)\n", len(main)-i)
			break
		}
		if !r.runStep(ref) {
			r.stopReason = "--fail-fast"
			if remaining := len(main) - i - 1; remaining > 0 {
				fmt.Printf("   Skipped %d remaining step(s) (teardown still runs)\n", remaining)
			}
			break
		}
	}

	if len(teardown) == 0 {
		return
	}
	fmt.Printf("\n🧹 Teardown (always runs)\n")
	ctx, cancel := teardownContext(r.ctx)
	defer cancel()
	r.stepCtx = ctx
	for _, ref := range teardown {
		r.runStep(ref)
	}
	r.stepCtx = r.ctx
}

// runStep runs (or skips) one step. It returns false when execution must
// stop because of --fail-fast.
func (r *flowRunner) runStep(ref flowStepRef) bool {
	step := ref.step
	if d := r.decideSkip(ref); d != nil {
		r.recordSkip(ref, d)
		return true
	}

	if step.WaitMs > 0 {
		fmt.Printf("\n  ⏳ %s waiting %dms before execution\n", ref.name(), step.WaitMs)
		sleepCtx(r.stepCtx, time.Duration(step.WaitMs)*time.Millisecond)
	}

	fail := func(result summary.TestResult) bool {
		result.StepID = step.ID
		result.Phase = ref.phase
		if ref.phase == phaseTeardown {
			// A failing teardown step is reported with its own marker so it
			// is never mistaken for (or hides) the failure that came first.
			if result.Error != nil {
				result.Error = fmt.Errorf("teardown failed: %w", result.Error)
			}
			result.ErrorKind = output.ErrorKindTeardown
			fmt.Printf("    ⚠️  Teardown step %s failed; cleanup may be incomplete\n", ref.name())
		}
		r.summ.AddResult(result)
		r.recordFailure(ref)
		if runFailFast && ref.phase != phaseTeardown {
			fmt.Printf("\n⚠️  Stopping execution (--fail-fast enabled)\n")
			fmt.Printf("   Failed step: %s\n", ref.name())
			if result.Error != nil {
				fmt.Printf("   Reason: %v\n", result.Error)
			}
			return false
		}
		return true
	}

	if err := r.missingVariableError(ref); err != nil {
		fmt.Printf("\n  ▶ %s (line %d)\n", ref.name(), step.LineNum)
		fmt.Printf("    ❌ %v\n", err)
		return fail(summary.TestResult{
			Name:      ref.name(),
			Method:    strings.ToUpper(step.Request.Method),
			URL:       step.Request.URL,
			Error:     err,
			ErrorKind: output.ErrorKindVariable,
		})
	}

	if step.Type == "exec" {
		fmt.Printf("\n  ▶ %s (exec, line %d)\n", ref.name(), step.LineNum)
		result := executeExecStep(r.stepCtx, step)
		if !result.Success {
			fmt.Printf("❌ Failed at exec step %s\n\n", ref.name())
			return fail(result)
		}
		result.StepID = step.ID
		result.Phase = ref.phase
		r.summ.AddResult(result)
		r.recordPass(ref, result)
		return true
	}

	if step.Request.Method == "" || step.Request.URL == "" {
		return fail(summary.TestResult{
			Name:      ref.name(),
			Error:     fmt.Errorf("invalid step (missing METHOD/URL) at line %d", step.LineNum),
			ErrorKind: output.ErrorKindConfig,
		})
	}
	fmt.Printf("\n  ▶ %s %s %s (line %d)\n", ref.name(), step.Request.Method, step.Request.URL, step.LineNum)

	opts := step.Request
	opts.Verbose = runVerbose
	opts.DebugVars = runDebugVars
	opts.StrictVars = runStrict
	opts.SilentOutput = true
	opts.SkipHistorySync = true
	opts.Ctx = r.stepCtx
	if step.Retry > 0 {
		opts.Retry = step.Retry
	}
	if step.RetryWait > 0 {
		opts.RetryWait = step.RetryWait
	}
	if step.MaxDuration > 0 {
		opts.MaxDuration = step.MaxDuration
	}

	res, err := executeFlowStepWithPoll(step, opts)
	result := res
	result.Name = ref.name()
	result.Success = (err == nil)
	result.Error = err
	if err == nil {
		result.ErrorKind = ""
		r.processCaptures(step, &result, res.ResponseBody)
	}

	if err != nil {
		if result.FailedAssertion == "" && strings.Contains(err.Error(), "assertion failed:") {
			result.FailedAssertion = strings.TrimSpace(strings.TrimPrefix(err.Error(), "assertion failed:"))
		}
		fmt.Printf("    ❌ Failed at step %s\n", ref.name())
		return fail(result)
	}
	fmt.Printf("    ✅ %s %s → %d (%s)\n", res.Method, step.Request.URL, res.Status, res.Duration.Round(time.Millisecond))
	result.StepID = step.ID
	result.Phase = ref.phase
	r.summ.AddResult(result)
	r.recordPass(ref, result)
	return true
}

// processCaptures extracts [Captures] from a successful response.
func (r *flowRunner) processCaptures(step FlowStep, result *summary.TestResult, body string) {
	if len(step.Request.Captures) == 0 {
		return
	}
	if result.Captures == nil {
		result.Captures = make(map[string]string)
	}
	store, _ := storage.NewStore() //nolint: we need a fresh store per capture block
	for _, capExpr := range step.Request.Captures {
		varName, query, ok := ParseCaptureExpr(capExpr)
		if !ok {
			continue
		}
		captureResult := gjson.Get(body, query)
		if !captureResult.Exists() {
			continue
		}
		value := captureResult.String()
		if ActiveRunCtx != nil {
			ActiveRunCtx.Set(varName, value)
		}
		result.Captures[varName] = value
		persistCapturedVariable(store, varName, value)
		fmt.Printf("    Captured: %s = %s\n", varName, value)
		logger.LogToSession("Captured: %s = %s", varName, value)
	}
	if store != nil {
		store.Close()
	}
}
