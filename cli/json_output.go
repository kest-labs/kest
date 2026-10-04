package main

import (
	"errors"
	"os"
	"time"

	"github.com/kest-labs/kest/cli/internal/output"
	"github.com/spf13/cobra"
)

// jsonCapableAnnotation marks commands that support --json / --output json.
// Only these commands redirect human output away from stdout; every other
// command keeps printing normally even when the global flag is set.
const jsonCapableAnnotation = "kest.json-output"

// JSONFlag is the --json shorthand for --output json.
var JSONFlag bool

func markJSONCapable(cmd *cobra.Command) {
	if cmd.Annotations == nil {
		cmd.Annotations = map[string]string{}
	}
	cmd.Annotations[jsonCapableAnnotation] = "true"
}

func jsonModeRequested() bool {
	return JSONFlag || OutputFormat == "json"
}

func isJSONCapable(cmd *cobra.Command) bool {
	return cmd != nil && cmd.Annotations[jsonCapableAnnotation] == "true"
}

// exitCodeForKind maps a machine-readable error kind to a process exit code.
func exitCodeForKind(kind string) int {
	switch kind {
	case "":
		return ExitSuccess
	case output.ErrorKindAssertion, output.ErrorKindSnapshot:
		return ExitAssertionFailed
	case output.ErrorKindInterrupted:
		return ExitInterrupted
	case output.ErrorKindConfig, output.ErrorKindVariable, output.ErrorKindNotFound, output.ErrorKindAINotConfigured:
		return ExitConfigError
	default:
		return ExitRuntimeError
	}
}

// exitCodeForResult derives the exit code from the root cause, which is the
// top-level error or else the first failed step.
func exitCodeForResult(res *output.Result) int {
	if res == nil {
		return ExitSuccess
	}
	if failure := res.FirstFailure(); failure != nil {
		return exitCodeForKind(failure.Kind)
	}
	return ExitSuccess
}

func kindForExitCode(code int) string {
	switch code {
	case ExitAssertionFailed:
		return output.ErrorKindAssertion
	case ExitConfigError:
		return output.ErrorKindConfig
	default:
		return output.ErrorKindInternal
	}
}

func exitCodeForError(err error) int {
	if err == nil {
		return ExitSuccess
	}
	var exitErr *ExitError
	if errors.As(err, &exitErr) {
		return exitErr.Code
	}
	return ExitRuntimeError
}

// finalizeResult fills ok/exit_code from the result and the command error.
// A nil result is replaced by an empty one so callers always get a document.
func finalizeResult(command string, res *output.Result, err error) *output.Result {
	if res == nil {
		res = output.NewResult(command)
	}
	if res.Command == "" {
		res.Command = command
	}
	if err != nil && res.FirstFailure() == nil {
		res.SetError(kindForExitCode(exitCodeForError(err)), err.Error())
	}
	res.OK = err == nil && res.FirstFailure() == nil
	switch {
	case res.OK:
		res.ExitCode = ExitSuccess
	case err != nil:
		res.ExitCode = exitCodeForError(err)
	default:
		res.ExitCode = exitCodeForResult(res)
	}
	return res
}

// finishJSON emits the single JSON document for a command and returns an
// error carrying the matching exit code (or nil on success).
func finishJSON(command string, res *output.Result, err error) error {
	res = finalizeResult(command, res, err)
	if emitErr := output.EmitJSON(res); emitErr != nil {
		return &ExitError{Code: ExitRuntimeError, Err: emitErr}
	}
	if res.OK {
		return nil
	}
	if err == nil {
		err = errors.New(res.FirstFailure().Message)
	}
	return &ExitError{Code: res.ExitCode, Err: err}
}

// buildRunResult converts per-file run results into the versioned result.
func buildRunResult(files []runExecutionResult, startedAt, finishedAt time.Time) *output.Result {
	res := output.NewResult("run")
	for _, file := range files {
		if file.Summary == nil {
			kind := output.ErrorKindConfig
			message := "flow failed to load"
			if file.Err != nil {
				message = file.Err.Error()
				if !errors.Is(file.Err, os.ErrNotExist) && !errors.Is(file.Err, os.ErrPermission) && !isFlowIncludeError(file.Err) {
					kind = output.ErrorKindInternal
				}
			}
			res.AddStep(output.Step{
				Name:       "load",
				Source:     file.SourcePath,
				OK:         false,
				Assertions: []output.Assertion{},
				Error:      &output.Error{Kind: kind, Message: message},
			})
			continue
		}
		for _, tr := range file.Summary.Results {
			res.AddStep(output.StepFromTestResult(tr, output.StepOptions{
				Source:                 file.SourcePath,
				IncludeBodiesOnFailure: true,
			}))
		}
		// Dependency skips were already counted by AddStep; add the steps that
		// were never reached (--fail-fast, interrupts).
		if unreached := file.Summary.SkippedTests - file.Summary.RecordedSkips(); unreached > 0 {
			res.Summary.Skipped += unreached
		}
		if file.Err != nil && file.Summary.FailedTests == 0 && res.Error == nil {
			res.SetError(output.ErrorKindInternal, file.Err.Error())
		}
	}
	res.SetDuration(startedAt, finishedAt)
	res.OK = res.FirstFailure() == nil
	res.ExitCode = exitCodeForResult(res)
	return res
}
