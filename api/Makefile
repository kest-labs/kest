BINARY_NAME=kest-api
SERVER_BINARY=kest-server
OUTPUT_DIR=bin
MAIN_PACKAGE=./cmd/api
WIRE_PACKAGE=./internal/wiring

# Version information
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME ?= $(shell date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS := -ldflags "-s -w -X main.Version=$(VERSION) -X main.GitCommit=$(GIT_COMMIT) -X main.BuildTime=$(BUILD_TIME)"

# Detect OS for platform-specific commands
ifeq ($(OS),Windows_NT)
	BINARY_EXT=.exe
	RM=del /Q
	MKDIR=mkdir
	PATH_SEP=\\
else
	BINARY_EXT=
	RM=rm -f
	MKDIR=mkdir -p
	PATH_SEP=/
endif

.PHONY: all build build-server build-all clean test cover lint lint-fix generate wire docs mock dev air server migrate seed tidy update vuln setup install build-windows build-linux build-darwin build-all-platforms build-prod help

# Default target
all: lint test build

# Create output directory
$(OUTPUT_DIR):
	@$(MKDIR) $(OUTPUT_DIR)

# Build CLI binary for current platform (auto-runs wire first)
build: wire $(OUTPUT_DIR)
	@echo "Building $(BINARY_NAME)..."
	go build $(LDFLAGS) -o $(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) $(MAIN_PACKAGE)

# Build server binary for current platform
build-server: $(OUTPUT_DIR)
	@echo "Building $(SERVER_BINARY)..."
	go build $(LDFLAGS) -o $(OUTPUT_DIR)$(PATH_SEP)$(SERVER_BINARY)$(BINARY_EXT) $(MAIN_PACKAGE)

# Build both binaries
build-all: build build-server
	@echo "Build completed for current platform"

# Build Windows binaries
build-windows: $(OUTPUT_DIR)
	@echo "Building Windows binaries..."
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME).exe $(MAIN_PACKAGE)
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(OUTPUT_DIR)/$(SERVER_BINARY).exe $(MAIN_PACKAGE)
	@echo "✅ Windows binaries built successfully"

# Build Linux binaries
build-linux: $(OUTPUT_DIR)
	@echo "Building Linux binaries..."
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME)-linux $(MAIN_PACKAGE)
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(OUTPUT_DIR)/$(SERVER_BINARY)-linux $(MAIN_PACKAGE)
	@echo "✅ Linux binaries built successfully"

# Build macOS binaries (both Intel and Apple Silicon)
build-darwin: $(OUTPUT_DIR)
	@echo "Building macOS binaries..."
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME)-darwin-amd64 $(MAIN_PACKAGE)
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(OUTPUT_DIR)/$(SERVER_BINARY)-darwin-amd64 $(MAIN_PACKAGE)
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME)-darwin-arm64 $(MAIN_PACKAGE)
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o $(OUTPUT_DIR)/$(SERVER_BINARY)-darwin-arm64 $(MAIN_PACKAGE)
	@echo "✅ macOS binaries built successfully"

# Build for all platforms
build-all-platforms: build-windows build-linux build-darwin
	@echo "✅ All platform binaries built successfully"

# Production build with optimizations
build-prod: wire $(OUTPUT_DIR)
	@echo "Building production binaries..."
	go build -ldflags="-s -w" -o $(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) $(MAIN_PACKAGE)
	go build -ldflags="-s -w" -o $(OUTPUT_DIR)$(PATH_SEP)$(SERVER_BINARY)$(BINARY_EXT) $(MAIN_PACKAGE)
	@echo "✅ Production binaries built successfully"

# Install CLI to $GOPATH/bin or /usr/local/bin
install: build
	@echo "Installing $(BINARY_NAME)..."
ifeq ($(OS),Windows_NT)
	go install $(LDFLAGS) $(MAIN_PACKAGE)
else
	go install $(LDFLAGS) $(MAIN_PACKAGE)
endif
	@echo "✅ $(BINARY_NAME) installed successfully"

# Clean build artifacts
clean:
	@echo "Cleaning..."
	go clean
ifeq ($(OS),Windows_NT)
	@if exist $(OUTPUT_DIR) rmdir /s /q $(OUTPUT_DIR)
else
	@rm -rf $(OUTPUT_DIR)
endif
	@rm -f coverage.txt coverage.html
	@echo "✅ Cleaned"

# Run tests
test:
	@echo "Running tests..."
	go test ./... -v

# Run tests with race detection
test-race:
	@echo "Running tests with race detection..."
	go test ./... -race -v

# Run tests with coverage
cover:
	@echo "Running tests with coverage..."
	go test ./... -coverprofile=coverage.txt -covermode=atomic
	go tool cover -html=coverage.txt -o coverage.html
	@echo "Coverage report: coverage.html"

# Run linter
lint:
	@echo "Running linter..."
	@which golangci-lint > /dev/null || (echo "Installing golangci-lint..." && go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest)
	golangci-lint run ./...

# Fix lint issues automatically
lint-fix:
	@echo "Fixing lint issues..."
	golangci-lint run --fix ./...

# Generate code (Wire, etc.)
generate:
	@echo "Generating code..."
	go generate ./...

# Run Wire dependency injection
wire:
	@echo "Running Wire..."
	go generate $(WIRE_PACKAGE)

# Generate API documentation (Swagger)
docs:
	@echo "Generating API documentation..."
	@which swag > /dev/null || (echo "Installing swag..." && go install github.com/swaggo/swag/cmd/swag@latest)
	swag init -g cmd/api/main.go -o docs/swagger

