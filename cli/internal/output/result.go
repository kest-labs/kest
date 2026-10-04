package output

import (
	"encoding/json"
	"io"
	"os"
	"strings"
	"time"

	"github.com/kest-labs/kest/cli/internal/platformsync"
	"github.com/kest-labs/kest/cli/internal/summary"
)

// SchemaVersion is the version of the machine-readable result document.
// Bump it only for breaking changes (removed or renamed fields, changed
// semantics). Adding optional fields is not a breaking change.
const SchemaVersion = 1

// Error kinds used in Step.Error.Kind and Result.Error.Kind.
const (
	ErrorKindAssertion       = "assertion"
	ErrorKindNetwork         = "network"
	ErrorKindTimeout         = "timeout"
	ErrorKindVariable        = "variable"
	ErrorKindConfig          = "config"
	ErrorKindExec            = "exec"
	ErrorKindNotFound        = "not_found"
	ErrorKindSnapshot        = "snapshot_mismatch"
	ErrorKindAINotConfigured = "ai_not_configured"
	ErrorKindInternal        = "internal"
)

// Result is the single JSON document emitted by --json / --output json and
// returned by every Kest MCP tool.
type Result struct {
	SchemaVersion int     `json:"schema_version"`
	Command       string  `json:"command"`
	OK            bool    `json:"ok"`
	ExitCode      int     `json:"exit_code"`
	Summary       Summary `json:"summary"`
	Steps         []Step  `json:"steps"`
	Diff          *Diff   `json:"diff,omitempty"`
	Error         *Error  `json:"error,omitempty"`
	// Data carries command-specific payloads (history records, AI diagnosis).
	Data any `json:"data,omitempty"`
}

// Summary aggregates step outcomes.
type Summary struct {
	Total      int   `json:"total"`
	Passed     int   `json:"passed"`
	Failed     int   `json:"failed"`
	Skipped    int   `json:"skipped"`
	DurationMs int64 `json:"duration_ms"`
}

// Step is one executed request (or exec/snapshot step).
type Step struct {
	Name       string            `json:"name"`
	Source     string            `json:"source,omitempty"`
	Method     string            `json:"method,omitempty"`
	URL        string            `json:"url,omitempty"`
	Status     int               `json:"status"`
	DurationMs int64             `json:"duration_ms"`
	OK         bool              `json:"ok"`
	RecordID   int64             `json:"record_id,omitempty"`
	RequestID  string            `json:"request_id,omitempty"`
	Assertions []Assertion       `json:"assertions"`
	Captures   map[string]string `json:"captures,omitempty"`
	Request    *HTTPMessage      `json:"request,omitempty"`
	Response   *HTTPMessage      `json:"response,omitempty"`
	Error      *Error            `json:"error,omitempty"`
}

// Assertion is the outcome of a single assertion expression.
type Assertion struct {
	Expr    string `json:"expr"`
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
	Soft    bool   `json:"soft,omitempty"`
}

// HTTPMessage holds redacted headers and a redacted, size-limited body.
type HTTPMessage struct {
	Headers       map[string]string `json:"headers,omitempty"`
	Body          any               `json:"body,omitempty"`
	BodyTruncated bool              `json:"body_truncated,omitempty"`
}

// Diff describes a comparison against a baseline (replay or snapshot).
type Diff struct {
	Baseline     string `json:"baseline"`
	Changed      bool   `json:"changed"`
	StatusBefore int    `json:"status_before,omitempty"`
	StatusAfter  int    `json:"status_after,omitempty"`
	// Patch is a line diff: lines prefixed with "-" were removed from the
	// baseline, lines prefixed with "+" were added.
	Patch string `json:"patch,omitempty"`
}

// Error is a classified error.
type Error struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
}

// NewResult returns an empty result for the given command.
func NewResult(command string) *Result {
	return &Result{
		SchemaVersion: SchemaVersion,
		Command:       command,
		Steps:         []Step{},
	}
}

// StepOptions controls how a summary.TestResult is converted.
type StepOptions struct {
	Source string
	// IncludeBodies attaches redacted request/response headers and bodies.
	IncludeBodies bool
	// IncludeBodiesOnFailure attaches them only when the step failed.
	IncludeBodiesOnFailure bool
}

// StepFromTestResult converts an executed test result into a redacted Step.
func StepFromTestResult(tr summary.TestResult, opts StepOptions) Step {
	step := Step{
		Name:       tr.Name,
		Source:     opts.Source,
		Method:     tr.Method,
		URL:        platformsync.SanitizeURL(tr.URL),
		Status:     tr.Status,
		DurationMs: tr.Duration.Milliseconds(),
		OK:         tr.Success,
		RecordID:   tr.RecordID,
		RequestID:  tr.RequestID,
		Assertions: make([]Assertion, 0, len(tr.Assertions)),
	}
	if step.Name == "" {
		step.Name = strings.TrimSpace(tr.Method + " " + step.URL)
	}
	for _, a := range tr.Assertions {
		step.Assertions = append(step.Assertions, Assertion{
			Expr:    a.Expr,
			OK:      a.Passed,
			Message: a.Message,
			Soft:    a.Soft,
		})
	}
	if len(tr.Captures) > 0 {
		step.Captures = platformsync.SanitizeStringMap(tr.Captures)
	}
	if !tr.Success {
		kind := tr.ErrorKind
		if kind == "" {
			kind = ErrorKindInternal
		}
		message := "step failed"
		if tr.Error != nil {
			message = tr.Error.Error()
		}
		step.Error = &Error{Kind: kind, Message: platformsync.SanitizeLog(message)}
	}

	if opts.IncludeBodies || (opts.IncludeBodiesOnFailure && !tr.Success) {
		if len(tr.RequestHeaders) > 0 || tr.RequestBody != "" {
			step.Request = NewHTTPMessage(tr.RequestHeaders, tr.RequestBody)
		}
		if tr.Status > 0 || tr.ResponseBody != "" {
			step.Response = NewHTTPMessage(flattenHeaders(tr.ResponseHeaders), tr.ResponseBody)
		}
	}
	return step
}

