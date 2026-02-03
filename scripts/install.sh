#!/bin/bash
set -e

# 设置颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🦅 准备安装 Kest CLI...${NC}"

# 1. 检测系统架构
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case $ARCH in
  x86_64) ARCH="amd64" ;;
  x86) ARCH="386" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "暂不支持的架构: $ARCH"; exit 1 ;;
esac

# 2. 从 GitHub API 获取最新版本
REPO="kest-lab/kest-cli"
LATEST_TAG=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_TAG" ]; then
    echo "无法自动获取最新版本，请检查网络或手动访问 https://github.com/$REPO/releases"
    exit 1
fi

echo -e "检测到最新版本: ${GREEN}$LATEST_TAG${NC}"

# 3. 构造下载 URL
BINARY_NAME="kest-${OS}-${ARCH}"
# 注意：这里假设你的 Release 里的文件名格式是 kest-darwin-arm64, kest-linux-amd64 等
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$LATEST_TAG/$BINARY_NAME"

if [[ "$OS" == "mingw"* || "$OS" == "cygwin"* ]]; then
    DOWNLOAD_URL="${DOWNLOAD_URL}.exe"
    BINARY_NAME="${BINARY_NAME}.exe"
fi

# 4. 执行下载
echo -e "正在从 GitHub 下载 ${BINARY_NAME}..."
curl -fsSL "$DOWNLOAD_URL" -o kest_tmp

# 5. 安装到系统路径
if [ -w "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
else
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
    echo "提示: /usr/local/bin 无写入权限，将安装至 $INSTALL_DIR"
fi

mv kest_tmp "$INSTALL_DIR/kest"
chmod +x "$INSTALL_DIR/kest"

echo -e "${GREEN}✅ Kest $LATEST_TAG 已成功安装到 $INSTALL_DIR/kest${NC}"
echo -e "你可以现在输入 ${BLUE}kest version${NC} 来验证安装。"
