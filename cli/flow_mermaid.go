package main

import (
	"fmt"
	"strings"
)

// FlowToMermaid renders a flowchart string for Mermaid.
func FlowToMermaid(doc FlowDoc) string {
	var b strings.Builder
	b.WriteString("flowchart LR\n")

	stepName := func(step FlowStep) string {
		if step.Name != "" {
			return step.Name
		}
		if step.ID != "" {
			return step.ID
		}
		return "step"
	}

	// Steps pulled in with @use run first (setup phase); draw them as a chain
	// leading into the first own step. Their ids contain dots, which Mermaid
	// node ids cannot, so every id goes through mermaidID.
	var included []FlowStep
	for _, step := range doc.Setup {
		if step.IncludedFrom != "" && step.ID != "" {
			included = append(included, step)
		}
	}
	for _, step := range included {
		fmt.Fprintf(&b, "  %s[\"%s\"]\n", mermaidID(step.ID), escapeMermaidLabel(stepName(step)))
	}
	for i := 0; i+1 < len(included); i++ {
		fmt.Fprintf(&b, "  %s --> %s\n", mermaidID(included[i].ID), mermaidID(included[i+1].ID))
	}
	if len(included) > 0 && len(doc.Steps) > 0 && doc.Steps[0].ID != "" {
		fmt.Fprintf(&b, "  %s --> %s\n", mermaidID(included[len(included)-1].ID), mermaidID(doc.Steps[0].ID))
	}

	for _, step := range doc.Steps {
		id := step.ID
		if id == "" {
			continue
		}
		label := escapeMermaidLabel(stepName(step))
		fmt.Fprintf(&b, "  %s[\"%s\"]\n", mermaidID(id), label)
	}

	if len(doc.Edges) == 0 {
		for i := 0; i+1 < len(doc.Steps); i++ {
			from := doc.Steps[i].ID
			to := doc.Steps[i+1].ID
			if from == "" || to == "" {
				continue
			}
			fmt.Fprintf(&b, "  %s --> %s\n", mermaidID(from), mermaidID(to))
		}
		return b.String()
	}

	// Steps that no explicit edge touches still run in file order; draw the
	// implicit sequential edge between neighbours that have no explicit
	// outgoing/incoming edge, so partially-specified flows are not drawn with
	// disconnected nodes.
	hasOut := map[string]bool{}
	hasIn := map[string]bool{}
	for _, edge := range doc.Edges {
		hasOut[edge.From] = true
		hasIn[edge.To] = true
	}
	for i := 0; i+1 < len(doc.Steps); i++ {
		from, to := doc.Steps[i].ID, doc.Steps[i+1].ID
		if from == "" || to == "" || hasOut[from] || hasIn[to] {
			continue
		}
		fmt.Fprintf(&b, "  %s --> %s\n", mermaidID(from), mermaidID(to))
	}

	for _, edge := range doc.Edges {
		if edge.From == "" || edge.To == "" {
			continue
		}
		if edge.On != "" {
			label := escapeMermaidLabel(edge.On)
			fmt.Fprintf(&b, "  %s -->|%s| %s\n", mermaidID(edge.From), label, mermaidID(edge.To))
		} else {
			fmt.Fprintf(&b, "  %s --> %s\n", mermaidID(edge.From), mermaidID(edge.To))
		}
	}

	return b.String()
}

func escapeMermaidLabel(value string) string {
	return strings.ReplaceAll(value, "\"", "'")
}

// mermaidID makes a step id usable as a Mermaid node id.
func mermaidID(id string) string {
	return strings.ReplaceAll(id, ".", "_")
}