// NewHTTPMessage builds a redacted HTTP message. JSON bodies are embedded as
// JSON values; other bodies are embedded as strings.
func NewHTTPMessage(headers map[string]string, body string) *HTTPMessage {
	msg := &HTTPMessage{Headers: platformsync.SanitizeStringMap(headers)}
	if strings.TrimSpace(body) == "" {
		return msg
	}
	sanitized, truncated := platformsync.SanitizeBody(body)
	msg.BodyTruncated = truncated
	if !truncated && json.Valid([]byte(sanitized)) {
		msg.Body = json.RawMessage(sanitized)
	} else {
		msg.Body = sanitized
	}
	return msg
}

func flattenHeaders(headers map[string][]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	flat := make(map[string]string, len(headers))
	for key, values := range headers {
		flat[key] = strings.Join(values, ", ")
	}
	return flat
}

// AddStep appends a step and updates the summary counters.
func (r *Result) AddStep(step Step) {
	r.Steps = append(r.Steps, step)
	r.Summary.Total++
	if step.OK {
		r.Summary.Passed++
	} else {
		r.Summary.Failed++
	}
}

// SetError records a top-level error and marks the result as failed.
func (r *Result) SetError(kind, message string) {
	r.Error = &Error{Kind: kind, Message: platformsync.SanitizeLog(message)}
	r.OK = false
}

// FirstFailure returns the error of the first failed step, the top-level
// error, or nil when everything passed.
func (r *Result) FirstFailure() *Error {
	if r.Error != nil {
		return r.Error
	}
	for _, step := range r.Steps {
		if !step.OK && step.Error != nil {
			return step.Error
		}
	}
	return nil
}

// SetDuration records the wall-clock duration of the command.
func (r *Result) SetDuration(started, finished time.Time) {
	d := finished.Sub(started)
	if d < 0 {
		d = 0
	}
	r.Summary.DurationMs = d.Milliseconds()
}

// WriteJSON encodes the result as a single indented JSON document.
func WriteJSON(w io.Writer, r *Result) error {
	if r.Steps == nil {
		r.Steps = []Step{}
	}
	for i := range r.Steps {
		if r.Steps[i].Assertions == nil {
			r.Steps[i].Assertions = []Assertion{}
		}
	}
	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	return encoder.Encode(r)
}

// jsonSink is where the machine-readable document is written. It is the
// process stdout captured before human output is redirected away from it.
var jsonSink io.Writer = os.Stdout

// RedirectHumanOutput captures the real stdout as the JSON sink and points
// os.Stdout at the null device so that decorative fmt.Print output from
// deep call paths cannot corrupt the JSON document. It returns a function
// restoring the previous stdout.
func RedirectHumanOutput() func() {
	realStdout := os.Stdout
	jsonSink = realStdout
	devNull, err := os.OpenFile(os.DevNull, os.O_WRONLY, 0)
	if err != nil {
		return func() {}
	}
	os.Stdout = devNull
	return func() {
		os.Stdout = realStdout
		_ = devNull.Close()
	}
}

// SetJSONSink replaces the JSON sink and returns a function restoring the
// previous one. It is intended for tests and embedding.
func SetJSONSink(w io.Writer) func() {
	previous := jsonSink
	jsonSink = w
	return func() { jsonSink = previous }
}

// EmitJSON writes the result document to the JSON sink.
func EmitJSON(r *Result) error {
	return WriteJSON(jsonSink, r)
}

// maxLineDiffCells bounds the LCS table size used by LineDiff.
const maxLineDiffCells = 4_000_000

// LineDiff returns a minimal line-oriented diff of two texts. Unchanged lines
// are omitted; removed lines start with "- " and added lines with "+ ".
func LineDiff(before, after string) string {
	if before == after {
		return ""
	}
	a := strings.Split(before, "\n")
	b := strings.Split(after, "\n")
	if len(a)*len(b) > maxLineDiffCells {
		var out strings.Builder
		for _, line := range a {
			out.WriteString("- " + line + "\n")
		}
		for _, line := range b {
			out.WriteString("+ " + line + "\n")
		}
		return out.String()
	}
	// Longest common subsequence table over lines.
	lcs := make([][]int, len(a)+1)
	for i := range lcs {
		lcs[i] = make([]int, len(b)+1)
	}
	for i := len(a) - 1; i >= 0; i-- {
		for j := len(b) - 1; j >= 0; j-- {
			if a[i] == b[j] {
				lcs[i][j] = lcs[i+1][j+1] + 1
			} else if lcs[i+1][j] >= lcs[i][j+1] {
				lcs[i][j] = lcs[i+1][j]
			} else {
				lcs[i][j] = lcs[i][j+1]
			}
		}
	}
	var out strings.Builder
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		switch {
		case a[i] == b[j]:
			i++
			j++
		case lcs[i+1][j] >= lcs[i][j+1]:
			out.WriteString("- " + a[i] + "\n")
			i++
		default:
			out.WriteString("+ " + b[j] + "\n")
			j++
		}
	}
	for ; i < len(a); i++ {
		out.WriteString("- " + a[i] + "\n")
	}
	for ; j < len(b); j++ {
		out.WriteString("+ " + b[j] + "\n")
	}
	return out.String()
}
