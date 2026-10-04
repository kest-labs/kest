package main

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/kest-labs/kest/cli/internal/platformsync"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/spf13/cobra"
)

// historyFilters holds optional filter values for the history command
var (
	historyStatusFilter string
	historyMethodFilter string
	historyURLFilter    string
	historySince        string
)

var (
	historyLimit  int
	globalHistory bool
)

var historyCmd = &cobra.Command{
	Use:     "history",
	Aliases: []string{"h", "hist"},
	Short:   "List test history",
	Long:    "Display a table of recently recorded API requests. You can filter by project, status, method, URL, or time range.",
	Example: `  # Show last 20 records (default)
  kest history

  # Show last 50 records
  kest history -n 50

  # Show only failed requests (4xx/5xx)
  kest history --status 4xx

  # Show only POST requests
  kest history --method POST

  # Filter by URL substring
  kest history --url /api/users

  # Show records from the last hour
  kest history --since 1h

  # Show history from all projects
  kest history --global`,
	Annotations: map[string]string{jsonCapableAnnotation: "true"},
	RunE: func(cmd *cobra.Command, args []string) error {
		if output.JSONOutput {
			res, err := listHistory(historyLimit, globalHistory, historyFilter{
				Status: historyStatusFilter,
				Method: historyMethodFilter,
				URL:    historyURLFilter,
				Since:  historySince,
			})
			return finishJSON("history", res, err)
		}

		conf := loadConfigWarn()

		store, err := storage.NewStore()
		if err != nil {
			return err
		}
		defer store.Close()

		records, err := store.GetHistory(historyLimit, historyScope(conf, globalHistory))
		if err != nil {
			return err
		}

		// Apply client-side filters
		records = applyHistoryFilters(records)

		fmt.Printf("%-5s %-20s %-6s %-40s %-6s %-10s\n", "ID", "TIME", "METHOD", "URL", "STATUS", "DURATION")
		fmt.Println(strings.Repeat("-", 90))

		for _, r := range records {
			fmt.Printf("%-5s %-20s %-6s %-40s %-6s %-10s\n",
				fmt.Sprintf("#%d", r.ID),
				formatTime(r.CreatedAt),
				r.Method,
				truncate(r.URL, 40),
				historyStatusCell(r.ResponseStatus),
				fmt.Sprintf("%dms", r.DurationMs),
			)
		}

		fmt.Printf("\nTotal: %d records\n", len(records))
		return nil
	},
}

func init() {
	historyCmd.Flags().IntVarP(&historyLimit, "number", "n", 20, "Number of records to show")
	historyCmd.Flags().BoolVarP(&globalHistory, "global", "g", false, "Show history across all projects")
	historyCmd.Flags().StringVar(&historyStatusFilter, "status", "", "Filter by status code or class (e.g. 200, 4xx, 5xx)")
	historyCmd.Flags().StringVar(&historyMethodFilter, "method", "", "Filter by HTTP method (e.g. GET, POST)")
	historyCmd.Flags().StringVar(&historyURLFilter, "url", "", "Filter by URL substring")
	historyCmd.Flags().StringVar(&historySince, "since", "", "Filter records newer than duration (e.g. 1h, 30m, 2h30m)")
	rootCmd.AddCommand(historyCmd)
}

// historyEntry is the redacted, machine-readable form of a history record.
type historyEntry struct {
	ID          int64  `json:"id"`
	Method      string `json:"method"`
	URL         string `json:"url"`
	Status      int    `json:"status"`
	DurationMs  int64  `json:"duration_ms"`
	Environment string `json:"environment,omitempty"`
	CreatedAt   string `json:"created_at"`
	// Failure is why Kest marked the request as failed (assertion,
	// --max-time, or a network error when Status is 0).
	Failure string `json:"failure,omitempty"`
}

// historyScope returns the storage scope for history queries: the current
// workspace, or "" for every workspace.
func historyScope(conf *config.Config, global bool) string {
	if global || conf == nil {
		return ""
	}
	return conf.ProjectID
}

