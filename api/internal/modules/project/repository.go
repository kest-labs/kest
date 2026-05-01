package project

import (
	"context"
	"errors"
	"time"

	"github.com/kest-labs/kest/api/pkg/dbutil"
	"gorm.io/gorm"
)

// ProjectStats holds aggregate counts for a project
type ProjectStats struct {
	APISpecCount     int64 `json:"api_spec_count"`
	FlowCount        int64 `json:"flow_count"`
	EnvironmentCount int64 `json:"environment_count"`
	MemberCount      int64 `json:"member_count"`
	CategoryCount    int64 `json:"category_count"`
}

// Repository defines the interface for project data access
type Repository interface {
	Create(ctx context.Context, project *Project) error
	GetByID(ctx context.Context, id string) (*Project, error)
	GetBySlug(ctx context.Context, slug string) (*Project, error)
	Update(ctx context.Context, project *Project) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, userID string, offset, limit int) ([]*Project, int64, error)
	GetStats(ctx context.Context, projectID string) (*ProjectStats, error)
	CreateCLIToken(ctx context.Context, token *ProjectCLIToken, tokenHash string) error
	GetCLITokenByHash(ctx context.Context, tokenHash string) (*ProjectCLIToken, error)
	TouchCLIToken(ctx context.Context, id string, usedAt time.Time) error
}

// repository implements Repository interface
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new project repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, project *Project) error {
	po := newProjectPO(project)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}
	// Copy back the generated ID
	project.ID = po.ID
	project.CreatedAt = po.CreatedAt
	project.UpdatedAt = po.UpdatedAt
	return nil
}

func (r *repository) GetByID(ctx context.Context, id string) (*Project, error) {
	var po ProjectPO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) GetBySlug(ctx context.Context, slug string) (*Project, error) {
	var po ProjectPO
	if err := r.db.WithContext(ctx).Where("slug = ?", slug).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) Update(ctx context.Context, project *Project) error {
	po := newProjectPO(project)
	return r.db.WithContext(ctx).Model(&ProjectPO{}).Where("id = ?", project.ID).Updates(po).Error
}

func (r *repository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, statement := range projectDeleteStatements(id) {
			if !tx.Migrator().HasTable(statement.table) {
				continue
			}

			if err := tx.Exec(statement.sql, statement.args...).Error; err != nil {
				return err
			}
		}

		return tx.Exec("DELETE FROM projects WHERE id = ?", id).Error
	})
}

func (r *repository) List(ctx context.Context, userID string, offset, limit int) ([]*Project, int64, error) {
	var poList []*ProjectPO
	var total int64

	base := r.db.WithContext(ctx).
		Model(&ProjectPO{}).
		Joins("JOIN project_members ON project_members.project_id = projects.id").
		Where("project_members.user_id = ?", userID).
		Where("project_members.deleted_at IS NULL")

	if err := base.Distinct("projects.id").Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := base.
		Select("projects.*").
		Distinct().
		Offset(offset).
		Limit(limit).
		Order("projects.created_at DESC").
		Find(&poList).Error; err != nil {
		return nil, 0, err
	}

	return toDomainList(poList), total, nil
}

func (r *repository) GetStats(ctx context.Context, projectID string) (*ProjectStats, error) {
	stats := &ProjectStats{}
	db := r.db.WithContext(ctx)

	db.Table("api_specs").Where("project_id = ?", projectID).Count(&stats.APISpecCount)
	db.Table("api_flows").Where("project_id = ?", projectID).Count(&stats.FlowCount)
	db.Table("api_environments").Where("project_id = ?", projectID).Count(&stats.EnvironmentCount)
	db.Table("project_members").Where("project_id = ?", projectID).Count(&stats.MemberCount)
	db.Table("api_categories").Where("project_id = ?", projectID).Count(&stats.CategoryCount)

	return stats, nil
}

type projectDeleteStatement struct {
	table string
	sql   string
	args  []any
}

func projectDeleteStatements(projectID string) []projectDeleteStatement {
	specIDsSubquery := "SELECT id FROM api_specs WHERE project_id = ?"
	collectionIDsSubquery := "SELECT id FROM collections WHERE project_id = ?"
	requestIDsSubquery := "SELECT id FROM requests WHERE collection_id IN (" + collectionIDsSubquery + ")"
	flowIDsSubquery := "SELECT id FROM api_flows WHERE project_id = ?"
	flowRunIDsSubquery := "SELECT id FROM api_flow_runs WHERE flow_id IN (" + flowIDsSubquery + ")"
	testCaseIDsSubquery := "SELECT id FROM test_cases WHERE api_spec_id IN (" + specIDsSubquery + ")"

	return []projectDeleteStatement{
		{
			table: "test_runs",
			sql:   "DELETE FROM test_runs WHERE test_case_id IN (" + testCaseIDsSubquery + ")",
			args:  []any{projectID},
		},
		{
			table: "test_cases",
			sql:   "DELETE FROM test_cases WHERE api_spec_id IN (" + specIDsSubquery + ")",
			args:  []any{projectID},
		},
		{
			table: "api_examples",
			sql:   "DELETE FROM api_examples WHERE api_spec_id IN (" + specIDsSubquery + ")",
			args:  []any{projectID},
		},
		{
			table: "api_spec_shares",
			sql:   "DELETE FROM api_spec_shares WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "api_spec_ai_drafts",
			sql:   "DELETE FROM api_spec_ai_drafts WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "api_specs",
			sql:   "DELETE FROM api_specs WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "examples",
			sql:   "DELETE FROM examples WHERE request_id IN (" + requestIDsSubquery + ")",
			args:  []any{projectID},
		},
		{
			table: "requests",
			sql:   "DELETE FROM requests WHERE collection_id IN (" + collectionIDsSubquery + ")",
			args:  []any{projectID},
		},
		{
			table: "collections",
			sql:   "DELETE FROM collections WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "api_flow_step_results",
			sql:   "DELETE FROM api_flow_step_results WHERE run_id IN (" + flowRunIDsSubquery + ")",
			args:  []any{projectID},
		},
		{
			table: "api_flow_runs",
			sql:   "DELETE FROM api_flow_runs WHERE flow_id IN (" + flowIDsSubquery + ")",
			args:  []any{projectID},
		},
		{
			table: "api_flow_edges",
			sql:   "DELETE FROM api_flow_edges WHERE flow_id IN (" + flowIDsSubquery + ")",
			args:  []any{projectID},
		},
		{
			table: "api_flow_steps",
			sql:   "DELETE FROM api_flow_steps WHERE flow_id IN (" + flowIDsSubquery + ")",
			args:  []any{projectID},
		},
		{
			table: "api_flows",
			sql:   "DELETE FROM api_flows WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "api_categories",
			sql:   "DELETE FROM api_categories WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "environments",
			sql:   "DELETE FROM environments WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "api_environments",
			sql:   "DELETE FROM api_environments WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "history",
			sql:   "DELETE FROM history WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "audit_logs",
			sql:   "DELETE FROM audit_logs WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "project_cli_tokens",
			sql:   "DELETE FROM project_cli_tokens WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "project_invitations",
			sql:   "DELETE FROM project_invitations WHERE project_id = ?",
			args:  []any{projectID},
		},
		{
			table: "project_members",
			sql:   "DELETE FROM project_members WHERE project_id = ?",
			args:  []any{projectID},
		},
	}
}
