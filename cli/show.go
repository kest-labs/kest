package main

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/charmbracelet/lipgloss"
	"github.com/kest-labs/kest/cli/internal/report"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/spf13/cobra"
)

var (
	showHTML bool
	showOpen bool
)

var showCmd = &cobra.Command{
	Use:   "show [id]",
	Short: "Show details of a recorded request/response",
	Long:  "Display the full request and response details of a recorded API interaction, including headers, body, status, and duration.",
	Example: `  # Show the last recorded request
  kest show last

  # Show a specific record by ID
  kest show 42

  # Generate an HTML report for a record
  kest show 42 --html

  # Generate and open the HTML report
  kest show last --open`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := storage.NewStore()
		if err != nil {
			return err
		}
		defer store.Close()

		var record *storage.Record
		if len(args) == 0 || args[0] == "last" {
			record, err = store.GetLastRecord()
		} else {
			id, parseErr := strconv.ParseInt(args[0], 10, 64)
			if parseErr != nil {
				return fmt.Errorf("invalid record ID: %s", args[0])
			}
			record, err = store.GetRecord(id)
		}

		if err != nil {
			return err
		}

		if showHTML || showOpen {
			reportPath, err := report.WriteRecordHTML(record, report.RecordHTMLOptions{})
			if err != nil {
				return err
			}

			fmt.Printf("🌐 HTML report generated at: %s\n", reportPath)
			if showOpen {
				if err := openReportInBrowser(reportPath); err != nil {
					return fmt.Errorf("report generated at %s, but failed to open it: %w", reportPath, err)
				}
				fmt.Println("   Opened in your default browser.")
			}
			return nil
		}

		printRecord(record)
		return nil
	},
}

func init() {
	showCmd.Flags().BoolVar(&showHTML, "html", false, "Generate an HTML report for this record")
	showCmd.Flags().BoolVar(&showOpen, "open", false, "Generate and open an HTML report for this record")
	rootCmd.AddCommand(showCmd)
}

func printRecord(r *storage.Record) {
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#7D56F4"))
	sectionStyle := lipgloss.NewStyle().Bold(true).Underline(true).MarginTop(1)

	fmt.Printf("\n%s\n", titleStyle.Render(fmt.Sprintf("════ Record #%d ════", r.ID)))
	fmt.Printf("Time: %s\n", r.CreatedAt.Local().Format("2006-01-02 15:04:05"))

	fmt.Println(sectionStyle.Render("─── Request ───"))
	fmt.Printf("%s %s\n", r.Method, r.URL)

	fmt.Println("\nHeaders:")
	var reqHeaders map[string]string
	json.Unmarshal(r.RequestHeaders, &reqHeaders)
	for k, v := range reqHeaders {
		fmt.Printf("  %s: %s\n", k, v)
	}

	if r.RequestBody != "" {
		fmt.Println("\nBody:")
		fmt.Println(r.RequestBody)
	}

	fmt.Println(sectionStyle.Render("─── Response ───"))
	fmt.Printf("Status: %s    Duration: %dms\n", statusLabel(r.ResponseStatus), r.DurationMs)
	if r.Failure != "" {
		fmt.Printf("Failure: %s\n", r.Failure)
	}

	fmt.Println("\nHeaders:")
	var respHeaders map[string][]string
	json.Unmarshal(r.ResponseHeaders, &respHeaders)
	for k, v := range respHeaders {
		fmt.Printf("  %s: %s\n", k, v)
	}

	fmt.Println("\nBody:")
	var bodyObj interface{}
	if err := json.Unmarshal([]byte(r.ResponseBody), &bodyObj); err == nil {
		pretty, _ := json.MarshalIndent(bodyObj, "", "  ")
		fmt.Println(string(pretty))
	} else {
		fmt.Println(r.ResponseBody)
	}
	fmt.Printf("\n%s\n", titleStyle.Render("═════════════════════"))
}
