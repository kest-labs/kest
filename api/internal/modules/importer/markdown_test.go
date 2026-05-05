package importer

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/kest-labs/kest/api/internal/modules/collection"
)

func TestImportMarkdownAggregateDocumentCreatesModuleCollectionsAndRequests(t *testing.T) {
	doc, err := parseMarkdownDocument("api.md", markdown(
		"# API 文档",
		"",
		"## 基础 URL",
		"",
		"| 环境 | URL |",
		"|------|-----|",
		"| 本地 | `http://localhost:8025/api/v1` |",
		"",
		"## 概览",
		"",
		"接口总数：**2**",
		"",
		`<a id="project"></a>`,
		"## Project",
		"",
		"| 方法 | 接口路径 | 说明 | 认证 |",
		"|------|----------|------|------|",
		"| `GET` | `/v1/projects/:id` | Get project details | 🔒 |",
		"",
		"### GET `/v1/projects/:id`",
		"",
		"**Get project details**",
		"",
		"| Property | Value |",
		"|----------|-------|",
		"| Auth | 🔒 JWT Required |",
		"",
		"#### Path Parameters",
		"",
		"| Parameter | Type | Description |",
		"|-----------|------|-------------|",
		"| `id` | `integer` | Resource identifier |",
		"",
		"#### Example",
		"",
		"```bash",
		"curl -X GET 'http://localhost:8025/api/v1/v1/projects/1' \\",
		"  -H 'Authorization: Bearer <token>'",
		"```",
		"",
		`<a id="apispec"></a>`,
		"## Apispec",
		"",
		"| 方法 | 接口路径 | 说明 | 认证 |",
		"|------|----------|------|------|",
		"| `POST` | `/v1/projects/:id/api-specs/batch-gen-doc` | Batch Gen Doc apispec | 🔒 |",
		"",
		"### POST `/v1/projects/:id/api-specs/batch-gen-doc`",
		"",
		"**Batch Gen Doc apispec**",
		"",
		"| Property | Value |",
		"|----------|-------|",
		"| Auth | 🔒 JWT Required |",
		"",
		"#### Request Body",
		"",
		"```json",
		`{"force": true}`,
		"```",
		"",
		"#### Path Parameters",
		"",
		"| Parameter | Type | Description |",
		"|-----------|------|-------------|",
		"| `id` | `integer` | Resource identifier |",
		"",
		"#### Example",
		"",
		"```bash",
		"curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/api-specs/batch-gen-doc' \\",
		"  -H 'Authorization: Bearer <token>' \\",
		"  -H 'Content-Type: application/json' \\",
		`  -d '{"force":true}'`,
		"```",
	))
	if err != nil {
		t.Fatalf("expected markdown to parse, got %v", err)
	}

	collectionService := &stubCollectionService{}
	requestService := &stubRequestService{}
	service := NewService(collectionService, requestService).(*service)

	parentID := "9"
	result, err := service.importMarkdownDocument(context.Background(), "7", parentID, doc)
	if err != nil {
		t.Fatalf("expected import to succeed, got %v", err)
	}

	if result.RootFolderName != "API 文档" {
		t.Fatalf("expected root folder name to match document title, got %q", result.RootFolderName)
	}
	if result.CollectionsCreated != 2 {
		t.Fatalf("expected 2 module collections, got %d", result.CollectionsCreated)
	}
	if result.RequestsCreated != 2 {
		t.Fatalf("expected 2 requests to be created, got %d", result.RequestsCreated)
	}
	if len(result.Modules) != 2 {
		t.Fatalf("expected 2 module results, got %d", len(result.Modules))
	}

	if len(collectionService.created) != 3 {
		t.Fatalf("expected root folder plus 2 module collections, got %d", len(collectionService.created))
	}

	rootFolder := collectionService.created[0]
	if !rootFolder.IsFolder {
		t.Fatal("expected first collection to be the root folder")
	}
	if rootFolder.ParentID == nil || *rootFolder.ParentID != parentID {
		t.Fatalf("expected root folder parent_id %s, got %#v", parentID, rootFolder.ParentID)
	}

	projectCollection := collectionService.created[1]
	if projectCollection.ParentID == nil || *projectCollection.ParentID != result.RootFolderID {
		t.Fatalf("expected module collection to be under root folder %s, got %#v", result.RootFolderID, projectCollection.ParentID)
	}

	if len(requestService.created) != 2 {
		t.Fatalf("expected 2 requests, got %d", len(requestService.created))
	}

	getProject := requestService.created[0]
	if getProject.URL != "{{base_url}}/projects/:id" {
		t.Fatalf("expected aggregate URL to be templated from base URL, got %q", getProject.URL)
	}
	if getProject.PathParams.(map[string]string)["id"] != "1" {
		t.Fatalf("expected path param id=1, got %#v", getProject.PathParams)
	}
	if len(getProject.Headers) != 1 || getProject.Headers[0].Enabled {
		t.Fatalf("expected disabled authorization header, got %#v", getProject.Headers)
	}

	postBatch := requestService.created[1]
	if postBatch.BodyType != "json" {
		t.Fatalf("expected request body type json, got %q", postBatch.BodyType)
	}
	if postBatch.Body != `{"force": true}` {
		t.Fatalf("expected request body to come from Request Body section, got %q", postBatch.Body)
	}
	if len(postBatch.Headers) != 2 {
		t.Fatalf("expected content-type and authorization headers, got %#v", postBatch.Headers)
	}
	if postBatch.Headers[0].Key != "Content-Type" || postBatch.Headers[0].Value != "application/json" || !postBatch.Headers[0].Enabled {
		t.Fatalf("expected enabled content-type header, got %#v", postBatch.Headers[0])
	}
	if postBatch.Headers[1].Key != "Authorization" || postBatch.Headers[1].Enabled {
		t.Fatalf("expected disabled authorization placeholder, got %#v", postBatch.Headers[1])
	}
}

