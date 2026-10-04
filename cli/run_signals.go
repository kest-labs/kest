package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// teardownGrace is how long teardown steps may keep running after the user
// interrupts a run (Ctrl-C / SIGTERM).
const teardownGrace = 10 * time.Second

var (
	// runCtx is cancelled when the process receives SIGINT or SIGTERM while a
	// run is in progress. It is context.Background() outside of `kest run`.
	runCtx = context.Background()

	interruptMu     sync.Mutex
	interruptSignal os.Signal
)

// currentRunCtx returns the context of the active run.
func currentRunCtx() context.Context {
	interruptMu.Lock()
	defer interruptMu.Unlock()
	return runCtx
}

// interruptedBy returns the signal that interrupted the run, if any.
func interruptedBy() os.Signal {
	interruptMu.Lock()
	defer interruptMu.Unlock()
	return interruptSignal
}

// installRunSignals makes Ctrl-C and SIGTERM cancel runCtx instead of killing
// the process, so the in-flight request is aborted, teardown runs and the
// results are still reported. A second signal exits immediately. The returned
// function restores the previous state.
func installRunSignals() func() {
	ctx, cancel := context.WithCancel(context.Background())
	interruptMu.Lock()
	previousCtx := runCtx
	runCtx = ctx
	interruptSignal = nil
	interruptMu.Unlock()

	ch := make(chan os.Signal, 2)
	signal.Notify(ch, os.Interrupt, syscall.SIGTERM)
	done := make(chan struct{})
	go func() {
		first := true
		for {
			select {
			case sig := <-ch:
				if !first {
					fmt.Fprintln(os.Stderr, "\nSecond interrupt: exiting without finishing teardown.")
					os.Exit(exitCodeForSignal(sig))
				}
				first = false
				interruptMu.Lock()
				interruptSignal = sig
				interruptMu.Unlock()
				fmt.Fprintf(os.Stderr, "\nInterrupted (%v): stopping the run and running teardown (press Ctrl-C again to quit immediately).\n", sig)
				cancel()
			case <-done:
				return
			}
		}
	}()

	return func() {
		signal.Stop(ch)
		close(done)
		cancel()
		interruptMu.Lock()
		runCtx = previousCtx
		interruptMu.Unlock()
	}
}

func exitCodeForSignal(sig os.Signal) int {
	if sig == syscall.SIGTERM {
		return ExitTerminated
	}
	return ExitInterrupted
}

// teardownContext returns the context teardown steps run with. It is never
// cancelled by the interrupt itself; instead teardown gets teardownGrace to
// finish once the run has been interrupted (immediately if it already was).
func teardownContext(parent context.Context) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		select {
		case <-parent.Done():
			timer := time.NewTimer(teardownGrace)
			defer timer.Stop()
			select {
			case <-timer.C:
				cancel()
			case <-ctx.Done():
			}
		case <-ctx.Done():
		}
	}()
	return ctx, cancel
}
