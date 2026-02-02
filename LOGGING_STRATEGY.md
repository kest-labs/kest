# Kest CLI 日志分割策略

**目标**: 详细记录所有请求/响应，按类型和日期分割，方便查看和调试

---

## 📁 日志分割方案

### 1. 按类型分割（2 个目录）

```
~/.kest/logs/
├── requests/              # 普通 HTTP 请求日志
│   ├── 2026-02-02.log
│   ├── 2026-02-01.log
│   └── 2026-01-31.log
│
└── flows/                 # Flow 测试日志（聚合的测试报告）
    ├── 2026-02-02.log
    ├── 2026-02-01.log
    └── 2026-01-31.log
```

**为什么分成 2 个？**

1. **requests/** - 单个请求日志
   - 用于：`kest get`、`kest post` 等单个命令
   - 特点：每个请求独立记录，详细的 headers 和 body
   - 查看：`tail -f ~/.kest/logs/requests/2026-02-02.log`

2. **flows/** - Flow 测试聚合日志
   - 用于：`kest run xxx.flow.md` 测试套件
   - 特点：完整的测试报告，包含所有步骤、断言、变量捕获
   - 查看：`cat ~/.kest/logs/flows/2026-02-02.log`

---

## 📅 按日期分割

### 分割规则

- **每天一个文件**：`2026-02-02.log`
- **自动创建**：首次写入时自动创建当天的日志文件
- **追加写入**：同一天的所有请求追加到同一个文件
- **自动轮转**：保留最近 30 天，自动删除旧日志

### 文件命名

```
格式: YYYY-MM-DD.log
示例: 2026-02-02.log
```

**优势**:
- ✅ 简洁明了
- ✅ 按日期排序
- ✅ 方便查找特定日期的日志

---

## 📝 日志格式详细设计

### 1. 普通请求日志 (requests/2026-02-02.log)

```log
════════════════════════════════════════════════════════════════════════════════
[2026-02-02 19:49:21.123] #578 POST http://127.0.0.1:8080/api/v1/register
Duration: 3.456ms | Status: 201 Created
────────────────────────────────────────────────────────────────────────────────

→ REQUEST HEADERS
  Content-Type: application/json
  User-Agent: kest-cli/1.0.0
  Accept: */*

→ REQUEST BODY
{
  "username": "smoketest1770061761",
  "email": "smoketest1770061761@example.com",
  "password": "Test123456"
}

← RESPONSE HEADERS
  Content-Type: application/json; charset=utf-8
  Date: Mon, 02 Feb 2026 19:49:21 GMT
  Content-Length: 156
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization

← RESPONSE BODY
{
  "code": 0,
  "data": {
    "id": 50,
    "username": "smoketest1770061761",
    "email": "smoketest1770061761@example.com",
    "status": 1,
    "created_at": "2026-02-03T03:49:21.867043411+08:00",
    "updated_at": "2026-02-03T03:49:21.867043411+08:00"
  },
  "message": "created"
}

════════════════════════════════════════════════════════════════════════════════


════════════════════════════════════════════════════════════════════════════════
[2026-02-02 19:49:21.456] #579 POST http://127.0.0.1:8080/api/v1/login
Duration: 2.789ms | Status: 200 OK
────────────────────────────────────────────────────────────────────────────────

→ REQUEST HEADERS
  Content-Type: application/json
  User-Agent: kest-cli/1.0.0

→ REQUEST BODY
{
  "username": "smoketest1770061761",
  "password": "Test123456"
}

← RESPONSE HEADERS
  Content-Type: application/json; charset=utf-8
  Date: Mon, 02 Feb 2026 19:49:21 GMT
  Set-Cookie: session_id=abc123; Path=/; HttpOnly; Secure

← RESPONSE BODY
{
  "code": 0,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 50,
      "username": "smoketest1770061761",
      "email": "smoketest1770061761@example.com"
    }
  },
  "message": "success"
}

════════════════════════════════════════════════════════════════════════════════
```

**格式说明**:
- **顶部分隔线**: `════` 80 个字符，醒目
- **时间戳**: `[2026-02-02 19:49:21.123]` 精确到毫秒
- **请求序号**: `#578` 全局唯一 ID
- **请求行**: `POST http://127.0.0.1:8080/api/v1/register`
- **元信息**: `Duration: 3.456ms | Status: 201 Created`
- **中间分隔线**: `────` 80 个字符
- **请求部分**: `→` 箭头表示发出
  - 所有 Headers（包括 User-Agent、Content-Type 等）
  - 完整的 Request Body（格式化的 JSON）
