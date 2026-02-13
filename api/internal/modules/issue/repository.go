package issue

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/kest-labs/kest/api/internal/modules/envelope"
)

// Repository defines the interface for issue storage operations
type Repository interface {
	// GetByFingerprint gets a single issue by project ID and fingerprint
	GetByFingerprint(ctx context.Context, projectID uint64, fingerprint string) (*Issue, error)

	// List returns issues for a project with optional filters
	List(ctx context.Context, projectID uint64, opts ListOptions) ([]*Issue, int64, error)

	// UpdateStatus updates the status of an issue
	UpdateStatus(ctx context.Context, projectID uint64, fingerprint string, status IssueStatus) error

	// GetEvents returns events for a specific issue
	GetEvents(ctx context.Context, projectID uint64, fingerprint string, opts EventListOptions) ([]*envelope.Event, int64, error)

	// InitSchema creates the issues table and materialized view
	InitSchema(ctx context.Context) error
}

// ListOptions contains filters for listing issues
type ListOptions struct {
	Page    int
	PerPage int
	Status  IssueStatus // filter by status (empty = all)
	Level   string      // filter by level (empty = all)
	SortBy  string      // "first_seen", "last_seen", "event_count"
	Order   string      // "asc", "desc"
}

// EventListOptions contains options for listing events of an issue
type EventListOptions struct {
	Page    int
	PerPage int
	SortBy  string // "timestamp"
	Order   string // "asc", "desc"
}

// repository implements Repository using ClickHouse
type repository struct {
	conn driver.Conn
}

