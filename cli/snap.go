package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/kest-labs/kest/cli/internal/platformsync"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/sergi/go-diff/diffmatchpatch"
	"github.com/spf13/cobra"
)

var (
	snapVerify bool
	snapUpdate bool
)

var snapCmd = &cobra.Command{
	Use:   "snap [url]",
	Short: "API snapshot testing — capture and verify response structure",
	Long: `Capture an API response as a snapshot file. On subsequent runs with --verify,
compare the current response against the saved snapshot to detect regressions.

Snapshots are saved in .kest/snapshots/ as JSON files.`,
	Example: `  # Save a snapshot of the current response
  kest snap /api/users

  # Verify current response matches snapshot
  kest snap /api/users --verify

  # Update snapshot after intentional changes
  kest snap /api/users --update`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	Annotations:  map[string]string{jsonCapableAnnotation: "true"},
	RunE: func(cmd *cobra.Command, args []string) error {
		res, err := snapshotPath(args[0], snapVerify, snapUpdate)
		if output.JSONOutput {
			return finishJSON("snap", res, err)
		}
		return err
	},
}

// snapshotPath saves, verifies or updates the snapshot for the latest
// recorded response matching urlPath and returns the versioned result.
func snapshotPath(urlPath string, verify, update bool) (*output.Result, error) {
	startedAt := time.Now()
	res := output.NewResult("snap")
	defer func() { res.SetDuration(startedAt, time.Now()) }()

	store, err := storage.NewStore()
	if err != nil {
		return res, &ExitError{Code: ExitRuntimeError, Err: err}
	}
	defer store.Close()

	// Find the latest record matching this path
	record, err := findRecordByPath(store, urlPath)
	if err != nil {
		err = fmt.Errorf("no recorded response for %s. Run a request first", urlPath)
		res.SetError(output.ErrorKindNotFound, err.Error())
		return res, &ExitError{Code: ExitConfigError, Err: err}
	}

	snapDir := ".kest/snapshots"
	if err := os.MkdirAll(snapDir, 0755); err != nil {
		return res, &ExitError{Code: ExitRuntimeError, Err: err}
	}

	snapFile := filepath.Join(snapDir, sanitizeFilename(record.Method+"_"+urlPath)+".json")
	step := output.Step{
		Name:       "snapshot " + urlPath,
		Method:     record.Method,
		URL:        platformsync.SanitizeURL(record.URL),
		Status:     record.ResponseStatus,
		DurationMs: record.DurationMs,
		OK:         true,
		RecordID:   record.ID,
		Assertions: []output.Assertion{},
	}

	if verify || update {
		// Read existing snapshot
		existing, err := os.ReadFile(snapFile)
		if err != nil {
			if os.IsNotExist(err) {
				err = fmt.Errorf("no snapshot found at %s. Run 'kest snap %s' first to create one", snapFile, urlPath)
				res.SetError(output.ErrorKindNotFound, err.Error())
				return res, &ExitError{Code: ExitConfigError, Err: err}
			}
			return res, &ExitError{Code: ExitRuntimeError, Err: err}
		}

		currentBody := prettyJSONSnap(record.ResponseBody)
		savedBody := string(existing)
		matches := currentBody == savedBody
		res.Diff = &output.Diff{Baseline: snapFile, Changed: !matches}
		if !matches {
			res.Diff.Patch = output.LineDiff(redactedPrettyBody(savedBody), redactedPrettyBody(currentBody))
		}
		step.Assertions = append(step.Assertions, output.Assertion{Expr: "body matches snapshot", OK: matches})

		if matches {
			fmt.Printf("✅ Snapshot matches: %s\n", snapFile)
			res.AddStep(step)
			return res, nil
		}

		// Show diff
		fmt.Printf("❌ Snapshot mismatch: %s\n\n", snapFile)
		dmp := diffmatchpatch.New()
		diffs := dmp.DiffMain(savedBody, currentBody, true)
		diffs = dmp.DiffCleanupSemantic(diffs)
		fmt.Println(dmp.DiffPrettyText(diffs))

		if update {
			if err := os.WriteFile(snapFile, []byte(currentBody), 0644); err != nil {
				return res, &ExitError{Code: ExitRuntimeError, Err: err}
			}
			fmt.Printf("\n✅ Snapshot updated: %s\n", snapFile)
			res.AddStep(step)
			return res, nil
		}

		fmt.Printf("\nRun 'kest snap %s --update' to accept changes.\n", urlPath)
		step.OK = false
		step.Assertions[0].Message = "response body differs from " + snapFile
		step.Error = &output.Error{Kind: output.ErrorKindSnapshot, Message: "snapshot mismatch: " + snapFile}
		res.AddStep(step)
		return res, &ExitError{Code: ExitAssertionFailed, Err: fmt.Errorf("snapshot mismatch")}
	}

	// Save new snapshot
	body := prettyJSONSnap(record.ResponseBody)
	if err := os.WriteFile(snapFile, []byte(body), 0644); err != nil {
		return res, &ExitError{Code: ExitRuntimeError, Err: err}
	}

	fmt.Printf("📸 Snapshot saved: %s\n", snapFile)
	fmt.Printf("   %s %s → %d (%dms)\n", record.Method, record.URL, record.ResponseStatus, record.DurationMs)
	fmt.Printf("   From record #%d\n", record.ID)
	res.Data = map[string]string{"snapshot_path": snapFile}
	res.AddStep(step)
	return res, nil
}

func init() {
	snapCmd.Flags().BoolVar(&snapVerify, "verify", false, "Verify current response matches snapshot")
	snapCmd.Flags().BoolVar(&snapUpdate, "update", false, "Update snapshot with current response")
	rootCmd.AddCommand(snapCmd)
}

func findRecordByPath(store *storage.Store, urlPath string) (*storage.Record, error) {
	records, err := store.GetAllRecords()
	if err != nil {
		return nil, err
	}
	for _, r := range records {
		if r.Path == urlPath || strings.HasSuffix(r.URL, urlPath) {
			return &r, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func sanitizeFilename(s string) string {
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, ":", "_")
	s = strings.ReplaceAll(s, "?", "_")
	s = strings.TrimLeft(s, "_")
	return s
}

func prettyJSONSnap(s string) string {
	var obj interface{}
	if err := json.Unmarshal([]byte(s), &obj); err == nil {
		if pretty, err := json.MarshalIndent(obj, "", "  "); err == nil {
			return string(pretty) + "\n"
		}
	}
	return s
}
