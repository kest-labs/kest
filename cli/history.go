package main

import (
	"fmt"
	"strconv"
	"strings"
	"time"

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
	RunE: func(cmd *cobra.Command, args []string) error {
		conf := loadConfigWarn()

		store, err := storage.NewStore()
		if err != nil {
			return err
		}
		defer store.Close()

		projectID := ""
		if !globalHistory && conf != nil {
			projectID = conf.ProjectID
		}

		records, err := store.GetHistory(historyLimit, projectID)
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
				strconv.Itoa(r.ResponseStatus),
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

// applyHistoryFilters filters the record slice based on CLI flag values.
func applyHistoryFilters(records []storage.Record) []storage.Record {
	// Parse --since duration once
	var sinceTime time.Time
	if historySince != "" {
		if d, err := time.ParseDuration(historySince); err == nil {
			sinceTime = time.Now().Add(-d)
		}
	}

	out := records[:0]
	for _, r := range records {
		// --method filter
		if historyMethodFilter != "" && !strings.EqualFold(r.Method, historyMethodFilter) {
			continue
		}
		// --url filter
		if historyURLFilter != "" && !strings.Contains(r.URL, historyURLFilter) {
			continue
		}
		// --status filter (exact "200" or class "4xx", "5xx", "2xx")
		if historyStatusFilter != "" {
			if !matchStatusFilter(r.ResponseStatus, historyStatusFilter) {
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

func formatTime(t time.Time) string {
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
