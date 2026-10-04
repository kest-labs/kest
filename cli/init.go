package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

const defaultInitBaseURL = "http://localhost:3000"

var initBaseURL string

var initCmd = &cobra.Command{
	Use:     "init",
	Aliases: []string{"i"},
	Short:   "Initialize a Kest workspace in the current directory",
	Long: `Create .kest/ with config.yaml (environments and base_url), flow.config.yaml,
and a sample flow at .kest/flow/smoke.flow.md that you can run right away.`,
	Example: `  # Point Kest at your API server
  kest init --base-url http://localhost:8080`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return initWorkspace(".", initBaseURL)
	},
}

func init() {
	initCmd.Flags().StringVar(&initBaseURL, "base-url", "", "Base URL of your API for the dev environment (default "+defaultInitBaseURL+")")
	rootCmd.AddCommand(initCmd)
}

// initWorkspace creates the .kest workspace files under dir. Existing files
// are never overwritten.
func initWorkspace(dir, baseURL string) error {
	kestDir := filepath.Join(dir, ".kest")
	if err := os.MkdirAll(kestDir, 0755); err != nil {
		return err
	}

	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		baseURL = defaultInitBaseURL
	}

	configFile := filepath.Join(kestDir, "config.yaml")
	if _, err := os.Stat(configFile); err == nil {
		fmt.Println("Kest workspace already initialized (.kest/config.yaml exists).")
		printInitNextSteps("")
		return nil
	}

	configContent := `version: 1
defaults:
  timeout: 30
  headers:
    Content-Type: application/json
    Accept: application/json

# Relative URLs (kest get /users, "GET /users" in flows) are sent to the
# base_url of the active environment. Switch with: kest env set <name>
environments:
  dev:
    base_url: ` + baseURL + `

  staging:
    base_url: https://staging-api.example.com

  prod:
    base_url: https://api.example.com

active_env: dev
log_enabled: true
`
	if err := os.WriteFile(configFile, []byte(configContent), 0600); err != nil {
		return err
	}
	created := []string{"config.yaml"}

	// Create flow directory for .flow.md test files
	flowDir := filepath.Join(kestDir, "flow")
	if err := os.MkdirAll(flowDir, 0755); err != nil {
		return err
	}

	flowConfigFile := filepath.Join(kestDir, "flow.config.yaml")
	if _, err := os.Stat(flowConfigFile); os.IsNotExist(err) {
		flowConfigContent := `version: 1
profiles:
  # Default for 'kest run'. Uses active_env and its base_url from config.yaml;
  # set env/base_url here only to override them for flow runs.
  local:
    include: ["**/*.flow.md"]
    strict: true
    fail_fast: false
    sync: false
  ci:
    include: ["**/*.flow.md"]
    env: staging
    strict: true
    fail_fast: false
    sync: false
    reports:
      json: ".kest/reports/flow-results.json"
      junit: ".kest/reports/flow-results.xml"
`
		if err := os.WriteFile(flowConfigFile, []byte(flowConfigContent), 0644); err != nil {
			return err
		}
		created = append(created, "flow.config.yaml")
	}

	sampleFlow := filepath.Join(flowDir, "smoke.flow.md")
	if _, err := os.Stat(sampleFlow); os.IsNotExist(err) {
		if err := os.WriteFile(sampleFlow, []byte(sampleFlowContent), 0644); err != nil {
			return err
		}
		created = append(created, "flow/smoke.flow.md")
	}

	// Create logs directory
	logsDir := filepath.Join(kestDir, "logs")
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		return err
	}

	// Create .gitignore
	gitignoreFile := filepath.Join(kestDir, ".gitignore")
	if _, err := os.Stat(gitignoreFile); os.IsNotExist(err) {
		gitignoreContent := `# Kest
*.log
*.db
# Secrets for {{$env.NAME}} in flows (see: kest guide). Never commit this file.
.env
logs/
reports/
`
		if err := os.WriteFile(gitignoreFile, []byte(gitignoreContent), 0644); err != nil {
			return err
		}
		created = append(created, ".gitignore")
	}

	fmt.Println("✓ Initialized Kest workspace in .kest/")
	for _, name := range created {
		fmt.Printf("  - %s\n", name)
	}
	fmt.Printf("\nRequests go to %s (dev). Change it in .kest/config.yaml or re-run with --base-url.\n", baseURL)
	fmt.Println("Secrets: put them in .kest/.env (git-ignored via .kest/.gitignore), e.g. ADMIN_PASSWORD=...,")
	fmt.Println("then reference them in flows as {{$env.ADMIN_PASSWORD}}. OS environment variables take precedence.")
	printInitNextSteps(baseURL)
	return nil
}

func printInitNextSteps(baseURL string) {
	fmt.Println("\nNext steps:")
	fmt.Println("  kest get / -a \"status < 500\"          # send a request (recorded to history)")
	fmt.Println("  kest run .kest/flow/smoke.flow.md     # run the sample flow")
	fmt.Println("  claude mcp add kest -- kest mcp        # let Claude Code verify your API (see docs/mcp.md)")
	_ = baseURL
}

const sampleFlowContent = "# Smoke test\n\n" +
	"Run it with `kest run .kest/flow/smoke.flow.md` (or just `kest run`).\n" +
	"Relative paths use `base_url` from `.kest/config.yaml`.\n" +
	"Replace the request below with a real endpoint of your API,\n" +
	"and see `kest guide` for captures, variables and more assertions.\n\n" +
	"```step\n" +
	"@id root\n" +
	"@name API responds\n" +
	"GET /\n\n" +
	"[Asserts]\n" +
	"status < 500\n" +
	"```\n"
