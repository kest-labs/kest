package testcase

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/kest-labs/kest/api/internal/modules/apispec"
	"github.com/kest-labs/kest/api/internal/modules/environment"
)

// Service defines the interface for test case business logic
type Service interface {
	CreateTestCase(ctx context.Context, req *CreateTestCaseRequest) (*TestCaseResponse, error)
	GetTestCase(ctx context.Context, id uint) (*TestCaseResponse, error)
	ListTestCases(ctx context.Context, filter *ListFilter) ([]*TestCaseResponse, *PaginationMeta, error)
	UpdateTestCase(ctx context.Context, id uint, req *UpdateTestCaseRequest) (*TestCaseResponse, error)
	DeleteTestCase(ctx context.Context, id uint) error
	DuplicateTestCase(ctx context.Context, id uint, req *DuplicateRequest) (*TestCaseResponse, error)
	CreateTestCaseFromSpec(ctx context.Context, req *FromSpecRequest) (*TestCaseResponse, error)
	RunTestCase(ctx context.Context, id uint, req *RunTestCaseRequest) (*RunTestCaseResponse, error)
}

// Runner defines the interface for executing test cases
type Runner interface {
	Execute(ctx context.Context, tc *TestCaseResponse, envVars map[string]any) (*RunTestCaseResponse, error)
}

type service struct {
	repo        Repository
	apiSpecRepo apispec.Repository
	envRepo     environment.Repository
	runner      Runner
}

// NewService creates a new test case service
func NewService(repo Repository, apiSpecRepo apispec.Repository, envRepo environment.Repository, runner Runner) Service {
	return &service{
		repo:        repo,
		apiSpecRepo: apiSpecRepo,
		envRepo:     envRepo,
		runner:      runner,
	}
}

// CreateTestCase creates a new test case
func (s *service) CreateTestCase(ctx context.Context, req *CreateTestCaseRequest) (*TestCaseResponse, error) {
	tc, err := req.ToTestCasePO()
	if err != nil {
		return nil, fmt.Errorf("failed to convert request: %w", err)
	}

	if err := s.repo.Create(ctx, tc); err != nil {
		return nil, fmt.Errorf("failed to create test case: %w", err)
	}

	return s.populateResponse(ctx, tc)
}

// GetTestCase gets a test case by ID
func (s *service) GetTestCase(ctx context.Context, id uint) (*TestCaseResponse, error) {
	tc, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get test case: %w", err)
	}
	if tc == nil {
		return nil, fmt.Errorf("test case not found")
	}

	return s.populateResponse(ctx, tc)
}

// ListTestCases lists test cases with filtering and pagination
func (s *service) ListTestCases(ctx context.Context, filter *ListFilter) ([]*TestCaseResponse, *PaginationMeta, error) {
	testCases, total, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list test cases: %w", err)
	}

	responses := make([]*TestCaseResponse, 0, len(testCases))
	for _, tc := range testCases {
		resp, _ := s.populateResponse(ctx, tc)
		responses = append(responses, resp)
	}

	totalPages := int(total) / filter.PageSize
	if int(total)%filter.PageSize > 0 {
		totalPages++
	}

	meta := &PaginationMeta{
		Page:       filter.Page,
		PageSize:   filter.PageSize,
		Total:      total,
		TotalPages: totalPages,
	}

	return responses, meta, nil
}

// UpdateTestCase updates a test case
func (s *service) UpdateTestCase(ctx context.Context, id uint, req *UpdateTestCaseRequest) (*TestCaseResponse, error) {
	tc, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get test case: %w", err)
	}
	if tc == nil {
		return nil, fmt.Errorf("test case not found")
	}

	if req.Name != nil {
		tc.Name = *req.Name
	}
	if req.Description != nil {
		tc.Description = *req.Description
	}
	if req.Env != nil {
		tc.Env = *req.Env
	}

	if req.Headers != nil {
		data, _ := json.Marshal(*req.Headers)
		tc.Headers = string(data)
	}
	if req.QueryParams != nil {
		data, _ := json.Marshal(*req.QueryParams)
		tc.QueryParams = string(data)
	}
	if req.PathParams != nil {
		data, _ := json.Marshal(*req.PathParams)
		tc.PathParams = string(data)
	}
	if req.RequestBody != nil {
		data, _ := json.Marshal(*req.RequestBody)
		tc.RequestBody = string(data)
	}
	if req.PreScript != nil {
		tc.PreScript = *req.PreScript
	}
	if req.PostScript != nil {
		tc.PostScript = *req.PostScript
	}
	if req.Assertions != nil {
		data, _ := json.Marshal(*req.Assertions)
		tc.Assertions = string(data)
	}
	if req.ExtractVars != nil {
		data, _ := json.Marshal(*req.ExtractVars)
		tc.ExtractVars = string(data)
	}

	if err := s.repo.Update(ctx, tc); err != nil {
		return nil, fmt.Errorf("failed to update test case: %w", err)
	}

	return s.populateResponse(ctx, tc)
}

// DeleteTestCase deletes a test case
func (s *service) DeleteTestCase(ctx context.Context, id uint) error {
	tc, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if tc == nil {
		return fmt.Errorf("test case not found")
	}

	return s.repo.Delete(ctx, id)
}

