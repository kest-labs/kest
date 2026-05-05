package importer

import (
	"context"
	"strconv"
	"testing"

	"github.com/kest-labs/kest/api/internal/modules/collection"
	"github.com/kest-labs/kest/api/internal/modules/request"
)

func TestImportPostmanCollectionCreatesSingleCollectionForAllRequests(t *testing.T) {
	parentID := "9"
	projectID := "7"
	collectionService := &stubCollectionService{}
	requestService := &stubRequestService{}
	service := NewService(collectionService, requestService).(*service)

	pmCol := &PostmanCollection{
		Info: PostmanInfo{
			Name:        "User API",
			Description: "Imported from Postman",
		},
		Item: []PostmanItem{
			{
				Name:        "List Users",
				Description: "Fetch all users",
				Request: &PostmanRequest{
					Method: "GET",
					URL:    PostmanURL{Raw: "https://api.example.com/users"},
				},
			},
			{
				Name: "Create User",
				Request: &PostmanRequest{
					Method: "POST",
					URL:    PostmanURL{Raw: "https://api.example.com/users"},
					Body: &PostmanBody{
						Mode: "raw",
						Raw:  `{"name":"alice"}`,
					},
				},
			},
		},
	}

	if err := service.importPostmanCollection(context.Background(), projectID, parentID, pmCol); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(collectionService.created) != 1 {
		t.Fatalf("expected 1 collection to be created, got %d", len(collectionService.created))
	}

	rootCollection := collectionService.created[0]
	if rootCollection.Name != "User API" {
		t.Fatalf("expected root collection name to be preserved, got %q", rootCollection.Name)
	}
	if rootCollection.ParentID == nil || *rootCollection.ParentID != parentID {
		t.Fatalf("expected root collection parent to be %s, got %#v", parentID, rootCollection.ParentID)
	}
	if rootCollection.IsFolder {
		t.Fatal("expected imported root collection to be a request collection, got folder")
	}

	if len(requestService.created) != 2 {
		t.Fatalf("expected 2 requests to be created, got %d", len(requestService.created))
	}

	firstRequest := requestService.created[0]
	if firstRequest.CollectionID != "1" {
		t.Fatalf("expected first request to belong to root collection ID 1, got %s", firstRequest.CollectionID)
	}
	if firstRequest.Name != "List Users" {
		t.Fatalf("expected first request name to be preserved, got %q", firstRequest.Name)
	}
	if firstRequest.Description != "Fetch all users" {
		t.Fatalf("expected first request description to be preserved, got %q", firstRequest.Description)
	}
	if firstRequest.SortOrder != 0 {
		t.Fatalf("expected first request sort order 0, got %d", firstRequest.SortOrder)
	}

	secondRequest := requestService.created[1]
	if secondRequest.CollectionID != "1" {
		t.Fatalf("expected second request to belong to root collection ID 1, got %s", secondRequest.CollectionID)
	}
	if secondRequest.Name != "Create User" {
		t.Fatalf("expected second request name to be preserved, got %q", secondRequest.Name)
	}
	if secondRequest.SortOrder != 1 {
		t.Fatalf("expected second request sort order 1, got %d", secondRequest.SortOrder)
	}
}

func TestImportPostmanCollectionFlattensNestedFoldersIntoSingleCollection(t *testing.T) {
	collectionService := &stubCollectionService{}
	requestService := &stubRequestService{}
	service := NewService(collectionService, requestService).(*service)

	pmCol := &PostmanCollection{
		Info: PostmanInfo{Name: "Nested API"},
		Item: []PostmanItem{
			{
				Name: "Auth",
				Item: []PostmanItem{
					{
						Name: "Login",
						Request: &PostmanRequest{
							Method: "POST",
							URL:    PostmanURL{Raw: "https://api.example.com/login"},
						},
					},
					{
						Name: "Refresh Token",
						Request: &PostmanRequest{
							Method: "POST",
							URL:    PostmanURL{Raw: "https://api.example.com/refresh"},
						},
					},
				},
			},
			{
				Name: "Health",
				Request: &PostmanRequest{
					Method: "GET",
					URL:    PostmanURL{Raw: "https://api.example.com/health"},
				},
			},
		},
	}

	if err := service.importPostmanCollection(context.Background(), "3", "", pmCol); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(collectionService.created) != 1 {
		t.Fatalf("expected only one collection to be created, got %d", len(collectionService.created))
	}
	if len(requestService.created) != 3 {
		t.Fatalf("expected 3 requests to be created, got %d", len(requestService.created))
	}

	expectedNames := []string{"Login", "Refresh Token", "Health"}
	for i, createdRequest := range requestService.created {
		if createdRequest.Name != expectedNames[i] {
			t.Fatalf("expected request %d to be %q, got %q", i, expectedNames[i], createdRequest.Name)
		}
		if createdRequest.CollectionID != "1" {
			t.Fatalf("expected request %q to belong to root collection ID 1, got %s", createdRequest.Name, createdRequest.CollectionID)
		}
		if createdRequest.SortOrder != i {
			t.Fatalf("expected request %q sort order %d, got %d", createdRequest.Name, i, createdRequest.SortOrder)
		}
	}
}

