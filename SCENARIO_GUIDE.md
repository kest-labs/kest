# Kest Scenario Guide (场景文件完全指南)

## 📝 什么是 Scenario？

**Scenario（场景）** 是 Kest 的测试用例文件格式，使用 `.kest` 扩展名。它是一个纯文本文件，描述了一系列 API 测试步骤。

**类比其他工具**：
- Postman → Collection
- Hurl → Test File
- k6 → Script
- **Kest → Scenario** ✨

---

---

## 🎯 Scenario 文件格式

Kest 支持两种格式的测试场景文件：
1. **`.kest` (CLI 风格)**：继承自 Shell 命令的极简单行格式。
2. **`.md` (Markdown 风格)**：**[新功能]** 结合文档与测试的声明式格式，支持多行 JSON 和结构化断言。

---

### 1. Markdown 风格 (.md) - 文档即测试
这是目前最推荐的方式，它允许你像写 API 文档一样编写测试用例。

#### 语法规范
在 Markdown 文件中，使用 ` ```kest ` 代码块定义一个测试步骤。

```kest
# 1. 第一行永远是 METHOD URL
POST /api/v1/projects
X-User-ID: 100
Content-Type: application/json

# 2. 空行之后是 Request Body (支持多行/格式化 JSON)
{
  "name": "My Project",
  "description": "Created from Markdown"
}

# 3. 变量捕获部分
[Captures]
project_id: data.id

# 4. 断言部分
[Asserts]
status == 201
body.name == "My Project"
duration < 500ms
```

#### 运行方式
```bash
kest run my-api-doc.md
```

---

### 2. CLI 风格 (.kest) - 极速单行
适合：小型、快速、一次性的 API 调用。

# 1. 注册新用户
POST /api/register -d '{"email":"test@example.com","password":"123456"}' -a "status=201"

# 2. 登录并捕获 token
POST /api/login -d '{"email":"test@example.com","password":"123456"}' -c "token=data.token" -a "status=200"

# 3. 使用 token 获取用户信息
GET /api/profile -H "Authorization: Bearer {{token}}" -a "status=200" -a "body.email=test@example.com"

# 4. 性能测试：搜索接口必须 < 500ms
GET /api/search?q=test --max-duration 500 -a "status=200"

# 5. 不稳定接口自动重试
POST /api/webhook -d '{"event":"test"}' --retry 3 --retry-wait 1000
```

### 支持的命令格式

```kest
# HTTP 方法
GET /path
POST /path -d '{"key":"value"}'
PUT /path -d '{"key":"value"}'
DELETE /path
PATCH /path -d '{"key":"value"}'

# Headers
GET /path -H "Authorization: Bearer token" -H "X-Custom: value"

# Query参数
GET /path -q "page=1" -q "limit=10"

# 变量捕获
POST /login -c "token=auth.token" -c "userId=user.id"

# 断言
GET /users -a "status=200" -a "body.length=10"

# 性能断言
GET /api -max-duration 1000

# 重试机制
POST /api --retry 3 --retry-wait 1000

# gRPC 调用
grpc localhost:50051 package.Service/Method -d '{"field":"value"}'

# 流式响应
POST /chat -d '{"stream":true}' --stream
```

---

## 🚀 创建 Scenario 的 4 种方式

### 方式1：手动创建（推荐）

适合：小型项目、快速原型、自定义测试

```bash
# 创建文件
cat > user-flow.kest << 'EOF'
# 用户完整流程测试
POST /register -d '{"email":"new@test.com"}' -a "status=201"
POST /login -d '{"email":"new@test.com"}' -c "token=data.token"
GET /profile -H "Authorization: Bearer {{token}}" -a "status=200"
EOF

# 执行
kest run user-flow.kest
```

---

### 方式2：从 OpenAPI/Swagger 生成

适合：已有 API 文档、快速覆盖所有端点

```bash
# 从本地文件生成
kest generate --from-openapi swagger.json -o api-tests.kest

# 从远程 URL 生成（需要先下载）
curl https://petstore3.swagger.io/api/v3/openapi.json -o openapi.json
kest generate --from-openapi openapi.json -o petstore.kest
```

**生成的文件示例**：
```kest
# Generated from swagger.json
# Project: My API

# Get user by ID
GET /users/{id} -a "status=200"

# Create new user
POST /users -d '{}' -a "status=200"

# Update user
PUT /users/{id} -d '{}' -a "status=200"
```

