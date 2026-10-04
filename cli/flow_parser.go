package main

import (
	"bufio"
	"strings"
)

type FlowBlock struct {
	Kind    string
	LineNum int
	Raw     string
}

// ParseFlowMarkdown extracts fenced code blocks and returns flow-related blocks.
// It supports both ``` and ~~~ fences and keeps the info string kind (first token).
func ParseFlowMarkdown(content string) []FlowBlock {
	var blocks []FlowBlock
	scanner := bufio.NewScanner(strings.NewReader(content))

	lineNum := 0
	inBlock := false
	var current strings.Builder
	blockStartLine := 0
	fence := ""
	kind := ""

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		if !inBlock {
			if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
				fence = trimmed[:3]
				info := strings.TrimSpace(trimmed[3:])
				kind = ""
				// A bare fence (no info string) is a plain code block, not a kind.
				if fields := strings.Fields(info); len(fields) > 0 {
					kind = strings.ToLower(fields[0])
				}
				inBlock = true
				blockStartLine = lineNum
				current.Reset()
			}
			continue
		}

		if strings.HasPrefix(trimmed, fence) {
			inBlock = false
			if kind != "" {
				blocks = append(blocks, FlowBlock{
					Kind:    kind,
					LineNum: blockStartLine,
					Raw:     current.String(),
				})
			}
			fence = ""
			kind = ""
			continue
		}

		if current.Len() > 0 {
			current.WriteString("\n")
		}
		current.WriteString(line)
	}

	return blocks
}
