package cli

import (
	"fmt"
	"os"

	"github.com/kest-labs/kest/internal/config"
	"github.com/kest-labs/kest/internal/output"
	"github.com/spf13/cobra"
)

// Version is set at build time via ldflags:
//
//	go build -ldflags "-X github.com/kest-labs/kest/internal/cli.Version=v1.0.0"
var Version = "dev"

// Global flags accessible by all commands
var (
	QuietMode    bool
	OutputFormat string // "" (default pretty), "json"
)

var rootCmd = &cobra.Command{
	Use:     "kest",
	Version: Version,
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
  - Use --verbose flag with 'run' to see full request/response details on the fly
  - RUN 'kest guide' for a quick tutorial on Writing Flow files (.flow.md)
`,
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
		if exitErr, ok := err.(*ExitError); ok {
			os.Exit(exitErr.Code)
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(ExitRuntimeError)
	}
}

// loadConfigWarn loads config and prints a warning to stderr if it fails.
// Returns a non-nil Config in all cases (empty fallback on error).
func loadConfigWarn() *config.Config {
	conf, err := config.LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "⚠️  Warning: failed to load config: %v\n", err)
		return &config.Config{}
	}
	return conf
}

func init() {
	rootCmd.PersistentFlags().BoolVar(&QuietMode, "quiet", false, "Suppress decorative output (for CI/CD pipelines)")
	rootCmd.PersistentFlags().StringVar(&OutputFormat, "output", "", "Output format: json for machine-readable output")

	rootCmd.PersistentPreRun = func(cmd *cobra.Command, args []string) {
		output.Quiet = QuietMode
		output.JSONOutput = OutputFormat == "json"
	}
}
