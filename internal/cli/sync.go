package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/kest-labs/kest/internal/config"
	"github.com/kest-labs/kest/internal/logger"
	"github.com/kest-labs/kest/internal/storage"
	"github.com/spf13/cobra"
)

var (
	syncPushProjectID string
	syncPushAPIURL    string
	syncPushToken     string
	syncDryRun        bool
)

var syncCmd = &cobra.Command{
	Use:     "sync",
	Aliases: []string{"sy"},
	Short:   "Sync API documentation to Kest Platform",
	Long: `Sync your API requests from local history to Kest Platform.
This allows you to generate API documentation automatically without modifying your code.`,
}

var syncPushCmd = &cobra.Command{
	Use:   "push",
	Short: "Push API specs to Kest Platform",
	Long: `Analyze local request history and push API specifications to the cloud platform.
This creates or updates API documentation based on your actual API usage.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runSyncPush()
	},
}

var syncConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Configure Kest Platform connection",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runSyncConfig()
	},
}

func init() {
	rootCmd.AddCommand(syncCmd)
	syncCmd.AddCommand(syncPushCmd)
	syncCmd.AddCommand(syncConfigCmd)

	// Sync push flags
	syncPushCmd.Flags().StringVarP(&syncPushProjectID, "project-id", "p", "", "Platform project ID")
	syncPushCmd.Flags().StringVar(&syncPushAPIURL, "api-url", "", "Platform API URL (override config)")
	syncPushCmd.Flags().StringVar(&syncPushToken, "token", "", "Platform API token (override config)")
	syncPushCmd.Flags().BoolVar(&syncDryRun, "dry-run", false, "Preview what would be synced without actually syncing")
}

// APISpecSync represents an API spec for syncing
type APISpecSync struct {
	Method      string                 `json:"method"`
	Path        string                 `json:"path"`
	Title       string                 `json:"title"`
	Summary     string                 `json:"summary,omitempty"`
	Description string                 `json:"description,omitempty"`
	Version     string                 `json:"version"`
	RequestBody map[string]interface{} `json:"request_body,omitempty"`
	Parameters  []Parameter            `json:"parameters,omitempty"`
	Responses   map[string]Response    `json:"responses,omitempty"`
	Examples    []Example              `json:"examples,omitempty"`
}

type Parameter struct {
	Name        string                 `json:"name"`
	In          string                 `json:"in"` // query, header, path
	Description string                 `json:"description,omitempty"`
	Required    bool                   `json:"required"`
	Schema      map[string]interface{} `json:"schema"`
	Example     interface{}            `json:"example,omitempty"`
}

type Response struct {
	Description string                 `json:"description"`
	ContentType string                 `json:"content_type"`
	Schema      map[string]interface{} `json:"schema"`
}

type Example struct {
	Name           string            `json:"name"`
	RequestHeaders map[string]string `json:"request_headers,omitempty"`
	RequestBody    string            `json:"request_body,omitempty"`
	ResponseStatus int               `json:"response_status"`
	ResponseBody   string            `json:"response_body,omitempty"`
	DurationMs     int64             `json:"duration_ms"`
}

type SyncRequest struct {
	ProjectID int             `json:"project_id"`
	Specs     []APISpecSync   `json:"specs"`
	Source    string          `json:"source"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

type SyncResponse struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

func runSyncPush() error {
	logger.StartSession("sync_push")
	defer logger.EndSession()

	// 1. Load configuration
	conf, err := config.LoadConfig()
	if err != nil {
		conf = &config.Config{} // Use empty config if not found
	}

	// 2. Get platform settings
	platformURL := syncPushAPIURL
	if platformURL == "" {
		platformURL = conf.PlatformURL
	}
	if platformURL == "" {
		return fmt.Errorf("platform URL not configured. Run 'kest sync config' or use --api-url flag")
	}

	platformToken := syncPushToken
	if platformToken == "" {
		platformToken = conf.PlatformToken
	}
	if platformToken == "" {
		return fmt.Errorf("platform token not configured. Run 'kest sync config' or use --token flag")
	}

	projectID := syncPushProjectID
	if projectID == "" {
		projectID = conf.PlatformProjectID
	}
	if projectID == "" {
		return fmt.Errorf("project ID not specified. Use --project-id flag or configure in .kest/config.yaml")
	}

	// 3. Load local history
	store, err := storage.NewStore()
	if err != nil {
		return fmt.Errorf("failed to open storage: %w", err)
	}
	defer store.Close()

	records, err := store.GetAllRecords()
	if err != nil {
		return fmt.Errorf("failed to load history: %w", err)
	}

	if len(records) == 0 {
		fmt.Println("⚠️  No request history found. Make some API requests first!")
		return nil
	}

	// 4. Analyze and group records into API specs
	specs := analyzeRecords(records)

	if len(specs) == 0 {
		fmt.Println("⚠️  No unique APIs found in history")
		return nil
	}

	// 5. Preview or push
	if syncDryRun {
		return previewSync(specs)
	}

	return pushToPlatform(platformURL, platformToken, projectID, specs, conf)
}

func analyzeRecords(records []storage.Record) []APISpecSync {
	// Group by method + path
	apiMap := make(map[string]*APISpecSync)

	for _, record := range records {
		// Skip if missing required fields
		if record.Method == "" || record.Path == "" {
			continue
		}

		key := record.Method + " " + record.Path
		spec, exists := apiMap[key]

		if !exists {
			// Create new spec
			spec = &APISpecSync{
				Method:    record.Method,
				Path:      record.Path,
				Title:     generateTitle(record.Method, record.Path),
				Version:   "v1.0.0",
				Responses: make(map[string]Response),
				Examples:  []Example{},
			}
			apiMap[key] = spec
		}

		// Add example from this record
		example := Example{
			Name:           fmt.Sprintf("Example %d", len(spec.Examples)+1),
			ResponseStatus: record.ResponseStatus,
			ResponseBody:   record.ResponseBody,
			DurationMs:     int64(record.DurationMs),
		}

		// Parse headers
		if len(record.RequestHeaders) > 0 && string(record.RequestHeaders) != "null" && string(record.RequestHeaders) != "" {
			var headers map[string]string
			if err := json.Unmarshal([]byte(record.RequestHeaders), &headers); err == nil {
				example.RequestHeaders = headers
			}
		}

		// Add request body
		if record.RequestBody != "" {
			example.RequestBody = record.RequestBody
		}

		spec.Examples = append(spec.Examples, example)

		// Infer response schema from response body
		if record.ResponseBody != "" {
			statusKey := fmt.Sprintf("%d", record.ResponseStatus)
			if _, exists := spec.Responses[statusKey]; !exists {
				spec.Responses[statusKey] = Response{
					Description: getStatusDescription(record.ResponseStatus),
					ContentType: "application/json",
					Schema: map[string]interface{}{
						"type": "object",
					},
				}
			}
		}
	}

	// Convert map to slice
	result := make([]APISpecSync, 0, len(apiMap))
	for _, spec := range apiMap {
		result = append(result, *spec)
	}

	return result
}

func generateTitle(method, path string) string {
	// Simple title generation
	// TODO: Could be smarter by analyzing path structure
	return method + " " + path
}

func getStatusDescription(status int) string {
	descriptions := map[int]string{
		200: "Successful response",
		201: "Resource created successfully",
		204: "No content",
		400: "Bad request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Not found",
		500: "Internal server error",
	}

	if desc, ok := descriptions[status]; ok {
		return desc
	}
	return fmt.Sprintf("HTTP %d response", status)
}

func previewSync(specs []APISpecSync) error {
	fmt.Printf("\n📋 Preview: Would sync %d API(s)\n\n", len(specs))

	for i, spec := range specs {
		fmt.Printf("%d. %s %s\n", i+1, spec.Method, spec.Path)
		fmt.Printf("   Title: %s\n", spec.Title)
		fmt.Printf("   Examples: %d\n", len(spec.Examples))
		if len(spec.Responses) > 0 {
			fmt.Printf("   Responses: ")
			for status := range spec.Responses {
				fmt.Printf("%s ", status)
			}
			fmt.Println()
		}
		fmt.Println()
	}

	fmt.Println("💡 Run without --dry-run to actually push to platform")
	return nil
}

func pushToPlatform(apiURL, token, projectID string, specs []APISpecSync, conf *config.Config) error {
	// Build sync request
	metadata := map[string]interface{}{
		"cli_version": "1.0.0", // TODO: Get actual version
		"sync_time":   time.Now().Format(time.RFC3339),
		"source":      "cli_history",
	}

	metadataJSON, _ := json.Marshal(metadata)

	// Convert projectID string to int
	var projID int
	fmt.Sscanf(projectID, "%d", &projID)

	syncReq := SyncRequest{
		ProjectID: projID,
		Specs:     specs,
		Source:    "cli",
		Metadata:  metadataJSON,
	}

	// Make HTTP request
	reqBody, err := json.Marshal(syncReq)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// Use simple HTTP client for now
	// TODO: Use a proper HTTP client library
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("POST", apiURL+"/api/v1/sync/apis", bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	logger.Info("🚀 Pushing %d API(s) to platform...", len(specs))

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("platform returned error: %d - %s", resp.StatusCode, string(body))
	}

	// Parse response
	var syncResp SyncResponse
	if err := json.NewDecoder(resp.Body).Decode(&syncResp); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	// Show result
	fmt.Println("\n✅ Sync completed!")
	fmt.Printf("   Created: %d\n", syncResp.Created)
	fmt.Printf("   Updated: %d\n", syncResp.Updated)
	fmt.Printf("   Skipped: %d\n", syncResp.Skipped)

	if len(syncResp.Errors) > 0 {
		fmt.Println("\n⚠️  Errors:")
		for _, err := range syncResp.Errors {
			fmt.Printf("   - %s\n", err)
		}
	}

	// Save last sync time
	conf.LastSyncTime = time.Now().Format(time.RFC3339)
	config.SaveConfig(conf)

	if logPath := logger.GetSessionPath(); logPath != "" {
		fmt.Printf("\n📄 Full sync logs generated at: %s\n", logPath)
		fmt.Printf("💡 Tip: Use this path for deep-context debugging in AI Editors (Cursor/Windsurf)\n")
	}

	return nil
}

func runSyncConfig() error {
	conf, err := config.LoadConfig()
	if err != nil {
		conf = &config.Config{}
	}

	// Interactive configuration
	fmt.Println("🔧 Configure Kest Platform Connection")
	fmt.Println()

	// Platform URL
	fmt.Print("Platform URL (e.g., https://kest.company.com): ")
	var url string
	fmt.Scanln(&url)
	if url != "" {
		conf.PlatformURL = url
	}

	// Platform Token
	fmt.Print("API Token: ")
	var token string
	fmt.Scanln(&token)
	if token != "" {
		conf.PlatformToken = token
	}

	// Project ID
	fmt.Print("Default Project ID: ")
	var projectID string
	fmt.Scanln(&projectID)
	if projectID != "" {
		conf.PlatformProjectID = projectID
	}

	// Save config
	if err := config.SaveConfig(conf); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	fmt.Println("\n✅ Configuration saved!")
	fmt.Println("\n💡 Now you can run: kest sync push")

	return nil
}
