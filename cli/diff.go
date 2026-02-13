package main

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/charmbracelet/lipgloss"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/sergi/go-diff/diffmatchpatch"
	"github.com/spf13/cobra"
)

var diffCmd = &cobra.Command{
	Use:   "diff <id1> <id2>",
	Short: "Compare two recorded requests side by side",
	Long: `Compare any two recorded API interactions — request headers, body,
response status, headers, and body — with a colorized diff output.

Use 'last' to reference the most recent record.`,
	Example: `  # Compare two records
  kest diff 100 105

  # Compare a record with the latest
  kest diff 100 last`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := storage.NewStore()
		if err != nil {
			return err
		}
		defer store.Close()

		r1, err := resolveRecord(store, args[0])
		if err != nil {
			return fmt.Errorf("record 1: %w", err)
		}
		r2, err := resolveRecord(store, args[1])
		if err != nil {
			return fmt.Errorf("record 2: %w", err)
		}

		printRecordDiff(r1, r2)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(diffCmd)
}

func resolveRecord(store *storage.Store, ref string) (*storage.Record, error) {
	if ref == "last" {
		return store.GetLastRecord()
	}
	id, err := strconv.ParseInt(ref, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid record reference: %s", ref)
	}
	return store.GetRecord(id)
}

func printRecordDiff(r1, r2 *storage.Record) {
	title := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#7D56F4"))
	section := lipgloss.NewStyle().Bold(true).Underline(true)
	added := lipgloss.NewStyle().Foreground(lipgloss.Color("#00FF00"))
	removed := lipgloss.NewStyle().Foreground(lipgloss.Color("#FF0000"))

	fmt.Printf("\n%s\n", title.Render(fmt.Sprintf("══ Diff: Record #%d vs #%d ══", r1.ID, r2.ID)))

	// Request line
	if r1.Method != r2.Method || r1.URL != r2.URL {
		fmt.Println(section.Render("─── Request ───"))
		fmt.Println(removed.Render(fmt.Sprintf("- %s %s", r1.Method, r1.URL)))
		fmt.Println(added.Render(fmt.Sprintf("+ %s %s", r2.Method, r2.URL)))
	} else {
		fmt.Printf("%s %s\n", r1.Method, r1.URL)
	}

	// Status + Duration
	fmt.Println(section.Render("─── Status ───"))
	if r1.ResponseStatus != r2.ResponseStatus {
		fmt.Println(removed.Render(fmt.Sprintf("- Status: %d  Duration: %dms", r1.ResponseStatus, r1.DurationMs)))
		fmt.Println(added.Render(fmt.Sprintf("+ Status: %d  Duration: %dms", r2.ResponseStatus, r2.DurationMs)))
	} else {
		fmt.Printf("  Status: %d  Duration: %dms → %dms\n", r1.ResponseStatus, r1.DurationMs, r2.DurationMs)
	}

	// Request Headers diff
	var h1, h2 map[string]string
	json.Unmarshal(r1.RequestHeaders, &h1)
	json.Unmarshal(r2.RequestHeaders, &h2)
	if diffHeaders := diffMaps(h1, h2); diffHeaders != "" {
		fmt.Println(section.Render("─── Request Headers ───"))
		fmt.Print(diffHeaders)
	}

	// Request Body diff
	if r1.RequestBody != r2.RequestBody {
		fmt.Println(section.Render("─── Request Body ───"))
		printBodyDiff(r1.RequestBody, r2.RequestBody)
	}

	// Response Body diff
	if r1.ResponseBody != r2.ResponseBody {
		fmt.Println(section.Render("─── Response Body ───"))
		printBodyDiff(r1.ResponseBody, r2.ResponseBody)
	} else {
		fmt.Println(section.Render("─── Response Body ───"))
		fmt.Println("  (identical)")
	}

	fmt.Printf("\n%s\n", title.Render("═══════════════════════"))
}

func diffMaps(a, b map[string]string) string {
	result := ""
	allKeys := make(map[string]bool)
	for k := range a {
		allKeys[k] = true
	}
	for k := range b {
		allKeys[k] = true
	}

	removed := lipgloss.NewStyle().Foreground(lipgloss.Color("#FF0000"))
	added := lipgloss.NewStyle().Foreground(lipgloss.Color("#00FF00"))

	for k := range allKeys {
		va, inA := a[k]
		vb, inB := b[k]
		if inA && inB {
			if va != vb {
				result += removed.Render(fmt.Sprintf("- %s: %s\n", k, va))
				result += added.Render(fmt.Sprintf("+ %s: %s\n", k, vb))
			}
		} else if inA {
			result += removed.Render(fmt.Sprintf("- %s: %s\n", k, va))
		} else {
			result += added.Render(fmt.Sprintf("+ %s: %s\n", k, vb))
		}
	}
	return result
}

func printBodyDiff(body1, body2 string) {
	// Try to pretty-print JSON for better diffs
	body1 = prettyJSON(body1)
	body2 = prettyJSON(body2)

	dmp := diffmatchpatch.New()
	diffs := dmp.DiffMain(body1, body2, true)
	diffs = dmp.DiffCleanupSemantic(diffs)
	fmt.Println(dmp.DiffPrettyText(diffs))
}

func prettyJSON(s string) string {
	var obj interface{}
	if err := json.Unmarshal([]byte(s), &obj); err == nil {
		if pretty, err := json.MarshalIndent(obj, "", "  "); err == nil {
			return string(pretty)
		}
	}
	return s
}
