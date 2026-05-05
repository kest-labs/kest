package collection

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestServiceUpdateRejectsDescendantParent(t *testing.T) {
	projectID := "1"
	rootID := "1"
	childID := "2"

	repo := &stubCollectionRepository{
		collections: map[string]*Collection{
			rootID: {
				ID:        rootID,
				Name:      "Root",
				ProjectID: projectID,
				IsFolder:  true,
			},
			childID: {
				ID:        childID,
				Name:      "Child",
				ProjectID: projectID,
				ParentID:  stringPtr(rootID),
				IsFolder:  true,
			},
		},
	}

	service := NewService(repo)
	req := &UpdateCollectionRequest{
		ParentID: stringPtr(childID),
	}

	_, err := service.Update(context.Background(), rootID, projectID, req)
	if !errors.Is(err, ErrInvalidParent) {
		t.Fatalf("expected ErrInvalidParent, got %v", err)
	}
}

func TestServiceGetTreeHandlesCorruptHierarchy(t *testing.T) {
	projectID := "1"
	cycleA := "1"
	cycleB := "2"
	orphanParent := "999"

	repo := &stubCollectionRepository{
		collections: map[string]*Collection{
			cycleA: {
				ID:        cycleA,
				Name:      "Cycle A",
				ProjectID: projectID,
				ParentID:  stringPtr(cycleB),
				IsFolder:  true,
				SortOrder: 2,
			},
			cycleB: {
				ID:        cycleB,
				Name:      "Cycle B",
				ProjectID: projectID,
				ParentID:  stringPtr(cycleA),
				IsFolder:  true,
				SortOrder: 1,
			},
			"3": {
				ID:        "3",
				Name:      "Orphan",
				ProjectID: projectID,
				ParentID:  stringPtr(orphanParent),
				IsFolder:  false,
				SortOrder: 3,
			},
		},
	}

	service := NewService(repo)
	tree, err := service.GetTree(context.Background(), projectID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if repo.listAllCalls != 1 {
		t.Fatalf("expected ListAll to be called once, got %d", repo.listAllCalls)
	}

	if len(tree) != 3 {
		t.Fatalf("expected all corrupt nodes to be surfaced as roots, got %d root nodes", len(tree))
	}

	if _, err := json.Marshal(tree); err != nil {
		t.Fatalf("expected tree to be JSON serializable, got %v", err)
	}
}

type stubCollectionRepository struct {
	collections  map[string]*Collection
	listAllCalls int
}

func (r *stubCollectionRepository) Create(_ context.Context, collection *Collection) error {
	r.collections[collection.ID] = cloneCollection(collection)
	return nil
}

func (r *stubCollectionRepository) GetByID(_ context.Context, id string) (*Collection, error) {
	return cloneCollection(r.collections[id]), nil
}

func (r *stubCollectionRepository) GetByIDAndProject(_ context.Context, id, projectID string) (*Collection, error) {
	collection := r.collections[id]
	if collection == nil || collection.ProjectID != projectID {
		return nil, nil
	}

	return cloneCollection(collection), nil
}

func (r *stubCollectionRepository) Update(_ context.Context, collection *Collection) error {
	r.collections[collection.ID] = cloneCollection(collection)
	return nil
}

func (r *stubCollectionRepository) Delete(_ context.Context, id string) error {
	delete(r.collections, id)
	return nil
}

func (r *stubCollectionRepository) List(_ context.Context, projectID string, _, _ int) ([]*Collection, int64, error) {
	var collections []*Collection
	for _, collection := range r.collections {
		if collection.ProjectID == projectID {
			collections = append(collections, cloneCollection(collection))
		}
	}

	return collections, int64(len(collections)), nil
}

func (r *stubCollectionRepository) ListAll(_ context.Context, projectID string) ([]*Collection, error) {
	r.listAllCalls++

	var collections []*Collection
	for _, collection := range r.collections {
		if collection.ProjectID == projectID {
			collections = append(collections, cloneCollection(collection))
		}
	}

	return collections, nil
}

func (r *stubCollectionRepository) GetByParentID(_ context.Context, projectID string, parentID *string) ([]*Collection, error) {
	var collections []*Collection
	for _, collection := range r.collections {
		if collection.ProjectID != projectID {
			continue
		}

		if parentID == nil && collection.ParentID == nil {
			collections = append(collections, cloneCollection(collection))
			continue
		}

		if parentID != nil && collection.ParentID != nil && *collection.ParentID == *parentID {
			collections = append(collections, cloneCollection(collection))
		}
	}

	return collections, nil
}

func (r *stubCollectionRepository) GetStats(_ context.Context, _ string) (*CollectionStats, error) {
	return &CollectionStats{}, nil
}

func cloneCollection(collection *Collection) *Collection {
	if collection == nil {
		return nil
	}

	cloned := *collection
	if collection.ParentID != nil {
		cloned.ParentID = stringPtr(*collection.ParentID)
	}

	return &cloned
}

func stringPtr(value string) *string {
	return &value
}
