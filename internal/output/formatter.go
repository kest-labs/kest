package output

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FAFAFA")).
			Background(lipgloss.Color("#7D56F4")).
			Padding(0, 1)

	statusOKStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#00FF00")).
			Bold(true)

	statusErrStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FF0000")).
			Bold(true)

	borderStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#7D56F4")).
			Padding(1)

	infoStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#888888"))
)

func PrintResponse(method, url string, status int, duration string, body []byte, recordID int64, startTime time.Time) {
	statusStr := fmt.Sprintf("%d", status)
	var sStyle lipgloss.Style
	if status >= 200 && status < 300 {
		sStyle = statusOKStyle
	} else {
		sStyle = statusErrStyle
	}

	timestamp := ""
	if !startTime.IsZero() {
		timestamp = infoStyle.Render("[" + startTime.Format("15:04:05") + "] ")
	}

	headerText := fmt.Sprintf(" %s %s ", method, url)
	statusText := sStyle.Render(statusStr)
	durationText := infoStyle.Render(duration)

	// Constrain width to terminal width or 100 characters
	maxWidth := 100

	var formattedBody string
	var obj interface{}
	if err := json.Unmarshal(body, &obj); err == nil {
		if prettyBody, err := json.MarshalIndent(obj, "", "  "); err == nil {
			formattedBody = string(prettyBody)
		} else {
			formattedBody = string(body)
		}
	} else {
		// If it's a stream (starts with data:), don't try to pretty print as single JSON
		formattedBody = string(body)
	}

	// Truncate or wrap long lines if not JSON
	lines := strings.Split(formattedBody, "\n")
	for i, line := range lines {
		if len(line) > maxWidth-4 {
			lines[i] = line[:maxWidth-7] + "..."
		}
	}
	formattedBody = strings.Join(lines, "\n")

	content := fmt.Sprintf("Status: %s    Duration: %s\n\n%s", statusText, durationText, strings.TrimSpace(formattedBody))

	doc := strings.Builder{}
	doc.WriteString(timestamp + titleStyle.Render(headerText) + "\n")

	// Apply width constraint to the box and handle wrapping
	styledContent := borderStyle.Width(maxWidth).Render(content)
	doc.WriteString(styledContent + "\n")

	if recordID > 0 {
		doc.WriteString(fmt.Sprintf(" ✓ Recorded as #%d\n", recordID))
	}

	fmt.Println(doc.String())
}
