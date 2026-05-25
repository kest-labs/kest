#!/bin/bash

# ===========================================
# Kest Platform Build Script
# ===========================================
# Builds the Next.js frontend and Go API binary

set -e  # Exit on error

echo "🏗️  Building Kest Platform..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ===========================================
# 1. Build Frontend (Next.js)
# ===========================================
echo -e "${BLUE}📦 Building frontend (Next.js + React)...${NC}"
cd "$PROJECT_ROOT/web"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  📥 Installing dependencies..."
    npm install
fi

# Build Next.js
echo "  ⚙️  Compiling Next.js..."
npm run build

# Check if build succeeded
if [ ! -d ".next" ]; then
    echo -e "${YELLOW}⚠️  Error: .next/ directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}  ✅ Frontend built successfully${NC}"
echo ""

# ===========================================
# 2. Build Backend (Go API)
# ===========================================
echo -e "${BLUE}🔨 Building backend (Go API)...${NC}"
cd "$PROJECT_ROOT/api"

# Download Go dependencies
echo "  📥 Downloading Go modules..."
go mod download

# Build binary
echo "  ⚙️  Compiling Go binary..."
CGO_ENABLED=0 go build -ldflags="-s -w" -o "$PROJECT_ROOT/kest-server" ./cmd/api

# Check if build succeeded
if [ ! -f "$PROJECT_ROOT/kest-server" ]; then
    echo -e "${YELLOW}⚠️  Error: Binary not created${NC}"
    exit 1
fi

echo -e "${GREEN}  ✅ Backend built successfully${NC}"
echo ""

# ===========================================
# Summary
# ===========================================
echo -e "${GREEN}🎉 Build completed!${NC}"
echo ""
echo "📦 Binary: $PROJECT_ROOT/kest-server"
echo "📏 Size: $(du -h "$PROJECT_ROOT/kest-server" | cut -f1)"
echo ""

# ===========================================
# 3. Run local Kest flows
# ===========================================
echo -e "${BLUE}🧪 Running local Kest flow tests...${NC}"
KEST_PROFILE=local "$PROJECT_ROOT/scripts/run-kest-flows.sh"
echo -e "${GREEN}  ✅ Kest flow tests completed${NC}"
echo ""

echo "🚀 To run:"
echo "   cd $PROJECT_ROOT"
echo "   ./kest-server"
echo ""
echo "   Server will start on http://localhost:${PORT:-5119}"
