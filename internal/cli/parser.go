package cli

import (
	"bufio"
	"fmt"
	"strings"
)

// KestBlock represents a test block extracted from Markdown or a single line from .kest
type KestBlock struct {
	LineNum int
	Raw     string
	IsBlock bool // true if it's a multi-line block from Markdown
}

// ParseMarkdown extracts kest code blocks from markdown content
func ParseMarkdown(content string) []KestBlock {
	var blocks []KestBlock
	scanner := bufio.NewScanner(strings.NewReader(content))
	lineNum := 0
	inBlock := false
	var currentBlock strings.Builder
	blockStartLine := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "```kest") {
			inBlock = true
			blockStartLine = lineNum
			currentBlock.Reset()
			continue
		}

		if inBlock && strings.HasPrefix(trimmed, "```") {
			inBlock = false
			blocks = append(blocks, KestBlock{
				LineNum: blockStartLine,
				Raw:     currentBlock.String(),
				IsBlock: true,
			})
			continue
		}

		if inBlock {
			if currentBlock.Len() > 0 {
				currentBlock.WriteString("\n")
			}
			currentBlock.WriteString(line)
		}
	}
	return blocks
}

// ParseBlock parses a multi-line kest block into RequestOptions
func ParseBlock(raw string) (RequestOptions, error) {
	opts := RequestOptions{}
	scanner := bufio.NewScanner(strings.NewReader(raw))

	// 1. First line: METHOD URL
	if !scanner.Scan() {
		return opts, fmt.Errorf("empty block")
	}
	firstLine := strings.TrimSpace(scanner.Text())
	parts := splitArguments(firstLine)
	if len(parts) < 2 {
		return opts, fmt.Errorf("invalid request line: %s", firstLine)
	}
	opts.Method = strings.ToLower(parts[0])
	opts.URL = parts[1]

	// 2. Parse remaining lines
	section := "headers" // default section after request line
	var bodyLines []string

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		// Section headers
		if trimmed == "[Captures]" {
			section = "captures"
			continue
		}
		if trimmed == "[Asserts]" {
			section = "asserts"
			continue
		}

		// Handle sections
		switch section {
		case "headers":
			if trimmed == "" {
				section = "body"
				continue
			}
			if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
				section = "body"
				bodyLines = append(bodyLines, line)
				continue
			}
			if strings.Contains(trimmed, ":") {
				opts.Headers = append(opts.Headers, trimmed)
			} else {
				// If it doesn't look like a header and isn't empty, assume body started
				section = "body"
				bodyLines = append(bodyLines, line)
			}
		case "body":
			bodyLines = append(bodyLines, line)
		case "captures":
			if trimmed != "" {
				opts.Captures = append(opts.Captures, trimmed)
			}
		case "asserts":
			if trimmed != "" {
				opts.Asserts = append(opts.Asserts, trimmed)
			}
		}
	}

	opts.Data = strings.Join(bodyLines, "\n")
	return opts, nil
}
