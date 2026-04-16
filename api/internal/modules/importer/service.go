package importer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"

	"github.com/kest-labs/kest/api/internal/modules/collection"
	"github.com/kest-labs/kest/api/internal/modules/request"
)

var ErrInvalidPostmanCollection = errors.New("invalid postman collection format")

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
		return fmt.Errorf("%w: %v", ErrInvalidPostmanCollection, err)
	}

	return s.importPostmanCollection(ctx, projectID, parentID, &pmCol)
}

func (s *service) importPostmanCollection(
	ctx context.Context,
	projectID, parentID uint,
	pmCol *PostmanCollection,
) error {
	rootName := pmCol.Info.Name
	if rootName == "" {
		rootName = "Imported Collection"
	}

	rootReq := &collection.CreateCollectionRequest{
		ProjectID:   projectID,
		Name:        rootName,
		Description: pmCol.Info.Description,
		IsFolder:    false,
	}
	if parentID > 0 {
		rootReq.ParentID = &parentID
	}

	rootCol, err := s.collectionService.Create(ctx, rootReq)
	if err != nil {
		return fmt.Errorf("failed to create root collection: %w", err)
	}

	requestItems := flattenPostmanRequests(pmCol.Item)
	for i, item := range requestItems {
		reqReq := s.convertFromPostmanRequest(item, rootCol.ID, i)
		if _, err := s.requestService.Create(ctx, projectID, reqReq); err != nil {
			return err
		}
	}

	return nil
}

func flattenPostmanRequests(items []PostmanItem) []PostmanItem {
	requestItems := make([]PostmanItem, 0)

	var walk func(items []PostmanItem)
	walk = func(items []PostmanItem) {
		for _, item := range items {
			if item.Request != nil {
				requestItems = append(requestItems, item)
			}
			if len(item.Item) > 0 {
				walk(item.Item)
			}
		}
	}

	walk(items)
	return requestItems
}

func (s *service) convertFromPostmanRequest(
	item PostmanItem,
	collectionID uint,
	sortOrder int,
) *request.CreateRequestRequest {
	requestName := item.Name
	if requestName == "" {
		requestName = "Imported Request"
	}

	pr := item.Request
	req := &request.CreateRequestRequest{
		CollectionID: collectionID,
		Name:         requestName,
		Description:  item.Description,
		Method:       pr.Method,
		URL:          pr.URL.Raw,
		SortOrder:    sortOrder,
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
