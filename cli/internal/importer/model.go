// Package importer converts third-party API definitions (Postman collections,
// curl commands, OpenAPI specs) into Kest Markdown flow files (.flow.md).
//
// The importer only produces text. It never sends requests and never writes
// secret values: credentials found in source files are replaced with Kest
// variables that the user supplies at run time (for example with --var).
package importer

import (
	"fmt"
	"sort"
	"strings"
)

// KV is an ordered name/value pair used for headers and query parameters.
type KV struct {
	Name  string
	Value string
}

// Note is content that could not be translated automatically. It is kept in
// the generated Markdown (outside of any step block) so nothing is lost.
type Note struct {
	Title   string
	Lang    string // fenced code language, empty for plain text
	Content string
}

// Step is a single HTTP request block in a flow file.
type Step struct {
	ID          string
	Name        string
	Description string
	Method      string
	URL         string
	Headers     []KV
	Queries     []KV
	Body        string
	Captures    []string
	Asserts     []string
	Notes       []Note
}

// Section groups steps under an optional heading (for example a Postman sub-folder).
type Section struct {
	Title       string
	Description string
	Notes       []Note
	Steps       []Step
}

// FlowFile is one generated .flow.md document.
type FlowFile struct {
	FileName    string
	ID          string
	Name        string
	Description string
	Source      string
	Tags        []string
	Notes       []Note
	Sections    []Section
}

// StepCount returns the number of steps in the file.
func (f FlowFile) StepCount() int {
	n := 0
	for _, s := range f.Sections {
		n += len(s.Steps)
	}
	return n
}

// Env describes the Kest environment derived from the source.
type Env struct {
	Name      string
	BaseURL   string
	Variables map[string]string
	// Secrets lists variable names whose values were deliberately not copied.
	Secrets []string
	// Required lists variables referenced by the flows that have no known value.
	Required []string
}

func (e *Env) setVar(name, value string) {
	if e.Variables == nil {
		e.Variables = map[string]string{}
	}
	e.Variables[name] = value
}

func (e *Env) addSecret(name string) {
	for _, s := range e.Secrets {
		if s == name {
			return
		}
	}
	e.Secrets = append(e.Secrets, name)
	delete(e.Variables, name)
}

func (e *Env) isSecret(name string) bool {
	for _, s := range e.Secrets {
		if s == name {
			return true
		}
	}
	return false
}

func (e *Env) addRequired(name string) {
	if _, ok := e.Variables[name]; ok {
		return
	}
	for _, s := range append(append([]string{}, e.Secrets...), e.Required...) {
		if s == name {
			return
		}
	}
	e.Required = append(e.Required, name)
}

// Warning is an item that needs manual review after import.
type Warning struct {
	Location string
	Message  string
}

func (w Warning) String() string {
	if w.Location == "" {
		return w.Message
	}
	return fmt.Sprintf("[%s] %s", w.Location, w.Message)
}

// Result is the output of an import.
type Result struct {
	SourceKind string // "postman", "openapi", "curl"
	SourceName string
	Files      []FlowFile
	Env        Env
	Warnings   []Warning
}

// RequestCount returns the total number of steps across all files.
func (r *Result) RequestCount() int {
	n := 0
	for _, f := range r.Files {
		n += f.StepCount()
	}
	return n
}

func (r *Result) warn(location, format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	for _, w := range r.Warnings {
		if w.Location == location && w.Message == msg {
			return
		}
	}
	r.Warnings = append(r.Warnings, Warning{Location: location, Message: msg})
}

// finalizeEnv records every referenced variable without a value as required.
func (r *Result) finalizeEnv() {
	seen := map[string]bool{}
	var names []string
	collect := func(s string) {
		for _, name := range referencedVars(s) {
			if !seen[name] {
				seen[name] = true
				names = append(names, name)
			}
		}
	}
	captured := map[string]bool{}
	for _, f := range r.Files {
		for _, sec := range f.Sections {
			for _, st := range sec.Steps {
				collect(st.URL)
				collect(st.Body)
				for _, h := range st.Headers {
					collect(h.Value)
				}
				for _, q := range st.Queries {
					collect(q.Value)
				}
				for _, c := range st.Captures {
					if name, _, ok := strings.Cut(c, "="); ok {
						captured[strings.TrimSpace(name)] = true
					}
				}
			}
		}
	}
	// Secrets are only worth mentioning when a flow references them and no
	// step captures them at run time (e.g. a token obtained by a login step).
	var secrets []string
	for _, name := range r.Env.Secrets {
		if seen[name] && !captured[name] {
			secrets = append(secrets, name)
		}
	}
	r.Env.Secrets = secrets
	for _, name := range names {
		if captured[name] || r.Env.isSecret(name) {
			continue
		}
		r.Env.addRequired(name)
	}
	sort.Strings(r.Env.Secrets)
	sort.Strings(r.Env.Required)
}
