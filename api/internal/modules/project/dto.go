package project

// CreateProjectRequest is the request body for creating a project
type CreateProjectRequest struct {
	Name     string `json:"name" binding:"required,min=1,max=100"`
	Slug     string `json:"slug" binding:"omitempty,min=1,max=50"`
	Platform string `json:"platform" binding:"omitempty,oneof=go javascript python java ruby php csharp"`
}

// UpdateProjectRequest is the request body for updating a project
type UpdateProjectRequest struct {
	Name     string `json:"name" binding:"omitempty,min=1,max=100"`
	Platform string `json:"platform" binding:"omitempty,oneof=go javascript python java ruby php csharp"`
	Status   *int   `json:"status" binding:"omitempty,oneof=0 1"`
}

// ProjectResponse is the response for project endpoints
type ProjectResponse struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	Platform  string `json:"platform"`
	Status    int    `json:"status"`
	CreatedAt string `json:"created_at"`
}

// ProjectListResponse is the response for listing projects
type ProjectListResponse struct {
	ID       uint   `json:"id"`
	Name     string `json:"name"`
	Slug     string `json:"slug"`
	Platform string `json:"platform"`
	Status   int    `json:"status"`
}

// toResponse converts Project to ProjectResponse
func toResponse(p *Project) *ProjectResponse {
	if p == nil {
		return nil
	}
	return &ProjectResponse{
		ID:        p.ID,
		Name:      p.Name,
		Slug:      p.Slug,
		Platform:  p.Platform,
		Status:    p.Status,
		CreatedAt: p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// toListResponse converts Project to ProjectListResponse
func toListResponse(p *Project) *ProjectListResponse {
	if p == nil {
		return nil
	}
	return &ProjectListResponse{
		ID:       p.ID,
		Name:     p.Name,
		Slug:     p.Slug,
		Platform: p.Platform,
		Status:   p.Status,
	}
}

// toListResponseSlice converts a slice of Projects to ProjectListResponse slice
func toListResponseSlice(projects []*Project) []*ProjectListResponse {
	result := make([]*ProjectListResponse, len(projects))
	for i, p := range projects {
		result[i] = toListResponse(p)
	}
	return result
}
