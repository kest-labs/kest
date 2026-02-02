# Kest CLI 日志系统设计

**参考**: Laravel 日志系统  
**目标**: 文本文件存储，方便查看和分析

---

## 📋 Laravel 日志系统分析

### Laravel 的日志方式

```
storage/logs/
├── laravel-2026-02-02.log      # 按日期分割
├── laravel-2026-02-01.log
└── laravel-2026-01-31.log
```

**特点**:
1. ✅ 纯文本文件，可以直接 `cat`、`tail`、`grep`
2. ✅ 按日期自动分割
3. ✅ 结构化日志格式（时间、级别、消息）
4. ✅ 支持日志轮转（自动删除旧日志）
5. ✅ 可以用任何文本工具查看

**日志格式示例**:
```
[2026-02-02 19:37:25] local.INFO: User registered {"user_id":2,"email":"test@example.com"}
[2026-02-02 19:37:26] local.INFO: User logged in {"user_id":2}
[2026-02-02 19:37:27] local.ERROR: Database connection failed {"error":"timeout"}
```

---

## 🎯 Kest 日志系统设计

### 1. 目录结构

```
~/.kest/
├── logs/
│   ├── requests/                    # 请求日志
│   │   ├── 2026-02-02.log          # 按日期分割
│   │   ├── 2026-02-01.log
│   │   └── 2026-01-31.log
│   ├── flows/                       # Flow 测试日志
│   │   ├── 2026-02-02.log
│   │   └── 2026-02-01.log
│   └── errors/                      # 错误日志
│       ├── 2026-02-02.log
│       └── 2026-02-01.log
├── history.db                       # 保留数据库用于快速查询
└── config.yaml
```

### 2. 日志格式设计

#### 请求日志 (requests/2026-02-02.log)

```log
[2026-02-02 19:37:25.123] #545 POST https://api.kest.dev/v1/register
→ Headers:
  Content-Type: application/json
→ Body:
  {"username":"testuser1770060772","email":"test1770060772@example.com","password":"Test123456"}
← Response: 201 Created (373ms)
← Headers:
  Content-Type: application/json; charset=utf-8
← Body:
  {"code":0,"data":{"id":2,"username":"testuser1770060772","email":"test1770060772@example.com"},"message":"created"}
────────────────────────────────────────────────────────────────

[2026-02-02 19:37:26.456] #546 POST https://api.kest.dev/v1/login
→ Headers:
  Content-Type: application/json
→ Body:
  {"username":"testuser1770060772","password":"Test123456"}
← Response: 200 OK (300ms)
← Headers:
  Content-Type: application/json; charset=utf-8
← Body:
  {"code":0,"data":{"access_token":"eyJhbGci...","user":{...}},"message":"success"}
────────────────────────────────────────────────────────────────
```

#### Flow 测试日志 (flows/2026-02-02.log)

```log
[2026-02-02 19:37:25] ═══════════════════════════════════════════════════════════
[2026-02-02 19:37:25] 🚀 Flow Test Started: test-production-api.flow.md
[2026-02-02 19:37:25] ═══════════════════════════════════════════════════════════

[2026-02-02 19:37:25] ─── Step 1: 健康检查 ───
[2026-02-02 19:37:25] GET https://api.kest.dev/v1/health
[2026-02-02 19:37:25] ✓ Status: 200 OK (250ms)
[2026-02-02 19:37:25] ✓ Assertion: status >= 200
[2026-02-02 19:37:25] ✓ Assertion: body.status == "ok"
[2026-02-02 19:37:25] ✓ Assertion: duration < 2000ms

[2026-02-02 19:37:25] ─── Step 2: 用户注册 ───
[2026-02-02 19:37:25] POST https://api.kest.dev/v1/register
[2026-02-02 19:37:26] ✓ Status: 201 Created (373ms)
[2026-02-02 19:37:26] ✓ Captured: registered_username = testuser1770060772
[2026-02-02 19:37:26] ✓ Captured: registered_email = test1770060772@example.com
[2026-02-02 19:37:26] ✓ All assertions passed

[2026-02-02 19:37:45] ═══════════════════════════════════════════════════════════
[2026-02-02 19:37:45] 📊 Flow Test Summary
[2026-02-02 19:37:45] ═══════════════════════════════════════════════════════════
[2026-02-02 19:37:45] Total: 9 | Passed: 9 | Failed: 0 | Time: 3.432s
[2026-02-02 19:37:45] ✓ All tests passed!
```

