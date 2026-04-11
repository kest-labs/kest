package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/spf13/cobra"
)

const (
	defaultBridgeHost = "127.0.0.1"
	defaultBridgePort = 8788
)

var (
	bridgeHost           string
	bridgePort           int
	bridgeCORSMode       string
	bridgeAllowedOrigins []string
)

type bridgeOriginPolicy struct {
	mode    string
	mu      sync.Mutex
	allowed map[string]struct{}
	logged  map[string]struct{}
}

type bridgeRunRequest struct {
	Method          string            `json:"method"`
	URL             string            `json:"url"`
	Headers         map[string]string `json:"headers"`
	Body            string            `json:"body"`
	TimeoutMS       int               `json:"timeout_ms,omitempty"`
	FollowRedirects *bool             `json:"follow_redirects,omitempty"`
	StrictTLS       *bool             `json:"strict_tls,omitempty"`
}

type bridgeRunResponse struct {
	Status     int               `json:"status"`
	StatusText string            `json:"status_text"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Time       int64             `json:"time"`
	Size       int               `json:"size"`
}

type bridgeErrorResponse struct {
	Error string `json:"error"`
}

var bridgeCmd = &cobra.Command{
	Use:   "bridge",
	Short: "Start a local bridge for web-triggered API execution",
	Long: `Launch a loopback-only HTTP bridge that allows the Kest web app to execute API
requests on your machine. This avoids target API CORS issues because the browser talks
only to the local bridge, and the bridge performs the real HTTP request locally.`,
	Example: `  # Start the default local bridge
  kest bridge

  # Start on a custom port
  kest bridge --port 8799

  # Restrict to explicit frontend origins only
  kest bridge --cors-mode strict --allow-origin https://your-kest.example.com`,
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		originPolicy := newBridgeOriginPolicy(
			bridgeCORSMode,
			normalizeBridgeOrigins(bridgeAllowedOrigins),
		)
		addr := fmt.Sprintf("%s:%d", bridgeHost, bridgePort)

		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			if handleBridgeCORS(w, r, originPolicy) {
				return
			}

			if r.Method != http.MethodGet {
				writeBridgeError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}

			writeBridgeJSON(w, http.StatusOK, map[string]any{
				"ok":        true,
				"name":      "kest-local-bridge",
				"cors_mode": originPolicy.mode,
			})
		})
		mux.HandleFunc("/run", func(w http.ResponseWriter, r *http.Request) {
			if handleBridgeCORS(w, r, originPolicy) {
				return
			}

			if r.Method != http.MethodPost {
				writeBridgeError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}

			defer r.Body.Close()

			var req bridgeRunRequest
			decoder := json.NewDecoder(io.LimitReader(r.Body, 2*1024*1024))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&req); err != nil {
				writeBridgeError(w, http.StatusBadRequest, "invalid bridge payload")
				return
			}

			resp, err := executeBridgeRequest(req)
			if err != nil {
				writeBridgeError(w, http.StatusBadRequest, err.Error())
				return
			}

			writeBridgeJSON(w, http.StatusOK, resp)
		})

		fmt.Printf("🔌 Kest local bridge listening on http://%s\n", addr)
		fmt.Printf("   CORS mode: %s\n", originPolicy.mode)
		if originPolicy.mode == "strict" {
			fmt.Println("   Allowed origins:")
			for _, origin := range originPolicy.listAllowedOrigins() {
				fmt.Printf("   - %s\n", origin)
			}
		} else {
			fmt.Println("   Allowed origins: auto-reflect any web origin on demand")
		}

		return http.ListenAndServe(addr, mux)
	},
}

func init() {
	bridgeCmd.Flags().StringVar(&bridgeHost, "host", defaultBridgeHost, "Host interface to bind")
	bridgeCmd.Flags().IntVar(&bridgePort, "port", defaultBridgePort, "Port to listen on")
	bridgeCmd.Flags().StringVar(
		&bridgeCORSMode,
		"cors-mode",
		"auto",
		"CORS mode: auto reflects the caller origin automatically, strict requires allow-origin values",
	)
	bridgeCmd.Flags().StringArrayVar(
		&bridgeAllowedOrigins,
		"allow-origin",
		nil,
		"Frontend origin allowed to call the bridge when --cors-mode strict is enabled",
	)

	rootCmd.AddCommand(bridgeCmd)
}

func newBridgeOriginPolicy(mode string, origins []string) *bridgeOriginPolicy {
	normalizedMode := strings.ToLower(strings.TrimSpace(mode))
	if normalizedMode != "strict" {
		normalizedMode = "auto"
	}

	allowed := make(map[string]struct{}, len(origins))
	for _, origin := range origins {
		allowed[origin] = struct{}{}
	}

	return &bridgeOriginPolicy{
		mode:    normalizedMode,
		allowed: allowed,
		logged:  make(map[string]struct{}),
	}
}

