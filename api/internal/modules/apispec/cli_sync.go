package apispec

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kest-labs/kest/api/internal/modules/project"
)

type CLISpecSyncInput struct {
	Source   string
	Metadata json.RawMessage
	Specs    []CLISpecSyncSpecInput
}

type CLISpecSyncSpecInput struct {
	Method      string
	Path        string
	Title       string
	Summary     string
	Description string
	Version     string
	RequestBody *CLISpecSyncRequestBodyInput
	Parameters  []CLISpecSyncParameterInput
	Responses   map[string]CLISpecSyncResponseInput
	Examples    []CLISpecSyncExampleInput
}

type CLISpecSyncRequestBodyInput struct {
	Description string
	Required    bool
	ContentType string
	Schema      map[string]interface{}
}

type CLISpecSyncParameterInput struct {
	Name        string
	In          string
	Description string
	Required    bool
	Schema      map[string]interface{}
	Example     interface{}
}

type CLISpecSyncResponseInput struct {
	Description string
	ContentType string
	Schema      map[string]interface{}
}

type CLISpecSyncExampleInput struct {
	Name           string
	RequestHeaders map[string]string
	RequestBody    string
	ResponseStatus int
	ResponseBody   string
	DurationMs     int64
}

type CLISpecSyncResult struct {
	Created int
	Updated int
	Skipped int
	Errors  []string
}

func (h *Handler) SyncSpecsFromCLI(ctx context.Context, projectID string, req *project.CLISpecSyncRequest) (*project.CLISpecSyncResponseBody, error) {
	input := &CLISpecSyncInput{
		Source:   req.Source,
		Metadata: req.Metadata,
		Specs:    make([]CLISpecSyncSpecInput, 0, len(req.Specs)),
	}

	for _, spec := range req.Specs {
		input.Specs = append(input.Specs, CLISpecSyncSpecInput{
			Method:      spec.Method,
			Path:        spec.Path,
			Title:       spec.Title,
			Summary:     spec.Summary,
			Description: spec.Description,
			Version:     spec.Version,
			RequestBody: toCLISyncRequestBodyInput(spec.RequestBody),
			Parameters:  toCLISyncParameterInputs(spec.Parameters),
			Responses:   toCLISyncResponseInputs(spec.Responses),
			Examples:    toCLISyncExampleInputs(spec.Examples),
		})
	}

	result, err := h.service.SyncSpecsFromCLI(ctx, projectID, input)
	if err != nil {
		return nil, err
	}

	return &project.CLISpecSyncResponseBody{
		Created: result.Created,
		Updated: result.Updated,
		Skipped: result.Skipped,
		Errors:  result.Errors,
	}, nil
}

func (s *service) SyncSpecsFromCLI(ctx context.Context, projectID string, req *CLISpecSyncInput) (*CLISpecSyncResult, error) {
	result := &CLISpecSyncResult{}

	for _, spec := range req.Specs {
		specReq := toCreateAPISpecRequest(projectID, spec)
		existing, err := s.repo.GetSpecByMethodAndPath(ctx, projectID, specReq.Method, specReq.Path)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s %s: %v", specReq.Method, specReq.Path, err))
			continue
		}

		var specID string
		switch {
		case existing == nil:
			po := ToAPISpecPO(specReq)
			if err := s.repo.CreateSpec(ctx, po); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("%s %s: %v", specReq.Method, specReq.Path, err))
				continue
			}
			specID = po.ID
			result.Created++
		default:
			changed := applyCLISpecUpdate(existing, specReq)
			specID = existing.ID
			if changed {
				if err := s.repo.UpdateSpec(ctx, existing); err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("%s %s: %v", specReq.Method, specReq.Path, err))
					continue
				}
				if err := s.syncShareSnapshot(ctx, existing); err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("%s %s: %v", specReq.Method, specReq.Path, err))
					continue
				}
			}
			createdExamples, err := s.syncCLIExamples(ctx, specID, spec.Method, spec.Path, spec.Examples)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("%s %s examples: %v", specReq.Method, specReq.Path, err))
				continue
			}
			if changed || createdExamples > 0 {
				result.Updated++
			} else {
				result.Skipped++
			}
			continue
		}

		if _, err := s.syncCLIExamples(ctx, specID, spec.Method, spec.Path, spec.Examples); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s %s examples: %v", specReq.Method, specReq.Path, err))
		}
	}

	return result, nil
}

