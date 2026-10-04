package importer

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Render produces the Markdown content of a flow file.
func Render(f FlowFile) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n\n", oneLine(f.Name))
	if f.Description != "" {
		b.WriteString(quote(f.Description))
		b.WriteString("\n")
	}
	if f.Source != "" {
		fmt.Fprintf(&b, "_%s_\n\n", oneLine(f.Source))
	}

	b.WriteString("```flow\n")
	fmt.Fprintf(&b, "@flow id=%s\n", f.ID)
	fmt.Fprintf(&b, "@name %s\n", oneLine(f.Name))
	if len(f.Tags) > 0 {
		fmt.Fprintf(&b, "@tags %s\n", strings.Join(f.Tags, ", "))
	}
	b.WriteString("```\n\n")

	for _, n := range f.Notes {
		b.WriteString(renderNote(n))
	}

	for _, sec := range f.Sections {
		if sec.Title != "" {
			fmt.Fprintf(&b, "## %s\n\n", oneLine(sec.Title))
		}
		if sec.Description != "" {
			b.WriteString(quote(sec.Description))
			b.WriteString("\n")
		}
		for _, n := range sec.Notes {
			b.WriteString(renderNote(n))
		}
		for _, st := range sec.Steps {
			fmt.Fprintf(&b, "### %s\n\n", oneLine(st.Name))
			if st.Description != "" {
				b.WriteString(quote(st.Description))
				b.WriteString("\n")
			}
			b.WriteString(RenderStep(st))
			b.WriteString("\n")
			for _, n := range st.Notes {
				b.WriteString(renderNote(n))
			}
		}
	}
	return strings.TrimRight(b.String(), "\n") + "\n"
}

// RenderStep renders a single fenced step block (with trailing newline).
func RenderStep(st Step) string {
	var body strings.Builder
	fmt.Fprintf(&body, "@id %s\n", st.ID)
	fmt.Fprintf(&body, "@name %s\n\n", oneLine(st.Name))
	fmt.Fprintf(&body, "%s %s\n", strings.ToUpper(st.Method), st.URL)
	for _, h := range st.Headers {
		fmt.Fprintf(&body, "%s: %s\n", h.Name, oneLine(h.Value))
	}
	if len(st.Queries) > 0 {
		body.WriteString("[Queries]\n")
		for _, q := range st.Queries {
			fmt.Fprintf(&body, "%s=%s\n", q.Name, oneLine(q.Value))
		}
		if st.Body != "" {
			body.WriteString("[Body]\n")
			body.WriteString(strings.TrimRight(st.Body, "\n"))
			body.WriteString("\n")
		}
	} else if st.Body != "" {
		body.WriteString("\n")
		body.WriteString(strings.TrimRight(st.Body, "\n"))
		body.WriteString("\n")
	}
	if len(st.Captures) > 0 {
		body.WriteString("\n[Captures]\n")
		for _, c := range st.Captures {
			body.WriteString(c + "\n")
		}
	}
	if len(st.Asserts) > 0 {
		body.WriteString("\n[Asserts]\n")
		for _, a := range st.Asserts {
			body.WriteString(a + "\n")
		}
	}
	content := body.String()
	fence := pickFence(content)
	if fence == "" {
		// Callers move such bodies into notes; this is only a safety net.
		fence = "```"
	}
	return fence + "step\n" + content + fence + "\n"
}

func renderNote(n Note) string {
	var b strings.Builder
	fmt.Fprintf(&b, "> **Manual review:** %s\n\n", oneLine(n.Title))
	content := strings.TrimRight(n.Content, "\n")
	if content == "" {
		return b.String()
	}
	fence := pickFence(content)
	if fence == "" {
		b.WriteString(quote(content))
		b.WriteString("\n")
		return b.String()
	}
	lang := n.Lang
	if lang == "" {
		lang = "text"
	}
	fmt.Fprintf(&b, "%s%s\n%s\n%s\n\n", fence, lang, content, fence)
	return b.String()
}

// pickFence returns a fence that does not collide with any line in content,
// or "" when both ``` and ~~~ appear at the start of a line.
func pickFence(content string) string {
	hasBacktick, hasTilde := false, false
	for _, line := range strings.Split(content, "\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "```") {
			hasBacktick = true
		}
		if strings.HasPrefix(t, "~~~") {
			hasTilde = true
		}
	}
	switch {
	case !hasBacktick:
		return "```"
	case !hasTilde:
		return "~~~"
	default:
		return ""
	}
}

// quote renders free text as a Markdown blockquote. Quoting guarantees that
// code fences inside descriptions are never picked up by the flow parser.
func quote(s string) string {
	var b strings.Builder
	for _, line := range strings.Split(strings.TrimRight(s, "\n"), "\n") {
		line = strings.TrimRight(line, " \t\r")
		if line == "" {
			b.WriteString(">\n")
			continue
		}
		b.WriteString("> " + line + "\n")
	}
	return b.String()
}

func oneLine(s string) string {
	s = strings.ReplaceAll(s, "\r", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	return strings.TrimSpace(s)
}

// RenderEnvSnippet renders the environment as a YAML snippet for .kest/config.yaml.
func RenderEnvSnippet(env Env) string {
	var b strings.Builder
	name := env.Name
	if name == "" {
		name = "imported"
	}
	b.WriteString("environments:\n")
	fmt.Fprintf(&b, "  %s:\n", name)
	if env.BaseURL != "" {
		fmt.Fprintf(&b, "    base_url: %s\n", yamlString(env.BaseURL))
	} else {
		b.WriteString("    base_url: \"\" # TODO: set the API base URL\n")
	}
	keys := make([]string, 0, len(env.Variables))
	for k := range env.Variables {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	if len(keys) > 0 || len(env.Secrets) > 0 || len(env.Required) > 0 {
		b.WriteString("    variables:\n")
	}
	for _, k := range keys {
		fmt.Fprintf(&b, "      %s: %s\n", k, yamlString(env.Variables[k]))
	}
	for _, k := range env.Secrets {
		fmt.Fprintf(&b, "      # %s: secret not copied - pass it with `kest run --var %s=...`\n", k, k)
	}
	for _, k := range env.Required {
		fmt.Fprintf(&b, "      # %s: \"\" # TODO: value needed\n", k)
	}
	return b.String()
}

func yamlString(s string) string {
	return strconv.Quote(s)
}
