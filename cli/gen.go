package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/kest-labs/kest/cli/internal/ai"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/spf13/cobra"
)

var (
	genOutput string
)

var genCmd = &cobra.Command{
	Use:   "gen [description]",
	Short: "AI generates a flow file from a natural language description",
	Long: `Describe a test scenario in plain language and let AI generate a complete
.flow.md file. The AI uses your request history for realistic request/response examples.`,
	Example: `  # Generate a flow from description
  kest gen "test user registration: signup, login, get profile"

  # Specify output file
  kest gen "test payment flow" -o payment.flow.md`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		description := args[0]

		store, err := storage.NewStore()
		if err != nil {
			return err
		}
		defer store.Close()

		conf := loadConfigWarn()

		// Get history for Reality Seeding
		history, _ := store.GetAllRecords()

		client := ai.NewClient(conf.AIKey, conf.AIBaseURL, conf.AIModel)

		fmt.Println("🧠 Generating flow from your description...")

		prompt := buildGenPrompt(description, history, conf.GetActiveEnv().BaseURL)
		result, err := client.Chat(genSystemPrompt, prompt)
		if err != nil {
			return fmt.Errorf("AI generation failed: %w", err)
		}

		// Extract the markdown content
		content := extractFlowContent(result)

		if genOutput == "" {
			// Auto-generate filename from description
			genOutput = sanitizeFilename(strings.ReplaceAll(description, " ", "_"))
			if len(genOutput) > 40 {
				genOutput = genOutput[:40]
			}
			genOutput += ".flow.md"
		}

		if err := os.WriteFile(genOutput, []byte(content), 0644); err != nil {
			return err
		}

		fmt.Printf("✅ Generated: %s\n", genOutput)
		fmt.Printf("   Run it: kest run %s\n", genOutput)
		return nil
	},
}

func init() {
	genCmd.Flags().StringVarP(&genOutput, "output", "o", "", "Output file path (default: auto-generated)")
	rootCmd.AddCommand(genCmd)
}

const genSystemPrompt = `You are an expert API test engineer generating Kest flow files (.flow.md).

Generate a complete, runnable .flow.md file based on the user's description.

Flow file format:
- Start with a flow block: @flow id=..., @name ...
- Each test step is a "step" fenced code block with @id, @name
- Use [Captures] to extract variables (e.g., token = data.access_token)
- Use [Asserts] for assertions (e.g., status == 200, duration < 500)
- Use {{variable}} syntax to reference captured variables
- Add Markdown text between steps to document the flow

Rules:
- If REAL HISTORY is provided, use actual URLs, headers, and body structures from it.
- Generate realistic but safe test data (no real passwords).
- Include both positive and negative test cases when appropriate.
- Add duration assertions for performance-sensitive endpoints.
- Use --var for sensitive values like passwords.
- Output ONLY the .flow.md content, no extra explanation.`

func buildGenPrompt(description string, history []storage.Record, baseURL string) string {
	prompt := fmt.Sprintf("## User Description:\n%s\n\n", description)

	if baseURL != "" {
		prompt += fmt.Sprintf("## Base URL: %s\n\n", baseURL)
	}

	if len(history) > 0 {
		prompt += "## Real API History (use these for realistic examples):\n"
		seen := make(map[string]bool)
		count := 0
		for _, r := range history {
			key := r.Method + " " + r.Path
			if seen[key] || r.Path == "" {
				continue
			}
			seen[key] = true
			count++
			if count > 20 {
				break
			}

			prompt += fmt.Sprintf("\n### %s %s (status: %d)\n", r.Method, r.URL, r.ResponseStatus)
			if r.RequestBody != "" {
				body := r.RequestBody
				if len(body) > 500 {
					body = body[:500] + "..."
				}
				prompt += fmt.Sprintf("Request body: %s\n", body)
			}
			if r.ResponseBody != "" {
				// Just show keys for context
				var obj map[string]interface{}
				if err := json.Unmarshal([]byte(r.ResponseBody), &obj); err == nil {
					keys := make([]string, 0, len(obj))
					for k := range obj {
						keys = append(keys, k)
					}
					prompt += fmt.Sprintf("Response keys: %v\n", keys)
				}
			}
		}
	}

	return prompt
}

func extractFlowContent(aiOutput string) string {
	// If AI wrapped output in ```markdown fences, strip them
	output := strings.TrimSpace(aiOutput)
	if strings.HasPrefix(output, "```") {
		lines := strings.Split(output, "\n")
		// Remove first and last lines if they are fences
		if len(lines) > 2 {
			start := 1
			end := len(lines) - 1
			if strings.HasPrefix(lines[end], "```") {
				output = strings.Join(lines[start:end], "\n")
			}
		}
	}
	return output + "\n"
}
