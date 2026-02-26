package main

import (
	"encoding/json"
	"fmt"

	"github.com/kest-labs/kest/cli/internal/ai"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/spf13/cobra"
)

var suggestCmd = &cobra.Command{
	Use:   "suggest",
	Short: "AI suggests the next command based on your recent history",
	Long: `Analyze your recent API interactions and captured variables to suggest
the most logical next kest command. Requires ai_key to be configured.`,
	Example: `  # Get suggestions based on recent history
  kest suggest`,
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := storage.NewStore()
		if err != nil {
			return err
		}
		defer store.Close()

		conf := loadConfigWarn()

		// Get recent history
		history, err := store.GetHistory(15, conf.ProjectID)
		if err != nil || len(history) == 0 {
			return fmt.Errorf("no request history found. Make some API requests first")
		}

		// Get captured variables
		vars, _ := store.GetVariables(conf.ProjectID, conf.ActiveEnv)

		// Get last full record for context
		lastRecord, _ := store.GetLastRecord()

		client := ai.NewClient(conf.AIKey, conf.AIBaseURL, conf.AIModel)

		fmt.Println("🧠 Analyzing your API history...")

		prompt := buildSuggestPrompt(history, vars, lastRecord, conf.GetActiveEnv().BaseURL)
		result, err := client.Chat(suggestSystemPrompt, prompt)
		if err != nil {
			return fmt.Errorf("AI suggestion failed: %w", err)
		}

		fmt.Println()
		fmt.Println(result)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(suggestCmd)
}

const suggestSystemPrompt = `You are an expert API workflow assistant embedded in the Kest CLI tool.
Based on the developer's recent API request history and captured variables, suggest 2-4 logical next commands.

Rules:
- Each suggestion must be a valid kest command (kest get/post/put/delete/patch <url> [flags]).
- If variables are captured (like tokens), use them with {{variable}} syntax in headers.
- Explain WHY each command is suggested in one short sentence.
- Prioritize: authentication flows → CRUD operations → edge cases.
- Format as a numbered list with the command in backticks.
- If the last request failed, suggest a fix first.
- Keep it concise — no more than 4 suggestions.`

func buildSuggestPrompt(history []storage.Record, vars map[string]string, lastRecord *storage.Record, baseURL string) string {
	prompt := "## Recent API History:\n"
	for _, h := range history {
		prompt += fmt.Sprintf("- #%d: %s %s → %d (%dms)\n",
			h.ID, h.Method, h.URL, h.ResponseStatus, h.DurationMs)
	}

	if len(vars) > 0 {
		prompt += "\n## Captured Variables:\n"
		for k, v := range vars {
			display := v
			if len(v) > 40 {
				display = v[:20] + "..." + v[len(v)-10:]
			}
			prompt += fmt.Sprintf("- {{%s}} = %s\n", k, display)
		}
	}

	if lastRecord != nil {
		prompt += "\n## Last Request Detail:\n"
		prompt += fmt.Sprintf("- %s %s → %d\n", lastRecord.Method, lastRecord.URL, lastRecord.ResponseStatus)
		if lastRecord.ResponseBody != "" {
			body := lastRecord.ResponseBody
			if len(body) > 1000 {
				body = body[:1000] + "..."
			}
			// Try to extract just the keys for context
			var obj map[string]interface{}
			if err := json.Unmarshal([]byte(lastRecord.ResponseBody), &obj); err == nil {
				keys := make([]string, 0, len(obj))
				for k := range obj {
					keys = append(keys, k)
				}
				prompt += fmt.Sprintf("- Response keys: %v\n", keys)
			}
			prompt += fmt.Sprintf("- Response body: %s\n", body)
		}
	}

	if baseURL != "" {
		prompt += fmt.Sprintf("\n## Base URL: %s\n", baseURL)
	}

	return prompt
}
