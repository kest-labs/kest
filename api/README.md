# Trac - 轻量化错误追踪系统

> Sentry 轻量替代方案 | 完全兼容 Sentry SDK | Go + ClickHouse

## 📦 功能特性

- ✅ **Sentry SDK 兼容** - 直接使用官方 Go/JS/Python SDK
- ✅ **高性能存储** - ClickHouse 列式存储，支持海量事件
- ✅ **智能聚合** - 按 fingerprint 自动去重，生成 Issue
- ✅ **实时监控** - 错误实时采集，毫秒级入库

## 🚀 快速开始

### 1. 环境要求

- Go 1.21+
- PostgreSQL 12+
- ClickHouse 21+
- Redis 6+ (可选)

### 2. 启动服务

```bash
# 克隆项目
git clone https://github.com/kest-labs/kest.git
cd kest/api

# 配置环境变量
cp .env.example .env
# 编辑 .env 配置数据库连接

# 启动 ClickHouse (Docker)
docker run -d --name zgo-clickhouse \
  -p 9000:9000 \
  -e CLICKHOUSE_DB=trac \
  -e CLICKHOUSE_USER=trac_user \
  -e CLICKHOUSE_PASSWORD=trac_pass \
  clickhouse/clickhouse-server:latest

# 启动服务
go run cmd/server/main.go
```

### 3. 创建项目

```bash
# 创建项目
curl -X POST http://localhost:8025/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "My App", "platform": "go"}'

# 获取 DSN
curl http://localhost:8025/v1/projects/1/dsn \
  -H "Authorization: Bearer YOUR_TOKEN"

# 响应: {"dsn": "http://abc123@localhost:8025/1"}
```

### 4. 集成 Sentry SDK

#### Go 应用

```go
import (
    "github.com/getsentry/sentry-go"
    sentrygin "github.com/getsentry/sentry-go/gin"
)

func main() {
    // 初始化 Sentry，DSN 指向 Trac 服务器
    sentry.Init(sentry.ClientOptions{
        Dsn: "http://abc123@localhost:8025/1",
        Environment: "production",
        Release: "myapp@1.0.0",
    })
    defer sentry.Flush(2 * time.Second)

    // Gin 中间件
    r := gin.Default()
    r.Use(sentrygin.New(sentrygin.Options{
        Repanic: true,
    }))

    // 手动上报错误
    sentry.CaptureException(errors.New("something went wrong"))
}
```

#### JavaScript 应用

```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "http://abc123@localhost:8025/1",
  environment: "production",
});

// 自动捕获未处理异常
// 或手动上报
Sentry.captureException(new Error("Something went wrong"));
```

#### Python 应用

```python
import sentry_sdk

sentry_sdk.init(
    dsn="http://abc123@localhost:8025/1",
    environment="production",
)

# 手动上报
sentry_sdk.capture_exception(Exception("Something went wrong"))
```

## 📊 API 端点

### SDK 上报端点（公开）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/{project_id}/envelope/` | Sentry Envelope 上报 |
| POST | `/api/{project_id}/store/` | 传统事件上报（已废弃） |

### 管理端点（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/projects` | 创建项目 |
| GET | `/v1/projects/:id/dsn` | 获取 DSN |
| GET | `/v1/projects/:id/issues/` | 获取 Issue 列表 |
| POST | `/v1/projects/:id/issues/:fingerprint/resolve` | 标记已解决 |

详细 API 文档见: [docs/api.md](docs/api.md)

## 🏗️ 项目结构

```
trac-api/
├── cmd/
│   └── server/           # 主程序入口
├── internal/
│   ├── infra/           # 基础设施
│   │   └── storage/     # ClickHouse 客户端
│   └── modules/
│       ├── project/     # 项目管理
│       ├── ingest/      # SDK 数据接收
│       ├── envelope/    # Sentry 信封解析
│       ├── event/       # 事件存储
│       └── issue/       # Issue 聚合
├── docs/                # 文档
└── examples/
    └── gin-app/         # Gin 集成示例
```

## ⚙️ 环境变量

```bash
# 服务配置
SERVER_PORT=8025

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trac
DB_USERNAME=postgres
DB_PASSWORD=password

# ClickHouse
LOG_CH_ENABLED=true
LOG_CH_ENDPOINT=localhost:9000
LOG_CH_DATABASE=trac
LOG_CH_USERNAME=trac_user
LOG_CH_PASSWORD=trac_pass
```

## 🔍 查看数据

### 查看事件

```bash
docker exec zgo-clickhouse clickhouse-client \
  -u trac_user --password trac_pass -d trac \
  -q "SELECT event_id, level, message FROM events ORDER BY timestamp DESC LIMIT 10"
```

### 查看 Issues

```bash
curl http://localhost:8025/v1/projects/1/issues/
```

## 📚 文档

- [API 接口文档](docs/api.md)
- [Sentry Go/Gin 集成指南](docs/sentry-go-gin-integration.md)
- [部署指南](docs/usage_and_config.md)

## 📄 License

MIT License