// NewRepository creates a new issue repository
func NewRepository(conn driver.Conn) (Repository, error) {
	if conn == nil {
		return &noOpRepository{}, nil
	}

	repo := &repository{conn: conn}

	// Initialize schema on startup
	if err := repo.InitSchema(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return repo, nil
}

type noOpRepository struct{}

func (r *noOpRepository) GetByFingerprint(ctx context.Context, projectID uint64, fingerprint string) (*Issue, error) {
	return nil, fmt.Errorf("clickhouse not enabled")
}

func (r *noOpRepository) List(ctx context.Context, projectID uint64, opts ListOptions) ([]*Issue, int64, error) {
	return []*Issue{}, 0, nil
}

func (r *noOpRepository) UpdateStatus(ctx context.Context, projectID uint64, fingerprint string, status IssueStatus) error {
	return nil
}

func (r *noOpRepository) GetEvents(ctx context.Context, projectID uint64, fingerprint string, opts EventListOptions) ([]*envelope.Event, int64, error) {
	return []*envelope.Event{}, 0, nil
}

func (r *noOpRepository) InitSchema(ctx context.Context) error {
	return nil
}

// InitSchema creates the issues table and MaterializedView
func (r *repository) InitSchema(ctx context.Context) error {
	// Create issues table using AggregatingMergeTree with SimpleAggregateFunction for efficient aggregations
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS issues (
		project_id UInt64,
		fingerprint String,
		
		first_seen SimpleAggregateFunction(min, DateTime64(3)),
		last_seen SimpleAggregateFunction(max, DateTime64(3)),
		event_count SimpleAggregateFunction(sum, UInt64),
		
		last_message SimpleAggregateFunction(anyLast, String),
		last_level SimpleAggregateFunction(anyLast, String),
		last_event_id SimpleAggregateFunction(anyLast, String),
		
		status SimpleAggregateFunction(anyLast, String)
	) ENGINE = AggregatingMergeTree()
	ORDER BY (project_id, fingerprint)
	`

	if err := r.conn.Exec(ctx, createTableSQL); err != nil {
		return fmt.Errorf("failed to create issues table: %w", err)
	}

	// Create materialized view for auto-aggregation
	createMVSQL := `
	CREATE MATERIALIZED VIEW IF NOT EXISTS issues_mv TO issues AS
	SELECT
		project_id,
		fingerprint,
		min(timestamp) AS first_seen,
		max(timestamp) AS last_seen,
		count() AS event_count,
		argMax(message, timestamp) AS last_message,
		argMax(level, timestamp) AS last_level,
		argMax(event_id, timestamp) AS last_event_id,
		'unresolved' AS status
	FROM events
	GROUP BY project_id, fingerprint
	`

	if err := r.conn.Exec(ctx, createMVSQL); err != nil {
		return fmt.Errorf("failed to create materialized view: %w", err)
	}

	return nil
}

// GetByFingerprint retrieves a single issue
func (r *repository) GetByFingerprint(ctx context.Context, projectID uint64, fingerprint string) (*Issue, error) {
	query := `
		SELECT 
			project_id,
			fingerprint,
			min(first_seen) as first_seen,
			max(last_seen) as last_seen,
			sum(event_count) as event_count,
			anyLast(last_message) as last_message,
			anyLast(last_level) as last_level,
			anyLast(last_event_id) as last_event_id,
			anyLast(status) as status
		FROM issues
		WHERE project_id = ? AND fingerprint = ?
		GROUP BY project_id, fingerprint
		LIMIT 1
	`

	row := r.conn.QueryRow(ctx, query, projectID, fingerprint)

	var issue Issue
	var statusStr string
	err := row.Scan(
		&issue.ProjectID,
		&issue.Fingerprint,
		&issue.FirstSeen,
		&issue.LastSeen,
		&issue.EventCount,
		&issue.LastMessage,
		&issue.LastLevel,
		&issue.LastEventID,
		&statusStr,
	)

	if err != nil {
		return nil, fmt.Errorf("issue not found: %w", err)
	}

	issue.Status = IssueStatus(statusStr)
	return &issue, nil
}

// List returns issues with pagination and filters
func (r *repository) List(ctx context.Context, projectID uint64, opts ListOptions) ([]*Issue, int64, error) {
	// Set defaults
	if opts.Page <= 0 {
		opts.Page = 1
	}
	if opts.PerPage <= 0 {
		opts.PerPage = 20
	}
	if opts.SortBy == "" {
		opts.SortBy = "last_seen"
	}
	if opts.Order == "" {
		opts.Order = "desc"
	}

	// Build WHERE clause
	whereClause := "project_id = ?"
	args := []interface{}{projectID}

	if opts.Status != "" {
		whereClause += " AND status = ?"
		args = append(args, string(opts.Status))
	}
	if opts.Level != "" {
		whereClause += " AND last_level = ?"
		args = append(args, opts.Level)
	}

	// Count total (distinct fingerprints)
	countQuery := fmt.Sprintf("SELECT count(DISTINCT fingerprint) FROM issues WHERE %s", whereClause)
	var total uint64
	if err := r.conn.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count issues: %w", err)
	}

	// Fetch paginated results
	query := fmt.Sprintf(`
		SELECT 
			project_id,
			fingerprint,
			min(first_seen) as first_seen,
			max(last_seen) as last_seen,
			sum(event_count) as event_count,
			anyLast(last_message) as last_message,
			anyLast(last_level) as last_level,
			anyLast(last_event_id) as last_event_id,
			anyLast(status) as status
		FROM issues
		WHERE %s
		GROUP BY project_id, fingerprint
		ORDER BY %s %s
		LIMIT ? OFFSET ?
	`, whereClause, opts.SortBy, opts.Order)

	offset := (opts.Page - 1) * opts.PerPage
	args = append(args, opts.PerPage, offset)

	rows, err := r.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query issues: %w", err)
	}
	defer rows.Close()

	var issues []*Issue
	for rows.Next() {
		var issue Issue
		var statusStr string
		err := rows.Scan(
			&issue.ProjectID,
			&issue.Fingerprint,
			&issue.FirstSeen,
			&issue.LastSeen,
			&issue.EventCount,
			&issue.LastMessage,
			&issue.LastLevel,
			&issue.LastEventID,
			&statusStr,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan issue: %w", err)
		}
		issue.Status = IssueStatus(statusStr)
		issues = append(issues, &issue)
	}

	return issues, int64(total), nil
}

// UpdateStatus updates the status of an issue
func (r *repository) UpdateStatus(ctx context.Context, projectID uint64, fingerprint string, status IssueStatus) error {
	query := `
		ALTER TABLE issues
		UPDATE status = ?
		WHERE project_id = ? AND fingerprint = ?
	`

	if err := r.conn.Exec(ctx, query, string(status), projectID, fingerprint); err != nil {
		return fmt.Errorf("failed to update issue status: %w", err)
	}

	return nil
}

// GetEvents returns events for a specific issue
func (r *repository) GetEvents(ctx context.Context, projectID uint64, fingerprint string, opts EventListOptions) ([]*envelope.Event, int64, error) {
	if opts.Page <= 0 {
		opts.Page = 1
	}
	if opts.PerPage <= 0 {
		opts.PerPage = 10
	}
	if opts.SortBy == "" {
		opts.SortBy = "timestamp"
	}
	if opts.Order == "" {
		opts.Order = "desc"
	}

	// Count total events
	countQuery := "SELECT count() FROM events WHERE project_id = ? AND fingerprint = ?"
	var total uint64
	if err := r.conn.QueryRow(ctx, countQuery, projectID, fingerprint).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count events: %w", err)
	}

	// Fetch events
	query := fmt.Sprintf(`
		SELECT 
			event_id,
			timestamp,
			platform,
			level,
			message,
			logger,
			environment,
			release,
			server_name,
			transaction,
			tags,
			extra,
			user,
			request,
			exception,
			breadcrumbs,
			contexts,
			sdk,
			fingerprint
		FROM events
		WHERE project_id = ? AND fingerprint = ?
		ORDER BY %s %s
		LIMIT ? OFFSET ?
	`, opts.SortBy, opts.Order)

	offset := (opts.Page - 1) * opts.PerPage
	rows, err := r.conn.Query(ctx, query, projectID, fingerprint, opts.PerPage, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []*envelope.Event
	for rows.Next() {
		var event envelope.Event
		var tagsJSON, extraJSON, userJSON, requestJSON, exceptionJSON, breadcrumbsJSON, contextsJSON, sdkJSON, fingerprintStr string

		err := rows.Scan(
			&event.EventID,
			&event.Timestamp,
			&event.Platform,
			&event.Level,
			&event.Message,
			&event.Logger,
			&event.Environment,
			&event.Release,
			&event.ServerName,
			&event.Transaction,
			&tagsJSON,
			&extraJSON,
			&userJSON,
			&requestJSON,
			&exceptionJSON,
			&breadcrumbsJSON,
			&contextsJSON,
			&sdkJSON,
			&fingerprintStr,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan event: %w", err)
		}

		// Set fingerprint
		if fingerprintStr != "" {
			event.Fingerprint = []string{fingerprintStr}
		}

		// Unmarshal JSON fields
		_ = json.Unmarshal([]byte(tagsJSON), &event.Tags)
		_ = json.Unmarshal([]byte(extraJSON), &event.Extra)
		_ = json.Unmarshal([]byte(userJSON), &event.User)
		_ = json.Unmarshal([]byte(requestJSON), &event.Request)
		_ = json.Unmarshal([]byte(exceptionJSON), &event.Exception)
		_ = json.Unmarshal([]byte(breadcrumbsJSON), &event.Breadcrumbs)
		_ = json.Unmarshal([]byte(contextsJSON), &event.Contexts)
		_ = json.Unmarshal([]byte(sdkJSON), &event.Sdk)

		events = append(events, &event)
	}

	return events, int64(total), nil
}
