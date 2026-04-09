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
	parentID := normalizeParentID(req.ParentID)

	// Validate parent if provided
	if parentID != nil {
		parent, err := s.repo.GetByIDAndProject(ctx, *parentID, req.ProjectID)
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
		ParentID:    parentID,
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
		parentID := normalizeParentID(req.ParentID)

		// Validate new parent
		if parentID != nil {
			parent, err := s.repo.GetByIDAndProject(ctx, *parentID, projectID)
			if err != nil {
				return nil, err
			}
			if parent == nil || !parent.IsFolder {
				return nil, ErrInvalidParent
			}
			// Prevent moving to self or descendant.
			if *parentID == id {
				return nil, ErrInvalidParent
			}

			createsCycle, err := s.wouldCreateCycle(ctx, projectID, id, *parentID)
			if err != nil {
				return nil, err
			}
			if createsCycle {
				return nil, ErrInvalidParent
			}
		}

		collection.ParentID = parentID
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
	allCollections, err := s.repo.ListAll(ctx, projectID)
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

func (s *service) wouldCreateCycle(ctx context.Context, projectID, collectionID, parentID uint) (bool, error) {
	visited := map[uint]struct{}{}
	currentID := parentID

	for currentID != 0 {
		if currentID == collectionID {
			return true, nil
		}
		if _, seen := visited[currentID]; seen {
			return true, nil
		}
		visited[currentID] = struct{}{}

		current, err := s.repo.GetByIDAndProject(ctx, currentID, projectID)
		if err != nil {
			return false, err
		}
		if current == nil || current.ParentID == nil {
			return false, nil
		}

		currentID = *current.ParentID
	}

	return false, nil
}

func normalizeParentID(parentID *uint) *uint {
	if parentID == nil || *parentID == 0 {
		return nil
	}

	return parentID
}

// buildTree converts flat collection list to tree structure
func buildTree(collections []*Collection) []*CollectionTreeNode {
	nodeMap := make(map[uint]*CollectionTreeNode)
	collectionMap := make(map[uint]*Collection)
	var rootNodes []*CollectionTreeNode

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
		collectionMap[c.ID] = c
	}

	for _, c := range collections {
		node := nodeMap[c.ID]
		parentID, ok := resolveTreeParentID(c, collectionMap)
		if !ok {
			rootNodes = append(rootNodes, node)
			continue
		}

		parentNode, exists := nodeMap[parentID]
		if !exists {
			rootNodes = append(rootNodes, node)
			continue
		}

		parentNode.Children = append(parentNode.Children, node)
	}

	sortNodes(rootNodes)

	return rootNodes
}

func resolveTreeParentID(collection *Collection, collectionMap map[uint]*Collection) (uint, bool) {
	if collection == nil || collection.ParentID == nil {
		return 0, false
	}

	immediateParentID := *collection.ParentID
	visited := map[uint]struct{}{collection.ID: {}}
	currentID := immediateParentID

	for currentID != 0 {
		if _, seen := visited[currentID]; seen {
			return 0, false
		}
		visited[currentID] = struct{}{}

		parent, exists := collectionMap[currentID]
		if !exists {
			return 0, false
		}
		if parent.ParentID == nil {
			return immediateParentID, true
		}

		currentID = *parent.ParentID
	}

	return 0, false
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
