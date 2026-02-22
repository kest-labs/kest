package collection

import "time"

// CreateCollectionRequest is the request body for creating a collection
type CreateCollectionRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=100"`
	Description string `json:"description" binding:"max=500"`
	ProjectID   uint   `json:"project_id"`
	ParentID    *uint  `json:"parent_id,omitempty"`
	IsFolder    bool   `json:"is_folder"`
	SortOrder   int    `json:"sort_order"`
}

// UpdateCollectionRequest is the request body for updating a collection
type UpdateCollectionRequest struct {
	Name        *string `json:"name" binding:"omitempty,min=1,max=100"`
	Description *string `json:"description" binding:"omitempty,max=500"`
	ParentID    *uint   `json:"parent_id,omitempty"`
	SortOrder   *int    `json:"sort_order,omitempty"`
}

// MoveCollectionRequest is the request body for moving a collection
type MoveCollectionRequest struct {
	ParentID  *uint `json:"parent_id,omitempty"`
	SortOrder *int  `json:"sort_order,omitempty"`
}

// CollectionResponse is the response for collection endpoints
type CollectionResponse struct {
	ID          uint      `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	ProjectID   uint      `json:"project_id"`
	ParentID    *uint     `json:"parent_id,omitempty"`
	IsFolder    bool      `json:"is_folder"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CollectionTreeNode represents a collection in tree structure
type CollectionTreeNode struct {
	ID           uint                  `json:"id"`
	Name         string                `json:"name"`
	Description  string                `json:"description"`
	ProjectID    uint                  `json:"project_id"`
	ParentID     *uint                 `json:"parent_id,omitempty"`
	IsFolder     bool                  `json:"is_folder"`
	SortOrder    int                   `json:"sort_order"`
	Children     []*CollectionTreeNode `json:"children,omitempty"`
	RequestCount int                   `json:"request_count,omitempty"`
}

// toResponse converts Collection to CollectionResponse
func toResponse(c *Collection) *CollectionResponse {
	if c == nil {
		return nil
	}
	return &CollectionResponse{
		ID:          c.ID,
		Name:        c.Name,
		Description: c.Description,
		ProjectID:   c.ProjectID,
		ParentID:    c.ParentID,
		IsFolder:    c.IsFolder,
		SortOrder:   c.SortOrder,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

// toResponseSlice converts a slice of Collections to CollectionResponse slice
func toResponseSlice(collections []*Collection) []*CollectionResponse {
	result := make([]*CollectionResponse, len(collections))
	for i, c := range collections {
		result[i] = toResponse(c)
	}
	return result
}
