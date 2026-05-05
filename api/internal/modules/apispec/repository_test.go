package apispec

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestRepositoryGetSpecByMethodAndPathReturnsNilWhenMissing(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&APISpecPO{}); err != nil {
		t.Fatalf("failed to migrate schema: %v", err)
	}

	repo := NewRepository(db)
	spec, err := repo.GetSpecByMethodAndPath(context.Background(), "project-1", "GET", "/missing")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if spec != nil {
		t.Fatalf("expected nil spec, got %+v", spec)
	}
}
