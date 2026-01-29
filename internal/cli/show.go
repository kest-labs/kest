package cli

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/charmbracelet/lipgloss"
	"github.com/kest-lab/kest-cli/internal/storage"
	"github.com/spf13/cobra"
)

var showCmd = &cobra.Command{
	Use:   "show [id]",
	Short: "Show details of a record",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := storage.NewStore()
		if err != nil {
			return err
		}

		var record *storage.Record
		if len(args) == 0 || args[0] == "last" {
			record, err = store.GetLastRecord()
		} else {
			id, err := strconv.ParseInt(args[0], 10, 64)
			if err != nil {
				return fmt.Errorf("invalid record ID: %s", args[0])
			}
			record, err = store.GetRecord(id)
		}

		if err != nil {
			return err
		}

		printRecord(record)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(showCmd)
}

func printRecord(r *storage.Record) {
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#7D56F4"))
	sectionStyle := lipgloss.NewStyle().Bold(true).Underline(true).MarginTop(1)

	fmt.Printf("\n%s\n", titleStyle.Render(fmt.Sprintf("════ Record #%d ════", r.ID)))
	fmt.Printf("Time: %s\n", r.CreatedAt.Format("2006-01-02 15:04:05"))

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
	fmt.Printf("Status: %d    Duration: %dms\n", r.ResponseStatus, r.DurationMs)

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
