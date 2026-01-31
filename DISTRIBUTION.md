# Kest CLI 分发与分发指南 (Distribution & Setup Guide)

为了让用户更方便地安装和使用 Kest，我们提供了以下分发方案。

## 1. 🍺 Homebrew 分发 (macOS/Linux)

这是最推荐的安装方式。你可以创建一个 `homebrew-tap` 仓库。

### 安装命令
```bash
brew tap kest-lab/kest
brew install kest
```

### 如何发布

#### 步骤 1：创建 Homebrew Tap 仓库
```bash
# 在 GitHub 上创建仓库：github.com/kest-lab/homebrew-kest
git clone https://github.com/kest-lab/homebrew-kest.git
cd homebrew-kest
mkdir -p Formula
```

#### 步骤 2：生成 SHA256 校验和
```bash
# 下载发布的 tar.gz
curl -LO https://github.com/kest-lab/kest-cli/archive/refs/tags/v0.5.0.tar.gz

# 计算 SHA256
openssl dgst -sha256 v0.5.0.tar.gz
# 输出示例：SHA256(v0.5.0.tar.gz)= abc123...
```

#### 步骤 3：创建 Formula 文件
添加 `Formula/kest.rb` 文件：
```ruby
class Kest < Formula
  desc "The CLI-first API Testing Tool for Vibe Coding"
  homepage "https://github.com/kest-lab/kest-cli"
  url "https://github.com/kest-lab/kest-cli/archive/refs/tags/v0.5.0.tar.gz"
  sha256 "REPLACE_WITH_ACTUAL_SHA256" # 使用 'openssl dgst -sha256 v0.5.0.tar.gz' 获取
  license "MIT"

  depends_on "go" => :build

  def install
    system "go", "build", *std_go_args(output: bin/"kest"), "./cmd/kest"
  end

  test do
    system "#{bin}/kest", "version"
  end
end
```

#### 步骤 4：提交并推送
```bash
git add Formula/kest.rb
git commit -m "Add kest formula v0.5.0"
git push origin main
```

#### 步骤 5：用户安装
```bash
# 用户只需执行
brew tap kest-lab/kest
brew install kest

# 验证安装
kest version
```

### 自动化更新 (GitHub Actions)

在 `kest-cli` 仓库中添加 `.github/workflows/release.yml`：
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  homebrew:
    runs-on: ubuntu-latest
    steps:
      - name: Update Homebrew Formula
        uses: mislav/bump-homebrew-formula-action@v2
        with:
          formula-name: kest
          homebrew-tap: kest-lab/homebrew-kest
        env:
          COMMITTER_TOKEN: ${{ secrets.COMMITTER_TOKEN }}
```

---

## 2. 🐋 Docker 分发 (全平台)

如果你想通过类似 Docker Desktop 的方式使用 Kest，可以提供官方镜像。

### 运行方式
```bash
docker run -it --rm -v $(pwd):/work kestlab/kest run auth.flow.md
```

### Dockerfile 示例
```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o kest ./cmd/kest

FROM alpine:latest
COPY --from=builder /app/kest /usr/local/bin/kest
WORKDIR /work
ENTRYPOINT ["kest"]
```

---

## 3. 🖥 桌面化建议 (GUI/Desktop)

目前 Kest 是 CLI 优先。如果你想实现类似 Docker Desktop 的管理界面，有以下方案：

### 方案 A：Raycast 扩展 (macOS)
为 Raycast 编写一个扩展，直接在搜索框里输入 `kest run` 就能看到进度。这是目前“最轻量、最极客”的桌面化方案。

### 方案 B：Tauri / Electron 包装 (推荐)
使用 **Tauri (推荐)** 或 Electron 包装一个简单的 GUI，提供以下功能：
- **可视化历史记录**：查看 SQLite 中的 `records.db`。
- **环境配置管理**：图形化编辑 `config.yaml`。
- **一键运行 Flow**：列出本地所有的 `.flow.md` 并提供运行按钮。
- **实时日志查看**：显示测试执行过程和结果。

**技术栈建议**：
- **Tauri + React/Vue**：体积小（~3MB），性能好，适合轻量级桌面应用。
- **Electron + React**：生态成熟，但体积较大（~100MB）。

**参考项目**：
- [Postman Desktop](https://www.postman.com/downloads/)
- [Bruno](https://www.usebruno.com/) - 开源 API 客户端
- [Insomnia](https://insomnia.rest/)

### 方案 C：IDE 插件 (最实用)
针对 **Cursor/Windsurf/VS Code** 开发插件，在侧边栏显示 Flow 列表，并在编辑器内直接高亮和运行 ` ```kest ` 块。

