package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Config holds error handler configuration
type Config struct {
	// Debug mode shows detailed error information
	Debug bool

	// ShowStack shows stack traces in debug mode
	ShowStack bool

	// LogErrors logs errors to console
	LogErrors bool

	// Custom error response transformer
	Transformer func(*gin.Context, *AppError) interface{}

	// Custom error logger
	Logger func(*gin.Context, *AppError)

	// Custom recovery handler
	RecoveryHandler func(*gin.Context, interface{})
}

// DefaultConfig returns default error handler config
func DefaultConfig() Config {
	return Config{
		Debug:     os.Getenv("GIN_MODE") != "release",
		ShowStack: os.Getenv("GIN_MODE") != "release",
		LogErrors: true,
	}
}

// ErrorResponse represents the standard error response format
type ErrorResponse struct {
	Success   bool                   `json:"success"`
	Error     ErrorDetail            `json:"error"`
	Meta      map[string]interface{} `json:"meta,omitempty"`
	Timestamp string                 `json:"timestamp"`
	RequestID string                 `json:"request_id,omitempty"`
}

// ErrorDetail contains error details
type ErrorDetail struct {
	Code    Code                `json:"code"`
	Message string              `json:"message"`
	Detail  string              `json:"detail,omitempty"`
	Errors  map[string][]string `json:"errors,omitempty"`
	Stack   []StackFrame        `json:"stack,omitempty"`
}

// StackFrame represents a stack frame for debugging
type StackFrame struct {
	File     string `json:"file"`
	Line     int    `json:"line"`
	Function string `json:"function"`
}

// Handler returns a Gin error handling middleware
func Handler(cfg ...Config) gin.HandlerFunc {
	config := DefaultConfig()
	if len(cfg) > 0 {
		config = cfg[0]
	}

	return func(c *gin.Context) {
		c.Next()

		// Handle any errors that occurred during request processing
		if len(c.Errors) > 0 {
			err := c.Errors.Last().Err
			handleError(c, err, config)
		}
	}
}

// Recovery returns a panic recovery middleware with pretty error output
func Recovery(cfg ...Config) gin.HandlerFunc {
	config := DefaultConfig()
	if len(cfg) > 0 {
		config = cfg[0]
	}

	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				// Custom recovery handler
				if config.RecoveryHandler != nil {
					config.RecoveryHandler(c, r)
					return
				}

				// Create internal error
				var err *AppError
				switch v := r.(type) {
				case *AppError:
					err = v
				case error:
					err = LegacyInternal("A panic occurred").WithInternal(v)
				case string:
					err = LegacyInternal(v)
				default:
					err = LegacyInternal(fmt.Sprintf("Unknown panic: %v", r))
				}

				// Capture stack trace
				buf := make([]byte, 4096)
				n := runtime.Stack(buf, false)
				err.Stack = string(buf[:n])

				handleError(c, err, config)
			}
		}()

		c.Next()
	}
}

// handleError processes and responds with an error
func handleError(c *gin.Context, err error, config Config) {
	appErr := toAppError(err)

	// Log error
	if config.LogErrors {
		logError(c, appErr, config)
	}

	// Custom logger
	if config.Logger != nil {
		config.Logger(c, appErr)
	}

	// Build response
	var response interface{}
	if config.Transformer != nil {
		response = config.Transformer(c, appErr)
	} else {
		response = buildErrorResponse(c, appErr, config)
	}

	c.AbortWithStatusJSON(appErr.Status, response)
}

// toAppError converts any error to AppError
func toAppError(err error) *AppError {
	if appErr, ok := err.(*AppError); ok {
		return appErr
	}

	// Check for common error types
	switch e := err.(type) {
	case interface{ Status() int }:
		return &AppError{
			Status:   e.Status(),
			Code:     CodeUnknown,
			Message:  err.Error(),
			Internal: err,
		}
	default:
		return LegacyInternal(err.Error()).WithInternal(err)
	}
}