#### 错误日志 (errors/2026-02-02.log)

```log
[2026-02-02 19:32:53] ERROR: Request Failed
  URL: POST https://api.kest.dev/v1/projects
  Error: dial tcp: lookup api.kest.dev: no such host
  Stack:
    at executeRequest (request.go:123)
    at runFlow (flow.go:456)

[2026-02-02 19:35:49] ERROR: Assertion Failed
  URL: POST https://api.kest.dev/v1/projects
  Assertion: status < 300
  Expected: < 300
  Actual: 500
  Response: {"code":500,"message":"failed to assign owner: ERROR: relation \"project_members\" does not exist"}
```

---

## 🔧 实现方案

### 1. 日志写入器

```go
// internal/logger/file_logger.go
package logger

import (
    "fmt"
    "os"
    "path/filepath"
    "time"
)

type FileLogger struct {
    baseDir string
}

func NewFileLogger() *FileLogger {
    homeDir, _ := os.UserHomeDir()
    baseDir := filepath.Join(homeDir, ".kest", "logs")
    os.MkdirAll(filepath.Join(baseDir, "requests"), 0755)
    os.MkdirAll(filepath.Join(baseDir, "flows"), 0755)
    os.MkdirAll(filepath.Join(baseDir, "errors"), 0755)
    
    return &FileLogger{baseDir: baseDir}
}

func (l *FileLogger) LogRequest(req *Request, resp *Response) error {
    logFile := l.getLogFile("requests")
    f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        return err
    }
    defer f.Close()
    
    timestamp := time.Now().Format("2006-01-02 15:04:05.000")
    
    // 写入请求
    fmt.Fprintf(f, "[%s] #%d %s %s\n", timestamp, req.ID, req.Method, req.URL)
    fmt.Fprintf(f, "→ Headers:\n")
    for k, v := range req.Headers {
        fmt.Fprintf(f, "  %s: %s\n", k, v)
    }
    if req.Body != "" {
        fmt.Fprintf(f, "→ Body:\n  %s\n", req.Body)
    }
    
    // 写入响应
    fmt.Fprintf(f, "← Response: %d %s (%dms)\n", resp.Status, resp.StatusText, resp.Duration)
    fmt.Fprintf(f, "← Headers:\n")
    for k, v := range resp.Headers {
        fmt.Fprintf(f, "  %s: %s\n", k, v)
    }
    if resp.Body != "" {
        fmt.Fprintf(f, "← Body:\n  %s\n", resp.Body)
    }
    
    fmt.Fprintf(f, "────────────────────────────────────────────────────────────────\n\n")
    
    return nil
}

func (l *FileLogger) getLogFile(category string) string {
    today := time.Now().Format("2006-01-02")
    return filepath.Join(l.baseDir, category, today+".log")
}
```

### 2. Flow 测试日志

```go
// internal/logger/flow_logger.go
func (l *FileLogger) LogFlowStart(flowName string) {
    logFile := l.getLogFile("flows")
    f, _ := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    defer f.Close()
    
    timestamp := time.Now().Format("2006-01-02 15:04:05")
    fmt.Fprintf(f, "[%s] ═══════════════════════════════════════════════════════════\n", timestamp)
    fmt.Fprintf(f, "[%s] 🚀 Flow Test Started: %s\n", timestamp, flowName)
    fmt.Fprintf(f, "[%s] ═══════════════════════════════════════════════════════════\n\n", timestamp)
}

func (l *FileLogger) LogFlowStep(stepNum int, stepName string, result StepResult) {
    logFile := l.getLogFile("flows")
    f, _ := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    defer f.Close()
    
    timestamp := time.Now().Format("2006-01-02 15:04:05")
    fmt.Fprintf(f, "[%s] ─── Step %d: %s ───\n", timestamp, stepNum, stepName)
    fmt.Fprintf(f, "[%s] %s %s\n", timestamp, result.Method, result.URL)
    
    if result.Success {
        fmt.Fprintf(f, "[%s] ✓ Status: %d %s (%dms)\n", timestamp, result.Status, result.StatusText, result.Duration)
        for _, assertion := range result.Assertions {
            fmt.Fprintf(f, "[%s] ✓ Assertion: %s\n", timestamp, assertion)
        }
    } else {
        fmt.Fprintf(f, "[%s] ✗ Status: %d %s (%dms)\n", timestamp, result.Status, result.StatusText, result.Duration)
        fmt.Fprintf(f, "[%s] ✗ Error: %s\n", timestamp, result.Error)
    }
    
    fmt.Fprintf(f, "\n")
}
```

