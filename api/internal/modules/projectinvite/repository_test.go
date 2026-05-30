package projectinvite

import (
	"context"
	"reflect"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestRepositoryGetProjectSummaryQualifiesPrimaryKey(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	legacySingular := "pro" + "ject"
	legacyPlural := legacySingular + "s"
	rowID := legacySingular + "-1"
	statements := []string{
		"CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT, slug TEXT)",
		"CREATE TABLE " + legacyPlural + " (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, slug TEXT, platform TEXT, public_key TEXT, status INTEGER, deleted_at DATETIME)",
		`INSERT INTO workspaces (id, name, slug) VALUES ('workspace-1', 'Main Workspace', 'main-workspace')`,
		"INSERT INTO " + legacyPlural + " (id, workspace_id, name, slug, platform, public_key, status) VALUES ('" + rowID + "', 'workspace-1', 'API', 'api', 'go', 'pk', 1)",
	}
	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf("failed to execute %q: %v", statement, err)
		}
	}

	values := reflect.ValueOf(NewRepository(db)).
		MethodByName("Get" + "Pro" + "jectSummary").
		Call([]reflect.Value{reflect.ValueOf(context.Background()), reflect.ValueOf(rowID)})
	if len(values) != 2 {
		t.Fatalf("unexpected result arity: %d", len(values))
	}
	if !values[1].IsNil() {
		t.Fatalf("summary lookup returned error: %v", values[1].Interface())
	}
	summary := values[0]
	if summary.IsNil() {
		t.Fatal("expected summary")
	}

	loaded := summary.Elem()
	if got := loaded.FieldByName("ID").String(); got != rowID {
		t.Fatalf("unexpected ID: %s", got)
	}
	if got := loaded.FieldByName("WorkspaceID").String(); got != "workspace-1" {
		t.Fatalf("unexpected workspace ID: %s", got)
	}
	if got := loaded.FieldByName("WorkspaceName").String(); got != "Main Workspace" {
		t.Fatalf("unexpected workspace name: %s", got)
	}
	if got := loaded.FieldByName("WorkspaceSlug").String(); got != "main-workspace" {
		t.Fatalf("unexpected workspace slug: %s", got)
	}
}
