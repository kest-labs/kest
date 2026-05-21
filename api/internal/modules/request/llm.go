package request

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

func buildDocPrompt(request *Request) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Name: %s\n", request.Name))
	sb.WriteString(fmt.Sprintf("Method: %s\n", request.Method))
	sb.WriteString(fmt.Sprintf("URL: %s\n", request.URL))
	if request.Description != "" {
		sb.WriteString(fmt.Sprintf("Description: %s\n", request.Description))
	}
	if len(request.QueryParams) > 0 {
		payload, _ := json.Marshal(request.QueryParams)
		sb.WriteString(fmt.Sprintf("Query Params (JSON): %s\n", payload))
	}
	if len(request.PathParams) > 0 {
		payload, _ := json.Marshal(request.PathParams)
		sb.WriteString(fmt.Sprintf("Path Params (JSON): %s\n", payload))
	}
	if len(request.Headers) > 0 {
		payload, _ := json.Marshal(request.Headers)
		sb.WriteString(fmt.Sprintf("Headers (JSON): %s\n", payload))
	}
	if request.Auth != nil {
		payload, _ := json.Marshal(request.Auth)
		sb.WriteString(fmt.Sprintf("Auth (JSON): %s\n", payload))
	}
	if request.BodyType != "" && request.BodyType != "none" {
		sb.WriteString(fmt.Sprintf("Body Type: %s\n", request.BodyType))
	}
	if request.Body != "" {
		sb.WriteString(fmt.Sprintf("Body: %s\n", request.Body))
	}

	sb.WriteString("\nWrite concise API request documentation in Markdown. Include purpose, request URL, auth requirements, parameters, headers, body, and example usage when data is available. Do not invent fields that are not present. Return only Markdown content; do not wrap the whole response in fenced code blocks.\n")
	return sb.String()
}

func getDocSystemPrompt(lang string) string {
	if lang == "zh" {
		return "你是一个严谨的 API 文档助手。请根据给定的 HTTP 请求信息输出结构清晰、可直接展示的 Markdown 文档。不要编造不存在的参数或响应。不要把整份文档包在代码块中。"
	}

	return "You are a precise API documentation assistant. Generate clean Markdown documentation from the provided HTTP request data. Do not invent parameters, auth, or payload details that are not present. Do not wrap the whole document in a code fence."
}

func cleanGeneratedMarkdown(value string) string {
	trimmed := strings.TrimSpace(value)
	if !strings.HasPrefix(trimmed, "```") {
		return trimmed
	}

	lineBreakIndex := strings.Index(trimmed, "\n")
	if lineBreakIndex < 0 {
		return trimmed
	}

	openingFence := strings.TrimSpace(trimmed[:lineBreakIndex])
	if openingFence != "```" &&
		!strings.EqualFold(openingFence, "```markdown") &&
		!strings.EqualFold(openingFence, "```md") {
		return trimmed
	}

	body := strings.TrimSpace(trimmed[lineBreakIndex+1:])
	if strings.HasSuffix(body, "```") {
		body = strings.TrimSpace(body[:len(body)-3])
	}
	return body
}
