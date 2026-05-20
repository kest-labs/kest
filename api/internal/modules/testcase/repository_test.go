package testcase

import (
	"context"
	"reflect"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/modules/apispec"
)

func TestRepositoryListIsScopedToWorkspace(t *testing.T) {
	db := newTestCaseRepositoryTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	specOne := &apispec.APISpecPO{
		ID:          "spec-1",
		WorkspaceID: "workspace-1",
		Method:      "GET",
		Path:        "/health",
	}
	specTwo := &apispec.APISpecPO{
		ID:          "spec-2",
		WorkspaceID: "workspace-2",
		Method:      "GET",
		Path:        "/health",
	}
	if err := db.WithContext(ctx).Create(specOne).Error; err != nil {
		t.Fatalf("failed to create workspace-1 spec: %v", err)
	}
	if err := db.WithContext(ctx).Create(specTwo).Error; err != nil {
		t.Fatalf("failed to create workspace-2 spec: %v", err)
	}

	if err := repo.Create(ctx, &TestCasePO{APISpecID: specOne.ID, Name: "one"}); err != nil {
		t.Fatalf("failed to create workspace-1 test case: %v", err)
	}
	if err := repo.Create(ctx, &TestCasePO{APISpecID: specTwo.ID, Name: "two"}); err != nil {
		t.Fatalf("failed to create workspace-2 test case: %v", err)
	}

	items, total, err := repo.List(ctx, &ListFilter{WorkspaceID: "workspace-2", Page: 1, PageSize: 20})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if total != 1 {
		t.Fatalf("expected total 1, got %d", total)
	}
	if len(items) != 1 || items[0].Name != "two" {
		t.Fatalf("expected only workspace-2 item, got %+v", items)
	}
}

func TestRepositoryGetByIDAndWorkspaceReturnsNilWhenOutsideWorkspace(t *testing.T) {
	db := newTestCaseRepositoryTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	spec := &apispec.APISpecPO{
		ID:          "spec-1",
		WorkspaceID: "workspace-1",
		Method:      "GET",
		Path:        "/health",
	}
	if err := db.WithContext(ctx).Create(spec).Error; err != nil {
		t.Fatalf("failed to create spec: %v", err)
	}

	tc := &TestCasePO{ID: "tc-1", APISpecID: spec.ID, Name: "one"}
	if err := repo.Create(ctx, tc); err != nil {
		t.Fatalf("failed to create test case: %v", err)
	}

	got, err := repo.GetByIDAndWorkspace(ctx, tc.ID, "workspace-2")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil test case, got %+v", got)
	}
}

func newTestCaseRepositoryTestDB(t *testing.T) *gorm.DB {
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

	if err := db.AutoMigrate(&apispec.APISpecPO{}, &TestCasePO{}); err != nil {
		t.Fatalf("failed to migrate schema: %v", err)
	}

	return db
}
