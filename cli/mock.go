package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/spf13/cobra"
)

var (
	mockPort int
)

var mockCmd = &cobra.Command{
	Use:   "mock",
	Short: "Start a mock server auto-generated from your request history",
	Long: `Launch a local HTTP server that replays recorded responses from your history.
Every unique endpoint (method + path) gets a mock handler returning the latest recorded response.

This is a zero-config mock server — no setup, no manual examples. Your real API traffic IS the mock.`,
	Example: `  # Start mock server on default port
  kest mock

  # Start on a custom port
  kest mock --port 9090`,
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := storage.NewStore()
		if err != nil {
			return err
		}
		defer store.Close()

		records, err := store.GetAllRecords()
		if err != nil {
			return err
		}
		if len(records) == 0 {
			return fmt.Errorf("no request history found. Make some API requests first")
		}

		// Build route table: method+path → latest record
		type route struct {
			Method   string
			Path     string
			Status   int
			Headers  map[string][]string
			Body     string
			RecordID int64
		}

		routes := make(map[string]*route)
		// Records are ordered DESC, so first occurrence is latest
		for _, r := range records {
			if r.Path == "" {
				continue
			}
			key := r.Method + " " + r.Path
			if _, exists := routes[key]; !exists {
				var respHeaders map[string][]string
				json.Unmarshal(r.ResponseHeaders, &respHeaders)
				routes[key] = &route{
					Method:   r.Method,
					Path:     r.Path,
					Status:   r.ResponseStatus,
					Headers:  respHeaders,
					Body:     r.ResponseBody,
					RecordID: r.ID,
				}
			}
		}

		if len(routes) == 0 {
			return fmt.Errorf("no mockable endpoints found in history")
		}

		// Print route table
		fmt.Printf("🎭 Mock server starting on :%d\n\n", mockPort)
		fmt.Printf("  %-7s %-40s %s\n", "METHOD", "PATH", "STATUS")
		fmt.Printf("  %s\n", strings.Repeat("─", 60))
		for _, r := range routes {
			fmt.Printf("  %-7s %-40s %d  (from #%d)\n", r.Method, r.Path, r.Status, r.RecordID)
		}
		fmt.Printf("\n  Total: %d endpoints\n\n", len(routes))

		// Build mux
		mux := http.NewServeMux()

		for _, r := range routes {
			rt := r // capture
			pattern := rt.Path
			mux.HandleFunc(pattern, func(w http.ResponseWriter, req *http.Request) {
				// Check method
				if req.Method != rt.Method && req.Method != "OPTIONS" {
					// Try to find the right method
					key := req.Method + " " + rt.Path
					if alt, ok := routes[key]; ok {
						serveMockResponse(w, alt.Status, alt.Headers, alt.Body)
						return
					}
					w.WriteHeader(http.StatusMethodNotAllowed)
					fmt.Fprintf(w, `{"error":"method %s not recorded for %s"}`, req.Method, rt.Path)
					return
				}

				// Handle CORS preflight
				if req.Method == "OPTIONS" {
					w.Header().Set("Access-Control-Allow-Origin", "*")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
					w.WriteHeader(http.StatusOK)
					return
				}

				serveMockResponse(w, rt.Status, rt.Headers, rt.Body)
				if !QuietMode {
					fmt.Printf("  → %s %s → %d\n", req.Method, req.URL.Path, rt.Status)
				}
			})
		}

		// Catch-all for unmatched routes
		mux.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
			// Check if any route matches
			key := req.Method + " " + req.URL.Path
			if rt, ok := routes[key]; ok {
				serveMockResponse(w, rt.Status, rt.Headers, rt.Body)
				if !QuietMode {
					fmt.Printf("  → %s %s → %d\n", req.Method, req.URL.Path, rt.Status)
				}
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			fmt.Fprintf(w, `{"error":"no recorded response for %s %s","hint":"make a real request first: kest %s %s"}`,
				req.Method, req.URL.Path,
				strings.ToLower(req.Method), req.URL.Path)
		})

		fmt.Printf("💡 Press Ctrl+C to stop\n\n")
		addr := fmt.Sprintf(":%d", mockPort)
		return http.ListenAndServe(addr, mux)
	},
}

func init() {
	mockCmd.Flags().IntVar(&mockPort, "port", 8787, "Port to listen on")
	rootCmd.AddCommand(mockCmd)
}

func serveMockResponse(w http.ResponseWriter, status int, headers map[string][]string, body string) {
	// Set CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Set recorded headers (skip hop-by-hop headers)
	skipHeaders := map[string]bool{
		"Transfer-Encoding": true,
		"Connection":        true,
		"Keep-Alive":        true,
	}
	for k, vals := range headers {
		if skipHeaders[k] {
			continue
		}
		for _, v := range vals {
			w.Header().Set(k, v)
		}
	}

	// Ensure content-type is set
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", "application/json")
	}

	w.WriteHeader(status)
	fmt.Fprint(w, body)
}
