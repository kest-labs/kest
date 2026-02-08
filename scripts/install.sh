#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

REPO="kest-lab/kest-cli"
GO_PACKAGE="github.com/$REPO/cmd/kest"

printf "${BLUE}Installing Kest CLI...${NC}\n"

# 1. Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case $ARCH in
  x86_64) ARCH="amd64" ;;
  x86) ARCH="386" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) printf "${RED}Error: Unsupported architecture: $ARCH${NC}\n"; exit 1 ;;
esac

# 2. Determine install directory
if [ -w "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
else
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
fi

# 3. Try to download pre-built binary from GitHub Releases
install_from_release() {
    # Try latest release first
    LATEST_TAG=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

    if [ -z "$LATEST_TAG" ]; then
        return 1
    fi

    printf "Found release: ${GREEN}$LATEST_TAG${NC}\n"

    BINARY_NAME="kest_${OS}_${ARCH}"
    EXT="tar.gz"
    if [[ "$OS" == "windows" ]]; then
        EXT="zip"
    fi

    DOWNLOAD_URL="https://github.com/$REPO/releases/download/$LATEST_TAG/${BINARY_NAME}.${EXT}"

    printf "Downloading ${BINARY_NAME}.${EXT}...\n"
    if ! curl -fsSL "$DOWNLOAD_URL" -o "kest_download.${EXT}" 2>/dev/null; then
        rm -f "kest_download.${EXT}"
        return 1
    fi

    if [[ "$EXT" == "tar.gz" ]]; then
        tar -xzf "kest_download.tar.gz" kest
    else
        unzip -o "kest_download.zip" kest.exe
    fi

    BINARY_FILE="kest"
    if [[ "$OS" == "windows" ]]; then
        BINARY_FILE="kest.exe"
    fi

    mv "$BINARY_FILE" "$INSTALL_DIR/kest"
    chmod +x "$INSTALL_DIR/kest"
    rm -f "kest_download.${EXT}"

    printf "${GREEN}Kest $LATEST_TAG installed to $INSTALL_DIR/kest${NC}\n"
    return 0
}

# 4. Fallback: build from source using go install
install_from_source() {
    if ! command -v go &> /dev/null; then
        printf "${RED}Error: Go is not installed.${NC}\n"
        printf "Please install Go first: https://go.dev/dl/\n"
        printf "Then run: ${BLUE}go install $GO_PACKAGE@latest${NC}\n"
        exit 1
    fi

    # Get latest tag for version info
    LATEST_TAG=$(curl -s "https://api.github.com/repos/$REPO/tags" 2>/dev/null | grep '"name":' | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')
    VERSION="${LATEST_TAG:-latest}"

    printf "Building from source (${GREEN}$VERSION${NC})...\n"

    GOBIN="$INSTALL_DIR" go install "$GO_PACKAGE@$VERSION"

    if [ $? -eq 0 ] && [ -f "$INSTALL_DIR/kest" ]; then
        chmod +x "$INSTALL_DIR/kest"
        printf "${GREEN}Kest $VERSION installed to $INSTALL_DIR/kest${NC}\n"
        return 0
    else
        return 1
    fi
}

# 5. Execute installation
if install_from_release; then
    : # Success via release binary
else
    printf "${YELLOW}No pre-built binary available. Building from source...${NC}\n"
    if ! install_from_source; then
        printf "${RED}Error: Installation failed.${NC}\n"
        printf "Please try manually: ${BLUE}go install $GO_PACKAGE@latest${NC}\n"
        exit 1
    fi
fi

# 6. Verify and show PATH hint
if ! command -v kest &> /dev/null; then
    if [[ "$INSTALL_DIR" == "$HOME/.local/bin" ]]; then
        printf "${YELLOW}Note: $INSTALL_DIR is not in your PATH.${NC}\n"
        printf "Add it by running:\n"
        printf "  ${BLUE}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}\n"
        printf "Then add the line above to your ~/.bashrc or ~/.zshrc\n"
    fi
fi

printf "Run ${BLUE}kest --version${NC} to verify the installation.\n"
