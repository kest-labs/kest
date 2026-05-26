package flow

import (
	"bufio"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type parsedFlowMarkdown struct {
	SourceID    string
	Name        string
	Metadata    string
	ParseStatus string
	ParseError  string
	ParsedAt    *time.Time
	Steps       []SaveStepRequest
	Edges       []SaveEdgeRequest
}

type markdownBlock struct {
	Kind    string
	LineNum int
	Raw     string
}

type markdownStep struct {
	ID        string
	Name      string
	Type      string
	LineNum   int
	Request   markdownRequest
	Exec      string
	Captures  []string
	Asserts   []string
	SortOrder int
}

type markdownRequest struct {
	Method   string
	URL      string
	Headers  []string
	Body     string
	Captures []string
	Asserts  []string
}

func parseFlowMarkdownDefinition(definition string) parsedFlowMarkdown {
	parsed := parsedFlowMarkdown{ParseStatus: FlowParseStatusUnparsed}
	blocks := parseMarkdownBlocks(definition)
	if len(blocks) == 0 {
		parsed.ParseStatus = FlowParseStatusFailed
		parsed.ParseError = "no flow, step, setup, teardown, or edge blocks found"
		return parsed
	}

	var steps []markdownStep
	var edges []SaveEdgeRequest
	for _, block := range blocks {
		switch block.Kind {
		case "flow":
			if !isFlowMetaBlock(block.Raw) {
				continue
			}
			meta := parseMarkdownFlowMeta(block.Raw)
			if meta.SourceID != "" {
				parsed.SourceID = meta.SourceID
			}
			if meta.Name != "" {
				parsed.Name = meta.Name
			}
			parsed.Metadata = meta.Metadata
		case "setup", "step", "teardown":
			step := parseMarkdownStep(block, len(steps))
			steps = append(steps, step)
		case "edge":
			edge := parseMarkdownEdge(block)
			if edge.SourceClientKey != "" && edge.TargetClientKey != "" {
				edges = append(edges, edge)
			}
		}
	}

	if len(steps) == 0 {
		parsed.ParseStatus = FlowParseStatusFailed
		parsed.ParseError = "flow markdown must include at least one step, setup, or teardown block"
		return parsed
	}

	parsed.Steps = make([]SaveStepRequest, 0, len(steps))
	for index, step := range steps {
		parsed.Steps = append(parsed.Steps, markdownStepToSaveStep(step, index))
	}
	parsed.Edges = edges
	if err := validateSaveGraph(parsed.Steps, parsed.Edges); err != nil {
		parsed.ParseStatus = FlowParseStatusFailed
		parsed.ParseError = err.Error()
		parsed.Steps = nil
		parsed.Edges = nil
		return parsed
	}

	now := time.Now().UTC()
	parsed.ParseStatus = FlowParseStatusParsed
	parsed.ParsedAt = &now
	return parsed
}

func parseMarkdownBlocks(content string) []markdownBlock {
	var blocks []markdownBlock
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
				kind = strings.ToLower(strings.Fields(info + " ")[0])
				inBlock = true
				blockStartLine = lineNum
				current.Reset()
			}
			continue
		}

		if strings.HasPrefix(trimmed, fence) {
			inBlock = false
			if kind != "" {
				blocks = append(blocks, markdownBlock{Kind: kind, LineNum: blockStartLine, Raw: current.String()})
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

func parseMarkdownFlowMeta(raw string) parsedFlowMarkdown {
	meta := parsedFlowMarkdown{}
	metadata := map[string]interface{}{}
	for _, line := range strings.Split(raw, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") || !strings.HasPrefix(trimmed, "@") {
			continue
		}
		key, val := parseMarkdownDirective(trimmed)
		switch key {
		case "flow":
			meta.SourceID = parseInlineKV(val, "id")
			if meta.SourceID == "" {
				meta.SourceID = val
			}
		case "name":
			meta.Name = val
		case "version", "env", "tags":
			metadata[key] = val
		}
	}
	if len(metadata) > 0 {
		data, _ := json.Marshal(metadata)
		meta.Metadata = string(data)
	}
	return meta
}

func parseMarkdownStep(block markdownBlock, sortOrder int) markdownStep {
	step := markdownStep{LineNum: block.LineNum, SortOrder: sortOrder}
	lines := strings.Split(block.Raw, "\n")
	var requestLines []string
	directivePhase := true
	section := "request"

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if directivePhase && (trimmed == "" || strings.HasPrefix(trimmed, "#")) {
			continue
		}
		if directivePhase && strings.HasPrefix(trimmed, "@") {
			key, val := parseMarkdownDirective(trimmed)
			switch key {
			case "id":
				step.ID = val
			case "name":
				step.Name = val
			case "type":
				step.Type = val
			}
			continue
		}
		directivePhase = false

		switch trimmed {
		case "[Captures]":
			section = "captures"
			continue
		case "[Asserts]", "[Soft Asserts]":
			section = "asserts"
			continue
		}

		switch section {
		case "request":
			requestLines = append(requestLines, line)
		case "captures":
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				step.Captures = append(step.Captures, stripInlineComment(trimmed))
			}
		case "asserts":
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				step.Asserts = append(step.Asserts, stripInlineComment(trimmed))
			}
		}
	}

	requestRaw := strings.TrimSpace(strings.Join(requestLines, "\n"))
	if strings.EqualFold(step.Type, "exec") {
		step.Exec = requestRaw
		return step
	}
	step.Request = parseMarkdownHTTPRequest(requestRaw)
	return step
}

