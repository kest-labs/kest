package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is a fluent HTTP client for making external requests.
type Client struct {
	baseURL     string
	timeout     time.Duration
	headers     map[string]string
	queryParams url.Values
	retries     int
	retryDelay  time.Duration
	httpClient  *http.Client
}

// Response wraps an HTTP response with convenience methods
type Response struct {
	*http.Response
	body []byte
}

// New creates a new HTTP client
func New() *Client {
	return &Client{
		timeout:     30 * time.Second,
		headers:     make(map[string]string),
		queryParams: make(url.Values),
		retries:     0,
		retryDelay:  100 * time.Millisecond,
		httpClient:  &http.Client{},
	}
}

// BaseURL sets the base URL for all requests
func (c *Client) BaseURL(url string) *Client {
	c.baseURL = strings.TrimRight(url, "/")
	return c
}

// Timeout sets the request timeout
func (c *Client) Timeout(d time.Duration) *Client {
	c.timeout = d
	return c
}

// WithHeader adds a header to the request
func (c *Client) WithHeader(key, value string) *Client {
	c.headers[key] = value
	return c
}

// WithHeaders adds multiple headers to the request
func (c *Client) WithHeaders(headers map[string]string) *Client {
	for k, v := range headers {
		c.headers[k] = v
	}
	return c
}

// WithToken adds a Bearer token to the request
func (c *Client) WithToken(token string) *Client {
	c.headers["Authorization"] = "Bearer " + token
	return c
}

// WithHTTPClient sets the underlying *http.Client (e.g. SharedOutboundClient
// for user-supplied URLs). The client is never mutated by this builder.
func (c *Client) WithHTTPClient(hc *http.Client) *Client {
	if hc != nil {
		c.httpClient = hc
	}
	return c
}

// WithBasicAuth adds Basic authentication
func (c *Client) WithBasicAuth(username, password string) *Client {
	// Copy the client so a shared *http.Client is never mutated, and keep its
	// transport (which may enforce outbound restrictions).
	base := c.httpClient.Transport
	if base == nil {
		base = http.DefaultTransport
	}
	hc := *c.httpClient
	hc.Transport = &basicAuthTransport{
		username: username,
		password: password,
		base:     base,
	}
	c.httpClient = &hc
	return c
}

// WithQuery adds query parameters
func (c *Client) WithQuery(params map[string]string) *Client {
	for k, v := range params {
		c.queryParams.Set(k, v)
	}
	return c
}

// Retry sets retry configuration
func (c *Client) Retry(times int, delay time.Duration) *Client {
	c.retries = times
	c.retryDelay = delay
	return c
}

// AcceptJSON sets Accept header to application/json
func (c *Client) AcceptJSON() *Client {
	c.headers["Accept"] = "application/json"
	return c
}

// ContentType sets the Content-Type header
func (c *Client) ContentType(contentType string) *Client {
	c.headers["Content-Type"] = contentType
	return c
}

// AsJSON sets Content-Type to application/json
func (c *Client) AsJSON() *Client {
	c.headers["Content-Type"] = "application/json"
	return c
}

// AsForm sets Content-Type to application/x-www-form-urlencoded
func (c *Client) AsForm() *Client {
	c.headers["Content-Type"] = "application/x-www-form-urlencoded"
	return c
}

// Get sends a GET request
func (c *Client) Get(path string) (*Response, error) {
	return c.request(context.Background(), http.MethodGet, path, nil)
}

// GetContext sends a GET request with context
func (c *Client) GetContext(ctx context.Context, path string) (*Response, error) {
	return c.request(ctx, http.MethodGet, path, nil)
}

// Post sends a POST request with JSON body
func (c *Client) Post(path string, body interface{}) (*Response, error) {
	return c.request(context.Background(), http.MethodPost, path, body)
}

// PostContext sends a POST request with context
func (c *Client) PostContext(ctx context.Context, path string, body interface{}) (*Response, error) {
	return c.request(ctx, http.MethodPost, path, body)
}

// Put sends a PUT request
func (c *Client) Put(path string, body interface{}) (*Response, error) {
	return c.request(context.Background(), http.MethodPut, path, body)
}

// PutContext sends a PUT request with context
func (c *Client) PutContext(ctx context.Context, path string, body interface{}) (*Response, error) {
	return c.request(ctx, http.MethodPut, path, body)
}

// Patch sends a PATCH request
func (c *Client) Patch(path string, body interface{}) (*Response, error) {
	return c.request(context.Background(), http.MethodPatch, path, body)
}

// PatchContext sends a PATCH request with context
func (c *Client) PatchContext(ctx context.Context, path string, body interface{}) (*Response, error) {
	return c.request(ctx, http.MethodPatch, path, body)
}

