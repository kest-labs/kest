package example

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/config"
	requestmodule "github.com/kest-labs/kest/api/internal/modules/request"
)

const defaultAIExampleCount = 6
const maxAIExampleCount = 12

type exampleLLMClient struct {
	apiKey  string
	baseURL string
	model   string
	timeout time.Duration
}

type exampleChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type exampleChatRequest struct {
	Model       string               `json:"model"`
	Messages    []exampleChatMessage `json:"messages"`
	MaxTokens   int                  `json:"max_tokens,omitempty"`
	Temperature float64              `json:"temperature,omitempty"`
}

type exampleChatChoice struct {
	Message exampleChatMessage `json:"message"`
}

type exampleChatResponse struct {
	Choices []exampleChatChoice `json:"choices"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type aiExampleDraftEnvelope struct {
	Examples []aiExampleDraft `json:"examples"`
}

type aiExampleDraft struct {
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	Category        string            `json:"category"`
	URL             string            `json:"url"`
	Method          string            `json:"method"`
	Headers         []KeyValue        `json:"headers"`
	QueryParams     []KeyValue        `json:"query_params"`
	Body            string            `json:"body"`
	BodyType        string            `json:"body_type"`
	Auth            *AuthConfig       `json:"auth"`
	Assertions      []Assertion       `json:"assertions"`
	ResponseStatus  int               `json:"response_status"`
	ResponseHeaders map[string]string `json:"response_headers"`
	ResponseBody    string            `json:"response_body"`
}

type aiExampleGenerationOptions struct {
	Count        int
	Categories   []string
	Instructions string
}

func generateAIExampleDrafts(
	ctx context.Context,
	req *requestmodule.Request,
	existing []*Example,
	options aiExampleGenerationOptions,
) ([]*CreateExampleRequest, error) {
	cfg := config.GlobalConfig
	if cfg == nil || cfg.OpenAI.APIKey == "" {
		return nil, fmt.Errorf("AI example generation is not configured (OPENAI_API_KEY missing)")
	}

	count := normalizeAIExampleCount(options.Count)
	categories := normalizeAIExampleCategories(options.Categories)
	instructions := truncatePromptValue(strings.TrimSpace(options.Instructions), 1200)
	client := &exampleLLMClient{
		apiKey:  cfg.OpenAI.APIKey,
		baseURL: cfg.OpenAI.BaseURL,
		model:   cfg.OpenAI.Model,
		timeout: 90 * time.Second,
	}

	raw, err := client.complete(
		ctx,
		getAIExamplesSystemPrompt(),
		buildAIExamplesPrompt(req, existing, count, categories, instructions),
	)
	if err != nil {
		return nil, err
	}

	drafts, err := parseAIExampleDrafts(raw)
	if err != nil {
		return nil, err
	}
	if len(drafts) == 0 {
		return nil, fmt.Errorf("AI example generation returned no examples")
	}
	if len(drafts) > count {
		drafts = drafts[:count]
	}

	result := make([]*CreateExampleRequest, 0, len(drafts))
	for index, draft := range drafts {
		normalized := normalizeAIExampleDraft(req, draft, index)
		result = append(result, normalized)
	}
	return result, nil
}

func (c *exampleLLMClient) complete(ctx context.Context, system, user string) (string, error) {
	payload := exampleChatRequest{
		Model: c.model,
		Messages: []exampleChatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		MaxTokens:   4096,
		Temperature: 0.35,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	endpoint := strings.TrimSuffix(c.baseURL, "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	timeout := c.timeout
	if timeout <= 0 {
		timeout = 90 * time.Second
	}
	client := &http.Client{Timeout: timeout}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("LLM request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result exampleChatResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return "", fmt.Errorf("failed to parse LLM response: %w", err)
	}
	if result.Error != nil {
		return "", fmt.Errorf("LLM API error: %s", result.Error.Message)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("LLM returned no choices")
	}

	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}

func normalizeAIExampleCount(count int) int {
	if count <= 0 {
		return defaultAIExampleCount
	}
	if count > maxAIExampleCount {
		return maxAIExampleCount
	}
	return count
}

func normalizeAIExampleCategories(categories []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(categories))
	for _, category := range categories {
		normalized := normalizeExampleCategory(strings.ToLower(strings.TrimSpace(category)))
		if normalized == "general" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	if len(result) == 0 {
		return []string{"positive", "negative", "boundary", "security"}
	}
	return result
}

func getAIExamplesSystemPrompt() string {
	return strings.Join([]string{
		"You generate executable HTTP request examples for API boundary testing.",
		"Return strict JSON only. Do not wrap the JSON in markdown fences.",
		"Return one top-level object with an examples array; do not return a top-level array or multiple JSON objects.",
		"Every example must include the complete request state needed for that scenario.",
		"Every example must include a category: positive, negative, boundary, or security.",
		"Every example must include assertions that can be evaluated after execution.",
		"Use placeholders such as {{base_url}}, {{token}}, and realistic safe dummy values.",
		"Never include real credentials, real personal data, or destructive payloads.",
	}, " ")
}

func buildAIExamplesPrompt(
	req *requestmodule.Request,
	existing []*Example,
	count int,
	categories []string,
	instructions string,
) string {
	payload := map[string]any{
		"target_count":         count,
		"requested_categories": categories,
		"extra_instructions":   instructions,
		"request": map[string]any{
			"name":         req.Name,
			"description":  req.Description,
			"method":       req.Method,
			"url":          req.URL,
			"headers":      requestKeyValuesForPrompt(req.Headers),
			"query_params": requestKeyValuesForPrompt(req.QueryParams),
			"path_params":  req.PathParams,
			"body":         sanitizePromptBody(req.Body),
			"body_type":    req.BodyType,
			"auth":         requestAuthForPrompt(req.Auth),
			"doc_markdown": truncatePromptValue(req.DocMarkdown, 2500),
			"doc_zh":       truncatePromptValue(req.DocMarkdownZh, 1800),
			"doc_en":       truncatePromptValue(req.DocMarkdownEn, 1800),
			"test_script":  truncatePromptValue(req.Test, 1200),
			"pre_request":  truncatePromptValue(req.PreRequest, 1200),
		},
		"existing_examples": examplesForPrompt(existing),
		"required_output_schema": map[string]any{
			"examples": []map[string]any{
				{
					"name":         "Happy path",
					"description":  "Valid request with representative inputs.",
					"category":     "positive",
					"method":       req.Method,
					"url":          req.URL,
					"headers":      []KeyValue{},
					"query_params": []KeyValue{},
					"body":         "",
					"body_type":    "none",
					"auth":         nil,
					"assertions": []Assertion{
						{
							Type:     "status",
							Operator: "equals",
							Expect:   200,
							Message:  "Response status should be 200.",
						},
					},
					"response_status":  200,
					"response_headers": map[string]string{},
					"response_body":    "",
				},
			},
		},
	}

	encoded, _ := json.MarshalIndent(payload, "", "  ")
	return string(encoded) + "\n\nCreate examples only for requested_categories. Cover happy path, missing required inputs, invalid path/query/body values, empty values, length or numeric boundaries, and auth/header failures when relevant. Set response_status to the expected HTTP status for each scenario. Use assertion types status, header, body_contains, or json_path with operators equals, not_equals, exists, or contains. For header assertions, set path to the header name such as Content-Type or Authorization. Include at least one status assertion for every example."
}

func parseAIExampleDrafts(raw string) ([]aiExampleDraft, error) {
	clean, err := cleanAIJSON(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse AI examples JSON: %w", err)
	}

	var envelope aiExampleDraftEnvelope
	envelopeErr := json.Unmarshal([]byte(clean), &envelope)
	if envelopeErr == nil && envelope.Examples != nil {
		return envelope.Examples, nil
	}

	var direct []aiExampleDraft
	if err := json.Unmarshal([]byte(clean), &direct); err == nil {
		return direct, nil
	}

	if envelopeErr != nil {
		return nil, fmt.Errorf("failed to parse AI examples JSON: %w", envelopeErr)
	}
	return nil, fmt.Errorf("failed to parse AI examples JSON: expected a JSON object with an examples array")
}

func cleanAIJSON(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if strings.HasPrefix(trimmed, "```") {
		lineBreakIndex := strings.Index(trimmed, "\n")
		if lineBreakIndex >= 0 {
			trimmed = strings.TrimSpace(trimmed[lineBreakIndex+1:])
		}
		if strings.HasSuffix(trimmed, "```") {
			trimmed = strings.TrimSpace(trimmed[:len(trimmed)-3])
		}
	}

	for index := 0; index < len(trimmed); index++ {
		if trimmed[index] != '{' && trimmed[index] != '[' {
			continue
		}

		decoder := json.NewDecoder(strings.NewReader(trimmed[index:]))
		var payload json.RawMessage
		if err := decoder.Decode(&payload); err == nil {
			return strings.TrimSpace(string(payload)), nil
		}
	}

	return "", fmt.Errorf("no JSON object or array found")
}

