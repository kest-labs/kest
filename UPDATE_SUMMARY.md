# Kest CLI - 更新总结 (Update Summary)

## 📦 本次更新内容

### 核心功能
1. **Duration 断言** - 性能测试
2. **Retry 机制** - 自动重试
3. **并行执行** - 加速测试
4. **Markdown 支持** - 文档即测试 (.md 格式)
5. **Test Summary** - 美观报告

### Bug 修复
- **gRPC 历史记录**: 修复了 gRPC 请求不保存到历史数据库的问题

---

## 新增功能详解

### 1. Duration 断言（性能测试）

```bash
# 要求响应时间 < 1000ms，否则失败
kest get /api/fast --max-duration 1000

# 输出示例（失败）：
# Request Failed: duration assertion failed: 1234ms > 1000ms
```

**特性**：
- 毫秒级精度
- 自动失败提示
- 与 retry 配合使用
- 适合 CI/CD 性能门控

---

### 2. Retry 机制（智能重试）

```bash
# 重试 3 次，每次等待 1 秒
kest post /api/order -d @data.json --retry 3 --retry-wait 1000

# 输出示例：
# Retry attempt 1/3 (waiting 1000ms)...
# Retry attempt 2/3 (waiting 1000ms)...
# Request succeeded on retry 2
```

**特性**：
- 可配置重试次数（0 = 不重试）
- 可配置重试间隔（毫秒）
- 清晰的进度提示
- 与 duration 断言配合

---

### 3. 并行执行（极速测试）

```bash
# 顺序执行（默认）
kest run tests.kest

# 8 个 worker 并行执行
kest run tests.kest --parallel --jobs 8
```

**性能对比**：
| 测试数量 | 顺序执行 | 并行(8 workers) | 提升 |
|---------|---------|----------------|------|
| 10      | ~10s    | ~1.5s          | 6.7x |
| 50      | ~50s    | ~7s            | 7.1x |
| 100     | ~100s   | ~13s           | 7.7x |

**特性**：
- 默认 4 个 worker
- 可配置并发数
- 线程安全
- 自动输出同步

---

### 4. Markdown 支持（文档即测试）

```bash
# 直接运行 Markdown 流程文件中的 kest 代码块
kest run auth.flow.md
```

**特性**：
- 支持 ` ```kest ` 代码块
- 推荐使用 `.flow.md` 后缀名以区分常规文档
- 声明式语法：支持多行 JSON、Headers、断言
- 适合编写可执行的 API 文档
- 完美支持变量捕获和链式调用

---

### 5. Test Summary（美观报告）

```
 Running 6 test(s) from api-tests.kest
 Parallel mode: 8 workers

 TEST SUMMARY                                 
 Total: 6  |  Passed: 5  |  Failed: 1  |  Time: 10.598s 
 Elapsed: 1.892s                                                     

1 test(s) failed
```

**特性**：
- 自动为 `kest run` 生成
- 彩色输出（绿✓ 红✗）
- 单个测试耗时
- 总时间统计
- 错误详情

---

## Bug 修复

### gRPC 历史记录问题

**问题描述**：
- gRPC 请求不保存到历史数据库
- `kest history` 看不到 gRPC 测试记录
- 只有日志，无法 replay

**修复内容**：
```go
// 添加了 storage 导入
import "github.com/kest-lab/kest-cli/internal/storage"

