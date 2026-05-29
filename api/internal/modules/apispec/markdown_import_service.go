package apispec

import (
	"context"
	"encoding/json"
	"sort"
	"strings"

	"github.com/kest-labs/kest/api/internal/modules/importer"
)

func (s *service) ImportMarkdownAIDraft(_ context.Context, parsed *importer.MarkdownParseResult) (*ImportMarkdownAIDraftResponse, error) {
	if parsed == nil || len(parsed.Modules) == 0 {
		return nil, ErrInvalidSpecData
	}

	result := &ImportMarkdownAIDraftResponse{
		DocumentTitle: parsed.Title,
		BaseURL:       parsed.BaseURL,
		BasePath:      parsed.BasePath,
		SourceFormat:  parsed.SourceFormat,
		Drafts:        make([]ImportMarkdownAIDraftItem, 0),
	}

	for _, module := range parsed.Modules {
		for _, endpoint := range module.Endpoints {
			item := buildMarkdownDraftItem(module.Name, endpoint)
			result.Drafts = append(result.Drafts, item)
			result.EndpointCount++
		}
	}

	result.DraftCount = len(result.Drafts)
	if result.DraftCount == 0 {
		return nil, ErrInvalidSpecData
	}

	return result, nil
}

func buildMarkdownDraftItem(moduleName string, endpoint importer.MarkdownParseEndpoint) ImportMarkdownAIDraftItem {
	fieldInsights := map[string]APISpecAIDraftFieldInsight{
		"method": {Source: "observed", Confidence: 1},
		"path":   {Source: "observed", Confidence: 1},
	}
	observedFields := []string{"method", "path"}
	inferredFields := []string{}
	warnings := []string{}

	authType := deriveMarkdownAuthType(endpoint.AuthText, endpoint.Headers)
	if authType != "" {
		fieldInsights["auth_type"] = APISpecAIDraftFieldInsight{Source: "observed", Confidence: 0.95}
		observedFields = append(observedFields, "auth_type")
	}

	parameters := make([]ParameterSpec, 0)
	parameters = append(parameters, convertMarkdownParameters(endpoint.PathParameterDefinitions, "path", fieldInsights, &observedFields)...)
	parameters = append(parameters, convertMarkdownParameters(endpoint.QueryParameterDefinitions, "query", fieldInsights, &observedFields)...)
	parameters = ensurePathParameters(endpoint.Path, parameters)
	if len(parameters) > 0 {
		fieldInsights["parameters"] = APISpecAIDraftFieldInsight{Source: "observed", Confidence: 0.95}
		observedFields = append(observedFields, "parameters")
	}

	requestBody, bodyObserved, bodyWarnings := convertMarkdownRequestBody(endpoint)
	if bodyObserved {
		fieldInsights["request_body"] = APISpecAIDraftFieldInsight{Source: "observed", Confidence: 0.95}
		observedFields = append(observedFields, "request_body")
	}
	if requestBody != nil && !bodyObserved {
		fieldInsights["request_body"] = APISpecAIDraftFieldInsight{Source: "inferred", Confidence: 0.7}
		inferredFields = append(inferredFields, "request_body")
	}
	warnings = append(warnings, bodyWarnings...)

	if strings.TrimSpace(endpoint.Description) != "" {
		fieldInsights["description"] = APISpecAIDraftFieldInsight{Source: "observed", Confidence: 0.9}
		observedFields = append(observedFields, "description")
	}
	if strings.TrimSpace(endpoint.Name) != "" {
		fieldInsights["summary"] = APISpecAIDraftFieldInsight{Source: "observed", Confidence: 0.95}
		observedFields = append(observedFields, "summary")
	}

	version, versionSource := inferVersionFromPath(endpoint.Path)
	if versionSource == "observed" {
		fieldInsights["version"] = APISpecAIDraftFieldInsight{Source: "observed", Confidence: 0.95}
		observedFields = append(observedFields, "version")
	} else {
		fieldInsights["version"] = APISpecAIDraftFieldInsight{Source: "inferred", Confidence: 0.7}
		inferredFields = append(inferredFields, "version")
	}

	tags := deriveMarkdownTags(moduleName, endpoint.Path)
	if len(tags) > 0 {
		fieldInsights["tags"] = APISpecAIDraftFieldInsight{Source: "inferred", Confidence: 0.7}
		inferredFields = append(inferredFields, "tags")
	}

	observedFields = uniqueStrings(observedFields)
	inferredFields = uniqueStrings(inferredFields)
	warnings = uniqueStrings(warnings)

	draft := APISpecAIDraftSpec{
		Method:      strings.ToUpper(strings.TrimSpace(endpoint.Method)),
		Path:        strings.TrimSpace(endpoint.Path),
		Summary:     strings.TrimSpace(endpoint.Name),
		Description: strings.TrimSpace(endpoint.Description),
		Tags:        tags,
		RequestBody: requestBody,
		Parameters:  parameters,
		Responses:   defaultResponsesForMethod(endpoint.Method),
		Version:     version,
		IsPublic:    authType == "public",
	}

	return ImportMarkdownAIDraftItem{
		ModuleName:         moduleName,
		AuthType:           authType,
		Confidence:         calculateMarkdownDraftConfidence(fieldInsights, warnings),
		Warnings:           warnings,
		ObservedFields:     observedFields,
		InferredFields:     inferredFields,
		ExampleRequestBody: strings.TrimSpace(endpoint.Body),
		Draft:              draft,
		FieldInsights:      fieldInsights,
	}
}