func normalizeAIExampleDraft(req *requestmodule.Request, draft aiExampleDraft, index int) *CreateExampleRequest {
	name := strings.TrimSpace(draft.Name)
	if name == "" {
		name = fmt.Sprintf("%s %s scenario %d", req.Method, req.URL, index+1)
	}

	method := strings.ToUpper(strings.TrimSpace(draft.Method))
	if method == "" {
		method = req.Method
	}

	url := strings.TrimSpace(draft.URL)
	if url == "" {
		url = req.URL
	}

	bodyType := strings.TrimSpace(draft.BodyType)
	if bodyType == "" {
		bodyType = req.BodyType
	}
	if bodyType == "" {
		bodyType = "none"
	}

	responseStatus := draft.ResponseStatus
	if responseStatus <= 0 {
		responseStatus = 200
	}

	category := normalizeExampleCategory(strings.ToLower(strings.TrimSpace(draft.Category)))
	assertions := normalizeExampleAssertions(draft.Assertions, responseStatus)

	return &CreateExampleRequest{
		Name:            truncatePromptValue(name, 100),
		Description:     truncatePromptValue(strings.TrimSpace(draft.Description), 500),
		Category:        category,
		Source:          "ai",
		URL:             url,
		Method:          method,
		Headers:         normalizeExampleKeyValues(draft.Headers),
		QueryParams:     normalizeExampleKeyValues(draft.QueryParams),
		Body:            draft.Body,
		BodyType:        bodyType,
		Auth:            draft.Auth,
		Assertions:      assertions,
		ResponseStatus:  responseStatus,
		ResponseHeaders: draft.ResponseHeaders,
		ResponseBody:    draft.ResponseBody,
		SortOrder:       index,
	}
}

