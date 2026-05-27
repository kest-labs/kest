package apispec

import (
	"testing"

	"github.com/kest-labs/kest/api/internal/modules/importer"
)

func TestImportMarkdownAIDraftBuildsStructuredDraftsFromParsedMarkdown(t *testing.T) {
	svc := &service{}

	result, err := svc.ImportMarkdownAIDraft(nil, &importer.MarkdownParseResult{
		Title:        "Authentication & Users API",
		BaseURL:      "http://localhost:8025/v1",
		BasePath:     "/v1",
		SourceFormat: "numbered-endpoint-document",
		Modules: []importer.MarkdownParseModule{
			{
				Name: "Authentication & Users",
				Endpoints: []importer.MarkdownParseEndpoint{
					{
						Name:        "Register a new user account",
						Description: "Register a new user account.",
						Method:      "POST",
						Path:        "/register",
						AuthText:    "Not required",
						Headers: []importer.MarkdownParseKeyValue{
							{Key: "Content-Type", Value: "application/json", Enabled: true},
						},
						Body: `{"username":"john","password":"secret"}`,
						RequestBodyFields: []importer.MarkdownParseBodyField{
							{Name: "username", Type: "string", Required: true, Description: "Unique username"},
							{Name: "password", Type: "string", Required: true, Description: "User password"},
							{Name: "nickname", Type: "string", Required: false, Description: "Display name"},
						},
					},
					{
						Name:        "Get user details by ID",
						Description: "Get user details by ID.",
						Method:      "GET",
						Path:        "/users/:id",
						AuthText:    "Required (Admin)",
						PathParameterDefinitions: []importer.MarkdownParseParameter{
							{Name: "id", Type: "integer", Required: true, Description: "User ID"},
						},
						QueryParameterDefinitions: []importer.MarkdownParseParameter{
							{Name: "verbose", Type: "boolean", Required: false, DefaultValue: "true", Description: "Include more details"},
						},
					},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("expected import preview to succeed, got %v", err)
	}

	if result.EndpointCount != 2 || result.DraftCount != 2 {
		t.Fatalf("expected 2 endpoints and drafts, got %+v", result)
	}

	register := result.Drafts[0]
	if register.AuthType != "public" {
		t.Fatalf("expected public auth type, got %q", register.AuthType)
	}
	if register.Draft.RequestBody == nil {
		t.Fatal("expected request body schema to be built from markdown table")
	}
	properties := register.Draft.RequestBody.Schema["properties"].(map[string]interface{})
	if _, ok := properties["username"]; !ok {
		t.Fatalf("expected username field in schema, got %#v", register.Draft.RequestBody.Schema)
	}
	if register.FieldInsights["request_body"].Source != "observed" {
		t.Fatalf("expected request_body to be observed, got %#v", register.FieldInsights["request_body"])
	}

	getUser := result.Drafts[1]
	if getUser.AuthType != "bearer-admin" {
		t.Fatalf("expected admin auth type, got %q", getUser.AuthType)
	}
	if getUser.Draft.Version != "v1" {
		t.Fatalf("expected inferred default version v1, got %q", getUser.Draft.Version)
	}
	if len(getUser.Draft.Parameters) != 2 {
		t.Fatalf("expected path and query parameters, got %#v", getUser.Draft.Parameters)
	}
	if getUser.Draft.Parameters[0].In != "path" || getUser.Draft.Parameters[0].Schema["type"] != "integer" {
		t.Fatalf("expected path parameter type to be preserved, got %#v", getUser.Draft.Parameters[0])
	}
}
