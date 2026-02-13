package event

import (
	"context"
	"encoding/json"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/kest-labs/kest/api/internal/modules/envelope"
)

// Repository defines the interface for event storage in ClickHouse
type Repository interface {
	Save(ctx context.Context, projectID uint, event *envelope.Event) error
}

type repository struct {
	conn driver.Conn
}

// NewRepository creates a new event repository and initializes the schema
func NewRepository(conn driver.Conn) (Repository, error) {
	if conn == nil {
		return &noOpRepository{}, nil
	}
	r := &repository{conn: conn}
	if err := r.initSchema(); err != nil {
		return nil, err
	}
	return r, nil
}

type noOpRepository struct{}

func (r *noOpRepository) Save(ctx context.Context, projectID uint, event *envelope.Event) error {
	// Do nothing or log warning
	return nil
}

func (r *repository) initSchema() error {
	// Note: JSON type in ClickHouse requires allow_experimental_object_type=1
	// or we can use String for simplicity if the CH version is older.
	// For now, let's use String for JSON fields to be safe and compatible.

	querySafe := `
	CREATE TABLE IF NOT EXISTS events (
		event_id UUID,
		project_id UInt64,
		timestamp DateTime64(3, 'UTC'),
		received_at DateTime64(3, 'UTC'),
		platform LowCardinality(String),
		level LowCardinality(String),
		message String,
		logger LowCardinality(String),
		environment String,
		release String,
		server_name String,
		transaction String,
		fingerprint String,
		tags String,
		extra String,
		user String,
		request String,
		exception String,
		breadcrumbs String,
		contexts String,
		sdk String
	) ENGINE = MergeTree()
	PARTITION BY toYYYYMM(timestamp)
	ORDER BY (project_id, fingerprint, timestamp)
	TTL timestamp + INTERVAL 90 DAY;
	`

	return r.conn.Exec(context.Background(), querySafe)
}

func (r *repository) Save(ctx context.Context, projectID uint, event *envelope.Event) error {
	// Prepare JSON fields
	tags, _ := json.Marshal(event.Tags)
	extra, _ := json.Marshal(event.Extra)
	user, _ := json.Marshal(event.User)
	request, _ := json.Marshal(event.Request)
	exception, _ := json.Marshal(event.Exception)
	breadcrumbs, _ := json.Marshal(event.Breadcrumbs)
	contexts, _ := json.Marshal(event.Contexts)
	sdk, _ := json.Marshal(event.Sdk)

	fingerprints := event.GetFingerprint()
	fingerprint := ""
	if len(fingerprints) > 0 {
		fingerprint = fingerprints[0] // Simplified for now
	}

	// Use ClickHouse batching or single exec. For ingestion, batching is better but
	// for the simple repository method, single insert is easier to implement first.
	// In the future, we can use an async buffer.

	query := `
	INSERT INTO events (
		event_id, project_id, timestamp, received_at,
		platform, level, message, logger,
		environment, release, server_name, transaction,
		fingerprint, tags, extra, user, request,
		exception, breadcrumbs, contexts, sdk
	) VALUES (
		?, ?, ?, ?,
		?, ?, ?, ?,
		?, ?, ?, ?,
		?, ?, ?, ?, ?,
		?, ?, ?, ?
	)
	`

	return r.conn.Exec(ctx, query,
		event.EventID,
		projectID,
		event.Timestamp,
		time.Now().UTC(),
		event.Platform,
		event.Level,
		event.Message,
		event.Logger,
		event.Environment,
		event.Release,
		event.ServerName,
		event.Transaction,
		fingerprint,
		string(tags),
		string(extra),
		string(user),
		string(request),
		string(exception),
		string(breadcrumbs),
		string(contexts),
		string(sdk),
	)
}