// buildErrorResponse builds the standard error response
func buildErrorResponse(c *gin.Context, err *AppError, config Config) ErrorResponse {
	detail := ErrorDetail{
		Code:    err.Code,
		Message: err.Message,
		Errors:  err.Errors,
	}

	// Add detail in debug mode
	if config.Debug && err.Detail != "" {
		detail.Detail = err.Detail
	}

	// Add stack trace in debug mode
	if config.Debug && config.ShowStack && err.Stack != "" {
		detail.Stack = parseStackTrace(err.Stack)
	}

	response := ErrorResponse{
		Success:   false,
		Error:     detail,
		Meta:      err.Meta,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	// Add request ID if available
	if requestID := c.GetString("request_id"); requestID != "" {
		response.RequestID = requestID
	}

	return response
}

// parseStackTrace parses a stack trace string into frames
func parseStackTrace(stack string) []StackFrame {
	var frames []StackFrame
	lines := strings.Split(stack, "\n")

	for i := 0; i < len(lines)-1; i += 2 {
		funcLine := strings.TrimSpace(lines[i])
		if i+1 >= len(lines) {
			break
		}
		fileLine := strings.TrimSpace(lines[i+1])

		// Skip runtime and gin internal frames
		if strings.Contains(funcLine, "runtime.") ||
			strings.Contains(funcLine, "gin-gonic") ||
			strings.Contains(funcLine, "pkg/errors") {
			continue
		}

		// Parse file:line
		file := fileLine
		line := 0
		if idx := strings.LastIndex(fileLine, ":"); idx != -1 {
			file = fileLine[:idx]
			fmt.Sscanf(fileLine[idx+1:], "%d", &line)
		}

		// Parse function name
		funcName := funcLine
		if idx := strings.LastIndex(funcLine, "/"); idx != -1 {
			funcName = funcLine[idx+1:]
		}

		frames = append(frames, StackFrame{
			File:     file,
			Line:     line,
			Function: funcName,
		})

		// Limit frames
		if len(frames) >= 10 {
			break
		}
	}

	return frames
}

// logError logs the error to console
func logError(c *gin.Context, err *AppError, config Config) {
	// Build log message
	msg := fmt.Sprintf("[ERROR] %s %s - %d %s: %s",
		c.Request.Method,
		c.Request.URL.Path,
		err.Status,
		err.Code,
		err.Message,
	)

	if err.Internal != nil {
		msg += fmt.Sprintf(" (internal: %v)", err.Internal)
	}

	fmt.Println(msg)

	// Print stack in debug mode
	if config.Debug && config.ShowStack && err.Stack != "" {
		fmt.Println("Stack trace:")
		fmt.Println(err.Stack)
	}
}

// --- Gin Integration Helpers ---

// Abort aborts with an error
func Abort(c *gin.Context, err *AppError) {
	c.Error(err)
	c.Abort()
}

// AbortWithValidation aborts with validation errors
func AbortWithValidation(c *gin.Context, errors map[string][]string) {
	Abort(c, LegacyValidationWithErrors(errors))
}

// AbortWithMessage aborts with a message
func AbortWithMessage(c *gin.Context, status int, message string) {
	err := &AppError{
		Status:  status,
		Code:    statusToCode(status),
		Message: message,
	}
	Abort(c, err)
}

// statusToCode converts HTTP status to error code
func statusToCode(status int) Code {
	switch status {
	case http.StatusBadRequest:
		return CodeBadRequest
	case http.StatusUnauthorized:
		return CodeUnauthorized
	case http.StatusForbidden:
		return CodeForbidden
	case http.StatusNotFound:
		return CodeNotFound
	case http.StatusConflict:
		return CodeConflict
	case http.StatusUnprocessableEntity:
		return CodeValidation
	case http.StatusTooManyRequests:
		return CodeTooManyRequests
	case http.StatusServiceUnavailable:
		return CodeServiceUnavailable
	default:
		return CodeInternal
	}
}

// --- Problem Details (RFC 7807) ---

// ProblemDetails represents RFC 7807 Problem Details
type ProblemDetails struct {
	Type     string                 `json:"type"`
	Title    string                 `json:"title"`
	Status   int                    `json:"status"`
	Detail   string                 `json:"detail,omitempty"`
	Instance string                 `json:"instance,omitempty"`
	Errors   map[string][]string    `json:"errors,omitempty"`
	Extra    map[string]interface{} `json:"extra,omitempty"`
}

// ToProblemDetails converts AppError to RFC 7807 Problem Details
func (e *AppError) ToProblemDetails(baseURL string) ProblemDetails {
	return ProblemDetails{
		Type:   fmt.Sprintf("%s/errors/%s", baseURL, strings.ToLower(string(e.Code))),
		Title:  string(e.Code),
		Status: e.Status,
		Detail: e.Message,
		Errors: e.Errors,
	}
}

// ProblemDetailsHandler returns a handler that uses RFC 7807 format
func ProblemDetailsHandler(baseURL string, cfg ...Config) gin.HandlerFunc {
	config := DefaultConfig()
	if len(cfg) > 0 {
		config = cfg[0]
	}

	config.Transformer = func(c *gin.Context, err *AppError) interface{} {
		pd := err.ToProblemDetails(baseURL)
		pd.Instance = c.Request.URL.Path
		return pd
	}

	return Handler(config)
}

// --- Response Helpers ---

// JSON sends a successful JSON response
func JSON(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

// Created sends a 201 Created response
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    data,
	})
}

