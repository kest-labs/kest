package platformsync

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/kest-labs/kest/cli/internal/logger"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/kest-labs/kest/cli/internal/summary"
)

const (
	HistorySyncKind   = "history"
	HistorySyncSource = "cli"
)

type HistorySyncEntry struct {
	SourceEventID string         `json:"source_event_id"`
	EventType     string         `json:"event_type"`
	OccurredAt    time.Time      `json:"occurred_at"`
	EntityType    string         `json:"entity_type"`
	EntityID      string         `json:"entity_id"`
	Action        string         `json:"action"`
	Message       string         `json:"message"`
	Data          map[string]any `json:"data"`
}

type HistorySyncRequest struct {
	ProjectID *string            `json:"project_id,omitempty"`
	Source    string             `json:"source"`
	Metadata  json.RawMessage    `json:"metadata,omitempty"`
	Entries   []HistorySyncEntry `json:"entries"`
}

type HistorySyncResponse struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

type historySyncEnvelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
	Error   string          `json:"error,omitempty"`
}

var (
	autoSyncWarningMu sync.Mutex
	autoSyncWarnings  = make(map[string]struct{})
)

func HistoryAutoSyncEnabled(conf *config.Config) bool {
	return conf != nil &&
		conf.PlatformAutoSyncHistory &&
		strings.TrimSpace(conf.ProjectID) != "" &&
		strings.TrimSpace(conf.PlatformProjectID) != "" &&
		strings.TrimSpace(conf.PlatformURL) != "" &&
		strings.TrimSpace(conf.PlatformToken) != ""
}

func MaybeFlushHistoryOutbox(conf *config.Config, store *storage.Store, maxItems int) {
	if !HistoryAutoSyncEnabled(conf) || store == nil {
		return
	}
	if err := FlushHistoryOutbox(conf, store, maxItems); err != nil {
		logger.LogToSession("history auto-sync flush failed: %v", err)
	}
}

func FlushHistoryOutbox(conf *config.Config, store *storage.Store, maxItems int) error {
	if !HistoryAutoSyncEnabled(conf) || store == nil {
		return nil
	}

	items, err := store.ListDueSyncOutbox(HistorySyncKind, conf.ProjectID, conf.PlatformProjectID, maxItems)
	if err != nil {
		return err
	}

	clientID, err := store.GetOrCreateClientID()
	if err != nil {
		return err
	}

	for _, item := range items {
		var entry HistorySyncEntry
		if err := json.Unmarshal([]byte(item.EntryPayload), &entry); err != nil {
			_ = store.DeleteSyncOutbox(item.ID)
			logger.LogToSession("history auto-sync dropped invalid outbox item %d: %v", item.ID, err)
			continue
		}

		if err := pushHistoryEntry(conf, clientID, entry); err != nil {
			attempts := item.Attempts + 1
			nextAttemptAt := time.Now().UTC().Add(historyRetryBackoff(attempts))
			_ = store.MarkSyncOutboxFailed(item.ID, attempts, err.Error(), nextAttemptAt)
			maybeWarnHistorySyncError(err)
			logger.LogToSession(
				"history auto-sync retry scheduled for %s (%s): %v",
				nextAttemptAt.Format(time.RFC3339),
				item.SourceEventID,
				err,
			)
			continue
		}

		if err := store.DeleteSyncOutbox(item.ID); err != nil {
			return err
		}
	}

	return nil
}

func QueueRequestHistory(conf *config.Config, store *storage.Store, record *storage.Record, sourceCommand string) error {
	if !HistoryAutoSyncEnabled(conf) || store == nil || record == nil || record.ID == 0 {
		return nil
	}

	clientID, err := store.GetOrCreateClientID()
	if err != nil {
		return err
	}

	entry := HistorySyncEntry{
		SourceEventID: fmt.Sprintf("%s:record:%d", clientID, record.ID),
		EventType:     "cli_request",
		OccurredAt:    normalizedEventTime(record.CreatedAt),
		EntityType:    "cli_request",
		EntityID:      fmt.Sprintf("%d", record.ID),
		Action:        requestHistoryAction(record.ResponseStatus),
		Message:       buildRequestHistoryMessage(record),
		Data:          buildRequestHistoryData(record, sourceCommand, clientID),
	}

	return enqueueHistoryEntry(store, conf, entry)
}

