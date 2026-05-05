package parser

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// APIConfig holds API documentation configuration
type APIConfig struct {
	LocalURL   string
	DevURL     string
	StagingURL string
	ProdURL    string
}

// LoadAPIConfig loads API configuration from environment
func LoadAPIConfig() APIConfig {
	return APIConfig{
		LocalURL:   getEnvOrDefault("API_BASE_URL_LOCAL", "http://localhost:8025/api/v1"),
		DevURL:     getEnvOrDefault("API_BASE_URL_DEV", ""),
		StagingURL: getEnvOrDefault("API_BASE_URL_STAGING", ""),
		ProdURL:    getEnvOrDefault("API_BASE_URL_PROD", ""),
	}
}

func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// GenerateMarkdown generates a single markdown file with all API documentation
func GenerateMarkdown(endpoints []Endpoint, outputFile string) error {
	config := LoadAPIConfig()
	var sb strings.Builder

	// Header
	sb.WriteString("# API Documentation\n\n")
	sb.WriteString(fmt.Sprintf("> Generated: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	// Base URLs
	sb.WriteString("## Base URLs\n\n")
	sb.WriteString("| Environment | URL |\n")
	sb.WriteString("|-------------|-----|\n")
	if config.LocalURL != "" {
		sb.WriteString(fmt.Sprintf("| 🏠 Local | `%s` |\n", config.LocalURL))
	}
	if config.DevURL != "" {
		sb.WriteString(fmt.Sprintf("| 🔧 Development | `%s` |\n", config.DevURL))
	}
	if config.StagingURL != "" {
		sb.WriteString(fmt.Sprintf("| 🧪 Staging | `%s` |\n", config.StagingURL))
	}
	if config.ProdURL != "" {
		sb.WriteString(fmt.Sprintf("| 🚀 Production | `%s` |\n", config.ProdURL))
	}
	sb.WriteString("\n")

	// Authentication
	sb.WriteString("## Authentication\n\n")
	sb.WriteString("Protected endpoints require a JWT token in the `Authorization` header:\n\n")
	sb.WriteString("```\nAuthorization: Bearer <token>\n```\n\n")

	// Overview
	sb.WriteString("## Overview\n\n")
	sb.WriteString(fmt.Sprintf("Total endpoints: **%d**\n\n", len(endpoints)))

	// Table of contents
	sb.WriteString("## Table of Contents\n\n")
	modules := groupByModule(endpoints)
	for _, module := range sortedKeys(modules) {
		count := len(modules[module])
		sb.WriteString(fmt.Sprintf("- [%s](#%s) (%d endpoints)\n", capitalize(module), module, count))
	}
	sb.WriteString("\n---\n\n")

	// Generate docs by module
	for _, module := range sortedKeys(modules) {
		moduleEndpoints := modules[module]
		sb.WriteString(fmt.Sprintf("## %s\n\n", capitalize(module)))

		// Module summary table
		sb.WriteString("| Method | Endpoint | Description | Auth |\n")
		sb.WriteString("|--------|----------|-------------|------|\n")
		for _, ep := range moduleEndpoints {
			auth := "🔓" // Public
			if !ep.Route.IsPublic {
				auth = "🔒" // Protected
			}
			sb.WriteString(fmt.Sprintf("| `%s` | `%s` | %s | %s |\n",
				ep.Route.Method, ep.Route.Path, ep.Summary, auth))
		}
		sb.WriteString("\n")

		for _, ep := range moduleEndpoints {
			writeEndpointEnhanced(&sb, ep, config)
		}
	}

	return os.WriteFile(outputFile, []byte(sb.String()), 0644)
}

// writeEndpointEnhanced writes a single endpoint documentation with enhanced format
func writeEndpointEnhanced(sb *strings.Builder, ep Endpoint, config APIConfig) {
	// Use the actual path from route definition
	path := ep.Route.Path

	// Endpoint header
	sb.WriteString(fmt.Sprintf("### %s `%s`\n\n", ep.Route.Method, path))

	// Summary and description
	if ep.Summary != "" {
		sb.WriteString(fmt.Sprintf("**%s**\n\n", ep.Summary))
	}
	if ep.Description != "" {
		sb.WriteString(fmt.Sprintf("%s\n\n", ep.Description))
	}

	// Quick info
	sb.WriteString("| Property | Value |\n")
	sb.WriteString("|----------|-------|\n")
	if ep.Route.IsPublic {
		sb.WriteString("| Auth | 🔓 Not required |\n")
	} else {
		sb.WriteString("| Auth | 🔒 JWT Required |\n")
	}
	if ep.Route.Name != "" {
		sb.WriteString(fmt.Sprintf("| Route Name | `%s` |\n", ep.Route.Name))
	}
	sb.WriteString("\n")

	// Request body
	if ep.Request != nil && len(ep.Request.Fields) > 0 {
		sb.WriteString("#### Request Body\n\n")

		// JSON example
		sb.WriteString("```json\n")
		sb.WriteString(generateJSONExample(ep.Request))
		sb.WriteString("\n```\n\n")

		// Fields table
		sb.WriteString("| Field | Type | Required | Description |\n")
		sb.WriteString("|-------|------|:--------:|-------------|\n")
		for _, field := range ep.Request.Fields {
			required := "❌"
			if field.Required {
				required = "✅"
			}
			desc := field.Validation
			if desc == "" {
				desc = "-"
			}
			sb.WriteString(fmt.Sprintf("| `%s` | `%s` | %s | %s |\n",
				field.JSONName, field.Type, required, desc))
		}
		sb.WriteString("\n")
	}

	// Path parameters
	if strings.Contains(ep.Route.Path, ":") {
		sb.WriteString("#### Path Parameters\n\n")
		sb.WriteString("| Parameter | Type | Description |\n")
		sb.WriteString("|-----------|------|-------------|\n")
		params := extractPathParams(ep.Route.Path)
		for _, param := range params {
			sb.WriteString(fmt.Sprintf("| `%s` | `integer` | Resource identifier |\n", param))
		}
		sb.WriteString("\n")
	}

	// Response
	if ep.Response != nil && len(ep.Response.Fields) > 0 {
		sb.WriteString("#### Response\n\n")
		sb.WriteString("```json\n")
		sb.WriteString(generateJSONExample(ep.Response))
		sb.WriteString("\n```\n\n")
	}

	// cURL example
	sb.WriteString("#### Example\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString(generateCurlExample(ep, config))
	sb.WriteString("\n```\n\n")

	sb.WriteString("---\n\n")
}

// generateCurlExample generates a cURL command example
func generateCurlExample(ep Endpoint, config APIConfig) string {
	baseURL := config.LocalURL
	if baseURL == "" {
		baseURL = "http://localhost:6066"
	}
	// Remove any trailing slash
	baseURL = strings.TrimSuffix(baseURL, "/")

	path := ep.Route.Path
	path = replacePathParamsWithExamples(path)

	var parts []string
	parts = append(parts, fmt.Sprintf("curl -X %s '%s'", ep.Route.Method, joinBaseURLAndPath(baseURL, path)))

	if !ep.Route.IsPublic {
		parts = append(parts, "  -H 'Authorization: Bearer <token>'")
	}

	if ep.Request != nil && len(ep.Request.Fields) > 0 {
		parts = append(parts, "  -H 'Content-Type: application/json'")
		jsonData := generateJSONExample(ep.Request)
		// Compact JSON for curl
		jsonData = strings.ReplaceAll(jsonData, "\n", "")
		jsonData = strings.ReplaceAll(jsonData, "  ", "")
		parts = append(parts, fmt.Sprintf("  -d '%s'", jsonData))
	}

	return strings.Join(parts, " \\\n")
}

var pathParamPattern = regexp.MustCompile(`:[A-Za-z_]+`)

func replacePathParamsWithExamples(path string) string {
	return pathParamPattern.ReplaceAllStringFunc(path, func(param string) string {
		if param == ":slug" {
			return "example"
		}
		return "1"
	})
}

func joinBaseURLAndPath(baseURL, path string) string {
	baseURL = strings.TrimSuffix(baseURL, "/")
	if path == "" {
		return baseURL
	}

	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	parsed, err := url.Parse(baseURL)
	if err != nil {
		return baseURL + path
	}

	basePath := strings.TrimSuffix(parsed.Path, "/")
	for _, overlap := range []string{"/api/v1", "/v1"} {
		if strings.HasSuffix(basePath, overlap) && strings.HasPrefix(path, overlap) {
			return baseURL + strings.TrimPrefix(path, overlap)
		}
	}

	return baseURL + path
}

// GenerateModuleDocs generates separate markdown files for each module
func GenerateModuleDocs(endpoints []Endpoint, outputDir string) error {
	config := LoadAPIConfig()
	modules := groupByModule(endpoints)

	for module, moduleEndpoints := range modules {
		var sb strings.Builder

		sb.WriteString(fmt.Sprintf("# %s API\n\n", capitalize(module)))
		sb.WriteString(fmt.Sprintf("> Generated: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

		// Base URL reference
		sb.WriteString("## Base URL\n\n")
		sb.WriteString("See [API Documentation](./api.md) for environment-specific base URLs.\n\n")

		// Summary table
		sb.WriteString("## Endpoints\n\n")
		sb.WriteString("| Method | Endpoint | Description | Auth |\n")
		sb.WriteString("|--------|----------|-------------|------|\n")
		for _, ep := range moduleEndpoints {
			auth := "🔓"
			if !ep.Route.IsPublic {
				auth = "🔒"
			}
			path := strings.TrimPrefix(ep.Route.Path, "/api/v1")
			sb.WriteString(fmt.Sprintf("| `%s` | `%s` | %s | %s |\n",
				ep.Route.Method, path, ep.Summary, auth))
		}
		sb.WriteString("\n---\n\n")

		// Detailed docs
		sb.WriteString("## Details\n\n")
		for _, ep := range moduleEndpoints {
			writeEndpointEnhanced(&sb, ep, config)
		}

		outputFile := filepath.Join(outputDir, module+".md")
		if err := os.WriteFile(outputFile, []byte(sb.String()), 0644); err != nil {
			return err
		}
		fmt.Printf("✅ Generated: %s\n", outputFile)
	}

	return nil
}

// writeEndpoint writes a single endpoint documentation
func writeEndpoint(sb *strings.Builder, ep Endpoint) {
	// Endpoint header
	sb.WriteString(fmt.Sprintf("### %s %s\n\n", ep.Route.Method, ep.Route.Path))

	// Summary
	sb.WriteString(fmt.Sprintf("**%s**\n\n", ep.Summary))

	// Auth info
	if ep.Route.IsPublic {
		sb.WriteString("🔓 **Authentication:** Not required\n\n")
	} else {
		sb.WriteString("🔒 **Authentication:** Required (JWT)\n\n")
	}

	// Route name
	if ep.Route.Name != "" {
		sb.WriteString(fmt.Sprintf("**Route Name:** `%s`\n\n", ep.Route.Name))
	}

	// Request body
	if ep.Request != nil && len(ep.Request.Fields) > 0 {
		sb.WriteString("#### Request Body\n\n")
		sb.WriteString("```json\n")
		sb.WriteString(generateJSONExample(ep.Request))
		sb.WriteString("\n```\n\n")

		// Fields table
		sb.WriteString("| Field | Type | Required | Validation |\n")
		sb.WriteString("|-------|------|----------|------------|\n")
		for _, field := range ep.Request.Fields {
			required := "No"
			if field.Required {
				required = "Yes"
			}
			validation := field.Validation
			if validation == "" {
				validation = "-"
			}
			sb.WriteString(fmt.Sprintf("| `%s` | `%s` | %s | %s |\n",
				field.JSONName, field.Type, required, validation))
		}
		sb.WriteString("\n")
	}

	// Response
	if ep.Response != nil && len(ep.Response.Fields) > 0 {
		sb.WriteString("#### Response\n\n")
		sb.WriteString("```json\n")
		sb.WriteString(generateJSONExample(ep.Response))
		sb.WriteString("\n```\n\n")
	}

	// Path parameters
	if strings.Contains(ep.Route.Path, ":") {
		sb.WriteString("#### Path Parameters\n\n")
		sb.WriteString("| Parameter | Type | Description |\n")
		sb.WriteString("|-----------|------|-------------|\n")
		params := extractPathParams(ep.Route.Path)
		for _, param := range params {
			sb.WriteString(fmt.Sprintf("| `%s` | `integer` | Resource ID |\n", param))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("---\n\n")
}

// generateJSONExample generates a JSON example from DTO
func generateJSONExample(dto *DTO) string {
	example := make(map[string]any)

	for _, field := range dto.Fields {
		jsonName := field.JSONName
		if jsonName == "" || jsonName == "-" {
			continue
		}

		example[jsonName] = getExampleValue(field)
	}

	data, _ := json.MarshalIndent(example, "", "  ")
	return string(data)
}

// getExampleValue returns an example value for a field
func getExampleValue(field DTOField) any {
	switch field.Type {
	case "string":
		switch {
		case strings.Contains(strings.ToLower(field.Name), "email"):
			return "user@example.com"
		case strings.Contains(strings.ToLower(field.Name), "password"):
			return "********"
		case strings.Contains(strings.ToLower(field.Name), "phone"):
			return "+1234567890"
		case strings.Contains(strings.ToLower(field.Name), "name"):
			return "John Doe"
		case strings.Contains(strings.ToLower(field.Name), "url"):
			return "https://example.com"
		case strings.Contains(strings.ToLower(field.Name), "avatar"):
			return "https://example.com/avatar.jpg"
		default:
			return "string"
		}
	case "int", "int64", "uint", "uint64":
		return 1
	case "float64", "float32":
		return 1.0
	case "bool":
		return true
	case "time.Time", "Time":
		return "2024-01-01T00:00:00Z"
	case "*time.Time", "*Time":
		return "2024-01-01T00:00:00Z"
	case "[]string":
		return []string{"item1", "item2"}
	default:
		if strings.HasPrefix(field.Type, "[]") {
			return []any{}
		}
		if strings.HasPrefix(field.Type, "*") {
			return nil
		}
		return "object"
	}
}

// extractPathParams extracts path parameters from a route path
func extractPathParams(path string) []string {
	var params []string
	parts := strings.Split(path, "/")
	for _, part := range parts {
		if strings.HasPrefix(part, ":") {
			params = append(params, strings.TrimPrefix(part, ":"))
		}
	}
	return params
}

// groupByModule groups endpoints by module
func groupByModule(endpoints []Endpoint) map[string][]Endpoint {
	modules := make(map[string][]Endpoint)
	for _, ep := range endpoints {
		module := ep.Route.Module
		if module == "" {
			module = "other"
		}
		modules[module] = append(modules[module], ep)
	}
	return modules
}

// sortedKeys returns sorted keys of a map
func sortedKeys(m map[string][]Endpoint) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// GenerateJSON generates a JSON file with all API documentation
func GenerateJSON(endpoints []Endpoint, outputFile string) error {
	data, err := json.MarshalIndent(endpoints, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(outputFile, data, 0644)
}
