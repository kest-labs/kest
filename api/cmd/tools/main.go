package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/kest-labs/kest/api/internal/infra/config"
)

func main() {
	toolName := flag.String("tool", "", "Tool to run (generate-url or check-file)")
	flag.Parse()

	switch *toolName {
	case "config-cache":
		CacheConfig()
	case "config-clear":
		ClearConfigCache()
	default:
		fmt.Printf("Unknown tool: %s\n", *toolName)
		fmt.Println("Available tools: config-cache, config-clear")
		os.Exit(1)
	}
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