func (p *bridgeOriginPolicy) resolve(origin string) (string, bool) {
	trimmed := strings.TrimSpace(origin)
	if trimmed == "" {
		return "", true
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.mode == "strict" {
		_, ok := p.allowed[trimmed]
		return trimmed, ok
	}

	if _, seen := p.logged[trimmed]; !seen {
		p.logged[trimmed] = struct{}{}
		fmt.Printf("   ↳ auto-allowed origin: %s\n", trimmed)
	}
	p.allowed[trimmed] = struct{}{}

	return trimmed, true
}

func (p *bridgeOriginPolicy) listAllowedOrigins() []string {
	p.mu.Lock()
	defer p.mu.Unlock()

	result := make([]string, 0, len(p.allowed))
	for origin := range p.allowed {
		result = append(result, origin)
	}
	return result
}

func normalizeBridgeOrigins(origins []string) []string {
	seen := make(map[string]struct{}, len(origins))
	result := make([]string, 0, len(origins))

	for _, origin := range origins {
		trimmed := strings.TrimSpace(origin)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}

	return result
}

func handleBridgeCORS(
	w http.ResponseWriter,
	r *http.Request,
	originPolicy *bridgeOriginPolicy,
) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin != "" {
		resolvedOrigin, allowed := originPolicy.resolve(origin)
		if !allowed {
			writeBridgeError(w, http.StatusForbidden, "origin not allowed")
			return true
		}

		headers := w.Header()
		headers.Set("Access-Control-Allow-Origin", resolvedOrigin)
		headers.Set(
			"Vary",
			"Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Access-Control-Request-Private-Network",
		)
		headers.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

		requestHeaders := strings.TrimSpace(r.Header.Get("Access-Control-Request-Headers"))
		if requestHeaders == "" {
			requestHeaders = "Content-Type"
		}
		headers.Set("Access-Control-Allow-Headers", requestHeaders)
		headers.Set("Access-Control-Max-Age", "600")

		if strings.EqualFold(r.Header.Get("Access-Control-Request-Private-Network"), "true") {
			headers.Set("Access-Control-Allow-Private-Network", "true")
		}
	}

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return true
	}

	return false
}

func executeBridgeRequest(req bridgeRunRequest) (*bridgeRunResponse, error) {
	method := strings.ToUpper(strings.TrimSpace(req.Method))
	if method == "" {
		return nil, fmt.Errorf("request method is required")
	}

	targetURL, err := url.ParseRequestURI(strings.TrimSpace(req.URL))
	if err != nil {
		return nil, fmt.Errorf("target URL is invalid")
	}
	if targetURL.Scheme != "http" && targetURL.Scheme != "https" {
		return nil, fmt.Errorf("target URL must use http or https")
	}

	timeout := 30 * time.Second
	if req.TimeoutMS > 0 {
		timeout = time.Duration(req.TimeoutMS) * time.Millisecond
	}

	followRedirects := true
	if req.FollowRedirects != nil {
		followRedirects = *req.FollowRedirects
	}

	strictTLS := true
	if req.StrictTLS != nil {
		strictTLS = *req.StrictTLS
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	if !strictTLS {
		if transport.TLSClientConfig == nil {
			transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
		} else {
			transport.TLSClientConfig = transport.TLSClientConfig.Clone()
			transport.TLSClientConfig.InsecureSkipVerify = true
		}
	}

	httpClient := &http.Client{
		Timeout:   timeout,
		Transport: transport,
	}
	if !followRedirects {
		httpClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	var bodyReader io.Reader
	if req.Body != "" {
		bodyReader = strings.NewReader(req.Body)
	}

	httpReq, err := http.NewRequest(method, targetURL.String(), bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	for key, value := range req.Headers {
		httpReq.Header.Set(key, value)
	}

	startedAt := time.Now()
	httpResp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("local run failed: %w", err)
	}
	defer httpResp.Body.Close()

	body, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	return &bridgeRunResponse{
		Status:     httpResp.StatusCode,
		StatusText: httpResp.Status,
		Headers:    flattenBridgeHeaders(httpResp.Header),
		Body:       string(body),
		Time:       time.Since(startedAt).Milliseconds(),
		Size:       len(body),
	}, nil
}

func flattenBridgeHeaders(headers http.Header) map[string]string {
	result := make(map[string]string, len(headers))
	for key, values := range headers {
		if len(values) == 0 {
			continue
		}
		result[key] = strings.Join(values, ", ")
	}
	return result
}

func writeBridgeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeBridgeError(w http.ResponseWriter, status int, message string) {
	writeBridgeJSON(w, status, bridgeErrorResponse{Error: message})
}
