package cli

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/kest-labs/kest/internal/storage"
	"github.com/spf13/cobra"
)

var (
	historyLimit  int
	globalHistory bool
)

var historyCmd = &cobra.Command{
	Use:     "history",
	Aliases: []string{"h", "hist"},
	Short:   "List test history",
	Long:    "Display a table of recently recorded API requests. You can filter by project or limit the number of results.",
	Example: `  # Show last 20 records (default)
  kest history

  # Show last 50 records
  kest history -n 50

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
	rootCmd.AddCommand(historyCmd)
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
