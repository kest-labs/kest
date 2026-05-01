package dbutil

import (
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type uuidModel struct {
	ID string `gorm:"column:id"`
}

func (uuidModel) TableName() string {
	return "projects"
}

func TestByIDGeneratesParameterizedUUIDQuery(t *testing.T) {
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  "host=localhost user=test dbname=test password=test sslmode=disable",
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
	})
	if err != nil {
		t.Fatalf("failed to create dry-run postgres db: %v", err)
	}

	id := "fd7cf941-8e7d-4a18-a29d-fd8c550d269e"
	sql := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return ByID(tx, id).First(&uuidModel{})
	})

	if !strings.Contains(sql, "WHERE id = 'fd7cf941-8e7d-4a18-a29d-fd8c550d269e'") {
		t.Fatalf("expected parameterized UUID predicate, got %q", sql)
	}
	if strings.Contains(sql, "WHERE fd7cf941-8e7d-4a18-a29d-fd8c550d269e") {
		t.Fatalf("unexpected bare UUID predicate in %q", sql)
	}
}

func TestDeleteByIDGeneratesParameterizedUUIDQuery(t *testing.T) {
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  "host=localhost user=test dbname=test password=test sslmode=disable",
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
	})
	if err != nil {
		t.Fatalf("failed to create dry-run postgres db: %v", err)
	}

	id := "fd7cf941-8e7d-4a18-a29d-fd8c550d269e"
	sql := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return DeleteByID(tx, &uuidModel{}, id)
	})

	if !strings.Contains(sql, "DELETE FROM \"projects\" WHERE id = 'fd7cf941-8e7d-4a18-a29d-fd8c550d269e'") {
		t.Fatalf("expected parameterized UUID delete, got %q", sql)
	}
}
