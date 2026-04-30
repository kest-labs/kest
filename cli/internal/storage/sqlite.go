package storage

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

type Record struct {
	ID              int64           `json:"id"`
	Method          string          `json:"method"`
	URL             string          `json:"url"`
	BaseURL         string          `json:"base_url"`
	Path            string          `json:"path"`
	QueryParams     json.RawMessage `json:"query_params"`
	RequestHeaders  json.RawMessage `json:"request_headers"`
	RequestBody     string          `json:"request_body"`
	ResponseStatus  int             `json:"response_status"`
	ResponseHeaders json.RawMessage `json:"response_headers"`
	ResponseBody    string          `json:"response_body"`
	DurationMs      int64           `json:"duration_ms"`
	Environment     string          `json:"environment"`
	Project         string          `json:"project"`
	CreatedAt       time.Time       `json:"created_at"`
}

type Store struct {
	db *sql.DB
}

func NewStore() (*Store, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	dbPath := filepath.Join(home, ".kest", "records.db")
	err = os.MkdirAll(filepath.Dir(dbPath), 0755)
	if err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL&parseTime=true")
	if err != nil {
		return nil, err
	}

	s := &Store{db: db}
	if err := s.Init(); err != nil {
		return nil, err
	}

	return s, nil
}

type Variable struct {
	Name        string    `json:"name"`
	Value       string    `json:"value"`
	Environment string    `json:"environment"`
	Project     string    `json:"project"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SyncOutboxItem struct {
	ID                int64     `json:"id"`
	SyncKind          string    `json:"sync_kind"`
	Project           string    `json:"project"`
	PlatformProjectID string    `json:"platform_project_id"`
	SourceEventID     string    `json:"source_event_id"`
	EntryPayload      string    `json:"entry_payload"`
	Attempts          int       `json:"attempts"`
	LastError         string    `json:"last_error"`
	NextAttemptAt     time.Time `json:"next_attempt_at"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (s *Store) Init() error {
	query := `
	CREATE TABLE IF NOT EXISTS records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		method VARCHAR(10) NOT NULL,
		url TEXT NOT NULL,
		base_url TEXT,
		path TEXT,
		query_params TEXT,
		request_headers TEXT,
		request_body TEXT,
		response_status INTEGER,
		response_headers TEXT,
		response_body TEXT,
		duration_ms INTEGER,
		environment VARCHAR(50),
		project VARCHAR(100),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS variables (
		name VARCHAR(100) NOT NULL,
		value TEXT,
		environment VARCHAR(50),
		project VARCHAR(100),
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (name, environment, project)
	);
	CREATE TABLE IF NOT EXISTS sync_meta (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS sync_outbox (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sync_kind TEXT NOT NULL,
		project VARCHAR(100) NOT NULL,
		platform_project_id TEXT NOT NULL,
		source_event_id TEXT NOT NULL UNIQUE,
		entry_payload TEXT NOT NULL,
		attempts INTEGER NOT NULL DEFAULT 0,
		last_error TEXT,
		next_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_records_url ON records(url);
	CREATE INDEX IF NOT EXISTS idx_records_status ON records(response_status);
	CREATE INDEX IF NOT EXISTS idx_records_created ON records(created_at);
	CREATE INDEX IF NOT EXISTS idx_records_method ON records(method);
	CREATE INDEX IF NOT EXISTS idx_sync_outbox_due
		ON sync_outbox(sync_kind, project, platform_project_id, next_attempt_at, id);
	`
	_, err := s.db.Exec(query)
	return err
}

func (s *Store) Close() error {
	return s.db.Close()
}

// GetAllRecords returns all records up to the given limit (0 = 5000 safety cap).
func (s *Store) GetAllRecords(limit ...int) ([]Record, error) {
	cap := 5000
	if len(limit) > 0 && limit[0] > 0 {
		cap = limit[0]
	}
	query := `
	SELECT id, method, url, base_url, path, query_params, request_headers, request_body,
	       response_status, response_headers, response_body, duration_ms, environment, project, created_at
	FROM records ORDER BY created_at DESC LIMIT ?
	`
	rows, err := s.db.Query(query, cap)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var r Record
		var queryParams, requestHeaders, responseHeaders []byte
		err := rows.Scan(
			&r.ID, &r.Method, &r.URL, &r.BaseURL, &r.Path, &queryParams, &requestHeaders, &r.RequestBody,
			&r.ResponseStatus, &responseHeaders, &r.ResponseBody, &r.DurationMs, &r.Environment, &r.Project, &r.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		r.QueryParams = json.RawMessage(queryParams)
		r.RequestHeaders = json.RawMessage(requestHeaders)
		r.ResponseHeaders = json.RawMessage(responseHeaders)
		records = append(records, r)
	}
	return records, nil
}

func (s *Store) GetRecordsByProject(project string, limit int) ([]Record, error) {
	if project == "" {
		return nil, nil
	}
	if limit <= 0 {
		limit = 5000
	}

	query := `
	SELECT id, method, url, base_url, path, query_params, request_headers, request_body,
	       response_status, response_headers, response_body, duration_ms, environment, project, created_at
	FROM records
	WHERE project = ?
	ORDER BY created_at DESC
	LIMIT ?
	`
	rows, err := s.db.Query(query, project, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var r Record
		var queryParams, requestHeaders, responseHeaders []byte
		err := rows.Scan(
			&r.ID, &r.Method, &r.URL, &r.BaseURL, &r.Path, &queryParams, &requestHeaders, &r.RequestBody,
			&r.ResponseStatus, &responseHeaders, &r.ResponseBody, &r.DurationMs, &r.Environment, &r.Project, &r.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		r.QueryParams = json.RawMessage(queryParams)
		r.RequestHeaders = json.RawMessage(requestHeaders)
		r.ResponseHeaders = json.RawMessage(responseHeaders)
		records = append(records, r)
	}

	return records, nil
}

func (s *Store) SaveRecord(r *Record) (int64, error) {
	query := `
	INSERT INTO records (
		method, url, base_url, path, query_params, request_headers, request_body,
		response_status, response_headers, response_body, duration_ms, environment, project
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	res, err := s.db.Exec(query,
		r.Method, r.URL, r.BaseURL, r.Path, r.QueryParams, r.RequestHeaders, r.RequestBody,
		r.ResponseStatus, r.ResponseHeaders, r.ResponseBody, r.DurationMs, r.Environment, r.Project,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) GetHistory(limit int, project string) ([]Record, error) {
	query := `
	SELECT id, method, url, response_status, duration_ms, created_at
	FROM records
	WHERE (? = "" OR project = ?)
	ORDER BY created_at DESC
	LIMIT ?
	`
	rows, err := s.db.Query(query, project, project, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var r Record
		if err := rows.Scan(&r.ID, &r.Method, &r.URL, &r.ResponseStatus, &r.DurationMs, &r.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	return records, nil
}

func (s *Store) GetRecord(id int64) (*Record, error) {
	query := `
	SELECT id, method, url, base_url, path, query_params, request_headers, request_body,
	       response_status, response_headers, response_body, duration_ms, environment, project, created_at
	FROM records WHERE id = ?
	`
	row := s.db.QueryRow(query, id)
	var r Record
	var queryParams, requestHeaders, responseHeaders []byte
	err := row.Scan(
		&r.ID, &r.Method, &r.URL, &r.BaseURL, &r.Path, &queryParams, &requestHeaders, &r.RequestBody,
		&r.ResponseStatus, &responseHeaders, &r.ResponseBody, &r.DurationMs, &r.Environment, &r.Project, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	r.QueryParams = json.RawMessage(queryParams)
	r.RequestHeaders = json.RawMessage(requestHeaders)
	r.ResponseHeaders = json.RawMessage(responseHeaders)
	return &r, nil
}

func (s *Store) GetLastRecord() (*Record, error) {
	query := `SELECT id FROM records ORDER BY created_at DESC LIMIT 1`
	var id int64
	err := s.db.QueryRow(query).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetRecord(id)
}

func (s *Store) SaveVariable(v *Variable) error {
	query := `
	INSERT INTO variables (name, value, environment, project, updated_at)
	VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
	ON CONFLICT(name, environment, project) DO UPDATE SET
		value = excluded.value,
		updated_at = CURRENT_TIMESTAMP
	`
	_, err := s.db.Exec(query, v.Name, v.Value, v.Environment, v.Project)
	return err
}

func (s *Store) GetOrCreateClientID() (string, error) {
	const query = `SELECT value FROM sync_meta WHERE key = 'client_id'`

	var existing string
	err := s.db.QueryRow(query).Scan(&existing)
	switch {
	case err == nil && existing != "":
		return existing, nil
	case err != nil && err != sql.ErrNoRows:
		return "", err
	}

	clientID := uuid.NewString()
	_, err = s.db.Exec(
		`INSERT INTO sync_meta (key, value, updated_at)
		 VALUES ('client_id', ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
		clientID,
	)
	if err != nil {
		return "", err
	}
	return clientID, nil
}

func (s *Store) EnqueueSyncOutbox(item *SyncOutboxItem) error {
	if item == nil {
		return nil
	}

	_, err := s.db.Exec(
		`INSERT INTO sync_outbox (
			sync_kind, project, platform_project_id, source_event_id, entry_payload,
			attempts, last_error, next_attempt_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT(source_event_id) DO NOTHING`,
		item.SyncKind,
		item.Project,
		item.PlatformProjectID,
		item.SourceEventID,
		item.EntryPayload,
		item.Attempts,
		item.LastError,
		sqliteTimestamp(item.NextAttemptAt),
	)
	return err
}

func (s *Store) ListDueSyncOutbox(syncKind, project, platformProjectID string, limit int) ([]SyncOutboxItem, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.db.Query(
		`SELECT id, sync_kind, project, platform_project_id, source_event_id, entry_payload,
		        attempts, COALESCE(last_error, ''), next_attempt_at, created_at, updated_at
		   FROM sync_outbox
		  WHERE sync_kind = ?
		    AND project = ?
		    AND platform_project_id = ?
		    AND datetime(next_attempt_at) <= CURRENT_TIMESTAMP
		  ORDER BY id ASC
		  LIMIT ?`,
		syncKind,
		project,
		platformProjectID,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SyncOutboxItem
	for rows.Next() {
		var item SyncOutboxItem
		if err := rows.Scan(
			&item.ID,
			&item.SyncKind,
			&item.Project,
			&item.PlatformProjectID,
			&item.SourceEventID,
			&item.EntryPayload,
			&item.Attempts,
			&item.LastError,
			&item.NextAttemptAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) DeleteSyncOutbox(id int64) error {
	_, err := s.db.Exec(`DELETE FROM sync_outbox WHERE id = ?`, id)
	return err
}

func (s *Store) MarkSyncOutboxFailed(id int64, attempts int, lastError string, nextAttemptAt time.Time) error {
	_, err := s.db.Exec(
		`UPDATE sync_outbox
		    SET attempts = ?, last_error = ?, next_attempt_at = ?, updated_at = CURRENT_TIMESTAMP
		  WHERE id = ?`,
		attempts,
		lastError,
		sqliteTimestamp(nextAttemptAt),
		id,
	)
	return err
}

func sqliteTimestamp(value time.Time) string {
	if value.IsZero() {
		value = time.Now().UTC()
	}
	return value.UTC().Format("2006-01-02 15:04:05")
}

func (s *Store) GetVariables(project, environment string) (map[string]string, error) {
	query := `
	SELECT name, value FROM variables
	WHERE (project = ? OR project = "") AND (environment = ? OR environment = "")
	`
	rows, err := s.db.Query(query, project, environment)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	vars := make(map[string]string)
	for rows.Next() {
		var name, value string
		if err := rows.Scan(&name, &value); err != nil {
			return nil, err
		}
		vars[name] = value
	}
	return vars, nil
}

// GetLatestSuccessfulRecord finds the most recent 2xx record for a given method and path.
// It handles path parameter matching (e.g., /users/:id matching /users/123).
func (s *Store) GetLatestSuccessfulRecord(method, path, project string) (*Record, error) {
	// Normalize path for matching: replace :param with % for SQL LIKE
	// Note: This is a heuristic match.
	sqlPath := path
	re := regexp.MustCompile(`:[^/]+`) // Fixed regex for path params
	sqlPath = re.ReplaceAllString(sqlPath, "%")

	query := `
	SELECT id, method, url, base_url, path, query_params, request_headers, request_body,
	       response_status, response_headers, response_body, duration_ms, environment, project, created_at
	FROM records 
	WHERE method = ? AND path LIKE ? AND (? = "" OR project LIKE ?) AND response_status >= 200 AND response_status < 300
	ORDER BY created_at DESC 
	LIMIT 1
	`
	row := s.db.QueryRow(query, method, sqlPath, project, "%"+project+"%")
	var r Record
	var queryParams, requestHeaders, responseHeaders []byte
	err := row.Scan(
		&r.ID, &r.Method, &r.URL, &r.BaseURL, &r.Path, &queryParams, &requestHeaders, &r.RequestBody,
		&r.ResponseStatus, &responseHeaders, &r.ResponseBody, &r.DurationMs, &r.Environment, &r.Project, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	r.QueryParams = json.RawMessage(queryParams)
	r.RequestHeaders = json.RawMessage(requestHeaders)
	r.ResponseHeaders = json.RawMessage(responseHeaders)
	return &r, nil
}
