#!/usr/bin/env bash

set -euo pipefail

echo "🏗️  Building Kest API..."
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT="${KEST_API_OUTPUT:-$WORKSPACE_ROOT/kest-api}"

echo -e "${BLUE}🔨 Building backend (Go API)...${NC}"
cd "$WORKSPACE_ROOT/api"

echo "  📥 Downloading Go modules..."
go mod download

echo "  ⚙️  Compiling Go binary..."
CGO_ENABLED="${CGO_ENABLED:-0}" go build -ldflags="-s -w" -o "$OUTPUT" ./cmd/api

if [[ ! -f "$OUTPUT" ]]; then
  echo -e "${YELLOW}⚠️  Error: API binary not created${NC}"
  exit 1
fi

echo -e "${GREEN}  ✅ Backend built successfully${NC}"
echo ""
echo -e "${GREEN}🎉 API build completed!${NC}"
echo "📦 Binary: $OUTPUT"
echo "📏 Size: $(du -h "$OUTPUT" | cut -f1)"
echo ""

echo -e "${BLUE}🧪 Running local Kest flow tests...${NC}"
KEST_PROFILE=local "$WORKSPACE_ROOT/scripts/run-kest-flows.sh"
echo -e "${GREEN}  ✅ Kest flow tests completed${NC}"
echo ""