// DuplicateTestCase duplicates a test case
func (s *service) DuplicateTestCase(ctx context.Context, id uint, req *DuplicateRequest) (*TestCaseResponse, error) {
	source, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if source == nil {
		return nil, fmt.Errorf("source test case not found")
	}

	newTC := &TestCasePO{
		APISpecID:   source.APISpecID,
		Name:        req.Name,
		Description: fmt.Sprintf("Copy of: %s", source.Description),
		Env:         source.Env,
		Headers:     source.Headers,
		QueryParams: source.QueryParams,
		PathParams:  source.PathParams,
		RequestBody: source.RequestBody,
		PreScript:   source.PreScript,
		PostScript:  source.PostScript,
		Assertions:  source.Assertions,
		ExtractVars: source.ExtractVars,
		CreatedBy:   source.CreatedBy,
	}

	if err := s.repo.Create(ctx, newTC); err != nil {
		return nil, err
	}

	return s.populateResponse(ctx, newTC)
}

// CreateTestCaseFromSpec creates a test case from an API spec
func (s *service) CreateTestCaseFromSpec(ctx context.Context, req *FromSpecRequest) (*TestCaseResponse, error) {
	spec, err := s.apiSpecRepo.GetSpecByID(ctx, req.APISpecID)
	if err != nil {
		return nil, err
	}
	if spec == nil {
		return nil, fmt.Errorf("api spec not found")
	}

	tc := &TestCasePO{
		APISpecID:   spec.ID,
		Name:        req.Name,
		Description: spec.Summary,
		Env:         req.Env,
	}

	assertions := []Assertion{
		{
			Type:     "status",
			Operator: "equals",
			Expect:   200,
			Message:  "Response status should be 200",
		},
	}

	if req.UseExample {
		var example *apispec.APIExamplePO
		if req.ExampleID != nil {
			example, _ = s.apiSpecRepo.GetExampleByID(ctx, *req.ExampleID)
		} else {
			examples, _ := s.apiSpecRepo.GetExamplesBySpecID(ctx, spec.ID)
			if len(examples) > 0 {
				example = examples[0]
			}
		}

		if example != nil {
			tc.Headers = example.RequestHeaders
			tc.RequestBody = example.RequestBody
			if example.ResponseStatus > 0 {
				assertions[0].Expect = example.ResponseStatus
				assertions[0].Message = fmt.Sprintf("Response status should be %d", example.ResponseStatus)
			}
		}
	}

	assertionsJSON, _ := json.Marshal(assertions)
	tc.Assertions = string(assertionsJSON)

	if err := s.repo.Create(ctx, tc); err != nil {
		return nil, err
	}

	return s.populateResponse(ctx, tc)
}

// RunTestCase executes a test case
func (s *service) RunTestCase(ctx context.Context, id uint, req *RunTestCaseRequest) (*RunTestCaseResponse, error) {
	tc, err := s.GetTestCase(ctx, id)
	if err != nil {
		return nil, err
	}

	// Prepare environment variables
	envVars := make(map[string]any)

	var env *environment.EnvironmentPO
	if req.EnvID != nil {
		env, _ = s.envRepo.GetByID(ctx, *req.EnvID)
	} else if tc.Env != "" {
		// Get project ID from API Spec
		spec, _ := s.apiSpecRepo.GetSpecByID(ctx, tc.APISpecID)
		if spec != nil {
			env, _ = s.envRepo.GetByProjectAndName(ctx, spec.ProjectID, tc.Env)
		}
	}

	if env != nil {
		// Load variables
		var vars map[string]any
		json.Unmarshal([]byte(env.Variables), &vars)
		for k, v := range vars {
			envVars[k] = v
		}

		// Add base_url if not already in vars
		if _, ok := envVars["base_url"]; !ok && env.BaseURL != "" {
			envVars["base_url"] = env.BaseURL
		}

		// Merge headers from environment into tc.Headers
		var envHeaders map[string]string
		if json.Unmarshal([]byte(env.Headers), &envHeaders) == nil {
			if tc.Headers == nil {
				tc.Headers = make(map[string]string)
			}
			for k, v := range envHeaders {
				// Don't override if test case already has it
				if _, ok := tc.Headers[k]; !ok {
					tc.Headers[k] = v
				}
			}
		}
	}

	// 2. Add global vars from request
	for k, v := range req.GlobalVars {
		envVars[k] = v
	}

	// 3. Add override keys from request
	for k, v := range req.VariableKeys {
		envVars[k] = v
	}

	// Execute
	return s.runner.Execute(ctx, tc, envVars)
}

// populateResponse converts PO to response and fills additional fields from APISpec
func (s *service) populateResponse(ctx context.Context, tc *TestCasePO) (*TestCaseResponse, error) {
	resp, err := tc.ToResponse()
	if err != nil {
		return nil, err
	}

	// Fill Method and Path from APISpec
	spec, err := s.apiSpecRepo.GetSpecByID(ctx, tc.APISpecID)
	if err == nil && spec != nil {
		resp.Method = spec.Method
		resp.Path = spec.Path
	}

	return resp, nil
}