func QueueRunHistory(conf *config.Config, store *storage.Store, sourcePath string, summ *summary.Summary, logPath string) error {
	if !HistoryAutoSyncEnabled(conf) || store == nil || summ == nil {
		return nil
	}

	clientID, err := store.GetOrCreateClientID()
	if err != nil {
		return err
	}

	sourceName := filepath.Base(strings.TrimSpace(sourcePath))
	if sourceName == "" || sourceName == "." {
		sourceName = "kest-run"
	}

	startedAt := normalizedEventTime(summ.StartTime)
	eventKey := shortHash(sourcePath + "|" + startedAt.Format(time.RFC3339Nano) + "|" + sourceName)

	entry := HistorySyncEntry{
		SourceEventID: fmt.Sprintf("%s:run:%s", clientID, eventKey),
		EventType:     "cli_run",
		OccurredAt:    startedAt,
		EntityType:    "cli_run",
		EntityID:      sourceName,
		Action:        runHistoryAction(summ),
		Message:       buildRunHistoryMessage(sourceName, summ),
		Data:          buildRunHistoryData(sourcePath, sourceName, summ, logPath, clientID),
	}

	return enqueueHistoryEntry(store, conf, entry)
}

func enqueueHistoryEntry(store *storage.Store, conf *config.Config, entry HistorySyncEntry) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	return store.EnqueueSyncOutbox(&storage.SyncOutboxItem{
		SyncKind:          HistorySyncKind,
		Project:           conf.ProjectID,
		PlatformProjectID: conf.PlatformProjectID,
		SourceEventID:     entry.SourceEventID,
		EntryPayload:      string(payload),
		NextAttemptAt:     time.Now().UTC(),
	})
}

