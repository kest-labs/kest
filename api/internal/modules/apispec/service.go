package apispec

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrSpecNotFound      = errors.New("API specification not found")
	ErrSpecAlreadyExists = errors.New("API specification already exists for this method and path")
	ErrInvalidSpecData   = errors.New("invalid API specification data")
	ErrExampleNotFound   = errors.New("API example not found")
)

// Service defines API specification business logic interface
type Service interface {
	// API Spec operations
	CreateSpec(ctx context.Context, req *CreateAPISpecRequest) (*APISpecResponse, error)
	GetSpecByID(ctx context.Context, id uint) (*APISpecResponse, error)
	UpdateSpec(ctx context.Context, id uint, req *UpdateAPISpecRequest) (*APISpecResponse, error)
	DeleteSpec(ctx context.Context, id uint) error
	ListSpecs(ctx context.Context, projectID uint, version string, page, pageSize int) ([]*APISpecResponse, int64, error)
	GetSpecWithExamples(ctx context.Context, id uint) (*APISpecResponse, error)

	// API Example operations
	CreateExample(ctx context.Context, req *CreateAPIExampleRequest) (*APIExampleResponse, error)
	GetExamplesBySpecID(ctx context.Context, specID uint) ([]*APIExampleResponse, error)
	DeleteExample(ctx context.Context, id uint) error

	// Batch operations
	ImportSpecs(ctx context.Context, projectID uint, specs []*CreateAPISpecRequest) error
	ExportSpecs(ctx context.Context, projectID uint, format string) (interface{}, error)
}

// service is the private implementation
type service struct {
	repo Repository
}

// NewService creates a new API spec service
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// ========== API Spec Operations ==========

func (s *service) CreateSpec(ctx context.Context, req *CreateAPISpecRequest) (*APISpecResponse, error) {
	// Check if spec already exists
	existing, err := s.repo.GetSpecByMethodAndPath(ctx, req.ProjectID, req.Method, req.Path)
	if err == nil && existing != nil {
		return nil, ErrSpecAlreadyExists
	}

	// Create new spec
	po := ToAPISpecPO(req)
	if err := s.repo.CreateSpec(ctx, po); err != nil {
		return nil, err
	}

	return FromAPISpecPO(po), nil
}

func (s *service) GetSpecByID(ctx context.Context, id uint) (*APISpecResponse, error) {
	po, err := s.repo.GetSpecByID(ctx, id)
	if err != nil {
		return nil, ErrSpecNotFound
	}
	return FromAPISpecPO(po), nil
}

func (s *service) UpdateSpec(ctx context.Context, id uint, req *UpdateAPISpecRequest) (*APISpecResponse, error) {
	// Get existing spec
	po, err := s.repo.GetSpecByID(ctx, id)
	if err != nil {
		return nil, ErrSpecNotFound
	}

	// Apply updates
	if req.Summary != nil {
		po.Summary = *req.Summary
	}
	if req.Description != nil {
		po.Description = *req.Description
	}
	if req.DocMarkdown != nil {
		po.DocMarkdown = *req.DocMarkdown
		now := time.Now()
		po.DocUpdatedAt = &now
		if req.DocSource == nil {
			po.DocSource = "manual"
		}
	}
	if req.DocSource != nil {
		po.DocSource = *req.DocSource
	}
	if req.Tags != nil {
		// Convert tags to JSON
		tagsJSON, _ := json.Marshal(req.Tags)
		po.Tags = string(tagsJSON)
	}
	if req.RequestBody != nil {
		reqBodyJSON, _ := json.Marshal(req.RequestBody)
		po.RequestBody = string(reqBodyJSON)
	}
	if req.Parameters != nil {
		paramsJSON, _ := json.Marshal(req.Parameters)
		po.Parameters = string(paramsJSON)
	}
	if req.Responses != nil {
		responsesJSON, _ := json.Marshal(req.Responses)
		po.Responses = string(responsesJSON)
	}
	if req.IsPublic != nil {
		po.IsPublic = *req.IsPublic
	}
	if req.CategoryID != nil {
		po.CategoryID = req.CategoryID
	}

	// Save updates
	if err := s.repo.UpdateSpec(ctx, po); err != nil {
		return nil, err
	}

	return FromAPISpecPO(po), nil
}

func (s *service) DeleteSpec(ctx context.Context, id uint) error {
	// Check if exists
	if _, err := s.repo.GetSpecByID(ctx, id); err != nil {
		return ErrSpecNotFound
	}
	return s.repo.DeleteSpec(ctx, id)
}

