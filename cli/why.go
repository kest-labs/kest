package main

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/kest-labs/kest/cli/internal/ai"
	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/kest-labs/kest/cli/internal/platformsync"
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
	Annotations:  map[string]string{jsonCapableAnnotation: "true"},
	RunE: func(cmd *cobra.Command, args []string) error {
		ref := ""
		if len(args) > 0 {
			ref = args[0]
		}
		res, err := diagnoseRecord(ref)
		if output.JSONOutput {
			return finishJSON("why", res, err)
		}
		if err != nil {
			return err
		}
		if data, ok := res.Data.(whyData); ok {
			fmt.Println(data.Diagnosis)
		}
		return nil
	},
}

// whyData is the command-specific payload of a `why` result.
type whyData struct {
	RecordID  int64  `json:"record_id"`
	Model     string `json:"model"`
	Diagnosis string `json:"diagnosis"`
}

// diagnoseRecord asks the configured AI model to diagnose a recorded request
// ("" or "last" for the latest record, otherwise a record ID).
func diagnoseRecord(ref string) (*output.Result, error) {
	res := output.NewResult("why")

	conf := loadConfigWarn()
	if strings.TrimSpace(conf.AIKey) == "" {
		err := fmt.Errorf("AI is not configured: set an API key with 'kest config set ai_key <key>'")
		res.SetError(output.ErrorKindAINotConfigured, err.Error())
		return res, &ExitError{Code: ExitConfigError, Err: err}
	}

	store, err := storage.NewStore()
	if err != nil {
		return res, &ExitError{Code: ExitRuntimeError, Err: err}
	}
	defer store.Close()

	var record *storage.Record
	if ref == "" || ref == "last" {
		record, err = store.GetLastRecord()
	} else {
		var id int64
		id, err = strconv.ParseInt(ref, 10, 64)
		if err != nil {
			return res, &ExitError{Code: ExitConfigError, Err: fmt.Errorf("invalid record ID: %s", ref)}
		}
		record, err = store.GetRecord(id)
	}
	if err != nil {
		err = fmt.Errorf("no record found: %w", err)
		res.SetError(output.ErrorKindNotFound, err.Error())
		return res, &ExitError{Code: ExitConfigError, Err: err}
	}

	// Get recent history for context
	history, _ := store.GetHistory(10, record.Project)

	client := ai.NewClient(conf.AIKey, conf.AIBaseURL, conf.AIModel)

	fmt.Printf("🧠 Analyzing record #%d: %s %s → %d ...\n\n", record.ID, record.Method, record.URL, record.ResponseStatus)

	prompt := buildWhyPrompt(record, history)
	diagnosis, err := client.Chat(whySystemPrompt, prompt)
	if err != nil {
		return res, &ExitError{Code: ExitRuntimeError, Err: fmt.Errorf("AI analysis failed: %w", err)}
	}

	res.Data = whyData{RecordID: record.ID, Model: client.Model, Diagnosis: diagnosis}
	return res, nil
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
%s
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
		failureLine(record.Failure),
		formatHeadersForPrompt(reqHeaders),
		truncateForPrompt(sanitizedBody(record.RequestBody), 2000),
		truncateForPrompt(sanitizedBody(record.ResponseBody), 3000),
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
	// The prompt goes to a third-party AI provider: redact credentials
	// (Authorization, cookies, API keys) the same way platform sync does.
	safe := platformsync.SanitizeStringMap(headers)
	keys := make([]string, 0, len(safe))
	for k := range safe {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	result := ""
	for _, k := range keys {
		result += fmt.Sprintf("  %s: %s\n", k, safe[k])
	}
	return result
}

// failureLine reports why Kest marked the request as failed, so the model
// can explain e.g. a 200 response that broke an assertion.
func failureLine(failure string) string {
	if strings.TrimSpace(failure) == "" {
		return ""
	}
	return fmt.Sprintf("- Kest failure: %s\n", failure)
}

// sanitizedBody redacts secret fields (passwords, tokens) from a body.
func sanitizedBody(body string) string {
	safe, _ := platformsync.SanitizeBody(body)
	return safe
}

func truncateForPrompt(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "\n... (truncated)"
}
