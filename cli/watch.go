package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/cobra"
)

var watchCmd = &cobra.Command{
	Use:   "watch [file]",
	Short: "Watch a flow file and auto-rerun on changes",
	Long: `Monitor a .flow.md or .kest file for changes and automatically
re-execute it whenever the file is saved. Like 'jest --watch' for APIs.`,
	Example: `  # Watch a single flow file
  kest watch login.flow.md

  # Watch with verbose output and override environment
  kest watch login.flow.md -v --env staging

  # Watch with inline variable injection
  kest watch login.flow.md --var api_key=secret`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		filePath := args[0]
		absPath, err := filepath.Abs(filePath)
		if err != nil {
			return err
		}

		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			return fmt.Errorf("file not found: %s", filePath)
		}

		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			return fmt.Errorf("failed to create watcher: %w", err)
		}
		defer watcher.Close()

		if err := watcher.Add(absPath); err != nil {
			return fmt.Errorf("failed to watch file: %w", err)
		}

		fmt.Printf("👀 Watching %s for changes...\n", filePath)
		fmt.Printf("   Press Ctrl+C to stop\n\n")

		// Initial run
		runAndReport(filePath)

		// Debounce timer
		var debounce *time.Timer

		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return nil
				}
				if event.Has(fsnotify.Write) {
					// Debounce: wait 200ms for editor to finish writing
					if debounce != nil {
						debounce.Stop()
					}
					debounce = time.AfterFunc(200*time.Millisecond, func() {
						fmt.Printf("\n📝 File changed, re-running...\n")
						runAndReport(filePath)
					})
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return nil
				}
				fmt.Fprintf(os.Stderr, "⚠️  Watch error: %v\n", err)
			}
		}
	},
}

func init() {
	watchCmd.Flags().StringVarP(&runEnv, "env", "e", "", "Override active environment for this watch session")
	watchCmd.Flags().StringArrayVar(&runVars, "var", []string{}, "Set variables (e.g. --var key=value)")
	watchCmd.Flags().BoolVarP(&runVerbose, "verbose", "v", false, "Show detailed request/response info")
	rootCmd.AddCommand(watchCmd)
}

func runAndReport(filePath string) {
	start := time.Now()
	err := runScenario(filePath)
	duration := time.Since(start)

	timestamp := time.Now().Format("15:04:05")
	if err != nil {
		fmt.Printf("[%s] ❌ Failed in %s: %v\n", timestamp, duration.Round(time.Millisecond), err)
	} else {
		fmt.Printf("[%s] ✅ All steps passed (%s)\n", timestamp, duration.Round(time.Millisecond))
	}
}
