package report

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/kest-labs/kest/cli/internal/summary"
)

type RecordHTMLOptions struct {
	OutputPath string
}

type RunHTMLOptions struct {
	OutputPath string
	SourcePath string
	LogPath    string
}

type metricView struct {
	Label string
	Value string
}

type navItemView struct {
	AnchorID    string
	Label       string
	StatusText  string
	StatusClass string
}

type codeSectionView struct {
	ID           string
	Title        string
	Content      string
	EmptyMessage string
	Open         bool
}

type headerRowView struct {
	Name  string
	Value string
}

type headerTableView struct {
	ID           string
	Title        string
	Rows         []headerRowView
	EmptyMessage string
	Open         bool
}

type recordPageView struct {
	PageTitle       string
	HeaderTitle     string
	HeaderSubtitle  string
	GeneratedAt     string
	Method          string
	MethodClass     string
	URL             string
	StatusText      string
	StatusClass     string
	Duration        string
	Metrics         []metricView
	QueryParams     codeSectionView
	RequestHeaders  headerTableView
	RequestBody     codeSectionView
	ResponseHeaders headerTableView
	ResponseBody    codeSectionView
}

type runResultView struct {
	AnchorID        string
	Name            string
	Method          string
	MethodClass     string
	URL             string
	StatusText      string
	StatusClass     string
	Duration        string
	StartedAt       string
	Error           string
	RecordID        int64
	IncludedFrom    string
	CommandSection  codeSectionView
	RequestHeaders  headerTableView
	RequestBody     codeSectionView
	ResponseHeaders headerTableView
	ResponseBody    codeSectionView
}

type runPageView struct {
	PageTitle      string
	HeaderTitle    string
	HeaderSubtitle string
	GeneratedAt    string
	Metrics        []metricView
	LogPath        string
	Navigation     []navItemView
	Results        []runResultView
}

var slugPattern = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

func WriteRecordHTML(record *storage.Record, opts RecordHTMLOptions) (string, error) {
	if record == nil {
		return "", fmt.Errorf("record is required")
	}

	outputPath, err := resolveOutputPath(opts.OutputPath, defaultRecordFilename(record))
	if err != nil {
		return "", err
	}

	view := buildRecordPageView(record, time.Now())
	if err := renderPage(outputPath, view, recordPageBodyTemplate); err != nil {
		return "", err
	}

	return outputPath, nil
}

func WriteRunHTML(summ *summary.Summary, opts RunHTMLOptions) (string, error) {
	if summ == nil {
		return "", fmt.Errorf("summary is required")
	}

	outputPath, err := resolveOutputPath(opts.OutputPath, defaultRunFilename(opts.SourcePath))
	if err != nil {
		return "", err
	}

	view := buildRunPageView(summ, opts, time.Now())
	if err := renderPage(outputPath, view, runPageBodyTemplate); err != nil {
		return "", err
	}

	return outputPath, nil
}