// Delete sends a DELETE request
func (c *Client) Delete(path string) (*Response, error) {
	return c.request(context.Background(), http.MethodDelete, path, nil)
}

// DeleteContext sends a DELETE request with context
func (c *Client) DeleteContext(ctx context.Context, path string) (*Response, error) {
	return c.request(ctx, http.MethodDelete, path, nil)
}

// PostForm sends a POST request with form data
func (c *Client) PostForm(path string, data map[string]string) (*Response, error) {
	formData := url.Values{}
	for k, v := range data {
		formData.Set(k, v)
	}
	c.AsForm()
	return c.requestRaw(context.Background(), http.MethodPost, path, strings.NewReader(formData.Encode()))
}

// request performs the HTTP request with optional body
func (c *Client) request(ctx context.Context, method, path string, body interface{}) (*Response, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
		if c.headers["Content-Type"] == "" {
			c.headers["Content-Type"] = "application/json"
		}
	}
	return c.requestRaw(ctx, method, path, bodyReader)
}

// requestRaw performs the HTTP request with raw body
func (c *Client) requestRaw(ctx context.Context, method, path string, body io.Reader) (*Response, error) {
	// Build URL
	fullURL := path
	if c.baseURL != "" && !strings.HasPrefix(path, "http") {
		fullURL = c.baseURL + "/" + strings.TrimLeft(path, "/")
	}

	// Add query parameters
	if len(c.queryParams) > 0 {
		if strings.Contains(fullURL, "?") {
			fullURL += "&" + c.queryParams.Encode()
		} else {
			fullURL += "?" + c.queryParams.Encode()
		}
	}

	// Create request
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	var resp *Response
	var lastErr error

	attempts := c.retries + 1
	for i := 0; i < attempts; i++ {
		if i > 0 {
			time.Sleep(c.retryDelay)
		}

		req, err := http.NewRequestWithContext(ctx, method, fullURL, body)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		// Set headers
		for k, v := range c.headers {
			req.Header.Set(k, v)
		}

		// Execute request
		httpResp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		// Read body
		respBody, err := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		resp = &Response{
			Response: httpResp,
			body:     respBody,
		}

		// Don't retry on success or client errors
		if httpResp.StatusCode < 500 {
			break
		}
		lastErr = fmt.Errorf("server error: %d", httpResp.StatusCode)
	}

	if resp == nil && lastErr != nil {
		return nil, lastErr
	}

	return resp, nil
}

// Response methods

// Body returns the response body as bytes
func (r *Response) Body() []byte {
	return r.body
}

// String returns the response body as string
func (r *Response) String() string {
	return string(r.body)
}

// JSON unmarshals the response body into the provided interface
func (r *Response) JSON(v interface{}) error {
	return json.Unmarshal(r.body, v)
}

// Ok returns true if the status code is 2xx
func (r *Response) Ok() bool {
	return r.StatusCode >= 200 && r.StatusCode < 300
}

// Successful returns true if the status code is 2xx (alias for Ok)
func (r *Response) Successful() bool {
	return r.Ok()
}

// Failed returns true if the status code is not 2xx
func (r *Response) Failed() bool {
	return !r.Ok()
}

// IsClientError returns true if the status code is 4xx
func (r *Response) IsClientError() bool {
	return r.StatusCode >= 400 && r.StatusCode < 500
}

// IsServerError returns true if the status code is 5xx
func (r *Response) IsServerError() bool {
	return r.StatusCode >= 500
}

// IsUnauthorized returns true if the status code is 401
func (r *Response) IsUnauthorized() bool {
	return r.StatusCode == 401
}

// IsForbidden returns true if the status code is 403
func (r *Response) IsForbidden() bool {
	return r.StatusCode == 403
}

// IsNotFound returns true if the status code is 404
func (r *Response) IsNotFound() bool {
	return r.StatusCode == 404
}

// basicAuthTransport adds basic auth to requests
type basicAuthTransport struct {
	username string
	password string
	base     http.RoundTripper
}

func (t *basicAuthTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.SetBasicAuth(t.username, t.password)
	return t.base.RoundTrip(req)
}

// Package-level convenience functions

// Get sends a GET request to the URL
func Get(url string) (*Response, error) {
	return New().Get(url)
}

// Post sends a POST request with JSON body
func Post(url string, body interface{}) (*Response, error) {
	return New().Post(url, body)
}

// Put sends a PUT request with JSON body
func Put(url string, body interface{}) (*Response, error) {
	return New().Put(url, body)
}

// Delete sends a DELETE request
func Delete(url string) (*Response, error) {
	return New().Delete(url)
}
