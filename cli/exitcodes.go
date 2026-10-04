package main

// Exit codes follow Unix conventions:
//   0 = success
//   1 = assertion failure (test did not pass)
//   2 = runtime error (network, timeout, exec failure)
//   3 = usage/config error (bad flags, broken config, missing file)
// 130 = interrupted by Ctrl-C (SIGINT), 143 = terminated (SIGTERM)

const (
	ExitSuccess         = 0
	ExitAssertionFailed = 1
	ExitRuntimeError    = 2
	ExitConfigError     = 3
	// ExitInterrupted / ExitTerminated follow the shell convention 128+signal
	// for a run stopped by SIGINT (Ctrl-C) or SIGTERM.
	ExitInterrupted = 130
	ExitTerminated  = 143
)

// ExitError wraps an error with a specific exit code.
type ExitError struct {
	Code int
	Err  error
}

func (e *ExitError) Error() string {
	return e.Err.Error()
}

func (e *ExitError) Unwrap() error {
	return e.Err
}