func (s *service) ListSpecs(ctx context.Context, projectID uint, version string, page, pageSize int) ([]*APISpecResponse, int64, error) {
	// Input validation
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	pos, total, err := s.repo.ListSpecs(ctx, projectID, version, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]*APISpecResponse, len(pos))
	for i, po := range pos {
		responses[i] = FromAPISpecPO(po)
	}

	return responses, total, nil
}

func (s *service) GetSpecWithExamples(ctx context.Context, id uint) (*APISpecResponse, error) {
	// Get spec
	po, err := s.repo.GetSpecByID(ctx, id)
	if err != nil {
		return nil, ErrSpecNotFound
	}

	resp := FromAPISpecPO(po)

	// Get examples
	examples, err := s.repo.GetExamplesBySpecID(ctx, id)
	if err == nil && len(examples) > 0 {
		resp.Examples = make([]APIExampleResponse, len(examples))
		for i, ex := range examples {
			resp.Examples[i] = *FromAPIExamplePO(ex)
		}
	}

	return resp, nil
}

// ========== API Example Operations ==========

func (s *service) CreateExample(ctx context.Context, req *CreateAPIExampleRequest) (*APIExampleResponse, error) {
	// Verify spec exists
	if _, err := s.repo.GetSpecByID(ctx, req.APISpecID); err != nil {
		return nil, ErrSpecNotFound
	}

	po := ToAPIExamplePO(req)
	if err := s.repo.CreateExample(ctx, po); err != nil {
		return nil, err
	}

	return FromAPIExamplePO(po), nil
}

func (s *service) GetExamplesBySpecID(ctx context.Context, specID uint) ([]*APIExampleResponse, error) {
	examples, err := s.repo.GetExamplesBySpecID(ctx, specID)
	if err != nil {
		return nil, err
	}

	result := make([]*APIExampleResponse, len(examples))
	for i, ex := range examples {
		result[i] = FromAPIExamplePO(ex)
	}
	return result, nil
}

func (s *service) DeleteExample(ctx context.Context, id uint) error {
	return s.repo.DeleteExample(ctx, id)
}

// ========== Batch Operations ==========

func (s *service) ImportSpecs(ctx context.Context, projectID uint, specs []*CreateAPISpecRequest) error {
	for _, spec := range specs {
		spec.ProjectID = projectID

		// Check if exists, update or create
		existing, err := s.repo.GetSpecByMethodAndPath(ctx, projectID, spec.Method, spec.Path)
		if err == nil && existing != nil {
			// Update existing
			po := ToAPISpecPO(spec)
			po.ID = existing.ID
			if err := s.repo.UpdateSpec(ctx, po); err != nil {
				return err
			}
		} else {
			// Create new
			po := ToAPISpecPO(spec)
			if err := s.repo.CreateSpec(ctx, po); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *service) ExportSpecs(ctx context.Context, projectID uint, format string) (interface{}, error) {
	specs, err := s.repo.ListAllSpecs(ctx, projectID)
	if err != nil {
		return nil, err
	}

	switch format {
	case "openapi", "swagger":
		return s.exportToOpenAPI(specs), nil
	case "markdown":
		return s.exportToMarkdown(specs), nil
	default:
		// Return as JSON
		responses := make([]*APISpecResponse, len(specs))
		for i, po := range specs {
			responses[i] = FromAPISpecPO(po)
		}
		return responses, nil
	}
}

// Helper functions for export
func (s *service) exportToOpenAPI(specs []*APISpecPO) map[string]interface{} {
	openapi := map[string]interface{}{
		"openapi": "3.0.0",
		"info": map[string]interface{}{
			"title":   "Generated API Documentation",
			"version": "1.0.0",
		},
		"paths": make(map[string]interface{}),
	}

	paths := openapi["paths"].(map[string]interface{})

	for _, spec := range specs {
		if paths[spec.Path] == nil {
			paths[spec.Path] = make(map[string]interface{})
		}

		pathItem := paths[spec.Path].(map[string]interface{})
		pathItem[strings.ToLower(spec.Method)] = map[string]interface{}{
			"summary":     spec.Summary,
			"description": spec.Description,
			"responses": map[string]interface{}{
				"200": map[string]interface{}{
					"description": "Successful response",
				},
			},
		}
	}

	return openapi
}

func (s *service) exportToMarkdown(specs []*APISpecPO) string {
	var md strings.Builder
	md.WriteString("# API Documentation\n\n")

	for _, spec := range specs {
		md.WriteString(fmt.Sprintf("## %s %s\n\n", spec.Method, spec.Path))
		if spec.Summary != "" {
			md.WriteString(fmt.Sprintf("**Summary**: %s\n\n", spec.Summary))
		}
		if spec.Description != "" {
			md.WriteString(fmt.Sprintf("%s\n\n", spec.Description))
		}
		md.WriteString("---\n\n")
	}

	return md.String()
}
