package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:     "kest",
	Version: "v0.5.2",
	Short:   "Kest CLI - A fast API testing tool with automatic recording",
	Long:    `Kest is a CLI-first API testing tool designed for Vibe Coding. It automatically records every request for tracing and replaying.`,
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
