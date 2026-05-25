package main

import (
	"time"

	"github.com/kest-labs/kest/cli/internal/summary"
)

type runExecutionResult struct {
	SourcePath string
	FlowID     string
	FlowName   string
	FlowDoc    *FlowDoc
	Summary    *summary.Summary
	LogPath    string
	Err        error
	StartedAt  time.Time
	FinishedAt time.Time
}

func (r runExecutionResult) Status() string {
	if r.Err != nil {
		return "failed"
	}
	if r.Summary != nil && r.Summary.FailedTests > 0 {
		return "failed"
	}
	return "passed"
}
