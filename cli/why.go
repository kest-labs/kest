package main

import (
	"encoding/json"
	"fmt"

	"github.com/kest-labs/kest/cli/internal/ai"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/spf13/cobra"
)

var whyCmd = &cobra.Command{
	Use:   "why",
	Short: "AI-powered diagnosis of the last failed request",
	Long: `Analyze the last recorded request using AI to diagnose errors,
explain root causes, and suggest fixes. Requires ai_key to be configured.`,
	Example: `  # Diagnose the last request
  kest why

  # Diagnose a specific record
  kest why 42`,
	Args:         cobra.MaximumNArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := storage.NewStore()
		if err != nil {
			return err
		}
		defer store.Close()

		var record *storage.Record
		if len(args) == 0 {
			record, err = store.GetLastRecord()
		} else {
			var id int64
			fmt.Sscanf(args[0], "%d", &id)
			record, err = store.GetRecord(id)
		}
		if err != nil {
			return fmt.Errorf("no record found: %w", err)
		}

		// Get recent history for context
		history, _ := store.GetHistory(10, record.Project)

		conf := loadConfigWarn()
		client := ai.NewClient(conf.AIKey, conf.AIBaseURL, conf.AIModel)

		fmt.Printf("🧠 Analyzing record #%d: %s %s → %d ...\n\n", record.ID, record.Method, record.URL, record.ResponseStatus)

		prompt := buildWhyPrompt(record, history)
		result, err := client.Chat(whySystemPrompt, prompt)
		if err != nil {
			return fmt.Errorf("AI analysis failed: %w", err)
		}

		fmt.Println(result)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(whyCmd)
}

const whySystemPrompt = `You are an expert API debugger embedded in the Kest CLI tool.
Your job is to analyze a failed or unexpected API request/response and provide:

1. **Diagnosis**: What went wrong, in plain language.
2. **Root Cause**: The most likely technical reason.
3. **Suggested Fix**: Concrete kest commands the developer can run to fix or investigate further.

Rules:
- Be concise and actionable. No fluff.
- If the response body contains error messages, quote them.
- If you see patterns in the recent history (e.g. expired token, repeated failures), mention them.
- Format suggested commands as: kest <command> <args>
- Use Markdown formatting for readability.`

func buildWhyPrompt(record *storage.Record, history []storage.Record) string {
	var reqHeaders map[string]string
	json.Unmarshal(record.RequestHeaders, &reqHeaders)

	var respHeaders map[string][]string
	json.Unmarshal(record.ResponseHeaders, &respHeaders)

	prompt := fmt.Sprintf(`## Target Request (Record #%d)
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
		prompt += "\n## Recent History (for context):\n"
		for _, h := range history {
			if h.ID == record.ID {
				continue
			}
			prompt += fmt.Sprintf("- #%d: %s %s → %d (%dms) at %s\n",
				h.ID, h.Method, h.URL, h.ResponseStatus, h.DurationMs,
				h.CreatedAt.Format("15:04:05"))
		}
	}

	return prompt
}

func formatHeadersForPrompt(headers map[string]string) string {
	if len(headers) == 0 {
		return "(none)"
	}
	result := ""
	for k, v := range headers {
		// Mask authorization tokens for safety
		if k == "Authorization" || k == "authorization" {
			if len(v) > 20 {
				result += fmt.Sprintf("  %s: %s...%s\n", k, v[:15], v[len(v)-4:])
			} else {
				result += fmt.Sprintf("  %s: ***\n", k)
			}
		} else {
			result += fmt.Sprintf("  %s: %s\n", k, v)
		}
	}
	return result
}

func truncateForPrompt(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "\n... (truncated)"
}