type stubCollectionService struct {
	created   []*collection.CreateCollectionRequest
	nextID    int
	createErr error
}

func (s *stubCollectionService) Create(_ context.Context, req *collection.CreateCollectionRequest) (*collection.Collection, error) {
	if s.createErr != nil {
		return nil, s.createErr
	}

	s.nextID++
	s.created = append(s.created, cloneCreateCollectionRequest(req))
	id := stringID(s.nextID)

	return &collection.Collection{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		ProjectID:   req.ProjectID,
		ParentID:    cloneStringPtr(req.ParentID),
		IsFolder:    req.IsFolder,
		SortOrder:   req.SortOrder,
	}, nil
}

func (s *stubCollectionService) GetByID(context.Context, string, string) (*collection.Collection, error) {
	return nil, nil
}

func (s *stubCollectionService) Update(context.Context, string, string, *collection.UpdateCollectionRequest) (*collection.Collection, error) {
	return nil, nil
}

func (s *stubCollectionService) Delete(context.Context, string, string) error {
	return nil
}

func (s *stubCollectionService) List(context.Context, string, int, int) ([]*collection.Collection, int64, error) {
	return nil, 0, nil
}

func (s *stubCollectionService) GetTree(context.Context, string) ([]*collection.CollectionTreeNode, error) {
	return nil, nil
}

func (s *stubCollectionService) Move(context.Context, string, string, *collection.MoveCollectionRequest) (*collection.Collection, error) {
	return nil, nil
}

type stubRequestService struct {
	created []*request.CreateRequestRequest
	nextID  int
}

func (s *stubRequestService) Create(_ context.Context, _ string, req *request.CreateRequestRequest) (*request.Request, error) {
	s.nextID++
	s.created = append(s.created, cloneCreateRequestRequest(req))
	id := stringID(s.nextID)

	return &request.Request{
		ID:           id,
		CollectionID: req.CollectionID,
		Name:         req.Name,
		Description:  req.Description,
		Method:       req.Method,
		URL:          req.URL,
		Headers:      append([]request.KeyValue(nil), req.Headers...),
		QueryParams:  append([]request.KeyValue(nil), req.QueryParams...),
		Body:         req.Body,
		BodyType:     req.BodyType,
		SortOrder:    req.SortOrder,
	}, nil
}

func (s *stubRequestService) GetByID(context.Context, string, string, string) (*request.Request, error) {
	return nil, nil
}

func (s *stubRequestService) Update(context.Context, string, string, string, *request.UpdateRequestRequest) (*request.Request, error) {
	return nil, nil
}

func (s *stubRequestService) Delete(context.Context, string, string, string) error {
	return nil
}

func (s *stubRequestService) List(context.Context, string, string, int, int) ([]*request.Request, int64, error) {
	return nil, 0, nil
}

func (s *stubRequestService) Move(context.Context, string, string, string, *request.MoveRequestRequest) (*request.Request, error) {
	return nil, nil
}

func (s *stubRequestService) Rollback(context.Context, string, string, string) (*request.Request, error) {
	return nil, nil
}

func cloneCreateCollectionRequest(req *collection.CreateCollectionRequest) *collection.CreateCollectionRequest {
	if req == nil {
		return nil
	}

	return &collection.CreateCollectionRequest{
		ProjectID:   req.ProjectID,
		Name:        req.Name,
		Description: req.Description,
		ParentID:    cloneStringPtr(req.ParentID),
		IsFolder:    req.IsFolder,
		SortOrder:   req.SortOrder,
	}
}

func cloneCreateRequestRequest(req *request.CreateRequestRequest) *request.CreateRequestRequest {
	if req == nil {
		return nil
	}

	return &request.CreateRequestRequest{
		CollectionID: req.CollectionID,
		Name:         req.Name,
		Description:  req.Description,
		Method:       req.Method,
		URL:          req.URL,
		Headers:      append([]request.KeyValue(nil), req.Headers...),
		QueryParams:  append([]request.KeyValue(nil), req.QueryParams...),
		PathParams:   req.PathParams,
		Body:         req.Body,
		BodyType:     req.BodyType,
		Auth:         req.Auth,
		PreRequest:   req.PreRequest,
		Test:         req.Test,
		SortOrder:    req.SortOrder,
	}
}

func cloneStringPtr(value *string) *string {
	if value == nil {
		return nil
	}

	cloned := *value
	return &cloned
}

func stringID(value int) string {
	return strconv.Itoa(value)
}
