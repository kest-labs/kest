package runner

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kest-labs/kest/api/internal/modules/request"
	"github.com/kest-labs/kest/api/internal/modules/variable"
)

type Runner interface {
	Run(req *request.Request, vars variable.Variables) (*Response, error)
}

type runner struct {
	client *http.Client
}

func New() Runner {
	return &runner{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type Response struct {
	Status     int               `json:"status"`
	StatusText string            `json:"status_text"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Time       int64             `json:"time"` // milliseconds
	Size       int               `json:"size"` // bytes
}

func (r *runner) Run(req *request.Request, vars variable.Variables) (*Response, error) {
	start := time.Now()

	// Convert request.KeyValue to variable.KeyValue
	headers := make([]variable.KeyValue, len(req.Headers))
	for i, h := range req.Headers {
		headers[i] = variable.KeyValue{Key: h.Key, Value: h.Value, Enabled: h.Enabled}
	}

	queryParams := make([]variable.KeyValue, len(req.QueryParams))
	for i, q := range req.QueryParams {
		queryParams[i] = variable.KeyValue{Key: q.Key, Value: q.Value, Enabled: q.Enabled}
	}

	resolved := variable.ResolveRequest(
		req.URL,
		headers,
		queryParams,
		req.PathParams,
		req.Body,
		vars,
	)

	fullURL := r.buildURL(resolved.URL, resolved.QueryParams)

	httpReq, err := http.NewRequest(req.Method, fullURL, bytes.NewBufferString(resolved.Body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	r.applyHeaders(httpReq, resolved.Headers)
	r.applyAuth(httpReq, req.Auth, vars)
	r.applyBodyType(httpReq, req.BodyType)

	resp, err := r.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	elapsed := time.Since(start).Milliseconds()

	response := &Response{
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		Headers:    r.flattenHeaders(resp.Header),
		Body:       string(body),
		Time:       elapsed,
		Size:       len(body),
	}

	return response, nil
}

func (r *runner) buildURL(baseURL string, queryParams map[string]string) string {
	if len(queryParams) == 0 {
		return baseURL
	}

	u, err := url.Parse(baseURL)
	if err != nil {
		return baseURL
	}

	q := u.Query()
	for k, v := range queryParams {
		q.Add(k, v)
	}
	u.RawQuery = q.Encode()

	return u.String()
}

func (r *runner) applyHeaders(httpReq *http.Request, headers map[string]string) {
	for k, v := range headers {
		httpReq.Header.Add(k, v)
	}
}

func (r *runner) applyAuth(httpReq *http.Request, auth *request.AuthConfig, vars variable.Variables) {
	if auth == nil {
		return
	}

	resolver := variable.New()

	switch auth.Type {
	case "basic":
		if auth.Basic != nil {
			username := resolver.Resolve(auth.Basic.Username, vars)
			password := resolver.Resolve(auth.Basic.Password, vars)
			httpReq.SetBasicAuth(username, password)
		}
	case "bearer":
		if auth.Bearer != nil {
			token := resolver.Resolve(auth.Bearer.Token, vars)
			httpReq.Header.Set("Authorization", "Bearer "+token)
		}
	case "api-key":
		if auth.APIKey != nil {
			key := resolver.Resolve(auth.APIKey.Key, vars)
			value := resolver.Resolve(auth.APIKey.Value, vars)
			in := auth.APIKey.In
			if in == "" {
				in = "header"
			}
			if in == "header" {
				httpReq.Header.Set(key, value)
			} else if in == "query" {
				q := httpReq.URL.Query()
				q.Add(key, value)
				httpReq.URL.RawQuery = q.Encode()
			}
		}
	}
}

func (r *runner) applyBodyType(httpReq *http.Request, bodyType string) {
	switch strings.ToLower(bodyType) {
	case "json":
		if httpReq.Header.Get("Content-Type") == "" {
			httpReq.Header.Set("Content-Type", "application/json")
		}
	case "xml":
		if httpReq.Header.Get("Content-Type") == "" {
			httpReq.Header.Set("Content-Type", "application/xml")
		}
	case "form-data":
		if httpReq.Header.Get("Content-Type") == "" {
			httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}
	case "text":
		if httpReq.Header.Get("Content-Type") == "" {
			httpReq.Header.Set("Content-Type", "text/plain")
		}
	}
}

func (r *runner) flattenHeaders(header http.Header) map[string]string {
	result := make(map[string]string)
	for k, v := range header {
		if len(v) > 0 {
			result[k] = v[0]
		}
	}
	return result
}

func ResponseToJSON(resp *Response) (string, error) {
	b, err := json.Marshal(resp)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
