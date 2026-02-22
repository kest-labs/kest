package request

import (
	"context"
	"encoding/json"
	"errors"
)

// Common errors
var (
	ErrRequestNotFound    = errors.New("request not found")
	ErrCollectionNotFound = errors.New("collection not found")
	ErrInvalidCollection  = errors.New("invalid collection")
	ErrVersionNotFound    = errors.New("version not found")
)

// Service defines the interface for request business logic
type Service interface {
	Create(ctx context.Context, req *CreateRequestRequest) (*Request, error)
	GetByID(ctx context.Context, id, collectionID uint) (*Request, error)
	Update(ctx context.Context, id, collectionID uint, req *UpdateRequestRequest) (*Request, error)
	Delete(ctx context.Context, id, collectionID uint) error
	List(ctx context.Context, collectionID uint, page, perPage int) ([]*Request, int64, error)
	Move(ctx context.Context, id, collectionID uint, req *MoveRequestRequest) (*Request, error)
	Rollback(ctx context.Context, id, collectionID, versionID uint) (*Request, error)
}

// service implements Service interface
type service struct {
	repo Repository
}

// NewService creates a new request service
func NewService(repo Repository) Service {
	return &service{
		repo: repo,
	}
}

func (s *service) Create(ctx context.Context, req *CreateRequestRequest) (*Request, error) {
	// Validate collection exists and is not a folder
	// This would require collection repository - for now we assume valid

	method := req.Method
	if method == "" {
		method = "GET"
	}

	bodyType := req.BodyType
	if bodyType == "" {
		bodyType = "none"
	}

	pathParams := s.parsePathParams(req.PathParams)

	request := &Request{
		CollectionID: req.CollectionID,
		Name:         req.Name,
		Description:  req.Description,
		Method:       method,
		URL:          req.URL,
		Headers:      req.Headers,
		QueryParams:  req.QueryParams,
		PathParams:   pathParams,
		Body:         req.Body,
		BodyType:     bodyType,
		Auth:         req.Auth,
		PreRequest:   req.PreRequest,
		Test:         req.Test,
		SortOrder:    req.SortOrder,
	}

	if err := s.repo.Create(ctx, request); err != nil {
		return nil, err
	}

	return request, nil
}

func (s *service) GetByID(ctx context.Context, id, collectionID uint) (*Request, error) {
	request, err := s.repo.GetByIDAndCollection(ctx, id, collectionID)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, ErrRequestNotFound
	}
	return request, nil
}

func (s *service) Update(ctx context.Context, id, collectionID uint, req *UpdateRequestRequest) (*Request, error) {
	request, err := s.repo.GetByIDAndCollection(ctx, id, collectionID)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, ErrRequestNotFound
	}

	// Apply updates
	if req.Name != nil {
		request.Name = *req.Name
	}
	if req.Description != nil {
		request.Description = *req.Description
	}
	if req.Method != nil {
		request.Method = *req.Method
	}
	if req.URL != nil {
		request.URL = *req.URL
	}
	if req.Headers != nil {
		request.Headers = req.Headers
	}
	if req.QueryParams != nil {
		request.QueryParams = req.QueryParams
	}
	if req.PathParams != nil {
		request.PathParams = s.parsePathParams(req.PathParams)
	}
	if req.Body != nil {
		request.Body = *req.Body
	}
	if req.BodyType != nil {
		request.BodyType = *req.BodyType
	}
	if req.Auth != nil {
		request.Auth = req.Auth
	}
	if req.PreRequest != nil {
		request.PreRequest = *req.PreRequest
	}
	if req.Test != nil {
		request.Test = *req.Test
	}
	if req.SortOrder != nil {
		request.SortOrder = *req.SortOrder
	}

	if err := s.repo.Update(ctx, request); err != nil {
		return nil, err
	}

	return request, nil
}

func (s *service) Delete(ctx context.Context, id, collectionID uint) error {
	request, err := s.repo.GetByIDAndCollection(ctx, id, collectionID)
	if err != nil {
		return err
	}
	if request == nil {
		return ErrRequestNotFound
	}

	return s.repo.Delete(ctx, id)
}

func (s *service) List(ctx context.Context, collectionID uint, page, perPage int) ([]*Request, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	offset := (page - 1) * perPage
	return s.repo.List(ctx, collectionID, offset, perPage)
}

func (s *service) Move(ctx context.Context, id, collectionID uint, req *MoveRequestRequest) (*Request, error) {
	request, err := s.repo.GetByIDAndCollection(ctx, id, collectionID)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, ErrRequestNotFound
	}

	if req.CollectionID != nil {
		request.CollectionID = *req.CollectionID
	}
	if req.SortOrder != nil {
		request.SortOrder = *req.SortOrder
	}

	if err := s.repo.Update(ctx, request); err != nil {
		return nil, err
	}

	return request, nil
}

func (s *service) Rollback(ctx context.Context, id, collectionID, versionID uint) (*Request, error) {
	// For now, return ErrVersionNotFound since history is tracked in another module
	// We will integrate with history module later
	return nil, ErrVersionNotFound
}

// parsePathParams converts interface{} to map[string]string
func (s *service) parsePathParams(params interface{}) map[string]string {
	if params == nil {
		return nil
	}

	switch v := params.(type) {
	case map[string]interface{}:
		result := make(map[string]string)
		for key, val := range v {
			if strVal, ok := val.(string); ok {
				result[key] = strVal
			}
		}
		return result
	case string:
		if v == "" {
			return nil
		}
		var result map[string]string
		_ = json.Unmarshal([]byte(v), &result)
		return result
	default:
		return nil
	}
}
