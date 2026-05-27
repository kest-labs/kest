package apispec

type ImportMarkdownAIDraftResponse struct {
	DocumentTitle string                      `json:"document_title"`
	BaseURL       string                      `json:"base_url,omitempty"`
	BasePath      string                      `json:"base_path,omitempty"`
	SourceFormat  string                      `json:"source_format,omitempty"`
	EndpointCount int                         `json:"endpoint_count"`
	DraftCount    int                         `json:"draft_count"`
	Warnings      []string                    `json:"warnings,omitempty"`
	Drafts        []ImportMarkdownAIDraftItem `json:"drafts"`
}

type ImportMarkdownAIDraftItem struct {
	ModuleName         string                                `json:"module_name"`
	AuthType           string                                `json:"auth_type,omitempty"`
	Confidence         float64                               `json:"confidence"`
	Warnings           []string                              `json:"warnings,omitempty"`
	ObservedFields     []string                              `json:"observed_fields,omitempty"`
	InferredFields     []string                              `json:"inferred_fields,omitempty"`
	ExampleRequestBody string                                `json:"example_request_body,omitempty"`
	Draft              APISpecAIDraftSpec                    `json:"draft"`
	FieldInsights      map[string]APISpecAIDraftFieldInsight `json:"field_insights,omitempty"`
}
