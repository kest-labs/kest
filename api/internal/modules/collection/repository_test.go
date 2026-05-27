package collection

import (
	"context"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type collectionContentRequestPO struct {
	ID           string `gorm:"primaryKey"`
	CollectionID string `gorm:"index"`
	DeletedAt    gorm.DeletedAt
}

func (collectionContentRequestPO) TableName() string {
	return "requests"
}

type collectionContentExamplePO struct {
	ID        string `gorm:"primaryKey"`
	RequestID string `gorm:"index"`
	DeletedAt gorm.DeletedAt
}

func (collectionContentExamplePO) TableName() string {
	return "examples"
}

func TestRepositoryDeleteCollectionContentsDeletesRequestsAndExamples(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite database: %v", err)
	}
	if err := db.AutoMigrate(&collectionContentRequestPO{}, &collectionContentExamplePO{}); err != nil {
		t.Fatalf("migrate test schema: %v", err)
	}

	if err := db.Create(&collectionContentRequestPO{ID: "request-1", CollectionID: "collection-1"}).Error; err != nil {
		t.Fatalf("seed request-1: %v", err)
	}
	if err := db.Create(&collectionContentRequestPO{ID: "request-2", CollectionID: "collection-2"}).Error; err != nil {
		t.Fatalf("seed request-2: %v", err)
	}
	if err := db.Create(&collectionContentExamplePO{ID: "example-1", RequestID: "request-1"}).Error; err != nil {
		t.Fatalf("seed example-1: %v", err)
	}
	if err := db.Create(&collectionContentExamplePO{ID: "example-2", RequestID: "request-2"}).Error; err != nil {
		t.Fatalf("seed example-2: %v", err)
	}

	repo := NewRepository(db)
	if err := repo.DeleteCollectionContents(context.Background(), "collection-1"); err != nil {
		t.Fatalf("delete collection contents: %v", err)
	}

	var deletedRequest collectionContentRequestPO
	if err := db.Unscoped().First(&deletedRequest, "id = ?", "request-1").Error; err != nil {
		t.Fatalf("load deleted request: %v", err)
	}
	if !deletedRequest.DeletedAt.Valid {
		t.Fatal("expected request in deleted collection to be soft deleted")
	}

	var deletedExample collectionContentExamplePO
	if err := db.Unscoped().First(&deletedExample, "id = ?", "example-1").Error; err != nil {
		t.Fatalf("load deleted example: %v", err)
	}
	if !deletedExample.DeletedAt.Valid {
		t.Fatal("expected example for deleted request to be soft deleted")
	}

	var remainingRequest collectionContentRequestPO
	if err := db.Unscoped().First(&remainingRequest, "id = ?", "request-2").Error; err != nil {
		t.Fatalf("load remaining request: %v", err)
	}
	if remainingRequest.DeletedAt.Valid {
		t.Fatal("expected request in another collection to remain active")
	}

	var remainingExample collectionContentExamplePO
	if err := db.Unscoped().First(&remainingExample, "id = ?", "example-2").Error; err != nil {
		t.Fatalf("load remaining example: %v", err)
	}
	if remainingExample.DeletedAt.Valid {
		t.Fatal("expected example for another collection to remain active")
	}
}
