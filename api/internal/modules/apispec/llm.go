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

// getDocSystemPrompt returns the system prompt for doc generation based on language.
func getDocSystemPrompt(lang string) string {
	if lang == "zh" {
		return `你是一位专业的技术文档撰写专家，用 Markdown 格式生成 API 文档。

⚠️ 重要：你必须用中文编写所有文档内容，包括标题、描述、表格、示例等。

根据提供的 API 端点详情，生成清晰、对开发者友好的 Markdown 文档，包含：
1. 端点功能的简要描述（用中文）
2. 认证要求（用中文）
3. 路径参数（如有）：类型和描述（用中文）
4. 查询参数（如有）：类型、必填标志和描述（用中文）
5. 请求体字段表格：| 字段 | 类型 | 必填 | 描述 |（用中文）
6. 响应字段和真实的 JSON 示例（用中文）
7. 使用占位符值的 cURL 示例（用中文注释）

规则：
- 使用干净的 Markdown 标题 (##, ###)
- 描述简洁但信息丰富
- 请求/响应示例使用真实的占位符值
- 只输出 Markdown 内容，不要有前言或解释
- 所有内容必须用中文`
	}
	return docSystemPrompt
}

// getTestSystemPrompt returns the system prompt for test generation based on language.
func getTestSystemPrompt(lang string) string {
	if lang == "zh" {
		return "你是一位专业的 QA 工程师，生成 Kest flow 测试文件 (.flow.md 格式)。\n\n⚠️ 重要：你必须用中文编写所有测试内容，包括标题、场景名称、步骤名称等。\n\nKest flow 格式规则：\n- 文件以 Markdown H1 标题开头（用中文）\n- 每个测试场景是 H2 章节（用中文，如 \"## 成功注册\"）\n- 每个步骤以 \"### Step: <名称>\" 开头（用中文，如 \"### Step: 发送注册请求\"）\n- 请求行：METHOD URL\n- 请求头：一行一个 \"Key: Value\"\n- 请求体放在 json 代码块中\n- [Asserts] 部分包含 \"- <断言>\" 行\n- [Captures] 部分包含 \"- 变量名 = json.path\" 行\n- 使用 {{base_url}} 作为基础 URL，{{token}} 作为认证 token\n- 使用 {{$randomInt}} 生成随机整数，{{$timestamp}} 获取当前时间\n- 步骤之间用 --- 分隔\n\n生成覆盖以下场景的测试（用中文标题）：\n1. 成功路径（有效数据的成功请求）\n2. 验证错误（缺少必填字段或无效数据）\n3. 未授权（如需认证，测试不带 token 的情况）\n\n输出 ONLY .flow.md 内容，不要有额外解释。\n所有内容必须用中文。"
	}
	return testSystemPrompt
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
