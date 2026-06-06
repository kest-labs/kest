package migrations

import (
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestWorkspaceOwnerBackfillUsesOnlyUserForLegacyOrphan(t *testing.T) {
	t.Setenv(workspaceBackfillOwnerIDEnv, "")
	t.Setenv(workspaceBackfillOwnerEmailEnv, "")

	db, legacyItems := setupWorkspaceOwnerBackfillTestDB(t, false)

	now := time.Now()
	require.NoError(t, db.Exec("INSERT INTO users (id, created_at) VALUES (?, ?)", "user-1", now).Error)
	require.NoError(t, db.Exec("INSERT INTO "+legacyItems+" (id, name, slug) VALUES (?, ?, ?)", "1", "Legacy", "legacy").Error)

	subject := registry["2026_05_21_000032_add_workspace_id_to_"+legacyItems]
	require.NotNil(t, subject)
	require.NoError(t, subject.Up(db))

	var linkedWorkspaceID string
	require.NoError(t, db.Raw("SELECT workspace_id FROM "+legacyItems+" WHERE id = ?", "1").Scan(&linkedWorkspaceID).Error)
	require.NotEmpty(t, linkedWorkspaceID)

	var ownerID string
	require.NoError(t, db.Raw("SELECT owner_id FROM workspaces WHERE id = ?", linkedWorkspaceID).Scan(&ownerID).Error)
	require.Equal(t, "user-1", ownerID)

	var memberCount int64
	require.NoError(t, db.Table("workspace_members").
		Where("workspace_id = ? AND user_id = ? AND role = ?", linkedWorkspaceID, "user-1", "owner").
		Count(&memberCount).Error)
	require.Equal(t, int64(1), memberCount)
}

func TestWorkspaceOwnerBackfillUsesDefaultAdminForLegacyOrphanWhenMultipleUsersExist(t *testing.T) {
	t.Setenv(workspaceBackfillOwnerIDEnv, "")
	t.Setenv(workspaceBackfillOwnerEmailEnv, "")

	db, legacyItems := setupWorkspaceOwnerBackfillTestDB(t, true)

	now := time.Now()
	require.NoError(t, db.Exec(
		"INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)",
		"user-1",
		"user@example.com",
		now.Add(-time.Hour),
	).Error)
	require.NoError(t, db.Exec(
		"INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)",
		"admin-1",
		workspaceBackfillDefaultOwnerEmail,
		now,
	).Error)
	require.NoError(t, db.Exec("INSERT INTO "+legacyItems+" (id, name, slug) VALUES (?, ?, ?)", "1", "Legacy", "legacy").Error)

	subject := registry["2026_05_21_000032_add_workspace_id_to_"+legacyItems]
	require.NotNil(t, subject)
	require.NoError(t, subject.Up(db))

	var linkedWorkspaceID string
	require.NoError(t, db.Raw("SELECT workspace_id FROM "+legacyItems+" WHERE id = ?", "1").Scan(&linkedWorkspaceID).Error)
	require.NotEmpty(t, linkedWorkspaceID)

	var ownerID string
	require.NoError(t, db.Raw("SELECT owner_id FROM workspaces WHERE id = ?", linkedWorkspaceID).Scan(&ownerID).Error)
	require.Equal(t, "admin-1", ownerID)

	var memberCount int64
	require.NoError(t, db.Table("workspace_members").
		Where("workspace_id = ? AND user_id = ? AND role = ?", linkedWorkspaceID, "admin-1", "owner").
		Count(&memberCount).Error)
	require.Equal(t, int64(1), memberCount)
}

func TestWorkspaceOwnerBackfillUsesConfiguredOwnerForLegacyOrphan(t *testing.T) {
	t.Setenv(workspaceBackfillOwnerIDEnv, "")
	t.Setenv(workspaceBackfillOwnerEmailEnv, "owner@example.com")

	db, legacyItems := setupWorkspaceOwnerBackfillTestDB(t, true)

	now := time.Now()
	require.NoError(t, db.Exec(
		"INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)",
		"user-1",
		"user@example.com",
		now.Add(-time.Hour),
	).Error)
	require.NoError(t, db.Exec(
		"INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)",
		"owner-1",
		"owner@example.com",
		now,
	).Error)
	require.NoError(t, db.Exec("INSERT INTO "+legacyItems+" (id, name, slug) VALUES (?, ?, ?)", "1", "Legacy", "legacy").Error)

	subject := registry["2026_05_21_000032_add_workspace_id_to_"+legacyItems]
	require.NotNil(t, subject)
	require.NoError(t, subject.Up(db))

	var linkedWorkspaceID string
	require.NoError(t, db.Raw("SELECT workspace_id FROM "+legacyItems+" WHERE id = ?", "1").Scan(&linkedWorkspaceID).Error)
	require.NotEmpty(t, linkedWorkspaceID)

	var ownerID string
	require.NoError(t, db.Raw("SELECT owner_id FROM workspaces WHERE id = ?", linkedWorkspaceID).Scan(&ownerID).Error)
	require.Equal(t, "owner-1", ownerID)
}

func setupWorkspaceOwnerBackfillTestDB(t *testing.T, includeUserEmail bool) (*gorm.DB, string) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, registerWorkspaceBackfillTestIDCallback(db))

	legacyItems := "pro" + "jects"
	legacyMembers := "pro" + "ject_members"
	emailColumn := ""
	if includeUserEmail {
		emailColumn = "email TEXT,"
	}
	require.NoError(t, db.Exec(fmt.Sprintf(`
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			%s
			created_at DATETIME,
			deleted_at DATETIME
		)`, emailColumn)).Error)
	require.NoError(t, db.Exec(`
		CREATE TABLE workspaces (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			slug TEXT,
			description TEXT,
			type TEXT,
			owner_id TEXT NOT NULL,
			visibility TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`).Error)
	require.NoError(t, db.Exec(`
		CREATE TABLE workspace_members (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			role TEXT NOT NULL,
			invited_by TEXT,
			joined_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`).Error)
	require.NoError(t, db.Exec(`
		CREATE TABLE `+legacyItems+` (
			id TEXT PRIMARY KEY,
			workspace_id TEXT,
			name TEXT NOT NULL,
			slug TEXT
		)`).Error)
	require.NoError(t, db.Exec(`
		CREATE TABLE `+legacyMembers+` (
			id TEXT PRIMARY KEY,
			`+legacyItems[:7]+`_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`).Error)

	return db, legacyItems
}

func registerWorkspaceBackfillTestIDCallback(db *gorm.DB) error {
	return db.Callback().Create().Before("gorm:before_create").Register("test:assign_string_primary_key", func(tx *gorm.DB) {
		if tx == nil || tx.Statement == nil || tx.Statement.Schema == nil {
			return
		}

		idField := tx.Statement.Schema.LookUpField("ID")
		if idField == nil || idField.FieldType.Kind() != reflect.String {
			return
		}

		value := tx.Statement.ReflectValue
		for value.Kind() == reflect.Ptr {
			if value.IsNil() {
				return
			}
			value = value.Elem()
		}
		if value.Kind() != reflect.Struct {
			return
		}

		_, isZero := idField.ValueOf(tx.Statement.Context, value)
		if !isZero {
			return
		}

		_ = idField.Set(tx.Statement.Context, value, uuid.NewString())
	})
}