# Generate mocks
mock:
	@echo "Generating mocks..."
	@which mockgen > /dev/null || (echo "Installing mockgen..." && go install go.uber.org/mock/mockgen@latest)
	go generate ./...

# Run development server
dev:
	go run $(MAIN_PACKAGE)

# Run with Air hot-reload
air:
	@which air > /dev/null || (echo "Installing air..." && go install github.com/air-verse/air@latest)
ifeq ($(OS),Windows_NT)
	@if exist .air.windows.toml (air -c .air.windows.toml) else (air)
else
	air
endif

# Run server (alias for dev)
server: dev

# Database migrations
migrate:
	@echo "Running migrations..."
ifeq ($(OS),Windows_NT)
	@if exist $(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) ($(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) migrate) else (go run cmd/kest-api/main.go migrate)
else
	@if [ -f $(OUTPUT_DIR)/$(BINARY_NAME) ]; then ./$(OUTPUT_DIR)/$(BINARY_NAME) migrate; else go run cmd/kest-api/main.go migrate; fi
endif

migrate-fresh:
	@echo "Running fresh migrations..."
ifeq ($(OS),Windows_NT)
	@if exist $(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) ($(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) migrate:fresh) else (go run cmd/kest-api/main.go migrate:fresh)
else
	@if [ -f $(OUTPUT_DIR)/$(BINARY_NAME) ]; then ./$(OUTPUT_DIR)/$(BINARY_NAME) migrate:fresh; else go run cmd/kest-api/main.go migrate:fresh; fi
endif

migrate-rollback:
	@echo "Rolling back migrations..."
ifeq ($(OS),Windows_NT)
	@if exist $(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) ($(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) migrate:rollback) else (go run cmd/kest-api/main.go migrate:rollback)
else
	@if [ -f $(OUTPUT_DIR)/$(BINARY_NAME) ]; then ./$(OUTPUT_DIR)/$(BINARY_NAME) migrate:rollback; else go run cmd/kest-api/main.go migrate:rollback; fi
endif

# Database seeding
seed:
	@echo "Running seeders..."
ifeq ($(OS),Windows_NT)
	@if exist $(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) ($(OUTPUT_DIR)$(PATH_SEP)$(BINARY_NAME)$(BINARY_EXT) db:seed) else (go run cmd/kest-api/main.go db:seed)
else
	@if [ -f $(OUTPUT_DIR)/$(BINARY_NAME) ]; then ./$(OUTPUT_DIR)/$(BINARY_NAME) db:seed; else go run cmd/kest-api/main.go db:seed; fi
endif

# Tidy dependencies
tidy:
	@echo "Tidying dependencies..."
	go mod tidy

# Update dependencies
update:
	@echo "Updating dependencies..."
	go get -u ./...
	go mod tidy

# Check for vulnerabilities
vuln:
	@echo "Checking for vulnerabilities..."
	@which govulncheck > /dev/null || (echo "Installing govulncheck..." && go install golang.org/x/vuln/cmd/govulncheck@latest)
	govulncheck ./...

# Setup development environment
setup:
	@echo "Setting up development environment..."
	@go mod download
ifeq ($(OS),Windows_NT)
	@echo "⚠️  Git hooks setup requires Git Bash or WSL on Windows"
	@echo "   Run: git config core.hooksPath .githooks"
else
	@git config core.hooksPath .githooks
	@chmod +x .githooks/*
	@echo "✅ Git hooks configured"
endif
	@echo "✅ Dependencies downloaded"
	@echo "Run 'make install' to install kest-api CLI globally"

# Show help
help:
	@echo "Available targets:"
	@echo ""
	@echo "Build Commands:"
	@echo "  make build              - Build CLI binary for current platform"
	@echo "  make build-server       - Build server binary for current platform"
	@echo "  make build-all          - Build both CLI and server binaries"
	@echo "  make build-windows      - Build Windows binaries (.exe)"
	@echo "  make build-linux        - Build Linux binaries"
	@echo "  make build-darwin       - Build macOS binaries (amd64 + arm64)"
	@echo "  make build-all-platforms- Build for all platforms"
	@echo "  make build-prod         - Production build with optimizations"
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev                - Run development server"
	@echo "  make server             - Run server (alias for dev)"
	@echo "  make air                - Run with hot reload (Air)"
	@echo "  make test               - Run tests"
	@echo "  make test-race          - Run tests with race detection"
	@echo "  make cover              - Run tests with coverage report"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint               - Run golangci-lint"
	@echo "  make lint-fix           - Fix lint issues automatically"
	@echo "  make generate           - Run go generate"
	@echo "  make wire               - Run Wire DI generator"
	@echo "  make docs               - Generate Swagger documentation"
	@echo "  make mock               - Generate mocks"
	@echo ""
	@echo "Database Commands:"
	@echo "  make migrate            - Run database migrations"
	@echo "  make migrate-fresh      - Fresh migration (drop & recreate)"
	@echo "  make migrate-rollback   - Rollback last migration"
	@echo "  make seed               - Run database seeders"
	@echo ""
	@echo "Maintenance:"
	@echo "  make install            - Install CLI to system PATH"
	@echo "  make clean              - Clean build artifacts"
	@echo "  make tidy               - Tidy dependencies"
	@echo "  make update             - Update dependencies"
	@echo "  make vuln               - Check for vulnerabilities"
	@echo "  make setup              - Setup development environment"
	@echo "  make help               - Show this help"
