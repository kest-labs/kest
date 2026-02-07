package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kest-lab/kest-cli/internal/ai"
	"github.com/kest-lab/kest-cli/internal/config"
	"github.com/kest-lab/kest-cli/internal/scanner"
	"github.com/kest-lab/kest-cli/internal/scanner/gin"
	"github.com/spf13/cobra"
)

var (
	docOutputDir string
	useAI        bool
	listOnly     bool
	onlyModules  []string
)

var docCmd = &cobra.Command{
	Use:     "doc [path]",
	Aliases: []string{"scan"},
	Short:   "Scan project and generate API documentation",
	Long: `Scan a project (Gin, FastAPI, etc.) to automatically generate 
elegant Markdown API documentation.`,
	Example: `  # Scan current directory
  kest doc .

  # List detected modules without generating documentation
  kest doc . --list

  # Generate documentation only for specific modules
  kest doc . --module category,project

  # Scan with AI-powered descriptions and examples
  kest doc . --ai`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := "."
		if len(args) > 0 {
			path = args[0]
		}
		return runDocGen(path, docOutputDir, useAI, listOnly, onlyModules)
	},
}

func init() {
	docCmd.Flags().StringVarP(&docOutputDir, "output", "o", "docs/api", "Output directory for generated documentation")
	docCmd.Flags().BoolVar(&useAI, "ai", false, "Use AI to enhance documentation with summaries and examples")
	docCmd.Flags().BoolVarP(&listOnly, "list", "l", false, "List detected modules/endpoints without generating documentation")
	docCmd.Flags().StringSliceVarP(&onlyModules, "module", "m", nil, "Generate documentation only for specified modules (comma separated)")
	rootCmd.AddCommand(docCmd)
}

func runDocGen(rootPath, outputDir string, useAI, listOnly bool, onlyModules []string) error {
	fmt.Printf("🔍 Scanning project at: %s\n", rootPath)

	ctx := context.Background()
	conf, _ := config.LoadConfig()

	// 1. Framework Detection & Scanning
	ginScanner := gin.NewScanner()
	if !ginScanner.Detect(ctx, rootPath) {
		return fmt.Errorf("could not detect any supported framework at %s", rootPath)
	}

	modules, err := ginScanner.Scan(ctx, rootPath)
	if err != nil {
		return err
	}

	// 2. Filter modules if specified
	if len(onlyModules) > 0 {
		filterMap := make(map[string]bool)
		for _, m := range onlyModules {
			filterMap[strings.ToLower(m)] = true
		}

		var filtered []*scanner.ModuleInfo
		for _, m := range modules {
			if filterMap[strings.ToLower(m.Name)] {
				filtered = append(filtered, m)
			}
		}
		modules = filtered
	}

	// 3. Handle List-Only mode
	if listOnly {
		fmt.Printf("\n📦 Detected %d modules:\n", len(modules))
		fmt.Printf("| %-20s | %-10s | %-30s |\n", "Module", "Endpoints", "Preview")
		fmt.Printf("| %-20s | %-10s | %-30s |\n", strings.Repeat("-", 20), strings.Repeat("-", 10), strings.Repeat("-", 30))
		for _, m := range modules {
			preview := ""
			if len(m.Endpoints) > 0 {
				preview = fmt.Sprintf("%s %s", m.Endpoints[0].Method, m.Endpoints[0].Path)
			}
			fmt.Printf("| %-20s | %-10d | %-30s |\n", m.Name, len(m.Endpoints), preview)
		}
		return nil
	}

	// 4. Generate Markdown
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}

	for _, mod := range modules {
		if useAI {
			fmt.Printf("🧠 Enhancing module %s with AI...\n", mod.Name)
			enhanceModuleWithAI(mod, conf)
		}
		if err := generateModuleDoc(mod, outputDir); err != nil {
			fmt.Printf("❌ Failed to generate doc for %s: %v\n", mod.Name, err)
		}
	}

	fmt.Printf("\n✨ Successfully generated documentation for %d modules in %s\n", len(modules), outputDir)
	return nil
}

type AIResponse struct {
	Summary    string          `json:"summary"`
	Request    json.RawMessage `json:"request_example"`
	Response   json.RawMessage `json:"response_example"`
	Permission string          `json:"permission"`
	Flow       string          `json:"flow"`
}

