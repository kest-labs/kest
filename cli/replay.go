package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/kest-labs/kest/cli/internal/client"
	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/kest-labs/kest/cli/internal/platformsync"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/kest-labs/kest/cli/internal/summary"
	"github.com/kest-labs/kest/cli/internal/variable"
	"github.com/sergi/go-diff/diffmatchpatch"
	"github.com/spf13/cobra"
)

var (
	replayDiff    bool
	replayAsserts []string
)

var replayCmd = &cobra.Command{
	Use:         "replay [id]",
	Short:       "Replay a historic request",
	Args:        cobra.ExactArgs(1),
	Annotations: map[string]string{jsonCapableAnnotation: "true"},
	RunE: func(cmd *cobra.Command, args []string) error {
		res, err := replayRecord(args[0], replayAsserts, replayDiff)
		if output.JSONOutput {
			return finishJSON("replay", res, err)
		}
		return err
	},
}

// replayRecord re-executes a recorded request ("last" or a record ID),
// prints the human-readable outcome and returns the versioned result.
func replayRecord(ref string, asserts []string, wantDiff bool) (*output.Result, error) {
	startedAt := time.Now()
	res := output.NewResult("replay")

	store, err := storage.NewStore()
	if err != nil {
		return res, &ExitError{Code: ExitRuntimeError, Err: err}
	}
	defer store.Close()

	var id int64
	var oldRecord *storage.Record
	if ref == "" || ref == "last" {
		oldRecord, err = store.GetLastRecord()
		if err != nil {
			res.SetError(output.ErrorKindNotFound, "no last record found")
			return res, &ExitError{Code: ExitConfigError, Err: fmt.Errorf("no last record found")}
		}
		id = oldRecord.ID
	} else {
		id, err = strconv.ParseInt(ref, 10, 64)
		if err != nil {
			return res, &ExitError{Code: ExitConfigError, Err: fmt.Errorf("invalid record ID: %s", ref)}
		}
		oldRecord, err = store.GetRecord(id)
		if err != nil {
			res.SetError(output.ErrorKindNotFound, fmt.Sprintf("record #%d not found", id))
			return res, &ExitError{Code: ExitConfigError, Err: fmt.Errorf("record #%d not found: %w", id, err)}
		}
	}

	fmt.Printf("Replaying #%d: %s %s\n", id, oldRecord.Method, oldRecord.URL)

	var headers map[string]string
	json.Unmarshal(oldRecord.RequestHeaders, &headers)

	tr := summary.TestResult{
		Name:           fmt.Sprintf("replay #%d", id),
		Method:         oldRecord.Method,
		URL:            oldRecord.URL,
		RequestHeaders: headers,
		RequestBody:    oldRecord.RequestBody,
		StartTime:      startedAt,
	}

	resp, err := client.Execute(client.RequestOptions{
		Method:  oldRecord.Method,
		URL:     oldRecord.URL,
		Headers: headers,
		Body:    []byte(oldRecord.RequestBody),
		Timeout: 30 * time.Second,
	})
	if err != nil {
		tr.Error = err
		tr.ErrorKind = classifyRequestError(err)
		res.AddStep(output.StepFromTestResult(tr, output.StepOptions{IncludeBodies: true}))
		res.SetDuration(startedAt, time.Now())
		return res, &ExitError{Code: ExitRuntimeError, Err: err}
	}

	// Save new record, preserving origin metadata from the original record
	headerJSON, _ := json.Marshal(headers)
	respHeaderJSON, _ := json.Marshal(resp.Headers)
	record := &storage.Record{
		Method:          oldRecord.Method,
		URL:             oldRecord.URL,
		BaseURL:         oldRecord.BaseURL,
		Path:            oldRecord.Path,
		RequestHeaders:  headerJSON,
		RequestBody:     oldRecord.RequestBody,
		ResponseStatus:  resp.Status,
		ResponseHeaders: respHeaderJSON,
		ResponseBody:    string(resp.Body),
		DurationMs:      resp.Duration.Milliseconds(),
		Environment:     oldRecord.Environment,
		Project:         oldRecord.Project,
		CreatedAt:       time.Now().UTC(),
	}
	newID, _ := store.SaveRecord(record)
	record.ID = newID
	conf := loadConfigWarn()
	if newID > 0 {
		if err := platformsync.QueueRequestHistory(conf, store, record, "replay"); err != nil {
			// Keep replay non-fatal when platform sync is unavailable.
		} else {
			platformsync.MaybeFlushHistoryOutbox(conf, store, 5)
		}
	}

	tr.Status = resp.Status
	tr.Duration = resp.Duration
	tr.ResponseHeaders = cloneHeaderMap(resp.Headers)
	tr.ResponseBody = string(resp.Body)
	tr.RecordID = newID
	tr.RequestID = extractRequestID(resp.Headers, resp.Body)
	tr.Success = true

	// Load variables
	var vars map[string]string
	if conf != nil {
		vars, _ = store.GetVariables(conf.ProjectID, conf.ActiveEnv)
	}

	// Handle assertions
	var assertErr error
	if len(asserts) > 0 {
		fmt.Println("\nAssertions:")
		allPassed := true
		for _, assertion := range asserts {
			passed, msg := variable.Assert(resp.Status, resp.Body, resp.Duration.Milliseconds(), vars, assertion)
			tr.Assertions = append(tr.Assertions, summary.AssertionResult{Expr: assertion, Passed: passed, Message: msg})
			if passed {
				fmt.Printf("  ✅ %s\n", assertion)
			} else {
				fmt.Printf("  ❌ %s (%s)\n", assertion, msg)
				if allPassed {
					tr.FailedAssertion = assertion
					tr.Error = fmt.Errorf("assertion failed: %s (%s)", assertion, msg)
				}
				allPassed = false
			}
		}
		if !allPassed {
			tr.Success = false
			tr.ErrorKind = output.ErrorKindAssertion
			assertErr = &ExitError{Code: ExitAssertionFailed, Err: fmt.Errorf("replay assertions failed")}
		}
	}

	res.AddStep(output.StepFromTestResult(tr, output.StepOptions{IncludeBodies: true}))
	if wantDiff {
		res.Diff = replayDiffResult(oldRecord, record)
	}
	res.SetDuration(startedAt, time.Now())
	if assertErr != nil {
		return res, assertErr
	}

	if wantDiff {
		printDiff(oldRecord.ResponseBody, string(resp.Body))
	} else {
		output.PrintResponse(oldRecord.Method, oldRecord.URL, resp.Status, resp.Duration.String(), resp.Body, newID, time.Now())
	}

	return res, nil
}

