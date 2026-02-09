package cli

import (
	"fmt"
	"os"

	"github.com/kest-labs/kest/internal/ai"
	"github.com/spf13/cobra"
)

var reviewCmd = &cobra.Command{
	Use:   "review [file]",
	Short: "AI reviews a flow file for security, coverage, and best practices",
	Long: `Analyze a .flow.md file using AI to identify security issues,
missing test coverage, and suggest improvements.`,
	Example: `  # Review a flow file
  kest review login.flow.md`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		filePath := args[0]
		content, err := os.ReadFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to read file: %w", err)
		}

		conf := loadConfigWarn()
		client := ai.NewClient(conf.AIKey, conf.AIBaseURL, conf.AIModel)

		fmt.Printf("🧠 Reviewing %s ...\n\n", filePath)

		result, err := client.Chat(reviewSystemPrompt, string(content))
		if err != nil {
			return fmt.Errorf("AI review failed: %w", err)
		}

		fmt.Println(result)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(reviewCmd)
}

const reviewSystemPrompt = `You are a senior API security auditor and test engineer reviewing a Kest flow file (.flow.md).

Analyze the file and provide feedback in these categories:

## Security Issues
- Hardcoded credentials or tokens (should use --var)
- Missing authentication on sensitive endpoints
- Sensitive data in URLs (should be in body/headers)

## Missing Coverage
- No negative tests (wrong credentials, invalid input, 4xx scenarios)
- No rate limit testing
- No edge cases (empty body, large payload, special characters)
- Missing status code assertions

## Best Practices
- Good patterns you see (token capture/reuse, proper assertions)
- Variable usage
- Step naming and documentation

Rules:
- Be specific — reference step IDs and line content.
- Suggest concrete kest commands or flow snippets to fix issues.
- Use emoji for severity: 🔴 critical, 🟡 warning, 🟢 good practice.
- Keep it actionable and concise.`