func normalizeExampleKeyValues(rows []KeyValue) []KeyValue {
	result := make([]KeyValue, 0, len(rows))
	for _, row := range rows {
		key := strings.TrimSpace(row.Key)
		if key == "" {
			continue
		}
		if !row.Enabled {
			row.Enabled = true
		}
		row.Key = key
		result = append(result, row)
	}
	return result
}

func normalizeExampleAssertions(assertions []Assertion, responseStatus int) []Assertion {
	result := make([]Assertion, 0, len(assertions)+1)
	hasStatus := false
	for _, assertion := range assertions {
		assertion.Type = strings.TrimSpace(assertion.Type)
		assertion.Path = strings.TrimSpace(assertion.Path)
		assertion.Operator = strings.TrimSpace(assertion.Operator)
		assertion.Message = truncatePromptValue(strings.TrimSpace(assertion.Message), 240)
		if assertion.Type == "" {
			continue
		}
		if assertion.Operator == "" {
			assertion.Operator = "equals"
		}
		if assertion.Type == "header" && assertion.Path == "" {
			assertion.Path = inferHeaderAssertionPath(assertion)
		}
		if assertion.Type == "status" {
			hasStatus = true
		}
		result = append(result, assertion)
	}
	if !hasStatus {
		result = append([]Assertion{
			{
				Type:     "status",
				Operator: "equals",
				Expect:   responseStatus,
				Message:  fmt.Sprintf("Response status should be %d.", responseStatus),
			},
		}, result...)
	}
	return result
}