func toCreateAPISpecRequest(projectID string, spec CLISpecSyncSpecInput) *CreateAPISpecRequest {
	req := &CreateAPISpecRequest{
		ProjectID:   projectID,
		Method:      strings.ToUpper(strings.TrimSpace(spec.Method)),
		Path:        strings.TrimSpace(spec.Path),
		Summary:     firstNonEmpty(strings.TrimSpace(spec.Summary), strings.TrimSpace(spec.Title)),
		Description: strings.TrimSpace(spec.Description),
		Version:     firstNonEmpty(strings.TrimSpace(spec.Version), "v1"),
		IsPublic:    boolPtr(false),
	}

	if spec.RequestBody != nil {
		req.RequestBody = &RequestBodySpec{
			Description: spec.RequestBody.Description,
			Required:    spec.RequestBody.Required,
			ContentType: spec.RequestBody.ContentType,
			Schema:      spec.RequestBody.Schema,
		}
	}

	if len(spec.Parameters) > 0 {
		req.Parameters = make([]ParameterSpec, 0, len(spec.Parameters))
		for _, parameter := range spec.Parameters {
			req.Parameters = append(req.Parameters, ParameterSpec(parameter))
		}
	}

	if len(spec.Responses) > 0 {
		req.Responses = make(map[string]ResponseSpec, len(spec.Responses))
		for code, response := range spec.Responses {
			req.Responses[code] = ResponseSpec(response)
		}
	}

	return req
}

func applyCLISpecUpdate(existing *APISpecPO, req *CreateAPISpecRequest) bool {
	incoming := ToAPISpecPO(req)
	changed := false

	if existing.Summary != incoming.Summary {
		existing.Summary = incoming.Summary
		changed = true
	}
	if existing.Description != incoming.Description {
		existing.Description = incoming.Description
		changed = true
	}
	if existing.RequestBody != incoming.RequestBody {
		existing.RequestBody = incoming.RequestBody
		changed = true
	}
	if existing.Parameters != incoming.Parameters {
		existing.Parameters = incoming.Parameters
		changed = true
	}
	if existing.Responses != incoming.Responses {
		existing.Responses = incoming.Responses
		changed = true
	}
	if existing.Version != incoming.Version {
		existing.Version = incoming.Version
		changed = true
	}

	return changed
}

func (s *service) syncCLIExamples(ctx context.Context, specID string, method, path string, examples []CLISpecSyncExampleInput) (int, error) {
	if len(examples) == 0 {
		return 0, nil
	}

	existingExamples, err := s.repo.GetExamplesBySpecID(ctx, specID)
	if err != nil {
		return 0, err
	}

	existingFingerprints := make(map[string]struct{}, len(existingExamples))
	for _, example := range existingExamples {
		existingFingerprints[cliExampleFingerprint(
			normalizeSerializedJSONField(example.RequestHeaders),
			normalizeSerializedJSONField(example.RequestBody),
			example.ResponseStatus,
			normalizeSerializedJSONField(example.ResponseBody),
		)] = struct{}{}
	}

	created := 0
	for _, example := range examples {
		sanitizedHeaders := sanitizeExampleHeaders(example.RequestHeaders)
		sanitizedRequestBody := sanitizeJSONString(example.RequestBody)
		sanitizedResponseBody := sanitizeJSONString(example.ResponseBody)
		fingerprint := cliExampleFingerprint(headersToJSON(sanitizedHeaders), sanitizedRequestBody, example.ResponseStatus, sanitizedResponseBody)
		if _, exists := existingFingerprints[fingerprint]; exists {
			continue
		}

		requestHeadersJSON := headersToJSON(sanitizedHeaders)
		po := &APIExamplePO{
			APISpecID:      specID,
			Name:           firstNonEmpty(strings.TrimSpace(example.Name), fmt.Sprintf("%s %s sample", strings.ToUpper(method), path)),
			Path:           path,
			Method:         strings.ToUpper(method),
			RequestHeaders: requestHeadersJSON,
			RequestBody:    sanitizedRequestBody,
			ResponseStatus: example.ResponseStatus,
			ResponseBody:   sanitizedResponseBody,
			DurationMs:     example.DurationMs,
		}

		if err := s.repo.CreateExample(ctx, po); err != nil {
			return created, err
		}

		existingFingerprints[fingerprint] = struct{}{}
		created++
	}

	return created, nil
}

func sanitizeExampleHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}

	sanitized := make(map[string]string, len(headers))
	for key, value := range headers {
		if isSensitiveHeader(key) {
			sanitized[key] = "[REDACTED]"
			continue
		}
		sanitized[key] = value
	}

	return sanitized
}

func isSensitiveHeader(key string) bool {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key", "api-key", "x-auth-token":
		return true
	default:
		return false
	}
}

func sanitizeJSONString(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	var decoded interface{}
	if err := json.Unmarshal([]byte(trimmed), &decoded); err != nil {
		return trimmed
	}

	sanitized := redactSensitiveJSON(decoded)
	encoded, err := json.Marshal(sanitized)
	if err != nil {
		return trimmed
	}

	return string(encoded)
}

func redactSensitiveJSON(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		for key, child := range typed {
			if isSensitiveField(key) {
				typed[key] = "[REDACTED]"
				continue
			}
			typed[key] = redactSensitiveJSON(child)
		}
		return typed
	case []interface{}:
		for i := range typed {
			typed[i] = redactSensitiveJSON(typed[i])
		}
		return typed
	default:
		return value
	}
}

func isSensitiveField(key string) bool {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "password", "pass", "secret", "token", "access_token", "refresh_token", "api_key", "apikey", "client_secret":
		return true
	default:
		return false
	}
}

func headersToJSON(headers map[string]string) string {
	if len(headers) == 0 {
		return ""
	}

	encoded, err := json.Marshal(headers)
	if err != nil {
		return ""
	}

	return string(encoded)
}

func normalizeSerializedJSONField(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || trimmed == "null" {
		return ""
	}
	return trimmed
}

func cliExampleFingerprint(requestHeaders, requestBody string, responseStatus int, responseBody string) string {
	return fmt.Sprintf("%s|%s|%d|%s", requestHeaders, requestBody, responseStatus, responseBody)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func boolPtr(v bool) *bool {
	return &v
}

func toCLISyncRequestBodyInput(input *project.CLISpecSyncRequestBody) *CLISpecSyncRequestBodyInput {
	if input == nil {
		return nil
	}

	return &CLISpecSyncRequestBodyInput{
		Description: input.Description,
		Required:    input.Required,
		ContentType: input.ContentType,
		Schema:      input.Schema,
	}
}

func toCLISyncParameterInputs(input []project.CLISpecSyncParameter) []CLISpecSyncParameterInput {
	if len(input) == 0 {
		return nil
	}

	output := make([]CLISpecSyncParameterInput, 0, len(input))
	for _, parameter := range input {
		output = append(output, CLISpecSyncParameterInput{
			Name:        parameter.Name,
			In:          parameter.In,
			Description: parameter.Description,
			Required:    parameter.Required,
			Schema:      parameter.Schema,
			Example:     parameter.Example,
		})
	}

	return output
}

func toCLISyncResponseInputs(input map[string]project.CLISpecSyncResponse) map[string]CLISpecSyncResponseInput {
	if len(input) == 0 {
		return nil
	}

	output := make(map[string]CLISpecSyncResponseInput, len(input))
	for code, response := range input {
		output[code] = CLISpecSyncResponseInput{
			Description: response.Description,
			ContentType: response.ContentType,
			Schema:      response.Schema,
		}
	}

	return output
}

func toCLISyncExampleInputs(input []project.CLISpecSyncExample) []CLISpecSyncExampleInput {
	if len(input) == 0 {
		return nil
	}

	output := make([]CLISpecSyncExampleInput, 0, len(input))
	for _, example := range input {
		output = append(output, CLISpecSyncExampleInput{
			Name:           example.Name,
			RequestHeaders: example.RequestHeaders,
			RequestBody:    example.RequestBody,
			ResponseStatus: example.ResponseStatus,
			ResponseBody:   example.ResponseBody,
			DurationMs:     example.DurationMs,
		})
	}

	return output
}
