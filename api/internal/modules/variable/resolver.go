package variable

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

var variablePattern = regexp.MustCompile(`\{\{([^}]+)\}\}`)

type Resolver interface {
	Resolve(value string, vars Variables) string
	ResolveAll(vars Variables) map[string]string
}

type Variables map[string]string

type resolver struct{}

func New() Resolver {
	return &resolver{}
}

func (r *resolver) Resolve(value string, vars Variables) string {
	if value == "" || len(vars) == 0 {
		return value
	}

	return variablePattern.ReplaceAllStringFunc(value, func(match string) string {
		key := strings.Trim(match, "{}")
		if val, ok := vars[key]; ok {
			return val
		}
		return match
	})
}

func (r *resolver) ResolveAll(vars Variables) map[string]string {
	result := make(map[string]string)
	for k, v := range vars {
		result[k] = v
	}
	return result
}

type ResolvedRequest struct {
	URL         string
	Headers     map[string]string
	QueryParams map[string]string
	PathParams  map[string]string
	Body        string
}

func ResolveRequest(
	url string,
	headers []KeyValue,
	queryParams []KeyValue,
	pathParams map[string]string,
	body string,
	vars Variables,
) *ResolvedRequest {
	resolver := New()

	result := &ResolvedRequest{
		Headers:     make(map[string]string),
		QueryParams: make(map[string]string),
	}

	result.URL = resolver.Resolve(url, vars)

	for _, h := range headers {
		if h.Enabled {
			key := resolver.Resolve(h.Key, vars)
			value := resolver.Resolve(h.Value, vars)
			result.Headers[key] = value
		}
	}

	for _, q := range queryParams {
		if q.Enabled {
			key := resolver.Resolve(q.Key, vars)
			value := resolver.Resolve(q.Value, vars)
			result.QueryParams[key] = value
		}
	}

	for k, v := range pathParams {
		result.PathParams[k] = resolver.Resolve(v, vars)
	}

	result.Body = resolver.Resolve(body, vars)

	return result
}

type KeyValue struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

func ParseEnvironmentVariables(varsJSON string) (Variables, error) {
	if varsJSON == "" {
		return make(Variables), nil
	}

	var vars map[string]interface{}
	if err := json.Unmarshal([]byte(varsJSON), &vars); err != nil {
		return nil, err
	}

	result := make(Variables)
	for k, v := range vars {
		switch val := v.(type) {
		case string:
			result[k] = val
		case float64:
			result[k] = strings.TrimRight(strings.TrimRight(fmt.Sprintf("%f", val), "0"), ".")
		case bool:
			result[k] = fmt.Sprintf("%t", val)
		default:
			result[k] = fmt.Sprintf("%v", val)
		}
	}

	return result, nil
}