func parseMarkdownHTTPRequest(raw string) markdownRequest {
	req := markdownRequest{}
	scanner := bufio.NewScanner(strings.NewReader(raw))
	if !scanner.Scan() {
		return req
	}
	firstLine := strings.TrimSpace(scanner.Text())
	parts := strings.Fields(firstLine)
	if len(parts) >= 2 {
		req.Method = strings.ToUpper(parts[0])
		req.URL = parts[1]
	}

	section := "headers"
	var bodyLines []string
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		switch trimmed {
		case "[Queries]":
			section = "queries"
			continue
		case "[Headers]":
			section = "headers"
			continue
		case "[Body]", "[Data]":
			section = "body"
			continue
		case "[Captures]":
			section = "captures"
			continue
		case "[Asserts]", "[Soft Asserts]":
			section = "asserts"
			continue
		}

		switch section {
		case "queries":
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				req.URL = appendQueryLine(req.URL, stripInlineComment(trimmed))
			}
		case "headers":
			if trimmed == "" {
				section = "body"
				continue
			}
			if strings.Contains(trimmed, ":") && !strings.HasPrefix(trimmed, "{") {
				req.Headers = append(req.Headers, trimmed)
				continue
			}
			section = "body"
			bodyLines = append(bodyLines, line)
		case "body":
			bodyLines = append(bodyLines, line)
		case "captures":
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				req.Captures = append(req.Captures, stripInlineComment(trimmed))
			}
		case "asserts":
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				req.Asserts = append(req.Asserts, stripInlineComment(trimmed))
			}
		}
	}
	req.Body = strings.TrimSpace(strings.Join(bodyLines, "\n"))
	return req
}

func parseMarkdownEdge(block markdownBlock) SaveEdgeRequest {
	var edge SaveEdgeRequest
	for _, line := range strings.Split(block.Raw, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") || !strings.HasPrefix(trimmed, "@") {
			continue
		}
		key, val := parseMarkdownDirective(trimmed)
		switch key {
		case "from":
			edge.SourceClientKey = val
		case "to":
			edge.TargetClientKey = val
		case "on":
			if strings.HasPrefix(strings.TrimSpace(val), "[") {
				edge.VariableMapping = val
			}
		}
	}
	return edge
}

func markdownStepToSaveStep(step markdownStep, index int) SaveStepRequest {
	clientKey := strings.TrimSpace(step.ID)
	if clientKey == "" {
		clientKey = fmt.Sprintf("step-%d", index+1)
	}

	stepType := strings.TrimSpace(step.Type)
	if stepType == "" {
		stepType = "http"
	}

	name := strings.TrimSpace(step.Name)
	if name == "" {
		name = clientKey
	}

	method := strings.TrimSpace(step.Request.Method)
	url := strings.TrimSpace(step.Request.URL)
	body := step.Request.Body
	headers := marshalStringList(step.Request.Headers)
	captures := marshalStringList(append(step.Request.Captures, step.Captures...))
	asserts := marshalStringList(append(step.Request.Asserts, step.Asserts...))
	if stepType == "exec" {
		method = "EXEC"
		url = step.Exec
		body = step.Exec
		headers = ""
		captures = marshalStringList(step.Captures)
	}
	if method == "" {
		method = "STEP"
	}
	if url == "" {
		url = name
	}

	return SaveStepRequest{
		ClientKey: clientKey,
		Name:      name,
		SortOrder: index,
		Method:    method,
		URL:       url,
		Headers:   headers,
		Body:      body,
		Captures:  captures,
		Asserts:   asserts,
		PositionX: float64(120 + (index%4)*260),
		PositionY: float64(80 + (index/4)*180),
	}
}