func inferHeaderAssertionPath(assertion Assertion) string {
	value := strings.ToLower(strings.TrimSpace(fmt.Sprint(assertion.Expect)))
	message := strings.ToLower(assertion.Message)
	context := value + " " + message

	switch {
	case strings.Contains(context, "content-type") ||
		strings.Contains(context, "content type") ||
		strings.Contains(context, "application/json") ||
		strings.Contains(context, "json"):
		return "Content-Type"
	case strings.Contains(context, "authorization") ||
		strings.Contains(context, "bearer"):
		return "Authorization"
	case strings.Contains(context, "location"):
		return "Location"
	case strings.Contains(context, "cache-control"):
		return "Cache-Control"
	default:
		return ""
	}
}

func requestKeyValuesForPrompt(rows []requestmodule.KeyValue) []KeyValue {
	result := make([]KeyValue, 0, len(rows))
	for _, row := range rows {
		result = append(result, KeyValue{
			Key:         row.Key,
			Value:       sanitizePromptValue(row.Key, row.Value),
			Type:        row.Type,
			Enabled:     row.Enabled,
			Description: row.Description,
		})
	}
	return result
}

func requestAuthForPrompt(auth *requestmodule.AuthConfig) *AuthConfig {
	if auth == nil {
		return nil
	}

	payload, err := json.Marshal(auth)
	if err != nil {
		return &AuthConfig{Type: auth.Type}
	}

	var converted AuthConfig
	if err := json.Unmarshal(payload, &converted); err != nil {
		return &AuthConfig{Type: auth.Type}
	}

	if converted.Bearer != nil && converted.Bearer.Token != "" {
		converted.Bearer.Token = "{{token}}"
	}
	if converted.Basic != nil && converted.Basic.Password != "" {
		converted.Basic.Password = "{{password}}"
	}
	if converted.APIKey != nil && converted.APIKey.Value != "" {
		converted.APIKey.Value = "{{api_key}}"
	}
	if converted.OAuth2 != nil {
		converted.OAuth2.ClientSecret = ""
		converted.OAuth2.Password = ""
	}
	return &converted
}

func examplesForPrompt(examples []*Example) []map[string]any {
	result := make([]map[string]any, 0, len(examples))
	for _, example := range examples {
		result = append(result, map[string]any{
			"name":            example.Name,
			"description":     example.Description,
			"category":        example.Category,
			"method":          example.Method,
			"url":             example.URL,
			"assertions":      example.Assertions,
			"response_status": example.ResponseStatus,
		})
	}
	return result
}

func sanitizePromptBody(body string) string {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return ""
	}

	var parsed any
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
		return truncatePromptValue(trimmed, 4000)
	}

	sanitized := sanitizeJSONValue(parsed)
	encoded, err := json.Marshal(sanitized)
	if err != nil {
		return truncatePromptValue(trimmed, 4000)
	}
	return truncatePromptValue(string(encoded), 4000)
}

func sanitizeJSONValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		result := make(map[string]any, len(typed))
		for key, nested := range typed {
			if isSensitivePromptKey(key) {
				result[key] = "{{redacted}}"
				continue
			}
			result[key] = sanitizeJSONValue(nested)
		}
		return result
	case []any:
		result := make([]any, len(typed))
		for index, nested := range typed {
			result[index] = sanitizeJSONValue(nested)
		}
		return result
	default:
		return value
	}
}

func sanitizePromptValue(key, value string) string {
	if isSensitivePromptKey(key) && strings.TrimSpace(value) != "" {
		return "{{redacted}}"
	}
	return value
}

func isSensitivePromptKey(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	if normalized == "" {
		return false
	}
	return strings.Contains(normalized, "authorization") ||
		strings.Contains(normalized, "cookie") ||
		strings.Contains(normalized, "token") ||
		strings.Contains(normalized, "secret") ||
		strings.Contains(normalized, "password") ||
		strings.Contains(normalized, "api-key") ||
		strings.Contains(normalized, "apikey") ||
		strings.Contains(normalized, "x-api-key")
}

func truncatePromptValue(value string, limit int) string {
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit]
}
