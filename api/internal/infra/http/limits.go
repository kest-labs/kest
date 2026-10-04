package http

import (
	"fmt"
	"io"

	"github.com/kest-labs/kest/api/internal/infra/config"
)

const (
	// DefaultRunnerMaxResponseBytes caps response bodies captured by the
	// request/flow/test runners (override with RUNNER_MAX_RESPONSE_MB).
	DefaultRunnerMaxResponseBytes int64 = 10 << 20
	// LLMMaxResponseBytes caps non-streaming LLM completion responses.
	LLMMaxResponseBytes int64 = 8 << 20
	// ErrorBodyMaxBytes caps bodies read only to build an error message.
	ErrorBodyMaxBytes int64 = 64 << 10
)

// RunnerMaxResponseBytes returns the configured runner response limit.
func RunnerMaxResponseBytes() int64 {
	if cfg := config.GlobalConfig; cfg != nil && cfg.Runner.MaxResponseBytes > 0 {
		return cfg.Runner.MaxResponseBytes
	}
	return DefaultRunnerMaxResponseBytes
}

// ReadLimited reads at most max bytes from r. truncated reports whether the
// source had more data than max. A max <= 0 disables the limit.
func ReadLimited(r io.Reader, max int64) (data []byte, truncated bool, err error) {
	if max <= 0 {
		data, err = io.ReadAll(r)
		return data, false, err
	}
	data, err = io.ReadAll(io.LimitReader(r, max+1))
	if int64(len(data)) > max {
		return data[:max], true, err
	}
	return data, false, err
}

// ReadAllLimited reads r fully but fails if it exceeds max bytes. Use it for
// payloads that are useless when truncated (e.g. JSON API responses).
func ReadAllLimited(r io.Reader, max int64) ([]byte, error) {
	data, truncated, err := ReadLimited(r, max)
	if err != nil {
		return nil, err
	}
	if truncated {
		return nil, fmt.Errorf("response body exceeds %d bytes", max)
	}
	return data, nil
}