// listHistory loads recent records for the current workspace (or all
// workspaces when global is set) and returns them as a redacted result.
func listHistory(limit int, global bool, f historyFilter) (*output.Result, error) {
	conf := loadConfigWarn()
	store, err := storage.NewStore()
	if err != nil {
		return nil, &ExitError{Code: ExitRuntimeError, Err: err}
	}
	defer store.Close()

	if limit <= 0 {
		limit = 20
	}
	records, err := store.GetHistory(limit, historyScope(conf, global))
	if err != nil {
		return nil, &ExitError{Code: ExitRuntimeError, Err: err}
	}
	return buildHistoryResult(filterHistoryRecords(records, f)), nil
}

// buildHistoryResult lists records without headers or bodies; sensitive
// query parameters in URLs are redacted.
func buildHistoryResult(records []storage.Record) *output.Result {
	res := output.NewResult("history")
	entries := make([]historyEntry, 0, len(records))
	for _, r := range records {
		entries = append(entries, historyEntry{
			ID:          r.ID,
			Method:      r.Method,
			URL:         platformsync.SanitizeURL(r.URL),
			Status:      r.ResponseStatus,
			DurationMs:  r.DurationMs,
			Environment: r.Environment,
			CreatedAt:   r.CreatedAt.UTC().Format(time.RFC3339),
			Failure:     platformsync.SanitizeLog(r.Failure),
		})
	}
	res.Summary.Total = len(entries)
	res.Data = map[string]any{"records": entries}
	return res
}

// historyFilter holds optional record filters.
type historyFilter struct {
	Status string
	Method string
	URL    string
	Since  string
}

// applyHistoryFilters filters the record slice based on CLI flag values.
func applyHistoryFilters(records []storage.Record) []storage.Record {
	return filterHistoryRecords(records, historyFilter{
		Status: historyStatusFilter,
		Method: historyMethodFilter,
		URL:    historyURLFilter,
		Since:  historySince,
	})
}

// filterHistoryRecords filters records in place by method, URL substring,
// status (exact or class like 4xx) and age.
func filterHistoryRecords(records []storage.Record, f historyFilter) []storage.Record {
	// Parse --since duration once
	var sinceTime time.Time
	if f.Since != "" {
		if d, err := time.ParseDuration(f.Since); err == nil {
			sinceTime = time.Now().Add(-d)
		}
	}

	out := records[:0]
	for _, r := range records {
		// --method filter
		if f.Method != "" && !strings.EqualFold(r.Method, f.Method) {
			continue
		}
		// --url filter
		if f.URL != "" && !strings.Contains(r.URL, f.URL) {
			continue
		}
		// --status filter (exact "200" or class "4xx", "5xx", "2xx")
		if f.Status != "" {
			if !matchStatusFilter(r.ResponseStatus, f.Status) {
				continue
			}
		}
		// --since filter
		if !sinceTime.IsZero() && r.CreatedAt.Before(sinceTime) {
			continue
		}
		out = append(out, r)
	}
	return out
}

// matchStatusFilter checks a status code against an expression like "200", "4xx", "5xx".
func matchStatusFilter(status int, filter string) bool {
	filter = strings.ToLower(strings.TrimSpace(filter))
	if len(filter) == 3 && filter[1] == 'x' && filter[2] == 'x' {
		class := int(filter[0]-'0') * 100
		return status >= class && status < class+100
	}
	code, err := strconv.Atoi(filter)
	if err != nil {
		return false
	}
	return status == code
}

// historyStatusCell shows "ERR" for records that never got an HTTP response.
func historyStatusCell(status int) string {
	if status == 0 {
		return "ERR"
	}
	return strconv.Itoa(status)
}

func formatTime(t time.Time) string {
	// Records are stored in UTC; show them in the user's local time.
	t = t.Local()
	now := time.Now()
	if t.Year() == now.Year() && t.YearDay() == now.YearDay() {
		return t.Format("15:04:05") + " today"
	}
	return t.Format("2006-01-02 15:04")
}

func truncate(s string, l int) string {
	if len(s) <= l {
		return s
	}
	return s[:l-3] + "..."
}
