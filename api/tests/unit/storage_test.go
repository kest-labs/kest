package unit

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/kest-labs/kest/api/internal/infra/storage"
)

func setupTestStorage(t *testing.T) (*storage.LocalDisk, string) {
	tmpDir := t.TempDir()
	disk, err := storage.NewLocalDisk(storage.LocalConfig{
		Root:    tmpDir,
		BaseURL: "http://example.com/storage",
	})
	if err != nil {
		t.Fatalf("Failed to create local disk: %v", err)
	}
	return disk, tmpDir
}

func TestLocalDisk_Put(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	err := disk.Put(ctx, "test.txt", []byte("hello world"))
	if err != nil {
		t.Fatalf("Put failed: %v", err)
	}

	if !disk.Exists(ctx, "test.txt") {
		t.Error("File should exist after Put")
	}
}

func TestLocalDisk_Get(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	content := []byte("test content")
	disk.Put(ctx, "test.txt", content)

	retrieved, err := disk.Get(ctx, "test.txt")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}

	if !bytes.Equal(retrieved, content) {
		t.Errorf("Expected '%s', got '%s'", content, retrieved)
	}
}

func TestLocalDisk_Get_NotFound(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	_, err := disk.Get(ctx, "nonexistent.txt")
	if err != storage.ErrFileNotFound {
		t.Errorf("Expected ErrFileNotFound, got %v", err)
	}
}

func TestLocalDisk_Delete(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	disk.Put(ctx, "test.txt", []byte("content"))
	err := disk.Delete(ctx, "test.txt")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if disk.Exists(ctx, "test.txt") {
		t.Error("File should not exist after Delete")
	}
}

func TestLocalDisk_Delete_NotFound(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	// Should not error for non-existent file
	err := disk.Delete(ctx, "nonexistent.txt")
	if err != nil {
		t.Errorf("Delete should not error for non-existent file: %v", err)
	}
}

func TestLocalDisk_Exists(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	if disk.Exists(ctx, "test.txt") {
		t.Error("File should not exist initially")
	}

	disk.Put(ctx, "test.txt", []byte("content"))

	if !disk.Exists(ctx, "test.txt") {
		t.Error("File should exist after Put")
	}
}

func TestLocalDisk_Size(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	content := []byte("12345678901234567890") // 20 bytes
	disk.Put(ctx, "test.txt", content)

	size, err := disk.Size(ctx, "test.txt")
	if err != nil {
		t.Fatalf("Size failed: %v", err)
	}

	if size != 20 {
		t.Errorf("Expected size 20, got %d", size)
	}
}

func TestLocalDisk_Size_NotFound(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	_, err := disk.Size(ctx, "nonexistent.txt")
	if err != storage.ErrFileNotFound {
		t.Errorf("Expected ErrFileNotFound, got %v", err)
	}
}

func TestLocalDisk_LastModified(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	disk.Put(ctx, "test.txt", []byte("content"))

	modTime, err := disk.LastModified(ctx, "test.txt")
	if err != nil {
		t.Fatalf("LastModified failed: %v", err)
	}

	if modTime.IsZero() {
		t.Error("LastModified should not be zero")
	}
}

func TestLocalDisk_Copy(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	content := []byte("original content")
	disk.Put(ctx, "original.txt", content)

	err := disk.Copy(ctx, "original.txt", "copy.txt")
	if err != nil {
		t.Fatalf("Copy failed: %v", err)
	}

	// Both files should exist
	if !disk.Exists(ctx, "original.txt") {
		t.Error("Original file should still exist")
	}
	if !disk.Exists(ctx, "copy.txt") {
		t.Error("Copy should exist")
	}

	// Content should be the same
	copied, _ := disk.Get(ctx, "copy.txt")
	if !bytes.Equal(copied, content) {
		t.Error("Copied content should match original")
	}
}

func TestLocalDisk_Move(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	content := []byte("content to move")
	disk.Put(ctx, "source.txt", content)

	err := disk.Move(ctx, "source.txt", "dest.txt")
	if err != nil {
		t.Fatalf("Move failed: %v", err)
	}

	// Source should not exist, dest should
	if disk.Exists(ctx, "source.txt") {
		t.Error("Source file should not exist after move")
	}
	if !disk.Exists(ctx, "dest.txt") {
		t.Error("Destination file should exist after move")
	}

	// Content should be preserved
	moved, _ := disk.Get(ctx, "dest.txt")
	if !bytes.Equal(moved, content) {
		t.Error("Moved content should match original")
	}
}

func TestLocalDisk_URL(t *testing.T) {
	disk, _ := setupTestStorage(t)

	url := disk.URL("images/photo.jpg")
	expected := "http://example.com/storage/images/photo.jpg"

	if url != expected {
		t.Errorf("Expected URL '%s', got '%s'", expected, url)
	}
}

func TestLocalDisk_URL_NoBaseURL(t *testing.T) {
	tmpDir := t.TempDir()
	disk, _ := storage.NewLocalDisk(storage.LocalConfig{Root: tmpDir})

	url := disk.URL("images/photo.jpg")
	if url != "images/photo.jpg" {
		t.Errorf("Expected path as URL, got '%s'", url)
	}
}

func TestLocalDisk_PutStream(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	content := []byte("stream content")
	reader := bytes.NewReader(content)

	err := disk.PutStream(ctx, "stream.txt", reader)
	if err != nil {
		t.Fatalf("PutStream failed: %v", err)
	}

	retrieved, _ := disk.Get(ctx, "stream.txt")
	if !bytes.Equal(retrieved, content) {
		t.Error("PutStream content should match")
	}
}

