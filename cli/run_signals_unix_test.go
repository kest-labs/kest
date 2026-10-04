//go:build !windows

package main

import (
	"os"
	"syscall"
	"testing"
)

func signalTestsSupported() bool { return true }

func sendSelfInterrupt(t *testing.T) {
	t.Helper()
	if err := syscall.Kill(os.Getpid(), syscall.SIGINT); err != nil {
		t.Errorf("send SIGINT: %v", err)
	}
}