- **响应部分**: `←` 箭头表示接收
  - 所有 Response Headers（包括 Set-Cookie、CORS 等）
  - 完整的 Response Body（格式化的 JSON）
- **底部分隔线**: `════` 结束标记

---

### 2. Flow 测试日志 (flows/2026-02-02.log)

```log
╔════════════════════════════════════════════════════════════════════════════════╗
║ 🚀 FLOW TEST STARTED                                                           ║
║ File: 99-working-smoke-test.flow.md                                           ║
║ Time: 2026-02-02 19:49:21                                                      ║
╚════════════════════════════════════════════════════════════════════════════════╝

┌────────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: 用户注册                                                                │
│ Line: 9                                                                         │
└────────────────────────────────────────────────────────────────────────────────┘

[19:49:21.123] POST http://127.0.0.1:8080/api/v1/register

→ REQUEST HEADERS
  Content-Type: application/json

→ REQUEST BODY
{
  "username": "smoketest1770061761",
  "email": "smoketest1770061761@example.com",
  "password": "Test123456"
}

← RESPONSE (201 Created, 3.456ms)
  Content-Type: application/json; charset=utf-8
  
← RESPONSE BODY
{
  "code": 0,
  "data": {
    "id": 50,
    "username": "smoketest1770061761",
    "email": "smoketest1770061761@example.com"
  },
  "message": "created"
}

✓ CAPTURES
  test_user_id = 50
  test_username = smoketest1770061761
  test_email = smoketest1770061761@example.com

✓ ASSERTIONS
  ✓ status >= 200
  ✓ status < 300
  ✓ body.data.username exists
  ✓ body.data.email exists
  ✓ duration < 3000ms

✓ STEP 1 PASSED (3.456ms)

────────────────────────────────────────────────────────────────────────────────

┌────────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: 用户登录                                                                │
│ Line: 30                                                                        │
└────────────────────────────────────────────────────────────────────────────────┘

[19:49:21.456] POST http://127.0.0.1:8080/api/v1/login

→ REQUEST HEADERS
  Content-Type: application/json

→ REQUEST BODY
{
  "username": "smoketest1770061761",
  "password": "Test123456"
}

← RESPONSE (200 OK, 2.789ms)
  Content-Type: application/json; charset=utf-8
  Set-Cookie: session_id=abc123; Path=/; HttpOnly

← RESPONSE BODY
{
  "code": 0,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {...}
  },
  "message": "success"
}

✓ CAPTURES
  access_token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

✓ ASSERTIONS
  ✓ status >= 200
  ✓ status < 300
  ✓ body.data.access_token exists
  ✓ duration < 3000ms

✓ STEP 2 PASSED (2.789ms)

────────────────────────────────────────────────────────────────────────────────

... (其他步骤)

────────────────────────────────────────────────────────────────────────────────

╔════════════════════════════════════════════════════════════════════════════════╗
║ 📊 FLOW TEST SUMMARY                                                           ║
╚════════════════════════════════════════════════════════════════════════════════╝

File: 99-working-smoke-test.flow.md
Started: 2026-02-02 19:49:21
Finished: 2026-02-02 19:49:22
Duration: 220ms

┌─────────────────────────────────────────────────────────────────────────────┐
│ RESULTS                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Total Steps:    8                                                           │
│ Passed:         8  ✓                                                        │
│ Failed:         0                                                           │
│ Success Rate:   100%                                                        │
│ Total Duration: 220ms                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

✓ ALL TESTS PASSED!

════════════════════════════════════════════════════════════════════════════════
```

**Flow 日志特点**:
- **完整的测试报告**: 包含所有步骤
- **变量捕获**: 显示捕获的变量和值
- **断言结果**: 每个断言的通过/失败状态
- **汇总统计**: 总步骤数、通过数、失败数、耗时
- **美化输出**: 使用 Unicode 框线字符

---

## 🔄 日志轮转策略

### 自动清理规则

```go
// 保留策略
const (
    MaxLogDays = 30        // 保留最近 30 天
    MaxLogSize = 100 * MB  // 单个文件最大 100MB
)

// 清理时机
- 每次启动 kest 时检查
- 每天凌晨 0 点自动清理
- 手动执行: kest logs clean
```

### 清理逻辑

```go
func CleanOldLogs() {
    cutoffDate := time.Now().AddDate(0, 0, -30)
    
    // 遍历 requests/ 和 flows/ 目录
    for _, dir := range []string{"requests", "flows"} {
        files, _ := os.ReadDir(filepath.Join(logsDir, dir))
        
        for _, file := range files {
            // 解析文件名中的日期: 2026-02-02.log
            dateStr := strings.TrimSuffix(file.Name(), ".log")
            fileDate, _ := time.Parse("2006-01-02", dateStr)
            
            // 删除超过 30 天的日志
            if fileDate.Before(cutoffDate) {
                os.Remove(filepath.Join(logsDir, dir, file.Name()))
            }
        }
    }
}
```