// NoContent sends a 204 No Content response
func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// Paginated sends a paginated response
func Paginated(c *gin.Context, data interface{}, meta interface{}) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
		"meta":    meta,
	})
}

// --- Debug Page Renderer ---

// DebugPageData holds data for debug error page
type DebugPageData struct {
	Title       string
	Message     string
	Code        string
	Status      int
	File        string
	Line        int
	Stack       []StackFrame
	Request     RequestInfo
	Environment map[string]string
}

// RequestInfo holds request information for debug
type RequestInfo struct {
	Method  string
	URL     string
	Headers map[string]string
	Query   map[string]string
	Body    string
}

// RenderDebugPage renders an HTML debug page
func RenderDebugPage(c *gin.Context, err *AppError) {
	data := DebugPageData{
		Title:   string(err.Code),
		Message: err.Message,
		Code:    string(err.Code),
		Status:  err.Status,
		File:    err.File,
		Line:    err.Line,
		Stack:   parseStackTrace(err.Stack),
		Request: RequestInfo{
			Method:  c.Request.Method,
			URL:     c.Request.URL.String(),
			Headers: make(map[string]string),
			Query:   make(map[string]string),
		},
		Environment: map[string]string{
			"Go Version": runtime.Version(),
			"OS":         runtime.GOOS,
			"Arch":       runtime.GOARCH,
		},
	}

	// Collect headers
	for k, v := range c.Request.Header {
		if len(v) > 0 {
			data.Request.Headers[k] = v[0]
		}
	}

	// Collect query params
	for k, v := range c.Request.URL.Query() {
		if len(v) > 0 {
			data.Request.Query[k] = v[0]
		}
	}

	html := renderDebugHTML(data)
	c.Data(err.Status, "text/html; charset=utf-8", []byte(html))
}