func TestImportMarkdownSingleModuleDerivesURLAndQueryParamsFromCurlExample(t *testing.T) {
	doc, err := parseMarkdownDocument("apispec.md", markdown(
		"# Apispec API",
		"",
		"## Base URL",
		"",
		"See [API Documentation](./api.md) for environment-specific base URLs.",
		"",
		"## Endpoints",
		"",
		"| Method | Endpoint | Description | Auth |",
		"|--------|----------|-------------|------|",
		"| `GET` | `/v1/projects/:id/api-specs/export` | Export specs | 🔒 |",
		"",
		"## Details",
		"",
		"### GET `/v1/projects/:id/api-specs/export`",
		"",
		"**Export specs**",
		"",
		"| Property | Value |",
		"|----------|-------|",
		"| Auth | 🔒 JWT Required |",
		"",
		"#### Path Parameters",
		"",
		"| Parameter | Type | Description |",
		"|-----------|------|-------------|",
		"| `id` | `integer` | Resource identifier |",
		"",
		"#### Example",
		"",
		"```bash",
		"curl -X GET 'http://localhost:8025/api/v1/projects/7/api-specs/export?format=markdown' \\",
		"  -H 'Authorization: Bearer <token>'",
		"```",
	))
	if err != nil {
		t.Fatalf("expected markdown to parse, got %v", err)
	}

	if len(doc.Modules) != 1 {
		t.Fatalf("expected single module document, got %d modules", len(doc.Modules))
	}
	if doc.Modules[0].Name != "Apispec" {
		t.Fatalf("expected module name to be trimmed from title, got %q", doc.Modules[0].Name)
	}
	if len(doc.Modules[0].Endpoints) != 1 {
		t.Fatalf("expected one endpoint, got %d", len(doc.Modules[0].Endpoints))
	}

	endpoint := doc.Modules[0].Endpoints[0]
	if endpoint.URL != "{{base_url}}/v1/projects/:id/api-specs/export" {
		t.Fatalf("expected URL to preserve placeholder path under base_url template, got %q", endpoint.URL)
	}
	if endpoint.PathParams["id"] != "7" {
		t.Fatalf("expected path param id=7 from example URL, got %#v", endpoint.PathParams)
	}
	if len(endpoint.QueryParams) != 1 || endpoint.QueryParams[0].Key != "format" || endpoint.QueryParams[0].Value != "markdown" {
		t.Fatalf("expected query params to come from example URL, got %#v", endpoint.QueryParams)
	}
}