func enhanceModuleWithAI(mod *scanner.ModuleInfo, conf *config.Config) {
	client := ai.NewClient(conf.AIKey, conf.AIBaseURL, conf.AIModel)

	// 1. Generate Module-level Purpose (The PM/Business view)
	modPurposePrompt := fmt.Sprintf(`You are a Product Manager and API Architect.
Analyze the following Go API module and write a concise "Module Purpose" section.
Include:
- Business value: What problem does this module solve?
- Scope: What resources does it manage?
- Role: Is it a core module or a support module?
Keep it under 3 paragraphs, professional and clear.

Module Name: %s
Endpoints:`, mod.Name)

	for _, ep := range mod.Endpoints {
		modPurposePrompt += fmt.Sprintf("\n- %s %s: %s", ep.Method, ep.Path, ep.Description)
	}

	purpose, err := client.Chat(modPurposePrompt, "")
	if err == nil {
		mod.Description = purpose
	}

	// 2. Enhance endpoints
	systemPrompt := `You are a STRICT API Auditor and Documentation Engineer.
Your goal is to generate 100% technically accurate documentation snippets based ONLY on the provided source code and schemas.

ANTI-HALLUCINATION RULES:
1. STRICT SCHEMA ADHERENCE: You MUST ONLY use field names provided in the "STRICT JSON SCHEMA" section. Do NOT invent, rename, or approximate keys.
2. NO GHOST WRAPPING: Do NOT wrap responses in keys like {"data":...}, {"message":...}, or {"items":...} UNLESS you see these keys explicitly defined in the provided DTO source or handler code return statements.
3. ARRAY CONSISTENCY: If the ResponseType is a list/slice (starts with []), your "response_example" MUST be a JSON array [...].
4. REALISTIC VALUES: Use realistic example values that respect validation tags (e.g., if max=50, keep it short).
5. FLOW FIDELITY: The Mermaid diagram must accurately reflect the specific calls and logic in the provided Handler Code.

Return strictly JSON:
{
  "summary": "Business-centric outcome/purpose of this endpoint",
  "request_example": {},
  "response_example": {},
  "permission": "Clear description of access requirements (JWT/Roles)",
  "flow": "sequenceDiagram\n..."
}`

	for i := range mod.Endpoints {
		ep := &mod.Endpoints[i]
		fmt.Printf("  - [%s] %s\n", ep.Method, ep.Path)

		userPrompt := fmt.Sprintf("Module: %s\nEndpoint: %s %s\nMiddlewares: %v\nHandler Code:\n%s\n\n",
			mod.Name, ep.Method, ep.Path, ep.Middlewares, ep.Code)

		if ep.RequestType != "" || ep.ResponseType != "" {
			userPrompt += "### STRICT JSON SCHEMAS FOR ALIGNMENT:\n"
			if ep.RequestType != "" {
				isSlice := strings.HasPrefix(ep.RequestType, "[]")
				userPrompt += fmt.Sprintf("- Request Type: %s (Is Slice: %v)\n", ep.RequestType, isSlice)
				if dto, ok := mod.DTOs[cleanTypeForAI(ep.RequestType)]; ok {
					userPrompt += "  Allowed Keys (STRICT):\n"
					for _, f := range dto.Fields {
						userPrompt += fmt.Sprintf("  * %s (%s) validation:%s\n", f.JSONName, f.Type, f.Validation)
					}
				}
			}
			if ep.ResponseType != "" {
				isSlice := strings.HasPrefix(ep.ResponseType, "[]")
				userPrompt += fmt.Sprintf("- Response Type: %s (Is Slice: %v)\n", ep.ResponseType, isSlice)
				if dto, ok := mod.DTOs[cleanTypeForAI(ep.ResponseType)]; ok {
					userPrompt += "  Allowed Keys (STRICT):\n"
					for _, f := range dto.Fields {
						userPrompt += fmt.Sprintf("  * %s (%s)\n", f.JSONName, f.Type)
					}
				}
			}
			userPrompt += "\n"
		}

		if len(mod.DTOs) > 0 {
			userPrompt += "### DTO SOURCE CODE (FACTUAL REFERENCE):\n"
			for _, dto := range mod.DTOs {
				userPrompt += fmt.Sprintf("Type %s:\n%s\n", dto.Name, dto.Code)
			}
		}

		resp, err := client.Chat(systemPrompt, userPrompt)
		if err != nil {
			fmt.Printf("    ⚠️ Error from AI: %v\n", err)
			continue
		}

		var aiResp AIResponse
		cleanJSON := cleanJSONResponse(resp)
		if err := json.Unmarshal([]byte(cleanJSON), &aiResp); err != nil {
			fmt.Printf("    ⚠️ Error parsing AI JSON: %v. Raw: %s\n", err, cleanJSON)
			continue
		}

		ep.Description = aiResp.Summary
		ep.RequestExample = string(aiResp.Request)
		ep.ResponseExample = string(aiResp.Response)
		ep.PermissionDesc = aiResp.Permission
		ep.FlowDiagram = aiResp.Flow
	}
}

func cleanJSONResponse(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		lines := strings.Split(s, "\n")
		if len(lines) >= 2 {
			s = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}
	return strings.TrimSpace(s)
}