func buildRecordPageView(record *storage.Record, generatedAt time.Time) recordPageView {
	method := strings.TrimSpace(record.Method)
	querySection := codeSectionView{
		ID:           fmt.Sprintf("record-%d-query", record.ID),
		Title:        "Query Parameters",
		Content:      formatJSONLikeBytes(record.QueryParams),
		EmptyMessage: "No query parameters were recorded.",
		Open:         false,
	}

	return recordPageView{
		PageTitle:      fmt.Sprintf("Kest Record #%d", record.ID),
		HeaderTitle:    fmt.Sprintf("Record #%d", record.ID),
		HeaderSubtitle: fmt.Sprintf("%s %s", method, record.URL),
		GeneratedAt:    formatTimestamp(generatedAt),
		Method:         method,
		MethodClass:    methodClass(method),
		URL:            record.URL,
		StatusText:     fmt.Sprintf("%d", record.ResponseStatus),
		StatusClass:    statusClass(record.ResponseStatus, record.ResponseStatus < 400, method),
		Duration:       formatMilliseconds(record.DurationMs),
		Metrics: []metricView{
			{Label: "Recorded At", Value: formatTimestamp(record.CreatedAt)},
			{Label: "Environment", Value: fallback(record.Environment, "default")},
			{Label: "Project", Value: fallback(record.Project, "global")},
		},
		QueryParams: querySection,
		RequestHeaders: headerTableView{
			ID:           fmt.Sprintf("record-%d-request-headers", record.ID),
			Title:        "Request Headers",
			Rows:         flattenStringHeaders(record.RequestHeaders),
			EmptyMessage: "No request headers were recorded.",
			Open:         false,
		},
		RequestBody: codeSectionView{
			ID:           fmt.Sprintf("record-%d-request-body", record.ID),
			Title:        "Request Body",
			Content:      formatJSONLikeString(record.RequestBody),
			EmptyMessage: "This request did not include a body.",
			Open:         true,
		},
		ResponseHeaders: headerTableView{
			ID:           fmt.Sprintf("record-%d-response-headers", record.ID),
			Title:        "Response Headers",
			Rows:         flattenListHeaders(record.ResponseHeaders),
			EmptyMessage: "No response headers were recorded.",
			Open:         false,
		},
		ResponseBody: codeSectionView{
			ID:           fmt.Sprintf("record-%d-response-body", record.ID),
			Title:        "Response Body",
			Content:      formatJSONLikeString(record.ResponseBody),
			EmptyMessage: "This response did not include a body.",
			Open:         true,
		},
	}
}

func buildRunPageView(summ *summary.Summary, opts RunHTMLOptions, generatedAt time.Time) runPageView {
	slowest, p95 := latencyStats(summ.Results)
	metrics := []metricView{
		{Label: "Total Steps", Value: fmt.Sprintf("%d", summ.TotalTests)},
		{Label: "Passed", Value: fmt.Sprintf("%d", summ.PassedTests)},
		{Label: "Failed", Value: fmt.Sprintf("%d", summ.FailedTests)},
		{Label: "Total Time", Value: summ.TotalTime.Round(time.Millisecond).String()},
	}
	if slowest > 0 {
		metrics = append(metrics, metricView{Label: "Slowest", Value: slowest.Round(time.Millisecond).String()})
	}
	if p95 > 0 {
		metrics = append(metrics, metricView{Label: "P95", Value: p95.Round(time.Millisecond).String()})
	}

	results := make([]runResultView, 0, len(summ.Results))
	navigation := make([]navItemView, 0, len(summ.Results))
	for index, result := range summ.Results {
		anchorID := fmt.Sprintf("result-%d", index+1)
		statusText := runStatusText(result)
		statusTone := statusClass(result.Status, result.Success, result.Method)
		results = append(results, runResultView{
			AnchorID:     anchorID,
			Name:         fallback(result.Name, fmt.Sprintf("Step %d", index+1)),
			Method:       fallback(result.Method, "STEP"),
			MethodClass:  methodClass(result.Method),
			URL:          result.URL,
			StatusText:   statusText,
			StatusClass:  statusTone,
			Duration:     formatDuration(result.Duration),
			StartedAt:    formatTimestamp(result.StartTime),
			Error:        errorString(result.Error),
			RecordID:     result.RecordID,
			IncludedFrom: result.IncludedFrom,
			CommandSection: codeSectionView{
				ID:           fmt.Sprintf("%s-command", anchorID),
				Title:        "Command",
				Content:      strings.TrimSpace(result.Command),
				EmptyMessage: "This step did not execute a shell command.",
				Open:         true,
			},
			RequestHeaders: headerTableView{
				ID:           fmt.Sprintf("%s-request-headers", anchorID),
				Title:        "Request Headers",
				Rows:         flattenHeaderMap(result.RequestHeaders),
				EmptyMessage: "No request headers were captured for this step.",
				Open:         false,
			},
			RequestBody: codeSectionView{
				ID:           fmt.Sprintf("%s-request-body", anchorID),
				Title:        "Request Body",
				Content:      formatJSONLikeString(result.RequestBody),
				EmptyMessage: "This step did not send a request body.",
				Open:         false,
			},
			ResponseHeaders: headerTableView{
				ID:           fmt.Sprintf("%s-response-headers", anchorID),
				Title:        "Response Headers",
				Rows:         flattenHeaderLists(result.ResponseHeaders),
				EmptyMessage: "No response headers were captured for this step.",
				Open:         false,
			},
			ResponseBody: codeSectionView{
				ID:           fmt.Sprintf("%s-response-body", anchorID),
				Title:        "Response Body",
				Content:      formatJSONLikeString(result.ResponseBody),
				EmptyMessage: "This step did not return any body output.",
				Open:         !result.Success,
			},
		})
		navigation = append(navigation, navItemView{
			AnchorID:    anchorID,
			Label:       fallback(result.Name, fmt.Sprintf("Step %d", index+1)),
			StatusText:  statusText,
			StatusClass: statusTone,
		})
	}

	sourcePath := strings.TrimSpace(opts.SourcePath)
	if sourcePath == "" {
		sourcePath = "Kest CLI run"
	}

	return runPageView{
		PageTitle:      fmt.Sprintf("Kest Run Report - %s", filepath.Base(sourcePath)),
		HeaderTitle:    filepath.Base(sourcePath),
		HeaderSubtitle: sourcePath,
		GeneratedAt:    formatTimestamp(generatedAt),
		Metrics:        metrics,
		LogPath:        strings.TrimSpace(opts.LogPath),
		Navigation:     navigation,
		Results:        results,
	}
}

