package apispec

import (
	"context"
	"reflect"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestRepositoryGetSpecByMethodAndPathReturnsNilWhenMissing(t *testing.T) {
	db := newAPISpecRepositoryTestDB(t)

	repo := NewRepository(db)
	spec, err := repo.GetSpecByMethodAndPath(context.Background(), "workspace-1", "GET", "/missing")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if spec != nil {
		t.Fatalf("expected nil spec, got %+v", spec)
	}
}

func TestRepositoryGetSpecByMethodAndPathIsScopedToWorkspace(t *testing.T) {
	db := newAPISpecRepositoryTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	if err := repo.CreateSpec(ctx, &APISpecPO{
		WorkspaceID: "workspace-1",
		Method:      "GET",
		Path:        "/health",
		Version:     "v1",
	}); err != nil {
		t.Fatalf("failed to create workspace-1 spec: %v", err)
	}

	if err := repo.CreateSpec(ctx, &APISpecPO{
		WorkspaceID: "workspace-2",
		Method:      "GET",
		Path:        "/health",
		Version:     "v1",
		Summary:     "Other workspace",
	}); err != nil {
		t.Fatalf("failed to create workspace-2 spec: %v", err)
	}

	spec, err := repo.GetSpecByMethodAndPath(ctx, "workspace-2", "GET", "/health")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if spec == nil {
		t.Fatal("expected workspace-2 spec, got nil")
	}
	if spec.WorkspaceID != "workspace-2" || spec.Summary != "Other workspace" {
		t.Fatalf("expected workspace-2 spec, got %+v", spec)
	}
}

func newAPISpecRepositoryTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("failed to get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	if err := db.Callback().Create().Before("gorm:before_create").Register("test:assign_uuid_primary_key", func(tx *gorm.DB) {
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
		if isZero {
			_ = idField.Set(tx.Statement.Context, value, uuid.NewString())
		}
	}); err != nil {
		t.Fatalf("failed to register id callback: %v", err)
	}

	if err := db.AutoMigrate(&APISpecPO{}); err != nil {
		t.Fatalf("failed to migrate schema: %v", err)
	}

	return db
}
