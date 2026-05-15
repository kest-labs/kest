package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/spf13/cobra"
)

const connectionKeyPrefix = "kest_key_"

type connectionKeyPayload struct {
	Version                 int    `json:"version,omitempty"`
	PlatformURL             string `json:"platform_url"`
	PlatformToken           string `json:"platform_token"`
	PlatformProjectID       string `json:"platform_project_id"`
	PlatformAutoSyncHistory *bool  `json:"platform_auto_sync_history,omitempty"`
}

var keyCmd = &cobra.Command{
	Use:   "key [connection-key]",
	Short: "Connect this project to Kest Web with a one-line key",
	Long: `Connect the current Kest project to Kest Web using the connection key copied
from the Web Console. The key contains the platform URL, project ID, and project-scoped
CLI token, so you do not need to edit .kest/config.yaml by hand.`,
	Example: `  # Paste the command copied from Kest Web
  kest key kest_key_eyJ2ZXJzaW9uIjoxLCJwbGF0Zm9ybV91cmwiOiJodHRwczovL2FwaS5rZXN0LmRldi92MSJ9`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runKeyConnect(args[0])
	},
}

func init() {
	rootCmd.AddCommand(keyCmd)
}

func runKeyConnect(rawKey string) error {
	payload, err := parseConnectionKey(rawKey)
	if err != nil {
		return err
	}

	conf, err := config.LoadConfig()
	if err != nil {
		conf = &config.Config{}
	}
	if strings.TrimSpace(conf.ProjectPath) == "" {
		if err := os.MkdirAll(".kest", 0755); err != nil {
			return fmt.Errorf("failed to initialize .kest directory: %w", err)
		}
		if loaded, err := config.LoadConfig(); err == nil {
			conf = loaded
		}
	}

	conf.PlatformURL = payload.PlatformURL
	conf.PlatformToken = payload.PlatformToken
	conf.PlatformProjectID = payload.PlatformProjectID
	if payload.PlatformAutoSyncHistory == nil {
		conf.PlatformAutoSyncHistory = true
	} else {
		conf.PlatformAutoSyncHistory = *payload.PlatformAutoSyncHistory
	}

	if err := config.SaveConfig(conf); err != nil {
		return fmt.Errorf("failed to save Kest Web connection: %w", err)
	}

	configPath, _ := config.ResolveConfigPath()
	fmt.Println("✅ Connected to Kest Web")
	if configPath != "" {
		fmt.Printf("📄 Config file: %s\n", configPath)
	}
	fmt.Println("🔄 History auto-sync is enabled.")
	fmt.Println("💡 Next: run a request, for example `kest get /api/health`.")
	return nil
}

func parseConnectionKey(rawKey string) (*connectionKeyPayload, error) {
	key := strings.TrimSpace(rawKey)
	if key == "" {
		return nil, fmt.Errorf("connection key is required")
	}

	if strings.HasPrefix(key, "kest_pat_") {
		return nil, fmt.Errorf("this is a raw CLI token, not a connection key. Copy the full `kest key ...` command from the Web project's CLI Sync card")
	}

	if !strings.HasPrefix(key, connectionKeyPrefix) {
		return nil, fmt.Errorf("invalid connection key. Expected a value starting with %s", connectionKeyPrefix)
	}

	encoded := strings.TrimPrefix(key, connectionKeyPrefix)
	decoded, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("invalid connection key encoding: %w", err)
	}

	var payload connectionKeyPayload
	if err := json.Unmarshal(decoded, &payload); err != nil {
		return nil, fmt.Errorf("invalid connection key payload: %w", err)
	}

	payload.PlatformURL = strings.TrimRight(strings.TrimSpace(payload.PlatformURL), "/")
	payload.PlatformToken = strings.TrimSpace(payload.PlatformToken)
	payload.PlatformProjectID = strings.TrimSpace(payload.PlatformProjectID)

	switch {
	case payload.PlatformURL == "":
		return nil, fmt.Errorf("connection key is missing platform_url")
	case payload.PlatformToken == "":
		return nil, fmt.Errorf("connection key is missing platform_token")
	case payload.PlatformProjectID == "":
		return nil, fmt.Errorf("connection key is missing platform_project_id")
	}

	return &payload, nil
}