func TestParseMarkdownDocumentSupportsSingleEndpointDocumentationFormat(t *testing.T) {
	doc, err := parseMarkdownDocument("register.md", markdown(
		"# User Registration API Documentation",
		"",
		"## Base URLs",
		"",
		"| Environment | URL |",
		"|-------------|-----|",
		"| Local | `http://localhost:8025/api/v1` |",
		"",
		"## Overview",
		"",
		"Register a new user account in the Kest platform.",
		"",
		"## Endpoint",
		"",
		"```",
		"POST /v1/register",
		"```",
		"",
		"**Authentication**: Not required (Public endpoint)",
		"",
		"## Request",
		"",
		"### Headers",
		"",
		"```",
		"Content-Type: application/json",
		"```",
		"",
		"### Example Request",
		"",
		"```json",
		`{"username":"john_doe"}`,
		"```",
		"",
		"## Usage Examples",
		"",
		"### cURL",
		"",
		"```bash",
		"curl -X POST 'http://localhost:8025/api/v1/register' \\",
		"  -H 'Content-Type: application/json' \\",
		`  -d '{"username":"john_doe"}'`,
		"```",
	))
	if err != nil {
		t.Fatalf("expected single endpoint markdown to parse, got %v", err)
	}

	if doc.BaseURL != "http://localhost:8025/api/v1" {
		t.Fatalf("expected Base URLs heading to be parsed, got %q", doc.BaseURL)
	}
	if len(doc.Modules) != 1 {
		t.Fatalf("expected 1 module, got %d", len(doc.Modules))
	}
	if doc.Modules[0].Name != "User Registration" {
		t.Fatalf("expected module name User Registration, got %q", doc.Modules[0].Name)
	}
	if len(doc.Modules[0].Endpoints) != 1 {
		t.Fatalf("expected 1 endpoint, got %d", len(doc.Modules[0].Endpoints))
	}

	endpoint := doc.Modules[0].Endpoints[0]
	if endpoint.Name != "User Registration" {
		t.Fatalf("expected endpoint name User Registration, got %q", endpoint.Name)
	}
	if endpoint.Description != "Register a new user account in the Kest platform." {
		t.Fatalf("expected overview to become description, got %q", endpoint.Description)
	}
	if endpoint.URL != "{{base_url}}/register" {
		t.Fatalf("expected URL to be built from base_url template, got %q", endpoint.URL)
	}
	if endpoint.BodyType != "json" {
		t.Fatalf("expected body type json, got %q", endpoint.BodyType)
	}
	if endpoint.Body != `{"username":"john_doe"}` {
		t.Fatalf("expected request body from Example Request, got %q", endpoint.Body)
	}
	if len(endpoint.Headers) != 1 || endpoint.Headers[0].Key != "Content-Type" {
		t.Fatalf("expected content-type header only, got %#v", endpoint.Headers)
	}
}

func TestParseMarkdownDocumentReturnsNoImportableEndpoints(t *testing.T) {
	_, err := parseMarkdownDocument("empty.md", markdown(
		"# Empty API",
		"",
		"## Base URL",
		"",
		"No endpoints here.",
	))
	if !errors.Is(err, ErrNoImportableEndpoints) {
		t.Fatalf("expected ErrNoImportableEndpoints, got %v", err)
	}
}

func TestParseMarkdownDocumentReturnsBaseURLErrorWhenURLCannotBeDerived(t *testing.T) {
	_, err := parseMarkdownDocument("invalid.md", markdown(
		"# Invalid API",
		"",
		"## Details",
		"",
		"### GET `/v1/projects/:id`",
		"",
		"**Get project**",
		"",
		"#### Path Parameters",
		"",
		"| Parameter | Type | Description |",
		"|-----------|------|-------------|",
		"| `id` | `integer` | Resource identifier |",
		"",
		"#### Example",
		"",
		"```bash",
		"curl -X GET '/v1/projects/1'",
		"```",
	))
	if !errors.Is(err, ErrMarkdownBaseURLNotFound) {
		t.Fatalf("expected ErrMarkdownBaseURLNotFound, got %v", err)
	}
}

func TestImportMarkdownPropagatesInvalidParentError(t *testing.T) {
	collectionService := &stubCollectionService{createErr: collection.ErrInvalidParent}
	requestService := &stubRequestService{}
	service := NewService(collectionService, requestService).(*service)

	doc := &markdownDocument{
		Title: "API 文档",
		Modules: []markdownModule{
			{
				Name: "Project",
				Endpoints: []markdownEndpoint{
					{
						Name:   "Get project",
						Method: "GET",
						URL:    "http://localhost:8025/api/v1/projects/:id",
					},
				},
			},
		},
	}

	_, err := service.importMarkdownDocument(context.Background(), "1", "3", doc)
	if !errors.Is(err, collection.ErrInvalidParent) {
		t.Fatalf("expected collection.ErrInvalidParent, got %v", err)
	}
}

func TestImportMarkdownAlwaysAppendsRequestsOnRepeatedImport(t *testing.T) {
	doc := &markdownDocument{
		Title: "API 文档",
		Modules: []markdownModule{
			{
				Name: "Project",
				Endpoints: []markdownEndpoint{
					{
						Name:   "Get project",
						Method: "GET",
						URL:    "http://localhost:8025/api/v1/projects/:id",
					},
				},
			},
		},
	}

	collectionService := &stubCollectionService{}
	requestService := &stubRequestService{}
	service := NewService(collectionService, requestService).(*service)

	if _, err := service.importMarkdownDocument(context.Background(), "1", "", doc); err != nil {
		t.Fatalf("expected first import to succeed, got %v", err)
	}
	if _, err := service.importMarkdownDocument(context.Background(), "1", "", doc); err != nil {
		t.Fatalf("expected second import to succeed, got %v", err)
	}

	if len(requestService.created) != 2 {
		t.Fatalf("expected repeated imports to append requests, got %d", len(requestService.created))
	}
}

func markdown(lines ...string) []byte {
	return []byte(strings.Join(lines, "\n"))
}
