package environment

import (
	"context"
	"reflect"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestServiceListEnvironmentsIsScopedToWorkspace(t *testing.T) {
	db := newEnvironmentTestDB(t)
	service := NewService(NewRepository(db))
	ctx := context.Background()

	if _, err := service.CreateEnvironment(ctx, &CreateEnvironmentRequest{
		WorkspaceID: "workspace-1",
		Name:        "dev",
		BaseURL:     "https://dev.example.com",
	}); err != nil {
		t.Fatalf("failed to create first environment: %v", err)
	}

	if _, err := service.CreateEnvironment(ctx, &CreateEnvironmentRequest{
		WorkspaceID: "workspace-2",
		Name:        "dev",
		BaseURL:     "https://other.example.com",
	}); err != nil {
		t.Fatalf("same environment name in another workspace should be allowed: %v", err)
	}

	envs, err := service.ListEnvironments(ctx, "workspace-1")
	if err != nil {
		t.Fatalf("failed to list environments: %v", err)
	}

	if len(envs) != 1 {
		t.Fatalf("expected 1 environment, got %d", len(envs))
	}
	if envs[0].WorkspaceID != "workspace-1" {
		t.Fatalf("expected workspace-1 environment, got %q", envs[0].WorkspaceID)
	}
}

func TestServiceRejectsDuplicateEnvironmentNameWithinWorkspace(t *testing.T) {
	db := newEnvironmentTestDB(t)
	service := NewService(NewRepository(db))
	ctx := context.Background()

	req := &CreateEnvironmentRequest{
		WorkspaceID: "workspace-1",
		Name:        "dev",
	}

	if _, err := service.CreateEnvironment(ctx, req); err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}
	if _, err := service.CreateEnvironment(ctx, req); err == nil {
		t.Fatal("expected duplicate environment name to fail")
	}
}

func TestServiceGetEnvironmentRequiresMatchingWorkspace(t *testing.T) {
	db := newEnvironmentTestDB(t)
	service := NewService(NewRepository(db))
	ctx := context.Background()

	env, err := service.CreateEnvironment(ctx, &CreateEnvironmentRequest{
		WorkspaceID: "workspace-1",
		Name:        "dev",
	})
	if err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	if _, err := service.GetEnvironment(ctx, "workspace-2", env.ID); err == nil {
		t.Fatal("expected cross-workspace lookup to fail")
	}
}

func newEnvironmentTestDB(t *testing.T) *gorm.DB {
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
	if err := db.AutoMigrate(&EnvironmentPO{}); err != nil {
		t.Fatalf("failed to migrate environment schema: %v", err)
	}

	return db
}
