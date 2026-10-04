package main

import (
	"fmt"
	"strings"
	"testing"
)

// syntheticFlow builds an n-step flow. With linear=true every consecutive pair
// also gets an explicit `@on success` edge block.
func syntheticFlow(n int, linear bool) string {
	var b strings.Builder
	b.WriteString("# Synthetic\n\n```flow\n@flow id=synthetic\n@name Synthetic\n```\n\n")
	for i := 1; i <= n; i++ {
		fmt.Fprintf(&b, "```step\n@id s%d\nGET /item/%d\n\n[Asserts]\nstatus == 200\n```\n\n", i, i)
	}
	if linear {
		for i := 1; i < n; i++ {
			fmt.Fprintf(&b, "```edge\n@from s%d\n@to s%d\n@on success\n```\n\n", i, i+1)
		}
	}
	return b.String()
}

func TestNoEdgesEquivalentToLinearEdges(t *testing.T) {
	for _, n := range []int{1, 2, 5, 12} {
		bare, _ := ParseFlowDocument(syntheticFlow(n, false))
		linear, _ := ParseFlowDocument(syntheticFlow(n, true))
		if len(bare.Edges) != 0 || (n > 1 && len(linear.Edges) != n-1) {
			t.Fatalf("n=%d: unexpected edge counts bare=%d linear=%d", n, len(bare.Edges), len(linear.Edges))
		}
		pb, pl := BuildFlowPlan(bare), BuildFlowPlan(linear)
		if len(pb) != n {
			t.Fatalf("n=%d: plan has %d entries", n, len(pb))
		}
		for i := range pb {
			if pb[i].ID != fmt.Sprintf("s%d", i+1) {
				t.Fatalf("n=%d: bare plan out of file order at %d: %s", n, i, pb[i].ID)
			}
		}
		if !flowPlansEquivalent(pb, pl) {
			t.Fatalf("n=%d: plans differ\nbare:   %v\nlinear: %v", n, planSequence(pb), planSequence(pl))
		}
	}
}

func TestEdgesOnlyReorderWhenNonLinear(t *testing.T) {
	// s3 must run before s2 although it is declared after it.
	content := syntheticFlow(3, false) + "```edge\n@from s3\n@to s2\n@on success\n```\n"
	doc, _ := ParseFlowDocument(content)
	var ids []string
	for _, e := range BuildFlowPlan(doc) {
		ids = append(ids, e.ID)
	}
	if strings.Join(ids, ",") != "s1,s3,s2" {
		t.Fatalf("expected s1,s3,s2 got %v", ids)
	}
}

func TestMermaidImplicitEdgesForUntouchedNeighbours(t *testing.T) {
	content := syntheticFlow(4, false) + "```edge\n@from s3\n@to s4\n@on success\n```\n"
	doc, _ := ParseFlowDocument(content)
	out := FlowToMermaid(doc)
	for _, want := range []string{"s1 --> s2", "s2 --> s3", "s3 -->|success| s4"} {
		if !strings.Contains(out, want) {
			t.Fatalf("mermaid missing %q:\n%s", want, out)
		}
	}
	// s4 already has an explicit incoming edge, so no implicit s3 --> s4.
	if strings.Count(out, "s3 --> s4") != 0 {
		t.Fatalf("unexpected implicit edge into s4:\n%s", out)
	}
}

func TestMermaidDrawsImplicitSequentialEdges(t *testing.T) {
	doc, _ := ParseFlowDocument(syntheticFlow(3, false))
	out := FlowToMermaid(doc)
	for _, want := range []string{"s1 --> s2", "s2 --> s3"} {
		if !strings.Contains(out, want) {
			t.Fatalf("mermaid missing %q:\n%s", want, out)
		}
	}
}