func TestLocalDisk_GetStream(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	content := []byte("stream content")
	disk.Put(ctx, "test.txt", content)

	reader, err := disk.GetStream(ctx, "test.txt")
	if err != nil {
		t.Fatalf("GetStream failed: %v", err)
	}
	defer reader.Close()

	buf := new(bytes.Buffer)
	buf.ReadFrom(reader)

	if !bytes.Equal(buf.Bytes(), content) {
		t.Error("GetStream content should match")
	}
}

func TestLocalDisk_NestedDirectories(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	// Put file in nested directory
	err := disk.Put(ctx, "deep/nested/dir/file.txt", []byte("content"))
	if err != nil {
		t.Fatalf("Put in nested dir failed: %v", err)
	}

	if !disk.Exists(ctx, "deep/nested/dir/file.txt") {
		t.Error("File in nested dir should exist")
	}
}

func TestLocalDisk_MakeDirectory(t *testing.T) {
	disk, tmpDir := setupTestStorage(t)
	ctx := context.Background()

	err := disk.MakeDirectory(ctx, "newdir")
	if err != nil {
		t.Fatalf("MakeDirectory failed: %v", err)
	}

	info, err := os.Stat(filepath.Join(tmpDir, "newdir"))
	if err != nil {
		t.Fatalf("Directory should exist: %v", err)
	}
	if !info.IsDir() {
		t.Error("Should be a directory")
	}
}

func TestLocalDisk_DeleteDirectory(t *testing.T) {
	disk, tmpDir := setupTestStorage(t)
	ctx := context.Background()

	// Create directory with files
	disk.Put(ctx, "testdir/file1.txt", []byte("1"))
	disk.Put(ctx, "testdir/file2.txt", []byte("2"))

	err := disk.DeleteDirectory(ctx, "testdir")
	if err != nil {
		t.Fatalf("DeleteDirectory failed: %v", err)
	}

	_, err = os.Stat(filepath.Join(tmpDir, "testdir"))
	if !os.IsNotExist(err) {
		t.Error("Directory should be deleted")
	}
}

func TestLocalDisk_Files(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	disk.Put(ctx, "dir/file1.txt", []byte("1"))
	disk.Put(ctx, "dir/file2.txt", []byte("2"))
	disk.MakeDirectory(ctx, "dir/subdir")

	files, err := disk.Files(ctx, "dir")
	if err != nil {
		t.Fatalf("Files failed: %v", err)
	}

	if len(files) != 2 {
		t.Errorf("Expected 2 files, got %d", len(files))
	}
}

func TestLocalDisk_Directories(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	disk.MakeDirectory(ctx, "parent/child1")
	disk.MakeDirectory(ctx, "parent/child2")
	disk.Put(ctx, "parent/file.txt", []byte("content"))

	dirs, err := disk.Directories(ctx, "parent")
	if err != nil {
		t.Fatalf("Directories failed: %v", err)
	}

	if len(dirs) != 2 {
		t.Errorf("Expected 2 directories, got %d", len(dirs))
	}
}

func TestLocalDisk_AllFiles(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	disk.Put(ctx, "root.txt", []byte("root"))
	disk.Put(ctx, "level1/file1.txt", []byte("1"))
	disk.Put(ctx, "level1/level2/file2.txt", []byte("2"))

	files, err := disk.AllFiles(ctx, "")
	if err != nil {
		t.Fatalf("AllFiles failed: %v", err)
	}

	if len(files) != 3 {
		t.Errorf("Expected 3 files recursively, got %d", len(files))
	}
}

func TestLocalDisk_InvalidPath(t *testing.T) {
	disk, _ := setupTestStorage(t)
	ctx := context.Background()

	// Try directory traversal
	err := disk.Put(ctx, "../outside.txt", []byte("content"))
	if err != storage.ErrInvalidPath {
		t.Errorf("Expected ErrInvalidPath for directory traversal, got %v", err)
	}
}

func TestManager_RegisterDisk(t *testing.T) {
	manager := storage.New()
	disk, _ := storage.NewLocalDisk(storage.LocalConfig{Root: t.TempDir()})

	manager.RegisterDisk("local", disk)

	retrieved := manager.Disk("local")
	if retrieved == nil {
		t.Error("Disk should be registered")
	}
}

func TestManager_SetDefault(t *testing.T) {
	manager := storage.New()
	disk1, _ := storage.NewLocalDisk(storage.LocalConfig{Root: t.TempDir()})
	disk2, _ := storage.NewLocalDisk(storage.LocalConfig{Root: t.TempDir()})

	manager.RegisterDisk("disk1", disk1)
	manager.RegisterDisk("disk2", disk2)
	manager.SetDefault("disk2")

	if manager.Default() != disk2 {
		t.Error("Default should be disk2")
	}
}

func TestGlobal_Functions(t *testing.T) {
	// Setup global storage
	disk, _ := storage.NewLocalDisk(storage.LocalConfig{Root: t.TempDir()})
	storage.RegisterDisk("local", disk)
	storage.Global().SetDefault("local")

	ctx := context.Background()

	// Test global functions
	err := storage.Put(ctx, "global.txt", []byte("content"))
	if err != nil {
		t.Fatalf("Global Put failed: %v", err)
	}

	if !storage.Exists(ctx, "global.txt") {
		t.Error("Global Exists should return true")
	}

	content, err := storage.Get(ctx, "global.txt")
	if err != nil {
		t.Fatalf("Global Get failed: %v", err)
	}
	if string(content) != "content" {
		t.Errorf("Expected 'content', got '%s'", content)
	}

	err = storage.Delete(ctx, "global.txt")
	if err != nil {
		t.Fatalf("Global Delete failed: %v", err)
	}
}
