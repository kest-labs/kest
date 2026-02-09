package cli

import (
	"encoding/json"
	"fmt"

	"github.com/kest-labs/kest/internal/ai"
	"github.com/kest-labs/kest/internal/storage"
	"github.com/spf13/cobra"
)

var explainCmd = &cobra.Command{
	Use:   "explain [id]",
	Short: "AI explains what a recorded API interaction does",
	Long: `Use AI to generate a human-readable explanation of a recorded request —
what it does, what the response means, and how it relates to other requests.
Great for onboarding new team members or understanding unfamiliar APIs.`,
	Example: `  # Explain the last request
  kest explain last

  # Explain a specific record
  kest explain 42`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := storage.NewStore()
		if err != nil {
			return err
		}
		defer store.Close()

		record, err := resolveRecord(store, args[0])
		if err != nil {
			return fmt.Errorf("record not found: %w", err)
		}

		// Get nearby records for context
		history, _ := store.GetHistory(10, record.Project)

		conf := loadConfigWarn()
		client := ai.NewClient(conf.AIKey, conf.AIBaseURL, conf.AIModel)

		fmt.Printf("🧠 Explaining record #%d: %s %s → %d ...\n\n",
			record.ID, record.Method, record.URL, record.ResponseStatus)

		prompt := buildExplainPrompt(record, history)
		result, err := client.Chat(explainSystemPrompt, prompt)
		if err != nil {
			return fmt.Errorf("AI explanation failed: %w", err)
		}

		fmt.Println(result)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(explainCmd)
}

const explainSystemPrompt = `You are an API documentation expert embedded in the Kest CLI tool.
Your job is to explain a recorded API interaction in plain language.

Provide:
1. **What it does**: The business purpose of this endpoint, in one sentence.
2. **Request breakdown**: Explain key headers, parameters, and body fields.
3. **Response breakdown**: Explain what the response data means.
4. **Related requests**: If the history shows related requests, mention the workflow.

Rules:
- Be concise and clear. Aimed at a developer who hasn't seen this API before.
- If you see authentication tokens, mention the auth mechanism (JWT, API key, etc).
- Use Markdown formatting.`

func buildExplainPrompt(record *storage.Record, history []storage.Record) string {
	var reqHeaders map[string]string
	json.Unmarshal(record.RequestHeaders, &reqHeaders)

	prompt := fmt.Sprintf(`## Record #%d
- Method: %s
- URL: %s
- Status: %d
- Duration: %dms
- Time: %s

### Request Headers:
%s

### Request Body:
%s

### Response Body:
%s
`,
		record.ID,
		record.Method,
		record.URL,
		record.ResponseStatus,
		record.DurationMs,
		record.CreatedAt.Format("2006-01-02 15:04:05"),
		formatHeadersForPrompt(reqHeaders),
		truncateForPrompt(record.RequestBody, 2000),
		truncateForPrompt(record.ResponseBody, 3000),
	)

	if len(history) > 1 {
		prompt += "\n## Nearby Requests (workflow context):\n"
		for _, h := range history {
			if h.ID == record.ID {
				continue
			}
			prompt += fmt.Sprintf("- #%d: %s %s → %d\n", h.ID, h.Method, h.URL, h.ResponseStatus)
		}
	}

	return prompt
}