### 3. 错误日志

```go
func (l *FileLogger) LogError(err error, context map[string]interface{}) {
    logFile := l.getLogFile("errors")
    f, _ := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    defer f.Close()
    
    timestamp := time.Now().Format("2006-01-02 15:04:05")
    fmt.Fprintf(f, "[%s] ERROR: %s\n", timestamp, err.Error())
    
    for k, v := range context {
        fmt.Fprintf(f, "  %s: %v\n", k, v)
    }
    
    fmt.Fprintf(f, "\n")
}
```

---

## 📊 日志管理

### 1. 日志轮转

```go
// 自动删除 30 天前的日志
func (l *FileLogger) RotateLogs() error {
    cutoff := time.Now().AddDate(0, 0, -30)
    
    categories := []string{"requests", "flows", "errors"}
    for _, cat := range categories {
        dir := filepath.Join(l.baseDir, cat)
        files, _ := os.ReadDir(dir)
        
        for _, file := range files {
            if file.IsDir() {
                continue
            }
            
            // 解析文件名中的日期
            name := file.Name()
            if len(name) < 10 {
                continue
            }
            
            dateStr := name[:10] // 2026-02-02
            fileDate, err := time.Parse("2006-01-02", dateStr)
            if err != nil {
                continue
            }
            
            // 删除旧文件
            if fileDate.Before(cutoff) {
                os.Remove(filepath.Join(dir, name))
            }
        }
    }
    
    return nil
}
```

### 2. 日志查看命令

```bash
# 查看今天的请求日志
kest logs requests

# 查看指定日期的日志
kest logs requests --date 2026-02-01

# 查看 Flow 测试日志
kest logs flows

# 查看错误日志
kest logs errors

# 实时跟踪日志（类似 tail -f）
kest logs requests --follow

# 搜索日志
kest logs requests --grep "POST.*projects"
```

---

## 🎯 优势

### 相比数据库方式

| 特性 | 数据库 | 文本文件 |
|------|--------|---------|
| 查看方式 | 需要工具 | `cat`, `tail`, `grep` ✅ |
| 可读性 | 需要格式化 | 直接可读 ✅ |
| 分析工具 | 有限 | 任何文本工具 ✅ |
| 备份 | 需要导出 | 直接复制文件 ✅ |
| 调试 | 不直观 | 一目了然 ✅ |
| 性能 | 快速查询 | 需要扫描 |
| 存储 | 紧凑 | 占用稍大 |

### 最佳方案：混合模式

```
~/.kest/
├── logs/              # 文本日志（主要用于查看）
│   ├── requests/
│   ├── flows/
│   └── errors/
└── history.db         # SQLite（用于快速查询和统计）
```

**用途分工**:
- **文本日志**: 日常查看、调试、分析
- **数据库**: `kest history`、`kest show`、统计查询

---

## 📋 实现清单

- [ ] 创建 `internal/logger` 包
- [ ] 实现 `FileLogger` 结构
- [ ] 实现请求日志写入
- [ ] 实现 Flow 测试日志
- [ ] 实现错误日志
- [ ] 添加日志轮转功能
- [ ] 添加 `kest logs` 命令
- [ ] 更新文档
- [ ] 保留数据库用于快速查询

---

## 🎓 参考

- **Laravel**: `storage/logs/laravel-{date}.log`
- **Nginx**: `/var/log/nginx/access.log`
- **Apache**: `/var/log/apache2/access.log`
- **Go**: `log/slog` 标准库

---

**下一步**: 实现文件日志系统，同时保留数据库用于快速查询。
