package importer

import "github.com/kest-labs/kest/api/internal/modules/request"

type MarkdownParseResult struct {
	Title        string                `json:"title"`
	BaseURL      string                `json:"base_url,omitempty"`
	BasePath     string                `json:"base_path,omitempty"`
	SourceFormat string                `json:"source_format,omitempty"`
	Modules      []MarkdownParseModule `json:"modules"`
}

type MarkdownParseModule struct {
	Name      string                  `json:"name"`
	Endpoints []MarkdownParseEndpoint `json:"endpoints"`
}

type MarkdownParseEndpoint struct {
	Name                      string                   `json:"name"`
	Description               string                   `json:"description"`
	Method                    string                   `json:"method"`
	Path                      string                   `json:"path"`
	URL                       string                   `json:"url"`
	AuthText                  string                   `json:"auth_text,omitempty"`
	Headers                   []MarkdownParseKeyValue  `json:"headers,omitempty"`
	QueryParams               []MarkdownParseKeyValue  `json:"query_params,omitempty"`
	PathParams                map[string]string        `json:"path_params,omitempty"`
	Body                      string                   `json:"body,omitempty"`
	BodyType                  string                   `json:"body_type,omitempty"`
	PathParameterDefinitions  []MarkdownParseParameter `json:"path_parameter_definitions,omitempty"`
	QueryParameterDefinitions []MarkdownParseParameter `json:"query_parameter_definitions,omitempty"`
	RequestBodyFields         []MarkdownParseBodyField `json:"request_body_fields,omitempty"`
}

type MarkdownParseKeyValue struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type MarkdownParseParameter struct {
	Name         string `json:"name"`
	Type         string `json:"type,omitempty"`
	Description  string `json:"description,omitempty"`
	DefaultValue string `json:"default_value,omitempty"`
	Required     bool   `json:"required"`
}

type MarkdownParseBodyField struct {
	Name         string `json:"name"`
	Type         string `json:"type,omitempty"`
	Description  string `json:"description,omitempty"`
	DefaultValue string `json:"default_value,omitempty"`
	Required     bool   `json:"required"`
}

func toMarkdownParseResult(doc *markdownDocument) *MarkdownParseResult {
	if doc == nil {
		return nil
	}

	result := &MarkdownParseResult{
		Title:        doc.Title,
		BaseURL:      doc.BaseURL,
		BasePath:     doc.BasePath,
		SourceFormat: doc.SourceFormat,
		Modules:      make([]MarkdownParseModule, 0, len(doc.Modules)),
	}

	for _, module := range doc.Modules {
		parseModule := MarkdownParseModule{
			Name:      module.Name,
			Endpoints: make([]MarkdownParseEndpoint, 0, len(module.Endpoints)),
		}

		for _, endpoint := range module.Endpoints {
			parseModule.Endpoints = append(parseModule.Endpoints, MarkdownParseEndpoint{
				Name:                      endpoint.Name,
				Description:               endpoint.Description,
				Method:                    endpoint.Method,
				Path:                      endpoint.Path,
				URL:                       endpoint.URL,
				AuthText:                  endpoint.AuthText,
				Headers:                   toMarkdownParseKeyValues(endpoint.Headers),
				QueryParams:               toMarkdownParseKeyValues(endpoint.QueryParams),
				PathParams:                cloneStringMap(endpoint.PathParams),
				Body:                      endpoint.Body,
				BodyType:                  endpoint.BodyType,
				PathParameterDefinitions:  toMarkdownParseParameters(endpoint.PathParameterDefinitions),
				QueryParameterDefinitions: toMarkdownParseParameters(endpoint.QueryParameterDefinitions),
				RequestBodyFields:         toMarkdownParseBodyFields(endpoint.RequestBodyFields),
			})
		}

		result.Modules = append(result.Modules, parseModule)
	}

	return result
}

func toMarkdownParseKeyValues(values []request.KeyValue) []MarkdownParseKeyValue {
	if len(values) == 0 {
		return nil
	}

	result := make([]MarkdownParseKeyValue, 0, len(values))
	for _, value := range values {
		result = append(result, MarkdownParseKeyValue{
			Key:     value.Key,
			Value:   value.Value,
			Enabled: value.Enabled,
		})
	}

	return result
}

func toMarkdownParseParameters(values []markdownParameterDefinition) []MarkdownParseParameter {
	if len(values) == 0 {
		return nil
	}

	result := make([]MarkdownParseParameter, 0, len(values))
	for _, value := range values {
		result = append(result, MarkdownParseParameter{
			Name:         value.Name,
			Type:         value.Type,
			Description:  value.Description,
			DefaultValue: value.DefaultValue,
			Required:     value.Required,
		})
	}

	return result
}

func toMarkdownParseBodyFields(values []markdownBodyFieldDefinition) []MarkdownParseBodyField {
	if len(values) == 0 {
		return nil
	}

	result := make([]MarkdownParseBodyField, 0, len(values))
	for _, value := range values {
		result = append(result, MarkdownParseBodyField{
			Name:         value.Name,
			Type:         value.Type,
			Description:  value.Description,
			DefaultValue: value.DefaultValue,
			Required:     value.Required,
		})
	}

	return result
}

func cloneStringMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return nil
	}

	result := make(map[string]string, len(input))
	for key, value := range input {
		result[key] = value
	}

	return result
}