// replayDiffResult compares the original and replayed responses using
// redacted, pretty-printed bodies so the patch never leaks secrets.
func replayDiffResult(before, after *storage.Record) *output.Diff {
	oldBody := redactedPrettyBody(before.ResponseBody)
	newBody := redactedPrettyBody(after.ResponseBody)
	return &output.Diff{
		Baseline:     fmt.Sprintf("record #%d", before.ID),
		Changed:      oldBody != newBody || before.ResponseStatus != after.ResponseStatus,
		StatusBefore: before.ResponseStatus,
		StatusAfter:  after.ResponseStatus,
		Patch:        output.LineDiff(oldBody, newBody),
	}
}

func redactedPrettyBody(body string) string {
	sanitized, _ := platformsync.SanitizeBody(body)
	return prettyJSONSnap(sanitized)
}

func init() {
	replayCmd.Flags().BoolVar(&replayDiff, "diff", false, "Compare response with the original one")
	replayCmd.Flags().StringSliceVarP(&replayAsserts, "assert", "a", []string{}, "Assert response (e.g. status=200, body.id=1)")
	rootCmd.AddCommand(replayCmd)
}

func printDiff(oldBody, newBody string) {
	dmp := diffmatchpatch.New()
	diffs := dmp.DiffMain(oldBody, newBody, false)
	fmt.Println("\n─── Response Body Diff ───")
	fmt.Println(dmp.DiffPrettyText(diffs))
}