// renderDebugHTML generates a beautiful modern debug HTML page
func renderDebugHTML(data DebugPageData) string {
	// Build stack trace HTML
	stackHTML := ""
	for i, frame := range data.Stack {
		activeClass := ""
		if i == 0 {
			activeClass = "active"
		}
		stackHTML += fmt.Sprintf(`
			<div class="stack-frame %s" onclick="selectFrame(this)">
				<div class="frame-num">#%d</div>
				<div class="frame-content">
					<div class="frame-func">%s</div>
					<div class="frame-loc">%s<span class="line-num">:%d</span></div>
				</div>
			</div>`, activeClass, i, frame.Function, frame.File, frame.Line)
	}

	// Build headers HTML
	headersHTML := ""
	for k, v := range data.Request.Headers {
		headersHTML += fmt.Sprintf(`<tr><td class="key">%s</td><td class="val">%s</td></tr>`, k, v)
	}

	// Build query params HTML
	queryHTML := ""
	for k, v := range data.Request.Query {
		queryHTML += fmt.Sprintf(`<tr><td class="key">%s</td><td class="val">%s</td></tr>`, k, v)
	}
	if queryHTML == "" {
		queryHTML = `<tr><td colspan="2" class="empty">No query parameters</td></tr>`
	}

	// Build environment HTML
	envHTML := ""
	for k, v := range data.Environment {
		envHTML += fmt.Sprintf(`<tr><td class="key">%s</td><td class="val">%s</td></tr>`, k, v)
	}

	// Generate markdown for copy
	markdownStack := ""
	for i, frame := range data.Stack {
		markdownStack += fmt.Sprintf("%d. `%s` at %s:%d\\n", i, frame.Function, frame.File, frame.Line)
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>%d %s | Eogo</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
	<style>
		:root {
			--bg-primary: #0f0f23;
			--bg-secondary: #1a1a3e;
			--bg-tertiary: #252550;
			--text-primary: #e4e4ef;
			--text-secondary: #9999bb;
			--text-muted: #666688;
			--accent-red: #ff6b6b;
			--accent-pink: #f472b6;
			--accent-purple: #a78bfa;
			--accent-blue: #60a5fa;
			--accent-cyan: #22d3ee;
			--accent-green: #34d399;
			--border: #333366;
			--radius: 12px;
		}
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body { 
			font-family: 'Inter', -apple-system, sans-serif; 
			background: var(--bg-primary); 
			color: var(--text-primary);
			line-height: 1.6;
		}
		code, .mono { font-family: 'JetBrains Mono', monospace; }
		
		/* Header */
		.header {
			background: linear-gradient(135deg, #dc2626 0%%, #991b1b 100%%);
			padding: 48px 40px;
			position: relative;
			overflow: hidden;
		}
		.header::before {
			content: '';
			position: absolute;
			top: -50%%; right: -20%%;
			width: 60%%; height: 200%%;
			background: radial-gradient(circle, rgba(255,255,255,0.1) 0%%, transparent 70%%);
		}
		.header-inner { max-width: 1400px; margin: 0 auto; position: relative; }
		.error-code { 
			font-size: 72px; font-weight: 700; 
			background: linear-gradient(135deg, #fff 0%%, rgba(255,255,255,0.7) 100%%);
			-webkit-background-clip: text; -webkit-text-fill-color: transparent;
			margin-bottom: 8px;
		}
		.error-type { 
			font-size: 14px; font-weight: 500;
			background: rgba(0,0,0,0.2); 
			display: inline-block; padding: 6px 14px; 
			border-radius: 20px; margin-bottom: 16px;
			font-family: 'JetBrains Mono', monospace;
		}
		.error-msg { font-size: 28px; font-weight: 500; max-width: 800px; }
		
		/* Toolbar */
		.toolbar {
			background: var(--bg-secondary);
			border-bottom: 1px solid var(--border);
			padding: 16px 40px;
			display: flex; align-items: center; gap: 16px;
		}
		.toolbar-inner { max-width: 1400px; margin: 0 auto; width: 100%%; display: flex; align-items: center; gap: 16px; }
		.file-loc {
			flex: 1;
			background: var(--bg-tertiary);
			padding: 12px 20px;
			border-radius: var(--radius);
			font-family: 'JetBrains Mono', monospace;
			font-size: 14px;
		}
		.file-loc .file { color: var(--accent-cyan); }
		.file-loc .line { color: var(--accent-pink); }
		.btn {
			background: var(--bg-tertiary);
			border: 1px solid var(--border);
			color: var(--text-primary);
			padding: 12px 20px;
			border-radius: var(--radius);
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			display: flex; align-items: center; gap: 8px;
			transition: all 0.2s;
		}
		.btn:hover { background: var(--accent-purple); border-color: var(--accent-purple); }
		.btn svg { width: 18px; height: 18px; }
		.btn-success { background: var(--accent-green); border-color: var(--accent-green); color: #000; }
		
		/* Main Content */
		.main { max-width: 1400px; margin: 0 auto; padding: 32px 40px; }
		
		/* Tabs */
		.tabs { display: flex; gap: 4px; margin-bottom: 24px; }
		.tab {
			padding: 12px 24px;
			background: transparent;
			border: none;
			color: var(--text-secondary);
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			border-radius: var(--radius) var(--radius) 0 0;
			transition: all 0.2s;
		}
		.tab:hover { color: var(--text-primary); }
		.tab.active { 
			background: var(--bg-secondary); 
			color: var(--accent-purple);
		}
		
		/* Panels */
		.panel { display: none; }
		.panel.active { display: block; }
		
		/* Card */
		.card {
			background: var(--bg-secondary);
			border-radius: var(--radius);
			overflow: hidden;
			margin-bottom: 24px;
		}
		.card-header {
			background: var(--bg-tertiary);
			padding: 16px 24px;
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 1px;
			color: var(--text-secondary);
			display: flex; align-items: center; gap: 10px;
		}
		.card-header svg { width: 16px; height: 16px; opacity: 0.7; }
		.card-body { padding: 0; }
		
		/* Stack Trace */
		.stack-frame {
			display: flex;
			padding: 16px 24px;
			border-bottom: 1px solid var(--border);
			cursor: pointer;
			transition: background 0.2s;
		}
		.stack-frame:hover { background: var(--bg-tertiary); }
		.stack-frame.active { 
			background: linear-gradient(90deg, var(--bg-tertiary) 0%%, var(--bg-secondary) 100%%);
			border-left: 3px solid var(--accent-purple);
		}
		.stack-frame:last-child { border-bottom: none; }
		.frame-num { 
			width: 40px; 
			color: var(--text-muted); 
			font-family: 'JetBrains Mono', monospace;
			font-size: 12px;
		}
		.frame-func { 
			color: var(--accent-pink); 
			font-family: 'JetBrains Mono', monospace;
			font-size: 14px;
			margin-bottom: 4px;
		}
		.frame-loc { 
			color: var(--text-muted); 
			font-size: 13px;
			font-family: 'JetBrains Mono', monospace;
		}
		.frame-loc .line-num { color: var(--accent-blue); }
		
		/* Table */
		table { width: 100%%; border-collapse: collapse; }
		tr { border-bottom: 1px solid var(--border); }
		tr:last-child { border-bottom: none; }
		td { padding: 14px 24px; font-size: 14px; }
		td.key { 
			color: var(--accent-cyan); 
			font-family: 'JetBrains Mono', monospace;
			width: 280px;
			font-weight: 500;
		}
		td.val { 
			color: var(--text-secondary);
			font-family: 'JetBrains Mono', monospace;
			word-break: break-all;
		}
		td.empty { color: var(--text-muted); font-style: italic; }
		
		/* Footer */
		.footer {
			text-align: center;
			padding: 40px;
			color: var(--text-muted);
			font-size: 13px;
		}
		.footer a { color: var(--accent-purple); text-decoration: none; }
		.footer .logo { 
			font-size: 24px; font-weight: 700; 
			background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
			-webkit-background-clip: text; -webkit-text-fill-color: transparent;
			margin-bottom: 8px;
		}
		
		/* Toast */
		.toast {
			position: fixed;
			bottom: 32px;
			right: 32px;
			background: var(--accent-green);
			color: #000;
			padding: 16px 24px;
			border-radius: var(--radius);
			font-weight: 500;
			display: none;
			animation: slideIn 0.3s ease;
		}
		@keyframes slideIn {
			from { transform: translateY(20px); opacity: 0; }
			to { transform: translateY(0); opacity: 1; }
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="header-inner">
			<div class="error-code">%d</div>
			<div class="error-type">%s</div>
			<div class="error-msg">%s</div>
		</div>
	</div>
	
	<div class="toolbar">
		<div class="toolbar-inner">
			<div class="file-loc">
				<span class="file">%s</span><span class="line">:%d</span>
			</div>
			<button class="btn" onclick="copyMarkdown()">
				<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
				Copy as Markdown
			</button>
		</div>
	</div>
	
	<div class="main">
		<div class="tabs">
			<button class="tab active" onclick="showPanel('stack')">Stack Trace</button>
			<button class="tab" onclick="showPanel('request')">Request</button>
			<button class="tab" onclick="showPanel('headers')">Headers</button>
			<button class="tab" onclick="showPanel('env')">Environment</button>
		</div>
		
		<div id="panel-stack" class="panel active">
			<div class="card">
				<div class="card-header">
					<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
					Stack Trace
				</div>
				<div class="card-body">%s</div>
			</div>
		</div>
		
		<div id="panel-request" class="panel">
			<div class="card">
				<div class="card-header">
					<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
					Request Details
				</div>
				<div class="card-body">
					<table>
						<tr><td class="key">Method</td><td class="val">%s</td></tr>
						<tr><td class="key">URL</td><td class="val">%s</td></tr>
					</table>
				</div>
			</div>
			<div class="card">
				<div class="card-header">Query Parameters</div>
				<div class="card-body"><table>%s</table></div>
			</div>
		</div>
		
		<div id="panel-headers" class="panel">
			<div class="card">
				<div class="card-header">
					<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
					Request Headers
				</div>
				<div class="card-body"><table>%s</table></div>
			</div>
		</div>
		
		<div id="panel-env" class="panel">
			<div class="card">
				<div class="card-header">
					<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
					Environment
				</div>
				<div class="card-body"><table>%s</table></div>
			</div>
		</div>
	</div>
	
	<div class="footer">
		<div class="logo">Eogo</div>
		<div>Framework Debug Mode • <a href="https://github.com/kest-labs/kest/api" target="_blank">Documentation</a></div>
	</div>
	
	<div id="toast" class="toast">✓ Copied to clipboard!</div>
	
	<script>
		var markdown = "# " + %d + " %s\n\n" +
			"**Error:** %s\n\n" +
			"**File:** %s:%d\n\n" +
			"## Stack Trace\n%s\n" +
			"## Request\n" +
			"- **Method:** %s\n" +
			"- **URL:** %s\n\n" +
			"## Environment\n" +
			"- **Go Version:** %s\n" +
			"- **OS:** %s\n" +
			"- **Arch:** %s\n";
		
		function showPanel(name) {
			document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
			document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
			document.getElementById('panel-' + name).classList.add('active');
			event.target.classList.add('active');
		}
		
		function selectFrame(el) {
			document.querySelectorAll('.stack-frame').forEach(function(f) { f.classList.remove('active'); });
			el.classList.add('active');
		}
		
		function copyMarkdown() {
			navigator.clipboard.writeText(markdown).then(function() {
				var btn = event.target.closest('.btn');
				btn.classList.add('btn-success');
				btn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Copied!';
				var toast = document.getElementById('toast');
				toast.style.display = 'block';
				setTimeout(function() {
					toast.style.display = 'none';
					btn.classList.remove('btn-success');
					btn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Copy as Markdown';
				}, 2000);
			});
		}
	</script>
</body>
</html>`,
		data.Status, data.Title,
		data.Status, data.Code, data.Message,
		data.File, data.Line,
		stackHTML,
		data.Request.Method, data.Request.URL, queryHTML,
		headersHTML,
		envHTML,
		// Markdown template values
		data.Status, data.Code, data.Message, data.File, data.Line,
		markdownStack,
		data.Request.Method, data.Request.URL,
		data.Environment["Go Version"], data.Environment["OS"], data.Environment["Arch"],
	)
}

// DebugHandler returns a handler that renders HTML debug pages
func DebugHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			err := toAppError(c.Errors.Last().Err)

			// Check if client wants JSON
			accept := c.GetHeader("Accept")
			if strings.Contains(accept, "application/json") {
				return // Let the normal handler deal with it
			}

			RenderDebugPage(c, err)
			c.Abort()
		}
	}
}

// PrettyJSON returns indented JSON for debugging
func PrettyJSON(v interface{}) string {
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}