func replaceFlowGraph(ctx context.Context, repo Repository, flowID string, steps []SaveStepRequest, edges []SaveEdgeRequest) error {
	if err := validateSaveGraph(steps, edges); err != nil {
		return err
	}

	stepPOs := make([]*FlowStepPO, 0, len(steps))
	for _, stepReq := range steps {
		stepPOs = append(stepPOs, &FlowStepPO{
			FlowID:    flowID,
			ClientKey: normalizeStepClientKey("", stepReq.ClientKey),
			SourceID:  strings.TrimSpace(stepReq.ClientKey),
			StepType:  "http",
			Name:      stepReq.Name,
			SortOrder: stepReq.SortOrder,
			Method:    stepReq.Method,
			URL:       stepReq.URL,
			Headers:   stepReq.Headers,
			Body:      stepReq.Body,
			Captures:  stepReq.Captures,
			Asserts:   stepReq.Asserts,
			PositionX: stepReq.PositionX,
			PositionY: stepReq.PositionY,
		})
	}
	if err := repo.BatchCreateSteps(ctx, stepPOs); err != nil {
		return err
	}

	stepIDByClientKey := make(map[string]string, len(stepPOs))
	for _, step := range stepPOs {
		stepIDByClientKey[step.ClientKey] = step.ID
	}

	edgePOs := make([]*FlowEdgePO, 0, len(edges))
	for _, edgeReq := range edges {
		sourceID, ok := stepIDByClientKey[edgeReq.SourceClientKey]
		if !ok {
			return newFlowError(http.StatusUnprocessableEntity, fmt.Sprintf("edge source step %q does not exist", edgeReq.SourceClientKey))
		}
		targetID, ok := stepIDByClientKey[edgeReq.TargetClientKey]
		if !ok {
			return newFlowError(http.StatusUnprocessableEntity, fmt.Sprintf("edge target step %q does not exist", edgeReq.TargetClientKey))
		}

		edgePOs = append(edgePOs, &FlowEdgePO{
			FlowID:          flowID,
			SourceStepID:    sourceID,
			TargetStepID:    targetID,
			VariableMapping: edgeReq.VariableMapping,
		})
	}
	return repo.BatchCreateEdges(ctx, edgePOs)
}

func parseMarkdownDirective(line string) (string, string) {
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

func parseInlineKV(value string, key string) string {
	key = strings.ToLower(strings.TrimSpace(key))
	for _, part := range strings.Fields(value) {
		if kv := strings.SplitN(part, "=", 2); len(kv) == 2 && strings.ToLower(strings.TrimSpace(kv[0])) == key {
			return strings.TrimSpace(kv[1])
		}
		if kv := strings.SplitN(part, ":", 2); len(kv) == 2 && strings.ToLower(strings.TrimSpace(kv[0])) == key {
			return strings.TrimSpace(kv[1])
		}
	}
	return ""
}

func marshalStringList(values []string) string {
	clean := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			clean = append(clean, trimmed)
		}
	}
	if len(clean) == 0 {
		return ""
	}
	data, _ := json.Marshal(clean)
	return string(data)
}

func stripInlineComment(value string) string {
	return strings.TrimSpace(strings.SplitN(value, "#", 2)[0])
}

func appendQueryLine(rawURL string, queryLine string) string {
	queryLine = strings.TrimSpace(queryLine)
	if rawURL == "" || queryLine == "" {
		return rawURL
	}
	separator := "?"
	if strings.Contains(rawURL, "?") {
		separator = "&"
	}
	return rawURL + separator + queryLine
}

func definitionHash(definition string) string {
	sum := sha1.Sum([]byte(definition))
	return hex.EncodeToString(sum[:])
}

func shortDefinitionHash(definition string) string {
	hash := definitionHash(definition)
	if len(hash) <= 12 {
		return hash
	}
	return hash[:12]
}
