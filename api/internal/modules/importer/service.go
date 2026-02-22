package importer

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"

	"github.com/kest-labs/kest/api/internal/modules/collection"
	"github.com/kest-labs/kest/api/internal/modules/request"
)

type PostmanCollection struct {
	Info PostmanInfo   `json:"info"`
	Item []PostmanItem `json:"item"`
}

type PostmanInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type PostmanItem struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Item        []PostmanItem   `json:"item,omitempty"`
	Request     *PostmanRequest `json:"request,omitempty"`
}

type PostmanRequest struct {
	Method string          `json:"method"`
	Header []PostmanHeader `json:"header,omitempty"`
	URL    PostmanURL      `json:"url"`
	Body   *PostmanBody    `json:"body,omitempty"`
}

type PostmanHeader struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type PostmanURL struct {
	Raw   string              `json:"raw"`
	Query []PostmanQueryParam `json:"query,omitempty"`
}

type PostmanQueryParam struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type PostmanBody struct {
	Mode string `json:"mode"`
	Raw  string `json:"raw,omitempty"`
}

type Service interface {
	ImportPostman(ctx context.Context, projectID, parentID uint, file *multipart.FileHeader) error
}

type service struct {
	collectionService collection.Service
	requestService    request.Service
}

func NewService(collectionService collection.Service, requestService request.Service) Service {
	return &service{
		collectionService: collectionService,
		requestService:    requestService,
	}
}

func (s *service) ImportPostman(ctx context.Context, projectID, parentID uint, file *multipart.FileHeader) error {
	f, err := file.Open()
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	bytes, err := io.ReadAll(f)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	var pmCol PostmanCollection
	if err := json.Unmarshal(bytes, &pmCol); err != nil {
		return fmt.Errorf("invalid postman collection format: %w", err)
	}

	// Create root collection
	rootReq := &collection.CreateCollectionRequest{
		ProjectID:   projectID,
		Name:        pmCol.Info.Name,
		Description: pmCol.Info.Description,
		IsFolder:    true,
	}
	if parentID > 0 {
		rootReq.ParentID = &parentID
	}

	rootCol, err := s.collectionService.Create(ctx, rootReq)
	if err != nil {
		return fmt.Errorf("failed to create root collection: %w", err)
	}

	// Recursively import items
	return s.importItems(ctx, projectID, rootCol.ID, pmCol.Item)
}

func (s *service) importItems(ctx context.Context, projectID, parentID uint, items []PostmanItem) error {
	for i, item := range items {
		isFolder := len(item.Item) > 0 || item.Request == nil

		// Create folder or collection node
		colReq := &collection.CreateCollectionRequest{
			ProjectID:   projectID,
			ParentID:    &parentID,
			Name:        item.Name,
			Description: item.Description,
			IsFolder:    isFolder,
			SortOrder:   i,
		}

		col, err := s.collectionService.Create(ctx, colReq)
		if err != nil {
			return err
		}

		if isFolder {
			if err := s.importItems(ctx, projectID, col.ID, item.Item); err != nil {
				return err
			}
		} else if item.Request != nil {
			// Create request for this collection node
			reqReq := s.convertFromPostmanRequest(item.Request, col.ID)
			if _, err := s.requestService.Create(ctx, reqReq); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *service) convertFromPostmanRequest(pr *PostmanRequest, collectionID uint) *request.CreateRequestRequest {
	req := &request.CreateRequestRequest{
		CollectionID: collectionID,
		Name:         "Default Request",
		Method:       pr.Method,
		URL:          pr.URL.Raw,
	}

	for _, h := range pr.Header {
		req.Headers = append(req.Headers, request.KeyValue{
			Key:     h.Key,
			Value:   h.Value,
			Enabled: true,
		})
	}

	for _, q := range pr.URL.Query {
		req.QueryParams = append(req.QueryParams, request.KeyValue{
			Key:     q.Key,
			Value:   q.Value,
			Enabled: true,
		})
	}

	if pr.Body != nil {
		req.BodyType = pr.Body.Mode
		req.Body = pr.Body.Raw
	} else {
		req.BodyType = "none"
	}

	return req
}
