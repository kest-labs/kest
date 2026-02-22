package export

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/kest-labs/kest/api/internal/modules/collection"
	"github.com/kest-labs/kest/api/internal/modules/request"
)

type PostmanCollection struct {
	Info  PostmanInfo    `json:"info"`
	Item  []PostmanItem  `json:"item"`
	Event []PostmanEvent `json:"event,omitempty"`
}

type PostmanInfo struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Schema      string `json:"schema"`
}

type PostmanItem struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Item        []PostmanItem   `json:"item,omitempty"`
	Request     *PostmanRequest `json:"request,omitempty"`
	Event       []PostmanEvent  `json:"event,omitempty"`
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
	Type  string `json:"type,omitempty"`
}

type PostmanURL struct {
	Raw   string              `json:"raw"`
	Host  []string            `json:"host,omitempty"`
	Path  []string            `json:"path,omitempty"`
	Query []PostmanQueryParam `json:"query,omitempty"`
}

type PostmanQueryParam struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type PostmanBody struct {
	Mode       string            `json:"mode"`
	Raw        string            `json:"raw,omitempty"`
	Formdata   []PostmanFormData `json:"formdata,omitempty"`
	Urlencoded []PostmanFormData `json:"urlencoded,omitempty"`
}

type PostmanFormData struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	Type  string `json:"type"`
}

type PostmanEvent struct {
	Listen string        `json:"listen"`
	Script PostmanScript `json:"script"`
}

type PostmanScript struct {
	Type string   `json:"type"`
	Exec []string `json:"exec"`
}

type Service interface {
	ExportPostman(ctx context.Context, projectID, collectionID uint) ([]byte, error)
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

func (s *service) ExportPostman(ctx context.Context, projectID, collectionID uint) ([]byte, error) {
	col, err := s.collectionService.GetByID(ctx, collectionID, projectID)
	if err != nil {
		return nil, err
	}

	tree, err := s.collectionService.GetTree(ctx, projectID)
	if err != nil {
		return nil, err
	}

	var targetNode *collection.CollectionTreeNode
	for _, node := range tree {
		if found := findNode(node, collectionID); found != nil {
			targetNode = found
			break
		}
	}

	if targetNode == nil {
		return nil, fmt.Errorf("collection not found in tree")
	}

	postmanCol := &PostmanCollection{
		Info: PostmanInfo{
			Name:        col.Name,
			Description: col.Description,
			Schema:      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		},
		Item: s.buildPostmanItems(ctx, targetNode.Children),
	}

	return json.MarshalIndent(postmanCol, "", "  ")
}

func findNode(node *collection.CollectionTreeNode, id uint) *collection.CollectionTreeNode {
	if node.ID == id {
		return node
	}
	for _, child := range node.Children {
		if found := findNode(child, id); found != nil {
			return found
		}
	}
	return nil
}

func (s *service) buildPostmanItems(ctx context.Context, nodes []*collection.CollectionTreeNode) []PostmanItem {
	items := make([]PostmanItem, 0, len(nodes))
	for _, node := range nodes {
		item := PostmanItem{
			Name:        node.Name,
			Description: node.Description,
		}

		if node.IsFolder {
			item.Item = s.buildPostmanItems(ctx, node.Children)
		} else {
			// It's a request, we need to fetch its details
			// Assuming Collection = Request mapping (1:1) in this implementation pattern
			reqs, _, err := s.requestService.List(ctx, node.ID, 1, 100)
			if err == nil && len(reqs) > 0 {
				req := reqs[0] // take the first request in the collection node
				item.Request = s.convertToPostmanRequest(req)
			}
		}
		items = append(items, item)
	}
	return items
}

func (s *service) convertToPostmanRequest(req *request.Request) *PostmanRequest {
	pr := &PostmanRequest{
		Method: req.Method,
		URL: PostmanURL{
			Raw: req.URL,
		},
	}

	for _, h := range req.Headers {
		if h.Enabled {
			pr.Header = append(pr.Header, PostmanHeader{
				Key:   h.Key,
				Value: h.Value,
			})
		}
	}

	if req.BodyType != "none" && req.Body != "" {
		pr.Body = &PostmanBody{
			Mode: req.BodyType,
			Raw:  req.Body,
		}
	}

	return pr
}
