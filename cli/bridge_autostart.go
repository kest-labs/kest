package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

const (
	autoBridgeDisableEnv = "KEST_DISABLE_AUTO_BRIDGE"
	autoBridgeSkipEnv    = "KEST_SKIP_AUTO_BRIDGE"
	autoBridgeHealthURL  = "http://127.0.0.1:8788/health"
	autoBridgeBootWait   = 3 * time.Second
)

type bridgeHealthResponse struct {
	OK   bool   `json:"ok"`
	Name string `json:"name"`
}

func shouldAutoStartBridge(cmd *cobra.Command, argv []string) bool {
	if os.Getenv(autoBridgeDisableEnv) == "1" || os.Getenv(autoBridgeSkipEnv) == "1" {
		return false
	}

	if cmd == nil {
		return false
	}

	if path := cmd.CommandPath(); path == "kest bridge" || strings.HasPrefix(path, "kest bridge ") {
		return false
	}

	for _, arg := range argv {
		switch strings.TrimSpace(arg) {
		case "", "-h", "--help", "help", "--version", "version":
			return false
		}
	}

	switch cmd.Name() {
	case "bridge", "help", "completion", "mcp":
		return false
	}

	return true
}

func ensureBridgeRunning() error {
	if isBridgeHealthy() {
		return nil
	}

	if err := startBridgeInBackground(); err != nil {
		return err
	}

	deadline := time.Now().Add(autoBridgeBootWait)
	for time.Now().Before(deadline) {
		if isBridgeHealthy() {
			return nil
		}
		time.Sleep(150 * time.Millisecond)
	}

	return fmt.Errorf("bridge did not become healthy on %s", autoBridgeHealthURL)
}

func isBridgeHealthy() bool {
	client := &http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Get(autoBridgeHealthURL)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false
	}

	var payload bridgeHealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return false
	}

	return payload.OK && payload.Name == "kest-local-bridge"
}

func startBridgeInBackground() error {
	executablePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve kest executable: %w", err)
	}

	logFile, err := openAutoBridgeLogFile()
	if err != nil {
		return fmt.Errorf("open bridge log file: %w", err)
	}
	defer logFile.Close()

	cmd := exec.Command(executablePath, "bridge")
	cmd.Stdin = nil
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	cmd.Env = append(os.Environ(), autoBridgeSkipEnv+"=1")
	configureAutoBridgeProcess(cmd)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("spawn bridge process: %w", err)
	}

	return nil
}

func openAutoBridgeLogFile() (*os.File, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	logDir := filepath.Join(homeDir, ".kest", "logs")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, err
	}

	return os.OpenFile(
		filepath.Join(logDir, "bridge.log"),
		os.O_CREATE|os.O_WRONLY|os.O_APPEND,
		0644,
	)
}
