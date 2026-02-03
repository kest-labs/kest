package cli

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/kest-lab/kest-cli/internal/client"
	"github.com/kest-lab/kest-cli/internal/config"
	"github.com/kest-lab/kest-cli/internal/output"
	"github.com/kest-lab/kest-cli/internal/storage"
	"github.com/kest-lab/kest-cli/internal/variable"
	"github.com/sergi/go-diff/diffmatchpatch"
	"github.com/spf13/cobra"
)

var (
	replayDiff    bool
	replayAsserts []string
)

var replayCmd = &cobra.Command{
	Use:   "replay [id]",
	Short: "Replay a historic request",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := storage.NewStore()
		if err != nil {
			return err
		}

		var id int64
		var oldRecord *storage.Record
		if args[0] == "last" {
			oldRecord, err = store.GetLastRecord()
			if err != nil {
				return fmt.Errorf("no last record found")
			}
			id = oldRecord.ID
		} else {
			id, err = strconv.ParseInt(args[0], 10, 64)
			if err != nil {
				return fmt.Errorf("invalid record ID: %s", args[0])
			}
			oldRecord, err = store.GetRecord(id)
			if err != nil {
				return err
			}
		}

		fmt.Printf("Replaying #%d: %s %s\n", id, oldRecord.Method, oldRecord.URL)

		var headers map[string]string
		json.Unmarshal(oldRecord.RequestHeaders, &headers)

		resp, err := client.Execute(client.RequestOptions{
			Method:  oldRecord.Method,
			URL:     oldRecord.URL,
			Headers: headers,
			Body:    []byte(oldRecord.RequestBody),
			Timeout: 30 * time.Second,
		})
		if err != nil {
			return err
		}

		// Save new record
		headerJSON, _ := json.Marshal(headers)
		respHeaderJSON, _ := json.Marshal(resp.Headers)
		newID, _ := store.SaveRecord(&storage.Record{
			Method:          oldRecord.Method,
			URL:             oldRecord.URL,
			RequestHeaders:  headerJSON,
			RequestBody:     oldRecord.RequestBody,
			ResponseStatus:  resp.Status,
			ResponseHeaders: respHeaderJSON,
			ResponseBody:    string(resp.Body),
			DurationMs:      resp.Duration.Milliseconds(),
		})

		// Load variables
		var vars map[string]string
		conf, _ := config.LoadConfig()
		if conf != nil {
			vars, _ = store.GetVariables(conf.ProjectID, conf.ActiveEnv)
		}

		// Handle assertions
		if len(replayAsserts) > 0 {
			fmt.Println("\nAssertions:")
			allPassed := true
			for _, assertion := range replayAsserts {
				passed, msg := variable.Assert(resp.Status, resp.Body, resp.Duration.Milliseconds(), vars, assertion)
				if passed {
					fmt.Printf("  ✅ %s\n", assertion)
				} else {
					fmt.Printf("  ❌ %s (%s)\n", assertion, msg)
					allPassed = false
				}
			}
			if !allPassed {
				// We don't necessarily return error here
			}
		}

		if replayDiff {
			printDiff(oldRecord.ResponseBody, string(resp.Body))
		} else {
			output.PrintResponse(oldRecord.Method, oldRecord.URL, resp.Status, resp.Duration.String(), resp.Body, newID, time.Now())
		}

		return nil
	},
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
