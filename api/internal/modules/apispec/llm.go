package apispec

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// llmClient is a minimal OpenAI-compatible chat completion client.
type llmClient struct {
	apiKey  string
	baseURL string
	model   string
	timeout time.Duration
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Temperature float64       `json:"temperature,omitempty"`
}

type chatChoice struct {
	Message chatMessage `json:"message"`
}

type chatResponse struct {
	Choices []chatChoice `json:"choices"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// complete calls the chat completions endpoint and returns the assistant message.
func (c *llmClient) complete(ctx context.Context, system, user string) (string, error) {
	payload := chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		MaxTokens:   2048,
		Temperature: 0.3,
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
		timeout = 60 * time.Second
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

	var result chatResponse
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

// buildDocPrompt builds the user prompt for generating API documentation.
func buildDocPrompt(spec *APISpecPO) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Method: %s\n", spec.Method))
	sb.WriteString(fmt.Sprintf("Path: %s\n", spec.Path))
	if spec.Summary != "" {
		sb.WriteString(fmt.Sprintf("Summary: %s\n", spec.Summary))
	}
	if spec.Description != "" {
		sb.WriteString(fmt.Sprintf("Description: %s\n", spec.Description))
	}
	if spec.Parameters != "" && spec.Parameters != "null" {
		sb.WriteString(fmt.Sprintf("Parameters (JSON): %s\n", spec.Parameters))
	}
	if spec.RequestBody != "" && spec.RequestBody != "null" {
		sb.WriteString(fmt.Sprintf("Request Body Schema (JSON): %s\n", spec.RequestBody))
	}
	if spec.Responses != "" && spec.Responses != "null" {
		sb.WriteString(fmt.Sprintf("Responses (JSON): %s\n", spec.Responses))
	}
	if spec.Tags != "" && spec.Tags != "null" {
		sb.WriteString(fmt.Sprintf("Tags: %s\n", spec.Tags))
	}
	auth := "JWT Bearer token required"
	if spec.IsPublic {
		auth = "No authentication required"
	}
	sb.WriteString(fmt.Sprintf("Authentication: %s\n", auth))
	return sb.String()
}

// buildTestPrompt builds the user prompt for generating a Kest flow test file.
func buildTestPrompt(spec *APISpecPO) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Method: %s\n", spec.Method))
	sb.WriteString(fmt.Sprintf("Path: %s\n", spec.Path))
	if spec.Summary != "" {
		sb.WriteString(fmt.Sprintf("Summary: %s\n", spec.Summary))
	}
	if spec.Parameters != "" && spec.Parameters != "null" {
		sb.WriteString(fmt.Sprintf("Parameters (JSON): %s\n", spec.Parameters))
	}
	if spec.RequestBody != "" && spec.RequestBody != "null" {
		sb.WriteString(fmt.Sprintf("Request Body Schema (JSON): %s\n", spec.RequestBody))
	}
	if spec.Responses != "" && spec.Responses != "null" {
		sb.WriteString(fmt.Sprintf("Responses (JSON): %s\n", spec.Responses))
	}
	auth := "JWT Bearer token required (use {{token}} variable)"
	if spec.IsPublic {
		auth = "No authentication required"
	}
	sb.WriteString(fmt.Sprintf("Authentication: %s\n", auth))
	return sb.String()
}

const testSystemPrompt = `You are an expert QA engineer generating Kest flow test files (.flow.md format).

Kest flow format rules:
- File starts with a markdown H1 title
- Each test scenario is an H2 section
- Each step inside a scenario starts with "### Step: <name>"
- Request line: METHOD URL (e.g. POST https://{{base_url}}/v1/users)
- Headers: one per line as "Key: Value"
- Request body in a fenced ` + "```json" + ` block
- [Asserts] section with "- <assertion>" lines
  - status == 200
  - body.json_path == "value"
  - body.field exists
- [Captures] section with "- var_name = json.path" lines
- Use {{base_url}} for base URL, {{token}} for auth token
- Use {{$randomInt}} for random integers, {{$timestamp}} for current time
- Steps are separated by ---

Generate test scenarios covering:
1. Happy path (successful request with valid data)
2. Validation error (missing required fields or invalid data)
3. Unauthorized (if auth required, test without token)

Output ONLY the .flow.md content, no extra explanation.`

const docSystemPrompt = `You are an expert technical writer generating API documentation in Markdown.

Given the API endpoint details, produce clear, developer-friendly Markdown documentation that includes:
1. A brief description of what the endpoint does
2. Authentication requirements
3. Path parameters (if any) with type and description
4. Query parameters (if any) with type, required flag, and description
5. Request body fields table: | Field | Type | Required | Description |
6. Response fields and a realistic JSON example
7. A cURL example using placeholder values

Rules:
- Use clean Markdown headings (##, ###)
- Keep descriptions concise but informative
- For request/response examples use realistic placeholder values
- Output only the Markdown content, no preamble or explanation outside the doc`