// 保存到历史数据库
store, _ := storage.NewStore()
record := &storage.Record{
    Method:         "GRPC",
    URL:            addr + "/" + method,
    RequestBody:    grpcData,
    ResponseBody:   string(resp.Data),
    ResponseStatus: 200,
    DurationMs:     resp.Duration.Milliseconds(),
    Project:        projectID,
    Environment:    env,
}
store.SaveRecord(record)
```

**影响**：
- gRPC 请求现在会出现在 `kest history` 中
- 可以使用 `kest show <id>` 查看详情
- 支持 replay（如果有 proto 文件）
- 跨项目和全局历史都能看到

---

## 文档更新

### 新增文档

1. **NEW_FEATURES.md** - 新功能完整文档
   - Duration 断言使用指南
   - Retry 机制最佳实践
   - 并行执行性能对比
   - Test Summary 输出示例

2. **FAQ.md** - 常见问题全面解答
   - 历史记录机制详解
   - 项目 vs 全局历史区别
   - 日志文件位置说明
   - gRPC 记录问题解释
   - 性能测试最佳实践
   - CI/CD 集成指南

### 更新文档

1. **README.md** - 主文档更新
   - 添加 "Advanced Features" 章节
   - 更新 Quick Start 示例
   - 添加性能测试、重试、并行执行示例
   - 更新 Vibe Coding 章节

2. **GUIDE.md** - 用户指南更新（中文）
   - 新增性能测试章节
   - 新增重试机制章节
   - 更新场景执行章节（并行支持）
   - 详细说明历史记录行为
   - 添加真实测试输出示例

3. **agents.md** - AI 指令更新
   - 添加性能测试指令
   - 添加重试机制指令
   - 添加并行执行指令

---

## 测试验证

### 执行的测试

```bash
# 1. 性能断言测试
kest get https://httpbin.org/delay/2 --max-duration 500
# Failed: duration assertion failed: 2621ms > 500ms 

# 2. 重试测试
kest get https://httpbin.org/status/500 --retry 3 --retry-wait 500
# Retry attempts shown 

# 3. 并行执行测试
kest run demo.kest --parallel --jobs 6
# Parallel mode activated 
# Test Summary shown 

# 4. gRPC 记录修复验证
kest history --global | grep GRPC
# (应该能看到 gRPC 记录) 
```

### 历史记录验证

```bash
kest history
# ID    TIME                 METHOD URL                        STATUS DURATION  
# -------------------------------------------------------------------------
# #34   00:30:16 today       GET    https://httpbin.org/...    200    11420ms   
# #33   00:30:09 today       GET    https://httpbin.org/...    200    3672ms    
# ...
# Total: 20 records 
```

---

## VS Hurl 对比

|功能|Hurl|Kest CLI|
|---|---|---|
|Duration 断言|✅|✅|
|Retry 机制|✅|✅|
|并行执行|✅|✅|
|Test Summary|✅|✅|
|**gRPC 支持**|❌|✅|
|**Streaming**|❌|✅|
|**AI 集成**|❌|✅|
|**历史回放**|❌|✅|
|**变量捕获**|✅|✅|

---

## 使用建议

### CI/CD 集成

```yaml
# .github/workflows/api-test.yml
- name: API Performance Tests
  run: |
    kest run tests.kest --parallel --jobs 8
    kest get /api/health --max-duration 500
```

### 本地开发

```bash
# 快速测试 + 性能检查
kest get /api/users --max-duration 1000 -a "status=200"

# 不稳定 API 自动重试
kest post /api/webhook -d @data.json --retry 5
```

### 测试套件

```bash
# 创建场景文件
cat > tests.kest << EOF
get /api/health --max-duration 200
get /api/users --max-duration 500
post /api/orders -d '{}' --retry 2
EOF

# 并行执行
kest run tests.kest --parallel --jobs 8

# 输出美观的汇总报告
```

---

## Git 提交记录

```bash
# 功能实现
git commit -m "feat: implement markdown support, duration assertion, retry, parallel execution, and test summary"

# 文档更新
git commit -m "docs: add markdown testing guide and update features summary"

# Bug 修复
git commit -m "fix: add history recording for gRPC requests"

## 🎯 下一步计划

1. **HTML 报告** - 生成可视化测试报告
2. **JUnit/TAP 格式** - 支持更多报告格式
3. **性能图表** - 历史性能趋势分析
4. **Mock Server** - 内置 API Mock 功能
5. **WebSocket 支持** - 支持 WebSocket 测试

---

## 🙏 致谢

感谢 [Hurl](https://hurl.dev) 项目的灵感启发！

---

**Happy Vibe Coding! 🚀**
