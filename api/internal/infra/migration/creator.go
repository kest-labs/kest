package migration

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"text/template"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/migration/stubs"
)

// CreatorOptions configures the migration file creator.
type CreatorOptions struct {
	// Create specifies the table name for a create table migration.
	// When set, uses the migration.create.stub template.
	Create string

	// Table specifies the table name for a modify table migration.
	// When set, uses the migration.update.stub template.
	Table string
}

// Creator creates new migration files.
type Creator struct {
	// MigrationsPath is the directory where migration files are created.
	MigrationsPath string
}

// NewCreator creates a new migration file creator.
func NewCreator(migrationsPath string) *Creator {
	if migrationsPath == "" {
		migrationsPath = "database/migrations"
	}
	return &Creator{
		MigrationsPath: migrationsPath,
	}
}

// CreatedMigration contains information about a created migration file.
type CreatedMigration struct {
	// Name is the migration name (e.g., "2025_01_01_120000_create_users_table")
	Name string

	// Path is the full path to the created file
	Path string

	// Filename is just the filename without directory
	Filename string
}

// Create creates a new migration file with the given name and options.
func (c *Creator) Create(name string, opts CreatorOptions) (*CreatedMigration, error) {
	// Generate timestamp prefix
	timestamp := time.Now().Format("2006_01_02_150405")

	// Create migration ID
	migrationID := fmt.Sprintf("%s_%s", timestamp, name)

	// Create filename
	filename := fmt.Sprintf("%s.go", migrationID)
	filePath := filepath.Join(c.MigrationsPath, filename)

	// Ensure directory exists
	if err := os.MkdirAll(c.MigrationsPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create migrations directory: %w", err)
	}

	// Check if file already exists
	if _, err := os.Stat(filePath); err == nil {
		return nil, fmt.Errorf("migration file already exists: %s", filePath)
	}

	// Select appropriate stub template
	stubContent := c.getStub(opts)

	// Generate struct name from migration name
	structName := toStructName(name)

	// Determine table name
	tableName := c.getTableName(name, opts)

	// Prepare template data
	data := map[string]string{
		"MigrationID": migrationID,
		"StructName":  structName,
		"TableName":   tableName,
	}

	// Parse and execute template
	tmpl, err := template.New("migration").Parse(stubContent)
	if err != nil {
		return nil, fmt.Errorf("failed to parse migration template: %w", err)
	}

	// Create file
	file, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create migration file: %w", err)
	}
	defer file.Close()

	// Execute template
	if err := tmpl.Execute(file, data); err != nil {
		return nil, fmt.Errorf("failed to write migration file: %w", err)
	}

	return &CreatedMigration{
		Name:     migrationID,
		Path:     filePath,
		Filename: filename,
	}, nil
}

// getStub returns the appropriate stub template based on options.
func (c *Creator) getStub(opts CreatorOptions) string {
	if opts.Create != "" {
		return stubs.Create
	}
	if opts.Table != "" {
		return stubs.Update
	}
	return stubs.Blank
}

// getTableName determines the table name from options or migration name.
func (c *Creator) getTableName(name string, opts CreatorOptions) string {
	// Use explicit table name from options
	if opts.Create != "" {
		return opts.Create
	}
	if opts.Table != "" {
		return opts.Table
	}

	// Try to infer table name from migration name
	return inferTableName(name)
}

// toStructName converts a migration name to a Go struct name.
// Example: "create_users_table" -> "createUsersTable"
func toStructName(name string) string {
	// Split by underscore
	parts := strings.Split(name, "_")
	if len(parts) == 0 {
		return name
	}

	// First part is lowercase, rest are title case
	result := strings.ToLower(parts[0])
	for i := 1; i < len(parts); i++ {
		if len(parts[i]) > 0 {
			result += strings.ToUpper(string(parts[i][0])) + strings.ToLower(parts[i][1:])
		}
	}

	return result
}

// inferTableName tries to extract a table name from a migration name.
// Examples:
//   - "create_users_table" -> "users"
//   - "add_email_to_users" -> "users"
//   - "modify_posts_table" -> "posts"
func inferTableName(name string) string {
	// Pattern: create_<table>_table
	createPattern := regexp.MustCompile(`^create_(.+)_table$`)
	if matches := createPattern.FindStringSubmatch(name); len(matches) > 1 {
		return matches[1]
	}

	// Pattern: <action>_<column>_to_<table>
	toPattern := regexp.MustCompile(`_to_([a-z_]+)$`)
	if matches := toPattern.FindStringSubmatch(name); len(matches) > 1 {
		return matches[1]
	}

	// Pattern: <action>_<column>_from_<table>
	fromPattern := regexp.MustCompile(`_from_([a-z_]+)$`)
	if matches := fromPattern.FindStringSubmatch(name); len(matches) > 1 {
		return matches[1]
	}

	// Pattern: modify_<table>_table
	modifyPattern := regexp.MustCompile(`^modify_(.+)_table$`)
	if matches := modifyPattern.FindStringSubmatch(name); len(matches) > 1 {
		return matches[1]
	}

	// Pattern: update_<table>_table
	updatePattern := regexp.MustCompile(`^update_(.+)_table$`)
	if matches := updatePattern.FindStringSubmatch(name); len(matches) > 1 {
		return matches[1]
	}

	// Default: use the name as-is
	return name
}

// GenerateTimestamp generates a timestamp string for migration filenames.
// Format: YYYY_MM_DD_HHMMSS
func GenerateTimestamp() string {
	return time.Now().Format("2006_01_02_150405")
}

// ValidateMigrationName checks if a migration name is valid.
func ValidateMigrationName(name string) error {
	if name == "" {
		return fmt.Errorf("migration name cannot be empty")
	}

	// Check for valid characters (lowercase letters, numbers, underscores)
	validPattern := regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
	if !validPattern.MatchString(name) {
		return fmt.Errorf("migration name must start with a lowercase letter and contain only lowercase letters, numbers, and underscores")
	}

	return nil
}