**功能设计**：
- 在 Markdown 文件中识别 ` ```kest ` 代码块。
- 提供 CodeLens 按钮：`▶ Run` / `▶ Debug`。
- 在侧边栏显示历史记录和变量。
- 支持快捷键：`Cmd+Shift+K` 运行当前 Flow。

**参考插件**：
- [REST Client for VS Code](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
- [Thunder Client](https://www.thunderclient.com/)

### 方案 D：Web 控制台 (kest-web)
开发一个轻量级的 Web UI（类似 Docker Desktop 的 Dashboard），通过 `kest serve` 启动：
```bash
kest serve --port 3000
# 打开 http://localhost:3000 查看控制台
```

**功能**：
- 查看和管理历史记录。
- 可视化编辑和运行 Flow。
- 实时查看测试结果和日志。
- 环境变量管理。

---

## 4. 🚀 快速下载 (Shell Script)

提供一个类似 `curl | sh` 的安装脚本，适合不想安装 Go 或 Brew 的用户。

### 安装脚本示例
```bash
curl -fsSL https://kest.dev/install.sh | sh
```

### install.sh 实现
```bash
#!/bin/bash
set -e

# 检测操作系统和架构
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case $ARCH in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# 下载最新版本
VERSION="v0.5.0"
URL="https://github.com/kest-lab/kest-cli/releases/download/${VERSION}/kest-${OS}-${ARCH}"

echo "Downloading kest ${VERSION} for ${OS}-${ARCH}..."
curl -fsSL "$URL" -o /tmp/kest

# 安装到 /usr/local/bin
sudo mv /tmp/kest /usr/local/bin/kest
sudo chmod +x /usr/local/bin/kest

echo "✅ Kest installed successfully!"
kest version
```

---

## 5. 📦 其他分发方式

### GitHub Releases (直接下载)
在每次发布时，通过 GitHub Actions 自动构建多平台二进制文件：
- `kest-darwin-amd64` (macOS Intel)
- `kest-darwin-arm64` (macOS Apple Silicon)
- `kest-linux-amd64` (Linux)
- `kest-linux-arm64` (Linux ARM)
- `kest-windows-amd64.exe` (Windows)

### Scoop (Windows)
```bash
scoop bucket add kest https://github.com/kest-lab/scoop-kest
scoop install kest
```

### Snap (Linux)
```bash
sudo snap install kest
```

---

## 🎯 推荐方案总结

| 方案 | 适用场景 | 优先级 |
|------|---------|--------|
| **Homebrew Tap** | macOS/Linux 用户 | ⭐⭐⭐⭐⭐ |
| **GitHub Releases** | 所有平台，直接下载 | ⭐⭐⭐⭐⭐ |
| **Shell Script** | 快速安装 | ⭐⭐⭐⭐ |
| **Docker** | 容器化环境 | ⭐⭐⭐ |
| **VS Code 插件** | 开发者日常使用 | ⭐⭐⭐⭐⭐ |
| **Tauri Desktop** | 需要 GUI 的用户 | ⭐⭐⭐ |
| **Web 控制台** | 团队协作 | ⭐⭐⭐ |

**建议优先级**：
1. **立即实施**：Homebrew Tap + GitHub Releases + Shell Script
2. **短期规划**：VS Code 插件
3. **长期规划**：Tauri Desktop / Web 控制台
