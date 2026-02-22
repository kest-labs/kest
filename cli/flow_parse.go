package main

import (
	"fmt"
	"strings"
)

// ParseFlowDocument parses Markdown content into FlowDoc and legacy Kest blocks.
func ParseFlowDocument(content string) (FlowDoc, []KestBlock) {
	blocks := ParseFlowMarkdown(content)
	doc := FlowDoc{}
	var legacy []KestBlock

	for _, b := range blocks {
		switch b.Kind {
		case "flow":
			if isFlowMetaBlock(b.Raw) {
				doc.Meta = mergeFlowMeta(doc.Meta, parseFlowMeta(b.Raw))
			} else {
				legacy = append(legacy, KestBlock{LineNum: b.LineNum, Raw: b.Raw, IsBlock: true})
			}
		case "step":
			step := parseFlowStep(b)
			doc.Steps = append(doc.Steps, step)
		case "edge":
			edge := parseFlowEdge(b)
			if edge.From != "" && edge.To != "" {
				doc.Edges = append(doc.Edges, edge)
			}
		case "kest", "http", "json":
			legacy = append(legacy, KestBlock{LineNum: b.LineNum, Raw: b.Raw, IsBlock: true})
		default:
			// Ignore other fenced blocks
		}
	}

	doc.Steps = ensureStepIDs(doc.Steps)
	return doc, legacy
}

func isFlowMetaBlock(raw string) bool {
	lines := strings.Split(raw, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if !strings.HasPrefix(trimmed, "@") {
			return false
		}
	}
	return true
}

func mergeFlowMeta(base FlowMeta, next FlowMeta) FlowMeta {
	if next.ID != "" {
		base.ID = next.ID
	}
	if next.Name != "" {
		base.Name = next.Name
	}
	if next.Version != "" {
		base.Version = next.Version
	}
	if next.Env != "" {
		base.Env = next.Env
	}
	if len(next.Tags) > 0 {
		base.Tags = next.Tags
	}
	return base
}

func parseFlowMeta(raw string) FlowMeta {
	meta := FlowMeta{}
	lines := strings.Split(raw, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if !strings.HasPrefix(trimmed, "@") {
			continue
		}
		key, val := parseDirective(trimmed)
		switch key {
		case "flow":
			meta.ID = parseInlineKV(val, "id")
			if meta.ID == "" {
				meta.ID = val
			}
		case "name":
			meta.Name = val
		case "version":
			meta.Version = val
		case "env":
			meta.Env = val
		case "tags":
			meta.Tags = splitCSV(val)
		}
	}
	return meta
}

func parseFlowStep(b FlowBlock) FlowStep {
	step := FlowStep{LineNum: b.LineNum, Raw: b.Raw}
	lines := strings.Split(b.Raw, "\n")
	var requestLines []string
	directivePhase := true
	section := "request"

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if directivePhase && (trimmed == "" || strings.HasPrefix(trimmed, "#")) {
			continue
		}
		if directivePhase && strings.HasPrefix(trimmed, "@") {
			key, val := parseDirective(trimmed)
			switch key {
			case "id":
				step.ID = val
			case "name":
				step.Name = val
			case "type":
				step.Type = val
			case "retry":
				step.Retry = parseInt(val)
			case "retry-wait":
				step.RetryWait = parseInt(val)
			case "max-duration":
				step.MaxDuration = parseInt(val)
			case "on-fail":
				fmt.Printf("⚠️  Warning: @on-fail is not yet implemented (line %d), ignoring.\n", b.LineNum)
				step.OnFail = val
			}
			continue
		}
		directivePhase = false

		// Track sections
		if trimmed == "[Captures]" {
			section = "captures"
			continue
		}
		if trimmed == "[Asserts]" {
			section = "asserts"
			continue
		}

		switch section {
		case "request":
			requestLines = append(requestLines, line)
		case "captures":
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				step.Request.Captures = append(step.Request.Captures, strings.TrimSpace(trimmed))
			}
		case "asserts":
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				step.Request.Asserts = append(step.Request.Asserts, strings.TrimSpace(trimmed))
			}
		}
	}

	// Validate @type
	switch step.Type {
	case "", "http", "exec":
		// valid
	default:
		fmt.Printf("⚠️  Warning: unknown step type '%s' at line %d, treating as http.\n", step.Type, b.LineNum)
		step.Type = ""
	}

	requestRaw := strings.TrimSpace(strings.Join(requestLines, "\n"))
	if requestRaw != "" {
		if step.Type == "exec" {
			step.Exec = parseExecBlock(requestRaw)
		} else if opts, err := ParseBlock(requestRaw); err == nil {
			step.Request = opts
		}
	}

	return step
}

func parseExecBlock(raw string) ExecOptions {
	opts := ExecOptions{}
	lines := strings.Split(raw, "\n")
	section := "command"
	var cmdLines []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "[Captures]" {
			section = "captures"
			continue
		}
		switch section {
		case "command":
			cmdLines = append(cmdLines, line)
		case "captures":
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				val := strings.SplitN(trimmed, "#", 2)[0]
				opts.Captures = append(opts.Captures, strings.TrimSpace(val))
			}
		}
	}
	opts.Command = strings.TrimSpace(strings.Join(cmdLines, "\n"))
	return opts
}

func parseFlowEdge(b FlowBlock) FlowEdge {
	edge := FlowEdge{LineNum: b.LineNum}
	lines := strings.Split(b.Raw, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") || !strings.HasPrefix(trimmed, "@") {
			continue
		}
		key, val := parseDirective(trimmed)
		switch key {
		case "from":
			edge.From = val
		case "to":
			edge.To = val
		case "on":
			edge.On = val
		}
	}
	return edge
}

func parseDirective(line string) (string, string) {
	trimmed := strings.TrimSpace(strings.TrimPrefix(line, "@"))
	if trimmed == "" {
		return "", ""
	}
	parts := strings.Fields(trimmed)
	if len(parts) == 0 {
		return "", ""
	}
	key := strings.ToLower(parts[0])
	val := strings.TrimSpace(strings.TrimPrefix(trimmed, parts[0]))
	return key, strings.TrimSpace(val)
}

func splitCSV(value string) []string {
	var out []string
	for _, part := range strings.Split(value, ",") {
		v := strings.TrimSpace(part)
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

func parseInt(value string) int {
	var n int
	for _, r := range strings.TrimSpace(value) {
		if r < '0' || r > '9' {
			break
		}
		n = n*10 + int(r-'0')
	}
	return n
}

func ensureStepIDs(steps []FlowStep) []FlowStep {
	for i := range steps {
		if steps[i].ID == "" {
			steps[i].ID = fmt.Sprintf("step-%d", i+1)
		}
	}
	return steps
}

func parseInlineKV(value string, key string) string {
	key = strings.ToLower(strings.TrimSpace(key))
	parts := strings.Fields(value)
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) == 2 && strings.ToLower(strings.TrimSpace(kv[0])) == key {
			return strings.TrimSpace(kv[1])
		}
		kv = strings.SplitN(part, ":", 2)
		if len(kv) == 2 && strings.ToLower(strings.TrimSpace(kv[0])) == key {
			return strings.TrimSpace(kv[1])
		}
	}
	return ""
}
