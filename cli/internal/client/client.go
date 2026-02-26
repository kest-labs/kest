package client

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

var (
	infoStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#888888"))
)

type RequestOptions struct {
	Method  string
	URL     string
	Headers map[string]string
	Body    []byte
	Timeout time.Duration
	Stream  bool
}

type Response struct {
	Status   int
	Headers  http.Header
	Body     []byte
	Duration time.Duration
}

// sharedTransport is a reusable transport that maintains a connection pool
// across all requests, significantly improving performance in parallel/sequential flows.
var sharedTransport = &http.Transport{
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 10,
	IdleConnTimeout:     90 * time.Second,
}

func Execute(opt RequestOptions) (*Response, error) {
	client := &http.Client{
		Timeout:   opt.Timeout,
		Transport: sharedTransport,
	}

	req, err := http.NewRequest(opt.Method, opt.URL, bytes.NewBuffer(opt.Body))
	if err != nil {
		return nil, err
	}

	for k, v := range opt.Headers {
		req.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := client.Do(req)
	duration := time.Since(start)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if opt.Stream {
		return handleStream(resp, duration)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return &Response{
		Status:   resp.StatusCode,
		Headers:  resp.Header,
		Body:     body,
		Duration: duration,
	}, nil
}

func handleStream(resp *http.Response, duration time.Duration) (*Response, error) {
	fmt.Println(infoStyle.Render("● Streaming response started..."))
	reader := bufio.NewReader(resp.Body)
	var fullBody bytes.Buffer

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}

		cleanLine := strings.TrimSpace(line)
		if cleanLine != "" {
			fmt.Printf("  %s %s\n", infoStyle.Render("┃"), cleanLine)
			fullBody.WriteString(line)
		}
	}
	fmt.Println(infoStyle.Render("● Stream finished."))

	return &Response{
		Status:   resp.StatusCode,
		Headers:  resp.Header,
		Body:     fullBody.Bytes(),
		Duration: duration,
	}, nil
}