**优化生成的文件**：
1. 替换占位符 `{}` 为真实数据
2. 添加变量捕获 `-c`
3. 添加性能断言 `--max-duration`
4. 添加重试机制 `--retry`

---

### 方式3：从历史记录转换（推荐！）

适合：已经手动测试过、想固化测试用例

```bash
# 1. 正常手动测试
kest post /login -d '{"user":"admin"}' -c "token=auth.token"
kest get /profile -H "Authorization: Bearer {{token}}"
kest get /orders

# 2. 查看历史
kest history
# ID    TIME                 METHOD URL                    STATUS DURATION  
# -------------------------------------------------------------------------
# #12   10:23:45 today       GET    /orders                200    123ms
# #11   10:23:40 today       GET    /profile               200    45ms
# #10   10:23:30 today       POST   /login                 200    234ms

# 3. 手动整理成 scenario（未来可以自动化）
cat > my-workflow.kest << 'EOF'
# 从历史记录整理的工作流
POST /login -d '{"user":"admin"}' -c "token=auth.token"
GET /profile -H "Authorization: Bearer {{token}}"
GET /orders
EOF
```

---

### 方式4：AI 辅助生成

适合：复杂场景、快速原型

**方法A：直接让 AI 生成**
```
你：请帮我生成一个 Kest scenario 文件，测试电商下单流程：
1. 用户登录
2. 浏览商品
3. 添加到购物车
4. 下单
5. 查询订单状态

AI：（生成 .kest 文件）
```

**方法B：从 API 文档生成**
```
你：我有这个 API 文档（粘贴），请生成 Kest scenario

AI：（分析并生成测试场景）
```

---

## 📋 Scenario 模板库

### 模板1：基础 CRUD

```kest
# CRUD 完整测试
# Create
POST /api/items -d '{"name":"test","price":100}' -c "itemId=data.id" -a "status=201"

# Read (list)
GET /api/items -a "status=200" --max-duration 500

# Read (single)
GET /api/items/{{itemId}} -a "status=200" -a "body.name=test"

# Update
PUT /api/items/{{itemId}} -d '{"name":"updated","price":200}' -a "status=200"

# Delete
DELETE /api/items/{{itemId}} -a "status=204"

# Verify deletion
GET /api/items/{{itemId}} -a "status=404"
```

---

### 模板2：认证流程

```kest
# 完整认证测试
# 1. 注册
POST /api/auth/register -d '{"email":"test@example.com","password":"pass123"}' -a "status=201"

# 2. 登录
POST /api/auth/login -d '{"email":"test@example.com","password":"pass123"}' -c "accessToken=tokens.access" -c "refreshToken=tokens.refresh" -a "status=200"

# 3. 访问受保护资源
GET /api/protected -H "Authorization: Bearer {{accessToken}}" -a "status=200"

# 4. 刷新 token
POST /api/auth/refresh -d '{"refresh_token":"{{refreshToken}}"}' -c "newAccessToken=tokens.access" -a "status=200"

# 5. 使用新 token
GET /api/protected -H "Authorization: Bearer {{newAccessToken}}" -a "status=200"

# 6. 登出
POST /api/auth/logout -H "Authorization: Bearer {{newAccessToken}}" -a "status=200"
```

---

### 模板3：性能测试套件

```kest
# 性能基准测试
# 所有接口必须在指定时间内响应

# 健康检查 < 100ms
GET /api/health --max-duration 100 -a "status=200"

# 首页 < 500ms
GET /api/home --max-duration 500 -a "status=200"

# 搜索 < 1000ms
GET /api/search?q=test --max-duration 1000 -a "status=200"

# 列表查询 < 800ms
GET /api/products?page=1&limit=20 --max-duration 800 -a "status=200"

# 详情页 < 300ms
GET /api/products/123 --max-duration 300 -a "status=200"
```

---

### 模板4：稳定性测试（重试）

```kest
# 不稳定 API 测试
# Webhook 通知（可能超时）
POST /api/webhooks/notify -d '{"event":"order.created"}' --retry 5 --retry-wait 2000 -a "status=200"

# 第三方 API（可能失败）
GET /api/external/data --retry 3 --retry-wait 1000 -a "status=200"

# 最终一致性检查（需要多次尝试）
GET /api/async/status --retry 10 --retry-wait 500 -a "body.status=completed"
```

---

### 模板5：gRPC + REST 混合

