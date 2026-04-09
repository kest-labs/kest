package apispec

import (
	"encoding/json"
	"fmt"
	"strings"
)

type aiDraftLLMOutput struct {
	Draft         APISpecAIDraftSpec                    `json:"draft"`
	Assumptions   []string                              `json:"assumptions"`
	Questions     []string                              `json:"questions"`
	FieldInsights map[string]APISpecAIDraftFieldInsight `json:"field_insights"`
}

func buildCreateAIDraftPrompt(
	req *CreateAPISpecAIDraftRequest,
	conventions *APISpecAIDraftConventions,
	references []APISpecAIDraftReference,
) string {
	var sb strings.Builder
	sb.WriteString("[Intent]\n")
	sb.WriteString(strings.TrimSpace(req.Intent))
	sb.WriteString("\n\n")

	if req.Method != "" || req.Path != "" {
		sb.WriteString("[Seed]\n")
		if req.Method != "" {
			sb.WriteString(fmt.Sprintf("Method: %s\n", req.Method))
		}
		if req.Path != "" {
			sb.WriteString(fmt.Sprintf("Path: %s\n", req.Path))
		}
		if req.CategoryID != nil {
			sb.WriteString(fmt.Sprintf("CategoryID: %d\n", *req.CategoryID))
		}
		sb.WriteString("\n")
	}

	if conventions != nil {
		if payload, err := json.MarshalIndent(conventions, "", "  "); err == nil {
			sb.WriteString("[Project Conventions]\n")
			sb.Write(payload)
			sb.WriteString("\n\n")
		}
	}

	if len(references) > 0 {
		if payload, err := json.MarshalIndent(references, "", "  "); err == nil {
			sb.WriteString("[Similar Specs]\n")
			sb.Write(payload)
			sb.WriteString("\n\n")
		}
	}

	sb.WriteString("[Output JSON Schema]\n")
	sb.WriteString(aiDraftOutputSchema())
	return sb.String()
}

func buildRefineAIDraftPrompt(
	req *RefineAPISpecAIDraftRequest,
	currentDraft *APISpecAIDraftSpec,
	conventions *APISpecAIDraftConventions,
	references []APISpecAIDraftReference,
) string {
	var sb strings.Builder
	sb.WriteString("[Refine Instruction]\n")
	sb.WriteString(strings.TrimSpace(req.Instruction))
	sb.WriteString("\n\n")

	if len(req.Fields) > 0 {
		sb.WriteString("[Target Fields]\n")
		sb.WriteString(strings.Join(req.Fields, ", "))
		sb.WriteString("\n\n")
	}

	if currentDraft != nil {
		if payload, err := json.MarshalIndent(currentDraft, "", "  "); err == nil {
			sb.WriteString("[Current Draft]\n")
			sb.Write(payload)
			sb.WriteString("\n\n")
		}
	}

	if conventions != nil {
		if payload, err := json.MarshalIndent(conventions, "", "  "); err == nil {
			sb.WriteString("[Project Conventions]\n")
			sb.Write(payload)
			sb.WriteString("\n\n")
		}
	}

	if len(references) > 0 {
		if payload, err := json.MarshalIndent(references, "", "  "); err == nil {
			sb.WriteString("[References]\n")
			sb.Write(payload)
			sb.WriteString("\n\n")
		}
	}

	sb.WriteString("[Output JSON Schema]\n")
	sb.WriteString(aiDraftOutputSchema())
	return sb.String()
}

func getAIDraftSystemPrompt(lang string) string {
	if lang == "zh" {
		return `你是一位资深 API 设计助手。你的任务是根据用户的一句话需求、项目约定和相似接口，生成一个结构化的 API 规格草稿。

严格规则：
1. 只输出 JSON，不要输出 Markdown、解释或代码块以外的内容。
2. 不要编造密钥、token、cookie、脚本或任何敏感值。
3. 优先复用项目既有风格，包括版本、状态码、tags 和响应结构。
4. 不确定时，把不确定点写进 assumptions 或 questions，不要硬猜。
5. draft 必须尽量完整，但只能包含公开、安全的接口设计字段。`
	}

	return `You are a senior API design assistant. Generate a structured API spec draft from the user's intent, project conventions, and similar APIs.

Strict rules:
1. Return JSON only. Do not include markdown explanation outside JSON.
2. Never invent secrets, tokens, cookies, scripts, or sensitive values.
3. Prefer the project's established versioning, status codes, tags, and response conventions.
4. When uncertain, record the gap in assumptions or questions instead of guessing.
5. The draft should stay within safe, public API design fields only.`
}

func getAIDraftRefineSystemPrompt(lang string) string {
	if lang == "zh" {
		return `你是一位资深 API 设计助手。根据当前草稿和补充指令，增量优化该 API 规格草稿。

严格规则：
1. 只输出 JSON。
2. 保留未要求修改的字段风格和结构。
3. 如果目标字段不明确，只在 assumptions/questions 里说明，不要破坏其它字段。
4. 不得输出敏感值或内部脚本。`
	}

	return `You are a senior API design assistant. Refine the current API spec draft according to the instruction.

Strict rules:
1. Return JSON only.
2. Preserve unchanged fields and existing structure unless the instruction requires otherwise.
3. If a target field is ambiguous, note it in assumptions/questions instead of damaging the rest of the draft.
4. Never output secrets or internal scripts.`
}

func parseAIDraftLLMOutput(raw string) (*aiDraftLLMOutput, error) {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)

	var output aiDraftLLMOutput
	if err := json.Unmarshal([]byte(trimmed), &output); err != nil {
		return nil, err
	}

	return &output, nil
}

func aiDraftOutputSchema() string {
	return `{
  "draft": {
    "category_id": 12,
    "method": "POST",
    "path": "/v1/orders",
    "summary": "Create order",
    "description": "Submit cart items and address to create an order.",
    "tags": ["orders"],
    "request_body": {
      "description": "Order payload",
      "required": true,
      "content_type": "application/json",
      "schema": {}
    },
    "parameters": [
      {
        "name": "order_id",
        "in": "path",
        "description": "Order identifier",
        "required": true,
        "schema": { "type": "string" }
      }
    ],
    "responses": {
      "201": {
        "description": "Created",
        "content_type": "application/json",
        "schema": {}
      }
    },
    "version": "v1",
    "is_public": false
  },
  "assumptions": ["string"],
  "questions": ["string"],
  "field_insights": {
    "responses": {
      "source": "project_conventions+similar_specs",
      "confidence": 0.8
    }
  }
}`
}
