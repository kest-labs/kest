package project

import (
	"context"
	"testing"
)

type testProjectRepo struct {
	project        *Project
	projectBySlug  map[string]*Project
	updatedProject *Project
}

func (r *testProjectRepo) Create(ctx context.Context, project *Project) error { return nil }
func (r *testProjectRepo) GetByID(ctx context.Context, id string) (*Project, error) {
	if r.project == nil || r.project.ID != id {
		return nil, nil
	}
	return r.project, nil
}
func (r *testProjectRepo) GetBySlug(ctx context.Context, slug string) (*Project, error) {
	if r.projectBySlug == nil {
		return nil, nil
	}
	return r.projectBySlug[slug], nil
}
func (r *testProjectRepo) Update(ctx context.Context, project *Project) error {
	projectCopy := *project
	r.project = &projectCopy
	r.updatedProject = &projectCopy
	return nil
}
func (r *testProjectRepo) Delete(ctx context.Context, id string) error { return nil }
func (r *testProjectRepo) List(ctx context.Context, userID string, offset, limit int) ([]*Project, int64, error) {
	return nil, 0, nil
}
func (r *testProjectRepo) GetStats(ctx context.Context, projectID string) (*ProjectStats, error) {
	return &ProjectStats{}, nil
}

func TestUpdateProjectAppliesEditableFields(t *testing.T) {
	repo := &testProjectRepo{
		project: &Project{
			ID:       "12",
			Name:     "Catalog API",
			Slug:     "catalog-api",
			Platform: "go",
			Status:   1,
		},
	}
	svc := NewService(repo, nil)
	inactive := 0

	project, err := svc.Update(context.Background(), "12", &UpdateProjectRequest{
		Name:     "Catalog Admin API",
		Platform: "python",
		Status:   &inactive,
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	if project.Name != "Catalog Admin API" {
		t.Fatalf("expected updated name, got %q", project.Name)
	}
	if project.Slug != "catalog-api" {
		t.Fatalf("expected slug to remain unchanged, got %q", project.Slug)
	}
	if project.Platform != "python" {
		t.Fatalf("expected updated platform, got %q", project.Platform)
	}
	if project.Status != inactive {
		t.Fatalf("expected updated status %d, got %d", inactive, project.Status)
	}
	if repo.updatedProject == nil || repo.updatedProject.Slug != "catalog-api" {
		t.Fatal("expected repository update to preserve the original slug")
	}
}
