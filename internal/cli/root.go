package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:     "kest",
	Version: "v0.5.4",
	Short:   "Kest CLI - A fast API testing tool with automatic recording",
	Long: `Kest is a high-performance, developer-first API testing tool designed for modern "Vibe Coding" workflows.
It automatically records every request to a local SQLite database, allowing you to trace history,
replay scenarios, and sync documentation to the Kest Platform effortlessly.

Core Features:
  - Markdown-native testing (.flow.md)
  - Automatic local request recording
  - Instant replaying of historic interactions
  - Parallel execution for CI/CD pipelines
  - Multi-environment session management

Tips:
  - Logs are saved in ~/.kest/logs/ (or .kest/logs/ in your project directory)
  - Use --verbose flag with 'run' to see full request/response details on the fly`,
	Example: `  # Initialize a new project
  kest init

  # Run an API flow defined in Markdown
  kest run user_auth.flow.md

  # Quick ad-hoc GET request
  kest get https://api.example.com/health

  # View recent test history
  kest history`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	// Root flags if any
}
