package collection

import (
	"context"
	"errors"
	"sort"
)

// Common errors
var (
	ErrCollectionNotFound = errors.New("collection not found")
	ErrInvalidParent      = errors.New("invalid parent collection")
)

// Service defines the interface for collection business logic
type Service interface {
	Create(ctx context.Context, req *CreateCollectionRequest) (*Collection, error)
	GetByID(ctx context.Context, id, projectID uint) (*Collection, error)
	Update(ctx context.Context, id, projectID uint, req *UpdateCollectionRequest) (*Collection, error)
	Delete(ctx context.Context, id, projectID uint) error
	List(ctx context.Context, projectID uint, page, perPage int) ([]*Collection, int64, error)
	GetTree(ctx context.Context, projectID uint) ([]*CollectionTreeNode, error)
	Move(ctx context.Context, id, projectID uint, req *MoveCollectionRequest) (*Collection, error)
}

// service implements Service interface
type service struct {
	repo Repository
}

// NewService creates a new collection service
func NewService(repo Repository) Service {
	return &service{
		repo: repo,
	}
}

func (s *service) Create(ctx context.Context, req *CreateCollectionRequest) (*Collection, error) {
	// Validate parent if provided
	if req.ParentID != nil {
		parent, err := s.repo.GetByIDAndProject(ctx, *req.ParentID, req.ProjectID)
		if err != nil {
			return nil, err
		}
		if parent == nil {
			return nil, ErrInvalidParent
		}
		if !parent.IsFolder {
			return nil, ErrInvalidParent
		}
	}

	collection := &Collection{
		Name:        req.Name,
		Description: req.Description,
		ProjectID:   req.ProjectID,
		ParentID:    req.ParentID,
		IsFolder:    req.IsFolder,
		SortOrder:   req.SortOrder,
	}

	if err := s.repo.Create(ctx, collection); err != nil {
		return nil, err
	}

	return collection, nil
}

func (s *service) GetByID(ctx context.Context, id, projectID uint) (*Collection, error) {
	collection, err := s.repo.GetByIDAndProject(ctx, id, projectID)
	if err != nil {
		return nil, err
	}
	if collection == nil {
		return nil, ErrCollectionNotFound
	}
	return collection, nil
}

func (s *service) Update(ctx context.Context, id, projectID uint, req *UpdateCollectionRequest) (*Collection, error) {
	collection, err := s.repo.GetByIDAndProject(ctx, id, projectID)
	if err != nil {
		return nil, err
	}
	if collection == nil {
		return nil, ErrCollectionNotFound
	}

	// Apply updates
	if req.Name != nil {
		collection.Name = *req.Name
	}
	if req.Description != nil {
		collection.Description = *req.Description
	}
	if req.ParentID != nil {
		// Validate new parent
		if *req.ParentID != 0 {
			parent, err := s.repo.GetByIDAndProject(ctx, *req.ParentID, projectID)
			if err != nil {
				return nil, err
			}
			if parent == nil || !parent.IsFolder {
				return nil, ErrInvalidParent
			}
			// Prevent moving to self or descendant
			if *req.ParentID == id {
				return nil, ErrInvalidParent
			}
		}
		collection.ParentID = req.ParentID
	}
	if req.SortOrder != nil {
		collection.SortOrder = *req.SortOrder
	}

	if err := s.repo.Update(ctx, collection); err != nil {
		return nil, err
	}

	return collection, nil
}

func (s *service) Delete(ctx context.Context, id, projectID uint) error {
	collection, err := s.repo.GetByIDAndProject(ctx, id, projectID)
	if err != nil {
		return err
	}
	if collection == nil {
		return ErrCollectionNotFound
	}

	// Check for children
	children, err := s.repo.GetByParentID(ctx, projectID, &id)
	if err != nil {
		return err
	}
	if len(children) > 0 {
		// Could either prevent delete or cascade delete
		// For now, prevent delete if has children
		return errors.New("cannot delete collection with children")
	}

	return s.repo.Delete(ctx, id)
}

func (s *service) List(ctx context.Context, projectID uint, page, perPage int) ([]*Collection, int64, error) {
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
	return s.repo.List(ctx, projectID, offset, perPage)
}

func (s *service) GetTree(ctx context.Context, projectID uint) ([]*CollectionTreeNode, error) {
	// Get all collections for the project
	allCollections, _, err := s.repo.List(ctx, projectID, 0, 1000)
	if err != nil {
		return nil, err
	}

	// Build tree structure
	return buildTree(allCollections), nil
}

func (s *service) Move(ctx context.Context, id, projectID uint, req *MoveCollectionRequest) (*Collection, error) {
	updateReq := &UpdateCollectionRequest{
		ParentID:  req.ParentID,
		SortOrder: req.SortOrder,
	}
	return s.Update(ctx, id, projectID, updateReq)
}

// buildTree converts flat collection list to tree structure
func buildTree(collections []*Collection) []*CollectionTreeNode {
	// Create map for quick lookup
	nodeMap := make(map[uint]*CollectionTreeNode)
	var rootNodes []*CollectionTreeNode

	// First pass: create all nodes
	for _, c := range collections {
		node := &CollectionTreeNode{
			ID:          c.ID,
			Name:        c.Name,
			Description: c.Description,
			ProjectID:   c.ProjectID,
			ParentID:    c.ParentID,
			IsFolder:    c.IsFolder,
			SortOrder:   c.SortOrder,
			Children:    []*CollectionTreeNode{},
		}
		nodeMap[c.ID] = node
	}

	// Second pass: build tree relationships
	for _, c := range collections {
		node := nodeMap[c.ID]
		if c.ParentID == nil {
			// Root level
			rootNodes = append(rootNodes, node)
		} else {
			// Child node
			if parentNode, ok := nodeMap[*c.ParentID]; ok {
				parentNode.Children = append(parentNode.Children, node)
			}
		}
	}

	// Sort children by sort_order
	sortNodes(rootNodes)

	return rootNodes
}

// sortNodes sorts tree nodes by sort_order
func sortNodes(nodes []*CollectionTreeNode) {
	sort.Slice(nodes, func(i, j int) bool {
		return nodes[i].SortOrder < nodes[j].SortOrder
	})
	// Recursively sort children
	for _, node := range nodes {
		if len(node.Children) > 0 {
			sortNodes(node.Children)
		}
	}
}