func renderPage(outputPath string, data any, bodyTemplate string) error {
	tmpl, err := template.New("page").Parse(basePageTemplate)
	if err != nil {
		return err
	}
	tmpl, err = tmpl.Parse(sharedPartialTemplates)
	if err != nil {
		return err
	}
	tmpl, err = tmpl.Parse(bodyTemplate)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	return tmpl.Execute(file, data)
}

func resolveOutputPath(outputPath, defaultFileName string) (string, error) {
	if strings.TrimSpace(outputPath) != "" {
		absPath, err := filepath.Abs(outputPath)
		if err != nil {
			return "", err
		}
		return absPath, nil
	}

	reportDir, err := defaultReportDir()
	if err != nil {
		return "", err
	}

	absPath, err := filepath.Abs(filepath.Join(reportDir, defaultFileName))
	if err != nil {
		return "", err
	}
	return absPath, nil
}

func defaultReportDir() (string, error) {
	conf, err := config.LoadConfig()
	if err == nil && conf != nil && conf.ProjectPath != "" {
		return filepath.Join(conf.ProjectPath, ".kest", "reports"), nil
	}

	home, homeErr := os.UserHomeDir()
	if homeErr != nil {
		if err != nil {
			return "", err
		}
		return "", homeErr
	}
	return filepath.Join(home, ".kest", "reports"), nil
}

func defaultRecordFilename(record *storage.Record) string {
	timestamp := time.Now().Format("20060102-150405")
	return fmt.Sprintf("record-%d-%s.html", record.ID, timestamp)
}

func defaultRunFilename(sourcePath string) string {
	base := filepath.Base(strings.TrimSpace(sourcePath))
	if base == "." || base == string(filepath.Separator) || base == "" {
		base = "kest-run"
	}
	base = strings.TrimSuffix(base, filepath.Ext(base))
	base = sanitizeSlug(base)
	timestamp := time.Now().Format("20060102-150405")
	return fmt.Sprintf("run-%s-%s.html", base, timestamp)
}

func sanitizeSlug(value string) string {
	normalized := slugPattern.ReplaceAllString(strings.TrimSpace(value), "-")
	normalized = strings.Trim(normalized, "-_.")
	if normalized == "" {
		return "report"
	}
	return strings.ToLower(normalized)
}

func flattenStringHeaders(raw json.RawMessage) []headerRowView {
	if len(raw) == 0 {
		return nil
	}

	var headers map[string]string
	if err := json.Unmarshal(raw, &headers); err != nil {
		return []headerRowView{{Name: "raw", Value: string(raw)}}
	}
	return flattenHeaderMap(headers)
}

