package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

// Flow-level defaults
//
// A flow declares defaults with @ directives in its (```flow) metadata block:
//
//	@default-header Accept: application/json
//	@default-assert status == 200
//	@auto-content-type json
//
// They are applied once, at parse time, to every setup/step/teardown HTTP step
// unless that step carries `@no-defaults`. Applying them at parse time means
// the resolved headers and assertions show up everywhere a step is described
// (run output, --json, HTML report, plan dump) with no special casing.
//
// Directives were chosen over a new ```defaults fenced block because the flow
// metadata block already is "@key value" lines, the parser already merges
// several of them, and an unknown directive is ignored by older binaries
// instead of the whole block being misread.

func addDefaultHeader(meta *FlowMeta, val string) {
	parts := strings.SplitN(val, ":", 2)
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" {
		return
	}
	name, value := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
	meta.DefaultHeaderLines = append(meta.DefaultHeaderLines, name+": "+value)
	if meta.DefaultHeaders == nil {
		meta.DefaultHeaders = map[string]string{}
	}
	meta.DefaultHeaders[name] = value
}

// applyFlowDefaults mutates doc, adding the flow-level default headers and
// assertions to every eligible step.
func applyFlowDefaults(doc *FlowDoc) {
	m := doc.Meta
	if len(m.DefaultHeaderLines) == 0 && len(m.DefaultAsserts) == 0 && !m.AutoContentType {
		return
	}
	apply := func(steps []FlowStep) {
		for i := range steps {
			applyDefaultsToStep(&steps[i], m)
		}
	}
	apply(doc.Setup)
	apply(doc.Steps)
	apply(doc.Teardown)
}

func applyDefaultsToStep(step *FlowStep, m FlowMeta) {
	if step.Type == "exec" || step.NoDefaults {
		return
	}
	req := &step.Request

	// Headers: a default is skipped when the step sets the same header.
	if len(m.DefaultHeaderLines) > 0 {
		have := map[string]bool{}
		for _, h := range req.Headers {
			if name, _, ok := strings.Cut(h, ":"); ok {
				have[http.CanonicalHeaderKey(strings.TrimSpace(name))] = true
			}
		}
		var merged []string
		for _, h := range m.DefaultHeaderLines {
			name, _, _ := strings.Cut(h, ":")
			if !have[http.CanonicalHeaderKey(strings.TrimSpace(name))] {
				merged = append(merged, h)
			}
		}
		req.Headers = append(merged, req.Headers...)
	}

	// Assertions: a default is skipped when the step already asserts the same
	// subject (the first token, e.g. `status`), so a step expecting 201 is not
	// also forced to 200.
	if len(m.DefaultAsserts) > 0 {
		subjects := map[string]bool{}
		for _, a := range req.Asserts {
			subjects[assertSubject(a)] = true
		}
		for _, a := range m.DefaultAsserts {
			if !subjects[assertSubject(a)] {
				req.Asserts = append(req.Asserts, a)
			}
		}
	}

	if m.AutoContentType {
		req.AutoJSONContentType = true
	}
}

func assertSubject(expr string) string {
	fields := strings.Fields(expr)
	if len(fields) == 0 {
		return ""
	}
	return strings.ToLower(fields[0])
}

// applyAutoContentType sets Content-Type: application/json on a request whose
// body is valid JSON when the flow opted in (@auto-content-type json) and no
// Content-Type header is present after config/flow/step headers are merged.
func applyAutoContentType(opts RequestOptions, headers map[string]string, body []byte) {
	if !opts.AutoJSONContentType || len(body) == 0 {
		return
	}
	for k := range headers {
		if strings.EqualFold(k, "Content-Type") {
			return
		}
	}
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" || (trimmed[0] != '{' && trimmed[0] != '[') || !json.Valid([]byte(trimmed)) {
		return
	}
	headers["Content-Type"] = "application/json"
}
