package storage

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"time"

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

	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&parseTime=true")
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
	CREATE INDEX IF NOT EXISTS idx_records_url ON records(url);
	CREATE INDEX IF NOT EXISTS idx_records_status ON records(response_status);
	CREATE INDEX IF NOT EXISTS idx_records_created ON records(created_at);
	CREATE INDEX IF NOT EXISTS idx_records_method ON records(method);
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
