package scanner

import "context"

// APIEndpoint represents a single API route
type APIEndpoint struct {
	Method          string
	Path            string
	Handler         string
	Code            string
	Description     string
	RequestType     string
	ResponseType    string
	RequestExample  string
	ResponseExample string
	Errors          []EndpointError
	Middlewares     []string // List of middleware names
	PermissionDesc  string   // AI-enhanced permission description
	FlowDiagram     string   // Mermaid flow diagram
}

// EndpointError represents a potential error response
type EndpointError struct {
	Code        int
	Description string
}

// DTOField represents a field in a DTO struct
type DTOField struct {
	Name       string
	JSONName   string
	Type       string
	Validation string
	Tag        string
	Comment    string
}

// DTOInfo represents a Data Transfer Object
type DTOInfo struct {
	Name   string
	Code   string
	Fields []DTOField
}

// ModuleInfo represents a group of related endpoints (e.g., a service or module)
type ModuleInfo struct {
	Name        string
	Description string // AI-generated module purpose
	Endpoints   []APIEndpoint
	DTOs        map[string]*DTOInfo
}

// Scanner defines the interface for framework-specific API scanners
type Scanner interface {
	// Name returns the name of the framework (e.g., "gin", "fastapi")
	Name() string

	// Detect returns true if the scanner identifies its framework in the given path
	Detect(ctx context.Context, path string) bool

	// Scan performs the actual scanning and returns module information
	Scan(ctx context.Context, path string) ([]*ModuleInfo, error)
}