func convertMarkdownParameters(
	definitions []importer.MarkdownParseParameter,
	location string,
	fieldInsights map[string]APISpecAIDraftFieldInsight,
	observedFields *[]string,
) []ParameterSpec {
	if len(definitions) == 0 {
		return nil
	}

	result := make([]ParameterSpec, 0, len(definitions))
	for _, definition := range definitions {
		result = append(result, ParameterSpec{
			Name:        strings.TrimSpace(definition.Name),
			In:          location,
			Description: strings.TrimSpace(definition.Description),
			Required:    definition.Required,
			Schema:      markdownTypeSchema(definition.Type),
			Example:     markdownParameterExample(definition),
		})
	}

	return result
}

func convertMarkdownRequestBody(endpoint importer.MarkdownParseEndpoint) (*RequestBodySpec, bool, []string) {
	if len(endpoint.RequestBodyFields) > 0 {
		properties := make(map[string]interface{}, len(endpoint.RequestBodyFields))
		required := make([]string, 0)
		for _, field := range endpoint.RequestBodyFields {
			property := markdownTypeSchema(field.Type)
			if description := strings.TrimSpace(field.Description); description != "" {
				property["description"] = description
			}
			if example := markdownBodyFieldExample(field); example != nil {
				property["example"] = example
			}
			properties[field.Name] = property
			if field.Required {
				required = append(required, field.Name)
			}
		}

		schema := map[string]interface{}{
			"type":       "object",
			"properties": properties,
		}
		if len(required) > 0 {
			sort.Strings(required)
			schema["required"] = required
		}

		return &RequestBodySpec{
			Required:    len(required) > 0,
			ContentType: markdownContentType(endpoint),
			Schema:      schema,
		}, true, nil
	}

	if strings.TrimSpace(endpoint.Body) == "" {
		return nil, false, nil
	}

	var decoded interface{}
	if err := json.Unmarshal([]byte(endpoint.Body), &decoded); err != nil {
		return &RequestBodySpec{
			Required:    true,
			ContentType: markdownContentType(endpoint),
			Schema:      map[string]interface{}{"type": "string"},
		}, false, []string{"Request body example is not valid JSON; schema inferred as string."}
	}

	return &RequestBodySpec{
		Required:    true,
		ContentType: markdownContentType(endpoint),
		Schema:      inferJSONSchema(decoded),
	}, false, nil
}

func markdownContentType(endpoint importer.MarkdownParseEndpoint) string {
	for _, header := range endpoint.Headers {
		if !strings.EqualFold(strings.TrimSpace(header.Key), "Content-Type") {
			continue
		}
		if value := strings.TrimSpace(header.Value); value != "" {
			return value
		}
	}

	if strings.EqualFold(strings.TrimSpace(endpoint.BodyType), "json") {
		return "application/json"
	}

	if strings.TrimSpace(endpoint.Body) != "" {
		return "application/json"
	}

	return "application/json"
}

func markdownTypeSchema(typeName string) map[string]interface{} {
	normalized := strings.ToLower(strings.TrimSpace(typeName))
	switch {
	case normalized == "":
		return map[string]interface{}{"type": "string"}
	case strings.Contains(normalized, "bool"):
		return map[string]interface{}{"type": "boolean"}
	case strings.Contains(normalized, "float"), strings.Contains(normalized, "double"), strings.Contains(normalized, "decimal"), strings.Contains(normalized, "number"):
		return map[string]interface{}{"type": "number"}
	case strings.Contains(normalized, "int"), strings.Contains(normalized, "uint"):
		return map[string]interface{}{"type": "integer"}
	case strings.Contains(normalized, "array"), strings.Contains(normalized, "list"):
		return map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}}
	case strings.Contains(normalized, "object"), strings.Contains(normalized, "map"):
		return map[string]interface{}{"type": "object"}
	default:
		return map[string]interface{}{"type": "string"}
	}
}