```kest
# 混合测试场景
# REST 登录
POST /api/login -d '{"email":"test@example.com"}' -c "token=data.token"

# gRPC 调用
grpc localhost:50051 user.UserService/GetProfile -d '{"token":"{{token}}"}' -p user.proto

# REST 查询
GET /api/orders -H "Authorization: Bearer {{token}}"

# gRPC 创建订单
grpc localhost:50051 order.OrderService/Create -d '{"items":[{"id":1}]}' -p order.proto
```

---

## 🎮 执行 Scenario

### 基础执行

```bash
# 顺序执行
kest run my-scenario.kest

# 并行执行（快速）
kest run my-scenario.kest --parallel --jobs 8

# 指定环境
kest env use staging
kest run my-scenario.kest
```

### 高级选项

```bash
# 带详细输出
kest run tests.kest -v

# 从特定行开始执行（调试）
# （功能待实现）

# 执行并生成报告
kest run tests.kest --parallel > test-results.log
```

---

## 🛠️ Scenario 最佳实践

### 1. 文件组织

```
project/
├── .kest/
│   ├── config.yaml
│   └── logs/
├── scenarios/
│   ├── smoke-tests.kest      # 冒烟测试
│   ├── auth-flow.kest         # 认证流程
│   ├── user-crud.kest         # 用户 CRUD
│   ├── order-flow.kest        # 订单流程
│   └── performance.kest       # 性能测试
└── README.md
```

### 2. 命名规范

```kest
# ✅ 好的命名
# Scenario: 用户注册和首次登录
# Test: POST /register should return 201

# ❌ 避免
# test1
# 测试
```

### 3. 注释习惯

```kest
# ===================================
# Scenario: 电商下单完整流程
# Author: stark
# Created: 2026-01-30
# Dependencies: 需要 staging 环境
# ===================================

# Step 1: 用户登录
# Expected: 返回 access_token
POST /login -d '{"email":"test@example.com"}' -c "token=data.token"

# Step 2: 浏览商品（性能要求 < 500ms）
GET /products --max-duration 500 -a "status=200"
```

### 4. 变量管理

```kest
# 使用有意义的变量名
POST /login -c "accessToken=auth.access" -c "userId=user.id"

# 避免
POST /login -c "t=auth.access" -c "id=user.id"
```

### 5. 断言分层

```kest
# 基础断言
GET /users -a "status=200"

# 业务断言
GET /users -a "status=200" -a "body.length=10"

# 性能断言
GET /users -a "status=200" --max-duration 500

# 组合断言
GET /users -a "status=200" -a "body.length=10" --max-duration 500
```

---

## 📊 Scenario vs 其他格式对比

| 特性 | Kest Scenario | Postman Collection | Hurl | k6 Script |
|------|--------------|-------------------|------|-----------|
| 格式 | 纯文本 | JSON | 纯文本 | JavaScript |
| 变量 | ✅ | ✅ | ✅ | ✅ |
| 断言 | ✅ | ✅ | ✅ | ✅ |
| Git 友好 | ✅ | ❌ | ✅ | ✅ |
| AI 生成 | ✅ | ❌ | ⚠️ | ⚠️ |
| 性能测试 | ✅ | ❌ | ✅ | ✅ |
| gRPC | ✅ | ✅ | ❌ | ❌ |
| 并行执行 | ✅ | ❌ | ✅ | ✅ |

---

## 🔮 未来功能（Roadmap）

### 即将支持

1. **从历史自动生成**
   ```bash
   kest history export --from 10 --to 15 -o workflow.kest
   ```

2. **条件执行**
   ```kest
   # if status == 200
   POST /next-step
   ```

3. **循环**
   ```kest
   # for i in 1..10
   GET /items/{{i}}
   ```

4. **子场景导入**
   ```kest
   # import auth-flow.kest
   POST /protected-action
   ```

---

## 💡 推荐工作流

### 开发阶段
```bash
# 1. 手动探索 API
kest post /login -d '{}' -c "token=..."
kest get /profile -H "Authorization: ..."

# 2. 记录到 scenario
vim dev-tests.kest
# (paste commands)

# 3. 运行验证
kest run dev-tests.kest
```

### CI/CD 阶段
```bash
# 冒烟测试
kest run smoke-tests.kest --parallel --jobs 8

# 完整测试
kest run all-scenarios.kest --parallel
```

---

**Happy Testing! 🚀**