func pushHistoryEntry(conf *config.Config, clientID string, entry HistorySyncEntry) error {
	projectID := strings.TrimSpace(conf.PlatformProjectID)
	metadata, _ := json.Marshal(map[string]any{
		"client_id": clientID,
	})

	reqBody, err := json.Marshal(HistorySyncRequest{
		ProjectID: &projectID,
		Source:    HistorySyncSource,
		Metadata:  metadata,
		Entries:   []HistorySyncEntry{entry},
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, buildHistorySyncEndpoint(conf.PlatformURL, projectID), bytes.NewBuffer(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+conf.PlatformToken)

	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("history sync failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	syncResp, err := parseHistorySyncResponse(body)
	if err != nil {
		return err
	}
	if len(syncResp.Errors) > 0 {
		return fmt.Errorf("history sync rejected entry: %s", strings.Join(syncResp.Errors, "; "))
	}

	return nil
}

func parseHistorySyncResponse(body []byte) (HistorySyncResponse, error) {
	var wrapped historySyncEnvelope
	if err := json.Unmarshal(body, &wrapped); err == nil && len(wrapped.Data) > 0 {
		var resp HistorySyncResponse
		if err := json.Unmarshal(wrapped.Data, &resp); err != nil {
			return HistorySyncResponse{}, err
		}
		return resp, nil
	}

	var resp HistorySyncResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return HistorySyncResponse{}, err
	}
	return resp, nil
}

func buildHistorySyncEndpoint(apiURL, projectID string) string {
	base := strings.TrimRight(strings.TrimSpace(apiURL), "/")
	switch {
	case strings.HasSuffix(base, "/v1"), strings.HasSuffix(base, "/api/v1"):
		return fmt.Sprintf("%s/projects/%s/cli/history-sync", base, projectID)
	default:
		return fmt.Sprintf("%s/v1/projects/%s/cli/history-sync", base, projectID)
	}
}

func buildRequestHistoryMessage(record *storage.Record) string {
	target := strings.TrimSpace(record.Path)
	if target == "" {
		target = strings.TrimSpace(record.URL)
	}
	if target == "" {
		target = "request"
	}
	return fmt.Sprintf("%s %s -> %d", strings.ToUpper(strings.TrimSpace(record.Method)), target, record.ResponseStatus)
}

func buildRequestHistoryData(record *storage.Record, sourceCommand, clientID string) map[string]any {
	requestHeaders := parseStringMap(record.RequestHeaders)
	responseHeaders := parseStringSliceMap(record.ResponseHeaders)
	requestBody, requestBodyTruncated := SanitizeBody(record.RequestBody)
	responseBody, responseBodyTruncated := SanitizeBody(record.ResponseBody)

	truncated := make(map[string]bool)
	if requestBodyTruncated {
		truncated["request_body"] = true
	}
	if responseBodyTruncated {
		truncated["response_body"] = true
	}

	data := map[string]any{
		"request": map[string]any{
			"id":              record.ID,
			"method":          strings.ToUpper(strings.TrimSpace(record.Method)),
			"url":             record.URL,
			"base_url":        record.BaseURL,
			"path":            record.Path,
			"query_params":    SanitizeJSONPayload(record.QueryParams),
			"headers":         SanitizeStringMap(requestHeaders),
			"body":            requestBody,
			"environment":     record.Environment,
			"transport":       requestTransport(sourceCommand),
			"source_command":  sourceCommand,
			"local_project":   record.Project,
			"local_record_id": record.ID,
		},
		"response": map[string]any{
			"status":      record.ResponseStatus,
			"headers":     SanitizeStringSliceMap(responseHeaders),
			"body":        responseBody,
			"duration_ms": record.DurationMs,
		},
		"sync": map[string]any{
			"source":    HistorySyncSource,
			"client_id": clientID,
		},
	}

	if len(truncated) > 0 {
		data["truncated"] = truncated
	}

	return data
}

func buildRunHistoryMessage(sourceName string, summ *summary.Summary) string {
	if summ.FailedTests > 0 {
		return fmt.Sprintf("Run %s failed (%d/%d passed)", sourceName, summ.PassedTests, summ.TotalTests)
	}
	return fmt.Sprintf("Run %s passed (%d/%d)", sourceName, summ.PassedTests, summ.TotalTests)
}

func buildRunHistoryData(sourcePath, sourceName string, summ *summary.Summary, logPath, clientID string) map[string]any {
	results := make([]map[string]any, 0, len(summ.Results))
	for _, result := range summ.Results {
		requestBody, requestBodyTruncated := SanitizeBody(result.RequestBody)
		responseBody, responseBodyTruncated := SanitizeBody(result.ResponseBody)
		command, commandTruncated := SanitizeBody(result.Command)

		truncated := make(map[string]bool)
		if requestBodyTruncated {
			truncated["request_body"] = true
		}
		if responseBodyTruncated {
			truncated["response_body"] = true
		}
		if commandTruncated {
			truncated["command"] = true
		}

		item := map[string]any{
			"name":             result.Name,
			"method":           result.Method,
			"url":              result.URL,
			"status":           result.Status,
			"success":          result.Success,
			"duration_ms":      result.Duration.Milliseconds(),
			"started_at":       normalizedEventTime(result.StartTime).Format(time.RFC3339),
			"record_id":        result.RecordID,
			"request_headers":  SanitizeStringMap(result.RequestHeaders),
			"request_body":     requestBody,
			"response_headers": SanitizeStringSliceMap(result.ResponseHeaders),
			"response_body":    responseBody,
			"command":          command,
		}
		if result.Error != nil {
			item["error"] = sanitizeLooseText(result.Error.Error())
		}
		if len(truncated) > 0 {
			item["truncated"] = truncated
		}
		results = append(results, item)
	}

	data := map[string]any{
		"run": map[string]any{
			"source_name":       sourceName,
			"source_path":       sourcePath,
			"status":            runDisplayStatus(summ),
			"total_steps":       summ.TotalTests,
			"passed_steps":      summ.PassedTests,
			"failed_steps":      summ.FailedTests,
			"total_duration_ms": summ.TotalTime.Milliseconds(),
			"started_at":        normalizedEventTime(summ.StartTime).Format(time.RFC3339),
			"finished_at":       normalizedEventTime(summ.StartTime.Add(summ.TotalTime)).Format(time.RFC3339),
		},
		"results": results,
		"sync": map[string]any{
			"source":    HistorySyncSource,
			"client_id": clientID,
		},
	}

	if logPath != "" {
		if excerpt, truncated := loadSanitizedLogExcerpt(logPath); excerpt != "" {
			data["log"] = map[string]any{
				"path":      logPath,
				"excerpt":   excerpt,
				"truncated": truncated,
			}
		}
	}

	return data
}

func loadSanitizedLogExcerpt(logPath string) (string, bool) {
	content, err := os.ReadFile(logPath)
	if err != nil {
		return "", false
	}
	return SanitizeLogExcerpt(string(content))
}

func requestHistoryAction(status int) string {
	if status >= 400 {
		return "run_failed"
	}
	return "run"
}

func runHistoryAction(summ *summary.Summary) string {
	if summ != nil && summ.FailedTests > 0 {
		return "run_failed"
	}
	return "run"
}

func runDisplayStatus(summ *summary.Summary) string {
	if summ != nil && summ.FailedTests > 0 {
		return "failed"
	}
	return "passed"
}

func requestTransport(sourceCommand string) string {
	switch strings.ToLower(strings.TrimSpace(sourceCommand)) {
	case "grpc":
		return "grpc"
	default:
		return "http"
	}
}

func historyRetryBackoff(attempts int) time.Duration {
	if attempts <= 1 {
		return time.Minute
	}
	delay := time.Minute << (attempts - 1)
	if delay > 30*time.Minute {
		return 30 * time.Minute
	}
	return delay
}

func maybeWarnHistorySyncError(err error) {
	if err == nil {
		return
	}

	message := strings.ToLower(err.Error())
	switch {
	case strings.Contains(message, "required scope"), strings.Contains(message, "run:write"), strings.Contains(message, "scope denied"):
		warnAutoSyncOnce("missing-run-scope", "CLI history auto-sync requires a project token with run:write. Generate a new token from the web project's CLI Sync card.")
	case strings.Contains(message, "401"), strings.Contains(message, "invalid cli token"), strings.Contains(message, "expired"):
		warnAutoSyncOnce("invalid-token", "CLI history auto-sync was rejected by the platform. Refresh the project CLI token from the web project's CLI Sync card.")
	case strings.Contains(message, "404"), strings.Contains(message, "project not found"), strings.Contains(message, "project id"):
		warnAutoSyncOnce("project-mismatch", "CLI history auto-sync is pointing at the wrong project. Re-run kest sync config with the setup command from the target web project.")
	}
}

func warnAutoSyncOnce(key, message string) {
	autoSyncWarningMu.Lock()
	defer autoSyncWarningMu.Unlock()

	if _, exists := autoSyncWarnings[key]; exists {
		return
	}
	autoSyncWarnings[key] = struct{}{}
	fmt.Fprintf(os.Stderr, "⚠️  %s\n", message)
}

func parseStringMap(raw json.RawMessage) map[string]string {
	if len(raw) == 0 {
		return nil
	}
	var value map[string]string
	if err := json.Unmarshal(raw, &value); err != nil {
		return map[string]string{"raw": string(raw)}
	}
	return value
}

func parseStringSliceMap(raw json.RawMessage) map[string][]string {
	if len(raw) == 0 {
		return nil
	}
	var value map[string][]string
	if err := json.Unmarshal(raw, &value); err != nil {
		return map[string][]string{"raw": {string(raw)}}
	}
	return value
}

func normalizedEventTime(value time.Time) time.Time {
	if value.IsZero() {
		return time.Now().UTC()
	}
	return value.UTC()
}

func shortHash(value string) string {
	sum := sha1.Sum([]byte(value))
	return hex.EncodeToString(sum[:8])
}