func generateModuleDoc(mod *scanner.ModuleInfo, outputDir string) error {
	filename := filepath.Join(outputDir, mod.Name+".md")
	f, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer f.Close()

	fmt.Fprintf(f, "# %s Module API\n\n", strings.Title(mod.Name))
	fmt.Fprintf(f, "> 💡 This documentation is automatically synchronized with the source code.\n\n")

	// 1. Module Purpose (The PM View)
	if mod.Description != "" {
		fmt.Fprintf(f, "## 🎯 Module Purpose\n\n%s\n\n", mod.Description)
	}

	fmt.Fprintf(f, "## 📌 Overview\n\n")
	fmt.Fprintf(f, "The `%s` module provides the following API endpoints:\n\n", mod.Name)
	fmt.Fprintf(f, "| Method | Path | Description |\n")
	fmt.Fprintf(f, "| :--- | :--- | :--- |\n")
	for _, ep := range mod.Endpoints {
		fmt.Fprintf(f, "| <kbd>%s</kbd> | `%s` | %s |\n", ep.Method, ep.Path, ep.Description)
	}
	fmt.Fprintf(f, "\n---\n\n")

	for _, ep := range mod.Endpoints {
		fmt.Fprintf(f, "## %s\n\n", ep.Description)

		fmt.Fprintf(f, "**Endpoint:**\n")
		fmt.Fprintf(f, "<kbd>%s</kbd> `%s`\n\n", ep.Method, ep.Path)

		if ep.PermissionDesc != "" {
			fmt.Fprintf(f, "### 🛡️ Permissions\n\n%s\n\n", ep.PermissionDesc)
		}

		if ep.FlowDiagram != "" {
			fmt.Fprintf(f, "### 🗺️ Logic Flow\n\n```mermaid\n%s\n```\n\n", ep.FlowDiagram)
		}

		// Request Schema
		if ep.RequestType != "" {
			if dto, ok := mod.DTOs[cleanTypeForAI(ep.RequestType)]; ok {
				fmt.Fprintf(f, "### 📥 Request: `%s`\n\n", ep.RequestType)
				fmt.Fprintf(f, "| JSON Field | Type | Required/Validation | Description |\n")
				fmt.Fprintf(f, "| :--- | :--- | :--- | :--- |\n")
				for _, field := range dto.Fields {
					fmt.Fprintf(f, "| `%s` | `%s` | `%s` | %s |\n", field.JSONName, field.Type, field.Validation, field.Comment)
				}
				fmt.Fprintf(f, "\n")
			}
		}

		if ep.RequestExample != "" {
			fmt.Fprintf(f, "**Request Example:**\n")
			fmt.Fprintf(f, "```json\n%s\n```\n\n", ep.RequestExample)
		}

		// Response Schema
		if ep.ResponseType != "" {
			if dto, ok := mod.DTOs[cleanTypeForAI(ep.ResponseType)]; ok {
				fmt.Fprintf(f, "### 📤 Response: `%s`\n\n", ep.ResponseType)
				fmt.Fprintf(f, "| JSON Field | Type | Description |\n")
				fmt.Fprintf(f, "| :--- | :--- | :--- |\n")
				for _, field := range dto.Fields {
					fmt.Fprintf(f, "| `%s` | `%s` | %s |\n", field.JSONName, field.Type, field.Comment)
				}
				fmt.Fprintf(f, "\n")
			}
		}

		if ep.ResponseExample != "" {
			fmt.Fprintf(f, "**Response Example:**\n")
			fmt.Fprintf(f, "```json\n%s\n```\n\n", ep.ResponseExample)
		}

		// Error Responses
		if len(ep.Errors) > 0 {
			fmt.Fprintf(f, "### ❌ Error Responses\n\n")
			fmt.Fprintf(f, "| Status Code | Description |\n")
			fmt.Fprintf(f, "| :--- | :--- |\n")
			for _, err := range ep.Errors {
				statusText := getStatusText(err.Code)
				fmt.Fprintf(f, "| `%d` | %s |\n", err.Code, statusText)
			}
			fmt.Fprintf(f, "\n")
		}

		fmt.Fprintf(f, "**Handler Implementation:**\n")
		fmt.Fprintf(f, "`%s`\n\n", ep.Handler)
		fmt.Fprintf(f, "---\n\n")
	}

	return nil
}

func getStatusText(code int) string {
	switch code {
	case 400:
		return "Bad Request: The request was invalid or could not be understood."
	case 401:
		return "Unauthorized: Authentication is required or has failed."
	case 403:
		return "Forbidden: The client does not have access rights to the content."
	case 404:
		return "Not Found: The server could not find the requested resource."
	case 500:
		return "Internal Server Error: The server encountered an unexpected condition."
	default:
		return "Error response generated by the server."
	}
}

func cleanTypeForAI(t string) string {
	t = strings.TrimPrefix(t, "[]")
	t = strings.TrimPrefix(t, "*")
	t = strings.TrimPrefix(t, "*")
	return t
}