func flattenListHeaders(raw json.RawMessage) []headerRowView {
	if len(raw) == 0 {
		return nil
	}

	var headers map[string][]string
	if err := json.Unmarshal(raw, &headers); err != nil {
		return []headerRowView{{Name: "raw", Value: string(raw)}}
	}
	return flattenHeaderLists(headers)
}

func flattenHeaderMap(headers map[string]string) []headerRowView {
	if len(headers) == 0 {
		return nil
	}

	keys := make([]string, 0, len(headers))
	for key := range headers {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	rows := make([]headerRowView, 0, len(keys))
	for _, key := range keys {
		rows = append(rows, headerRowView{Name: key, Value: headers[key]})
	}
	return rows
}

func flattenHeaderLists(headers map[string][]string) []headerRowView {
	if len(headers) == 0 {
		return nil
	}

	keys := make([]string, 0, len(headers))
	for key := range headers {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	rows := make([]headerRowView, 0, len(keys))
	for _, key := range keys {
		rows = append(rows, headerRowView{Name: key, Value: strings.Join(headers[key], ", ")})
	}
	return rows
}

func formatJSONLikeBytes(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	return formatJSONLikeString(string(raw))
}

func formatJSONLikeString(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	var pretty bytes.Buffer
	if json.Valid([]byte(trimmed)) {
		if err := json.Indent(&pretty, []byte(trimmed), "", "  "); err == nil {
			return pretty.String()
		}
	}

	return trimmed
}

func formatTimestamp(value time.Time) string {
	if value.IsZero() {
		return "n/a"
	}
	return value.Format("2006-01-02 15:04:05 MST")
}

func formatDuration(value time.Duration) string {
	if value <= 0 {
		return "0s"
	}
	return value.Round(time.Millisecond).String()
}

func formatMilliseconds(value int64) string {
	if value <= 0 {
		return "0ms"
	}
	return fmt.Sprintf("%dms", value)
}

func fallback(value, fallbackValue string) string {
	if strings.TrimSpace(value) == "" {
		return fallbackValue
	}
	return value
}

func runStatusText(result summary.TestResult) string {
	if strings.EqualFold(result.Method, "EXEC") {
		if result.Success {
			return "Completed"
		}
		return "Failed"
	}
	if result.Status > 0 {
		return fmt.Sprintf("%d", result.Status)
	}
	if result.Success {
		return "Passed"
	}
	return "Failed"
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return strings.TrimSpace(err.Error())
}

func latencyStats(results []summary.TestResult) (time.Duration, time.Duration) {
	if len(results) == 0 {
		return 0, 0
	}

	values := make([]time.Duration, 0, len(results))
	var slowest time.Duration
	for _, result := range results {
		values = append(values, result.Duration)
		if result.Duration > slowest {
			slowest = result.Duration
		}
	}

	sort.Slice(values, func(i, j int) bool { return values[i] < values[j] })
	index := int(float64(len(values)-1) * 0.95)
	if index < 0 {
		index = 0
	}
	if index >= len(values) {
		index = len(values) - 1
	}

	return slowest, values[index]
}

func methodClass(method string) string {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case "GET":
		return "badge badge-method-get"
	case "POST":
		return "badge badge-method-post"
	case "PUT":
		return "badge badge-method-put"
	case "PATCH":
		return "badge badge-method-patch"
	case "DELETE":
		return "badge badge-method-delete"
	case "EXEC":
		return "badge badge-method-exec"
	default:
		return "badge badge-method-default"
	}
}

func statusClass(status int, success bool, method string) string {
	if strings.EqualFold(method, "EXEC") {
		if success {
			return "badge badge-status-success"
		}
		return "badge badge-status-failure"
	}

	if success && status < 400 {
		return "badge badge-status-success"
	}
	if status >= 400 || !success {
		return "badge badge-status-failure"
	}
	return "badge badge-status-neutral"
}

const basePageTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{.PageTitle}}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5efe4;
      --panel: rgba(255, 252, 247, 0.92);
      --panel-strong: #fffdf9;
      --line: rgba(25, 36, 52, 0.12);
      --text: #1f2937;
      --muted: #5b6575;
      --accent: #0f766e;
      --accent-soft: rgba(15, 118, 110, 0.12);
      --success: #0f766e;
      --success-soft: rgba(15, 118, 110, 0.12);
      --warning: #b45309;
      --warning-soft: rgba(180, 83, 9, 0.12);
      --danger: #b91c1c;
      --danger-soft: rgba(185, 28, 28, 0.12);
      --shadow: 0 20px 60px rgba(53, 63, 82, 0.12);
      --radius: 22px;
      --mono: "IBM Plex Mono", "SFMono-Regular", "Menlo", "Consolas", monospace;
      --sans: "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(15, 118, 110, 0.16), transparent 34%),
        radial-gradient(circle at top right, rgba(180, 83, 9, 0.12), transparent 28%),
        linear-gradient(180deg, #f7f2e8 0%, #f1eadc 100%);
    }
    a { color: inherit; }
    .shell {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px 64px;
    }
    .hero {
      display: grid;
      gap: 18px;
      margin-bottom: 24px;
      padding: 24px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: calc(var(--radius) + 6px);
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }
    .eyebrow {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
    }
    h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3.1rem);
      line-height: 1.03;
      letter-spacing: -0.04em;
    }
    .subtitle {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 0.98rem;
      word-break: break-word;
    }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .hero-meta .badge {
      font-size: 0.88rem;
    }
    .generated-at {
      margin-left: auto;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin: 0 0 24px;
    }
    .metric {
      padding: 16px 18px;
      background: var(--panel-strong);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 10px 30px rgba(53, 63, 82, 0.08);
    }
    .metric-label {
      display: block;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .metric-value {
      display: block;
      font-size: 1.1rem;
      font-weight: 700;
      word-break: break-word;
    }
    .stack {
      display: grid;
      gap: 18px;
    }
    .card {
      padding: 20px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }
    .card-header {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .card-title {
      margin: 0;
      font-size: 1.12rem;
      letter-spacing: -0.02em;
    }
    .card-subtitle {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 0.92rem;
      word-break: break-word;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 0.88rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .badge-method-get { background: rgba(5, 150, 105, 0.12); color: #047857; border-color: rgba(5, 150, 105, 0.18); }
    .badge-method-post { background: rgba(14, 116, 144, 0.12); color: #0f766e; border-color: rgba(14, 116, 144, 0.18); }
    .badge-method-put { background: rgba(180, 83, 9, 0.12); color: #b45309; border-color: rgba(180, 83, 9, 0.18); }
    .badge-method-patch { background: rgba(67, 56, 202, 0.12); color: #4338ca; border-color: rgba(67, 56, 202, 0.18); }
    .badge-method-delete { background: rgba(185, 28, 28, 0.12); color: #b91c1c; border-color: rgba(185, 28, 28, 0.18); }
    .badge-method-exec { background: rgba(88, 28, 135, 0.12); color: #6b21a8; border-color: rgba(88, 28, 135, 0.18); }
    .badge-method-default { background: rgba(100, 116, 139, 0.12); color: #475569; border-color: rgba(100, 116, 139, 0.18); }
    .badge-status-success { background: var(--success-soft); color: var(--success); border-color: rgba(15, 118, 110, 0.2); }
    .badge-status-failure { background: var(--danger-soft); color: var(--danger); border-color: rgba(185, 28, 28, 0.2); }
    .badge-status-neutral { background: rgba(100, 116, 139, 0.12); color: #475569; border-color: rgba(100, 116, 139, 0.18); }
    .details {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.6);
      overflow: hidden;
    }
    .details + .details {
      margin-top: 14px;
    }
    .details summary {
      list-style: none;
      cursor: pointer;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-weight: 700;
    }
    .details summary::-webkit-details-marker { display: none; }
    .details summary span {
      color: var(--muted);
      font-size: 0.88rem;
      font-weight: 500;
    }
    .details-body {
      padding: 0 18px 18px;
    }
    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 10px;
    }
    .button {
      appearance: none;
      border: 1px solid var(--line);
      background: white;
      color: var(--text);
      border-radius: 999px;
      padding: 8px 12px;
      font: inherit;
      font-size: 0.86rem;
      cursor: pointer;
    }
    .button:hover { border-color: rgba(15, 118, 110, 0.3); color: var(--accent); }
    pre {
      margin: 0;
      padding: 16px;
      background: #1f2937;
      color: #f8fafc;
      border-radius: 16px;
      overflow: auto;
      line-height: 1.55;
      font-size: 0.88rem;
      font-family: var(--mono);
      white-space: pre-wrap;
      word-break: break-word;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.93rem;
    }
    th, td {
      text-align: left;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    th {
      width: 220px;
      color: var(--muted);
      font-weight: 600;
    }
    td code,
    .url {
      font-family: var(--mono);
      font-size: 0.9rem;
      word-break: break-word;
    }
    .nav-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }
    .nav-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: white;
      border: 1px solid var(--line);
      border-radius: 999px;
      text-decoration: none;
      color: inherit;
      font-size: 0.9rem;
    }
    .nav-item:hover {
      border-color: rgba(15, 118, 110, 0.28);
      color: var(--accent);
    }
    .result-grid {
      display: grid;
      gap: 18px;
    }
    .meta-line {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .result-card {
      scroll-margin-top: 24px;
    }
    .empty {
      color: var(--muted);
      font-style: italic;
    }
    @media (max-width: 720px) {
      .shell { padding: 20px 14px 40px; }
      .hero { padding: 18px; }
      .card { padding: 16px; }
      .generated-at { margin-left: 0; width: 100%; }
      th { width: 120px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Kest Local Report</p>
        <h1>{{.HeaderTitle}}</h1>
        <p class="subtitle">{{.HeaderSubtitle}}</p>
      </div>
      <div class="hero-meta">
        <span class="generated-at">Generated {{.GeneratedAt}}</span>
      </div>
    </header>
    {{template "body" .}}
  </div>
  <script>
    document.addEventListener('click', function(event) {
      const button = event.target.closest('[data-copy-target]');
      if (!button) return;
      const target = document.getElementById(button.getAttribute('data-copy-target'));
      if (!target) return;
      const text = target.textContent || '';
      navigator.clipboard.writeText(text).then(function() {
        const oldText = button.textContent;
        button.textContent = 'Copied';
        setTimeout(function() { button.textContent = oldText; }, 1200);
      });
    });
  </script>
</body>
</html>`

const sharedPartialTemplates = `
{{define "headerTable"}}
  <details class="details" {{if .Open}}open{{end}}>
    <summary>{{.Title}}<span>{{len .Rows}} row(s)</span></summary>
    <div class="details-body">
      {{if .Rows}}
        <table>
          <tbody>
            {{range .Rows}}
              <tr>
                <th>{{.Name}}</th>
                <td><code>{{.Value}}</code></td>
              </tr>
            {{end}}
          </tbody>
        </table>
      {{else}}
        <p class="empty">{{.EmptyMessage}}</p>
      {{end}}
    </div>
  </details>
{{end}}

{{define "codeSection"}}
  <details class="details" {{if .Open}}open{{end}}>
    <summary>{{.Title}}<span>{{if .Content}}Click to inspect{{else}}No content{{end}}</span></summary>
    <div class="details-body">
      {{if .Content}}
        <div class="toolbar">
          <button class="button" type="button" data-copy-target="{{.ID}}">Copy</button>
        </div>
        <pre id="{{.ID}}">{{.Content}}</pre>
      {{else}}
        <p class="empty">{{.EmptyMessage}}</p>
      {{end}}
    </div>
  </details>
{{end}}`

const recordPageBodyTemplate = `
{{define "body"}}
  <section class="metrics">
    <article class="metric">
      <span class="metric-label">Method</span>
      <span class="metric-value"><span class="{{.MethodClass}}">{{.Method}}</span></span>
    </article>
    <article class="metric">
      <span class="metric-label">Status</span>
      <span class="metric-value"><span class="{{.StatusClass}}">{{.StatusText}}</span></span>
    </article>
    <article class="metric">
      <span class="metric-label">Duration</span>
      <span class="metric-value">{{.Duration}}</span>
    </article>
    <article class="metric">
      <span class="metric-label">URL</span>
      <span class="metric-value url">{{.URL}}</span>
    </article>
    {{range .Metrics}}
      <article class="metric">
        <span class="metric-label">{{.Label}}</span>
        <span class="metric-value">{{.Value}}</span>
      </article>
    {{end}}
  </section>

  <section class="stack">
    <article class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">Request</h2>
          <p class="card-subtitle">Inspect exactly what was sent from Kest.</p>
        </div>
      </div>
      {{template "codeSection" .QueryParams}}
      {{template "headerTable" .RequestHeaders}}
      {{template "codeSection" .RequestBody}}
    </article>

    <article class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">Response</h2>
          <p class="card-subtitle">Long payloads are easier to read here than in the terminal.</p>
        </div>
      </div>
      {{template "headerTable" .ResponseHeaders}}
      {{template "codeSection" .ResponseBody}}
    </article>
  </section>
{{end}}`

const runPageBodyTemplate = `
{{define "body"}}
  <section class="metrics">
    {{range .Metrics}}
      <article class="metric">
        <span class="metric-label">{{.Label}}</span>
        <span class="metric-value">{{.Value}}</span>
      </article>
    {{end}}
  </section>

  {{if .LogPath}}
    <section class="card" style="margin-bottom: 18px;">
      <div class="card-header">
        <div>
          <h2 class="card-title">Session Log</h2>
          <p class="card-subtitle">Use this path when you need the raw terminal session for debugging.</p>
        </div>
      </div>
      <pre id="session-log-path">{{.LogPath}}</pre>
    </section>
  {{end}}

  {{if .Navigation}}
    <section class="card" style="margin-bottom: 18px;">
      <div class="card-header">
        <div>
          <h2 class="card-title">Step Index</h2>
          <p class="card-subtitle">Jump straight to a failed or noisy step.</p>
        </div>
      </div>
      <div class="nav-list">
        {{range .Navigation}}
          <a class="nav-item" href="#{{.AnchorID}}">
            <span>{{.Label}}</span>
            <span class="{{.StatusClass}}">{{.StatusText}}</span>
          </a>
        {{end}}
      </div>
    </section>
  {{end}}

  <section class="result-grid">
    {{range .Results}}
      <article class="card result-card" id="{{.AnchorID}}">
        <div class="card-header">
          <div>
            <h2 class="card-title">{{.Name}}</h2>
            {{if .URL}}
              <p class="card-subtitle">{{.URL}}</p>
            {{else if .CommandSection.Content}}
              <p class="card-subtitle">Exec step output</p>
            {{end}}
          </div>
          <div class="hero-meta">
            <span class="{{.MethodClass}}">{{.Method}}</span>
            <span class="{{.StatusClass}}">{{.StatusText}}</span>
          </div>
        </div>
        <p class="meta-line">
          <span>Started {{.StartedAt}}</span>
          <span>Duration {{.Duration}}</span>
          {{if gt .RecordID 0}}<span>Recorded as #{{.RecordID}}</span>{{end}}
          {{if .IncludedFrom}}<span>Included from {{.IncludedFrom}}</span>{{end}}
        </p>
        {{if .Error}}
          <div class="card" style="margin-top: 14px; padding: 14px 16px; border-radius: 18px; background: rgba(185, 28, 28, 0.08); border-color: rgba(185, 28, 28, 0.15); box-shadow: none;">
            <strong style="display: block; margin-bottom: 6px; color: #991b1b;">Failure Reason</strong>
            <span>{{.Error}}</span>
          </div>
        {{end}}
        {{if .CommandSection.Content}}
          <div style="margin-top: 14px;">{{template "codeSection" .CommandSection}}</div>
        {{end}}
        <div style="margin-top: 14px;">
          {{template "headerTable" .RequestHeaders}}
          {{template "codeSection" .RequestBody}}
          {{template "headerTable" .ResponseHeaders}}
          {{template "codeSection" .ResponseBody}}
        </div>
      </article>
    {{end}}
  </section>
{{end}}`