func markdownParameterExample(definition importer.MarkdownParseParameter) interface{} {
	value := strings.TrimSpace(definition.DefaultValue)
	if value == "" {
		return nil
	}
	return coerceExampleValue(value, definition.Type)
}

func markdownBodyFieldExample(definition importer.MarkdownParseBodyField) interface{} {
	value := strings.TrimSpace(definition.DefaultValue)
	if value == "" {
		return nil
	}
	return coerceExampleValue(value, definition.Type)
}

func coerceExampleValue(value, typeName string) interface{} {
	normalizedType := strings.ToLower(strings.TrimSpace(typeName))
	normalizedValue := strings.ToLower(strings.TrimSpace(value))
	switch {
	case strings.Contains(normalizedType, "bool"):
		return normalizedValue == "true"
	case strings.Contains(normalizedType, "int"), strings.Contains(normalizedType, "uint"), strings.Contains(normalizedType, "number"):
		if normalizedValue == "" || normalizedValue == "example" {
			return 1
		}
		return 1
	default:
		return value
	}
}

func inferJSONSchema(value interface{}) map[string]interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		properties := make(map[string]interface{}, len(typed))
		required := make([]string, 0, len(typed))
		for key, child := range typed {
			properties[key] = inferJSONSchema(child)
			required = append(required, key)
		}
		sort.Strings(required)
		return map[string]interface{}{
			"type":       "object",
			"properties": properties,
			"required":   required,
		}
	case []interface{}:
		schema := map[string]interface{}{"type": "array"}
		if len(typed) > 0 {
			schema["items"] = inferJSONSchema(typed[0])
		} else {
			schema["items"] = map[string]interface{}{"type": "string"}
		}
		return schema
	case bool:
		return map[string]interface{}{"type": "boolean"}
	case float64:
		if typed == float64(int64(typed)) {
			return map[string]interface{}{"type": "integer"}
		}
		return map[string]interface{}{"type": "number"}
	case string:
		return map[string]interface{}{"type": "string"}
	case nil:
		return map[string]interface{}{"type": "null"}
	default:
		return map[string]interface{}{"type": "string"}
	}
}

func inferVersionFromPath(path string) (string, string) {
	for _, segment := range splitMarkdownImportPathSegments(path) {
		if len(segment) >= 2 && strings.HasPrefix(strings.ToLower(segment), "v") {
			return segment, "observed"
		}
	}
	return "v1", "inferred"
}

func deriveMarkdownTags(moduleName, path string) []string {
	tags := make([]string, 0, 2)
	if trimmed := strings.TrimSpace(moduleName); trimmed != "" {
		tags = append(tags, trimmed)
	}
	if derived := deriveTagFromPath(path); derived != "" {
		tags = append(tags, derived)
	}
	return normalizeDraftTags(tags)
}

func deriveMarkdownAuthType(authText string, headers []importer.MarkdownParseKeyValue) string {
	normalized := strings.ToLower(strings.TrimSpace(authText))
	switch {
	case normalized == "":
		for _, header := range headers {
			if strings.EqualFold(strings.TrimSpace(header.Key), "Authorization") {
				return "bearer"
			}
		}
		return ""
	case strings.Contains(normalized, "not required"), strings.Contains(normalized, "public"):
		return "public"
	case strings.Contains(normalized, "admin"):
		return "bearer-admin"
	case strings.Contains(normalized, "required"):
		return "bearer"
	default:
		return ""
	}
}

func calculateMarkdownDraftConfidence(insights map[string]APISpecAIDraftFieldInsight, warnings []string) float64 {
	if len(insights) == 0 {
		return 0.5
	}

	total := 0.0
	for _, insight := range insights {
		total += insight.Confidence
	}

	score := total / float64(len(insights))
	score -= float64(len(warnings)) * 0.08
	if score < 0.2 {
		return 0.2
	}
	if score > 0.99 {
		return 0.99
	}
	return score
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func splitMarkdownImportPathSegments(path string) []string {
	trimmed := strings.Trim(strings.TrimSpace(path), "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}
