package example

import (
	"context"
	"errors"
)

// Common errors
var (
	ErrExampleNotFound = errors.New("example not found")
)

// Service defines the interface for example business logic
type Service interface {
	Create(ctx context.Context, req *CreateExampleRequest) (*Example, error)
	GetByID(ctx context.Context, id, requestID uint) (*Example, error)
	Update(ctx context.Context, id, requestID uint, req *UpdateExampleRequest) (*Example, error)
	Delete(ctx context.Context, id, requestID uint) error
	List(ctx context.Context, requestID uint) ([]*Example, error)
	SaveResponse(ctx context.Context, id, requestID uint, req *SaveResponseRequest) (*Example, error)
	SetDefault(ctx context.Context, id, requestID uint) (*Example, error)
}

// service implements Service interface
type service struct {
	repo Repository
}

// NewService creates a new example service
func NewService(repo Repository) Service {
	return &service{
		repo: repo,
	}
}

func (s *service) Create(ctx context.Context, req *CreateExampleRequest) (*Example, error) {
	// If setting as default, clear existing default first
	if req.IsDefault {
		_ = s.repo.ClearDefault(ctx, req.RequestID)
	}

	method := req.Method
	if method == "" {
		method = "GET"
	}

	bodyType := req.BodyType
	if bodyType == "" {
		bodyType = "none"
	}

	example := &Example{
		RequestID:   req.RequestID,
		Name:        req.Name,
		Description: req.Description,
		URL:         req.URL,
		Method:      method,
		Headers:     req.Headers,
		QueryParams: req.QueryParams,
		Body:        req.Body,
		BodyType:    bodyType,
		Auth:        req.Auth,
		IsDefault:   req.IsDefault,
		SortOrder:   req.SortOrder,
	}

	if err := s.repo.Create(ctx, example); err != nil {
		return nil, err
	}

	return example, nil
}

func (s *service) GetByID(ctx context.Context, id, requestID uint) (*Example, error) {
	example, err := s.repo.GetByIDAndRequest(ctx, id, requestID)
	if err != nil {
		return nil, err
	}
	if example == nil {
		return nil, ErrExampleNotFound
	}
	return example, nil
}

func (s *service) Update(ctx context.Context, id, requestID uint, req *UpdateExampleRequest) (*Example, error) {
	example, err := s.repo.GetByIDAndRequest(ctx, id, requestID)
	if err != nil {
		return nil, err
	}
	if example == nil {
		return nil, ErrExampleNotFound
	}

	// Handle default flag change
	if req.IsDefault != nil && *req.IsDefault && !example.IsDefault {
		_ = s.repo.ClearDefault(ctx, requestID)
		example.IsDefault = *req.IsDefault
	}

	// Apply updates
	if req.Name != nil {
		example.Name = *req.Name
	}
	if req.Description != nil {
		example.Description = *req.Description
	}
	if req.URL != nil {
		example.URL = *req.URL
	}
	if req.Method != nil {
		example.Method = *req.Method
	}
	if req.Headers != nil {
		example.Headers = req.Headers
	}
	if req.QueryParams != nil {
		example.QueryParams = req.QueryParams
	}
	if req.Body != nil {
		example.Body = *req.Body
	}
	if req.BodyType != nil {
		example.BodyType = *req.BodyType
	}
	if req.Auth != nil {
		example.Auth = req.Auth
	}
	if req.SortOrder != nil {
		example.SortOrder = *req.SortOrder
	}

	if err := s.repo.Update(ctx, example); err != nil {
		return nil, err
	}

	return example, nil
}

func (s *service) Delete(ctx context.Context, id, requestID uint) error {
	example, err := s.repo.GetByIDAndRequest(ctx, id, requestID)
	if err != nil {
		return err
	}
	if example == nil {
		return ErrExampleNotFound
	}

	return s.repo.Delete(ctx, id)
}

func (s *service) List(ctx context.Context, requestID uint) ([]*Example, error) {
	return s.repo.List(ctx, requestID)
}

func (s *service) SaveResponse(ctx context.Context, id, requestID uint, req *SaveResponseRequest) (*Example, error) {
	example, err := s.repo.GetByIDAndRequest(ctx, id, requestID)
	if err != nil {
		return nil, err
	}
	if example == nil {
		return nil, ErrExampleNotFound
	}

	example.ResponseStatus = req.ResponseStatus
	example.ResponseHeaders = req.ResponseHeaders
	example.ResponseBody = req.ResponseBody
	example.ResponseTime = req.ResponseTime

	if err := s.repo.Update(ctx, example); err != nil {
		return nil, err
	}

	return example, nil
}

func (s *service) SetDefault(ctx context.Context, id, requestID uint) (*Example, error) {
	example, err := s.repo.GetByIDAndRequest(ctx, id, requestID)
	if err != nil {
		return nil, err
	}
	if example == nil {
		return nil, ErrExampleNotFound
	}

	// Clear existing default
	_ = s.repo.ClearDefault(ctx, requestID)

	// Set new default
	example.IsDefault = true
	if err := s.repo.Update(ctx, example); err != nil {
		return nil, err
	}

	return example, nil
}
