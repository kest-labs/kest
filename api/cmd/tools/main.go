package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/storage"
)

func main() {
	toolName := flag.String("tool", "", "Tool to run (generate-url or check-file)")
	flag.Parse()

	switch *toolName {
	case "generate-url":
		GeneratePresignedURL()
	case "check-file":
		CheckR2File()
	case "config-cache":
		CacheConfig()
	case "config-clear":
		ClearConfigCache()
	default:
		fmt.Printf("Unknown tool: %s\n", *toolName)
		fmt.Println("Available tools: generate-url, check-file, config-cache, config-clear")
		os.Exit(1)
	}
}

// GeneratePresignedURL generates a presigned URL
func GeneratePresignedURL() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	r2Client := storage.NewR2Client(cfg)
	url, err := r2Client.GeneratePresignedURL("test.txt", "text/plain")
	if err != nil {
		log.Fatalf("Failed to generate presigned URL: %v", err)
	}

	fmt.Printf("Presigned URL: %s\n", url)
}

// CheckR2File checks if an R2 file exists
func CheckR2File() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	r2Client := storage.NewR2Client(cfg)
	exists, err := r2Client.FileExists("test.txt")
	if err != nil {
		log.Fatalf("Failed to check file: %v", err)
	}

	fmt.Printf("File exists: %v\n", exists)
}

// CacheConfig caches the current configuration to disk.
func CacheConfig() {
	cfg, err := config.LoadFresh()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := config.CacheConfig(cfg); err != nil {
		log.Fatalf("Failed to cache config: %v", err)
	}

	fmt.Printf("Configuration cached at %s\n", config.CacheFilePath())
}

// ClearConfigCache removes the cached configuration file.
func ClearConfigCache() {
	if err := config.ClearCache(); err != nil {
		log.Fatalf("Failed to clear config cache: %v", err)
	}

	fmt.Printf("Configuration cache cleared (%s)\n", config.CacheFilePath())
}