---

## 📊 日志大小管理

### 单文件大小限制

如果单个日志文件超过 100MB，自动分割：

```
requests/
├── 2026-02-02.log          # 主文件
├── 2026-02-02.1.log        # 分割文件 1
└── 2026-02-02.2.log        # 分割文件 2
```

**分割逻辑**:
```go
func WriteLog(content string) {
    logFile := getLogFile()
    
    // 检查文件大小
    info, _ := os.Stat(logFile)
    if info.Size() > 100*1024*1024 { // 100MB
        // 重命名为 .1.log
        os.Rename(logFile, logFile+".1")
    }
    
    // 追加写入
    f, _ := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    defer f.Close()
    f.WriteString(content)
}
```

---

## 🔍 日志查看命令

### 基础命令

```bash
# 查看今天的请求日志
kest logs

# 查看今天的 Flow 测试日志
kest logs flows

# 查看指定日期
kest logs --date 2026-02-01
kest logs flows --date 2026-02-01

# 实时跟踪（类似 tail -f）
kest logs --follow
kest logs -f

# 查看最近 N 条
kest logs --tail 50

# 搜索
kest logs --grep "POST.*projects"
kest logs --grep "error"
```

### 高级查看

```bash
# 只看请求
kest logs --requests-only

# 只看响应
kest logs --responses-only

# 只看 headers
kest logs --headers-only

# 过滤状态码
kest logs --status 500
kest logs --status 4xx
kest logs --status 2xx

# 过滤 HTTP 方法
kest logs --method POST
kest logs --method GET

# 时间范围
kest logs --from "2026-02-02 10:00" --to "2026-02-02 12:00"
```

---

## 💾 存储位置

```
~/.kest/
├── logs/
│   ├── requests/
│   │   ├── 2026-02-02.log    (当天的所有单个请求)
│   │   ├── 2026-02-01.log
│   │   └── 2026-01-31.log
│   └── flows/
│       ├── 2026-02-02.log    (当天的所有 Flow 测试)
│       ├── 2026-02-01.log
│       └── 2026-01-31.log
├── records.db                 (SQLite，用于 kest history 快速查询)
└── config.yaml
```

---

## 📋 实现清单

### Phase 1: 基础日志系统
- [ ] 创建 `internal/logger` 包
- [ ] 实现按日期分割的文件写入
- [ ] 实现详细的请求/响应格式化
- [ ] 记录所有 Headers（包括 User-Agent、Cookie 等）
- [ ] 格式化 JSON Body

### Phase 2: Flow 测试日志
- [ ] 实现 Flow 测试聚合日志
- [ ] 记录变量捕获
- [ ] 记录断言结果
- [ ] 生成测试汇总报告

### Phase 3: 日志管理
- [ ] 实现日志轮转（30 天）
- [ ] 实现文件大小限制（100MB）
- [ ] 添加 `kest logs` 命令
- [ ] 添加日志搜索和过滤

### Phase 4: 优化
- [ ] 异步写入（不阻塞请求）
- [ ] 日志压缩（gzip 旧日志）
- [ ] 性能优化

---

## 🎯 关键要点

### 1. 为什么分成 2 个目录？

- **requests/**: 单个请求，详细记录每个 HTTP 调用
- **flows/**: 测试套件，聚合的测试报告

### 2. 为什么按日期分割？

- ✅ 方便查找特定日期的日志
- ✅ 自动轮转，删除旧日志
- ✅ 文件数量可控（每天 1-2 个）

### 3. 必须记录的内容

- ✅ **所有请求 Headers**（包括 User-Agent、Authorization、Cookie 等）
- ✅ **所有响应 Headers**（包括 Set-Cookie、CORS、Content-Type 等）
- ✅ **完整的 Request Body**（格式化的 JSON）
- ✅ **完整的 Response Body**（格式化的 JSON）
- ✅ **时间戳**（精确到毫秒）
- ✅ **耗时**（毫秒）
- ✅ **状态码**（200 OK、404 Not Found 等）

### 4. 日志格式原则

- ✅ **易读**: 使用分隔线、缩进、符号
- ✅ **完整**: 记录所有信息，不遗漏
- ✅ **结构化**: 固定格式，方便解析
- ✅ **可搜索**: 支持 grep、awk 等工具

---

**下一步**: 开始实现这个日志系统
