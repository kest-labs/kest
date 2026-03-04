package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

var initCmd = &cobra.Command{
	Use:     "init",
	Aliases: []string{"i"},
	Short:   "Initialize Kest configuration in the current directory",
	RunE: func(cmd *cobra.Command, args []string) error {
		dir := ".kest"
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}

		configFile := filepath.Join(dir, "config.yaml")
		if _, err := os.Stat(configFile); err == nil {
			fmt.Println("Config file already exists.")
			return nil
		}

		configContent := `version: 1
defaults:
  timeout: 30
  headers:
    Content-Type: application/json
    Accept: application/json

environments:
  dev:
    base_url: http://localhost:3000
    variables:
      api_key: dev_key_123

  staging:
    base_url: https://staging-api.example.com

  prod:
    base_url: https://api.example.com

active_env: dev
log_enabled: true
`
		if err := os.WriteFile(configFile, []byte(configContent), 0644); err != nil {
			return err
		}

		// Create flow directory for .flow.md test files
		flowDir := filepath.Join(dir, "flow")
		if err := os.MkdirAll(flowDir, 0755); err != nil {
			return err
		}

		// Create logs directory
		logsDir := filepath.Join(dir, "logs")
		if err := os.MkdirAll(logsDir, 0755); err != nil {
			return err
		}

		// Create .gitignore
		gitignoreContent := `# Kest
*.log
*.db
.env
`
		gitignoreFile := filepath.Join(dir, ".gitignore")
		if err := os.WriteFile(gitignoreFile, []byte(gitignoreContent), 0644); err != nil {
			return err
		}

		fmt.Println("✓ Initialized Kest project in .kest/")
		fmt.Println("  - config.yaml")
		fmt.Println("  - flow/")
		fmt.Println("  - logs/")
		fmt.Println("  - .gitignore")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}
