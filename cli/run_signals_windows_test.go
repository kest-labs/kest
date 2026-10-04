//go:build windows

package main

import "testing"

func signalTestsSupported() bool { return false }

func sendSelfInterrupt(t *testing.T) { t.Helper() }
