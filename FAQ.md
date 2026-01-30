# Kest CLI FAQ (常见问题)

## 历史记录相关

### Q1: `kest history` 和 `kest history --global` 有什么区别？

**A:** Kest 的历史记录有两种模式：

#### 项目级别历史（默认）
- **触发条件**：在有 `.kest/config.yaml` 的项目目录中执行 `kest history`
- **显示内容**：只显示**当前项目**的测试记录
- **用途**：保持项目上下文清晰，不被其他项目的测试干扰

```bash
cd /path/to/my-api-project
kest history
# 只显示 my-api-project 的测试
```

#### 全局历史
- **触发方式**：使用 `kest history --global` 或在非项目目录执行
- **显示内容**：显示**所有项目**的测试记录
- **用途**：跨项目查看、全局搜索

```bash
# 方式1：使用 --global 标志
kest history --global

# 方式2：在非项目目录执行
cd /tmp
kest history  # 自动降级为全局模式
```

---

### Q2: 为什么我在项目 A 看不到项目 B 的测试？

**A:** 这是**设计行为**，不是 bug！

Kest 使用 **ProjectID** 来隔离不同项目的历史记录。这样做有几个好处：

1. **上下文清晰**：每个项目只看到自己的测试历史
2. **变量隔离**：不同项目的变量不会互相干扰
3. **环境隔离**：dev/staging/prod 环境按项目管理

**解决方案**：

```bash
# 方案1：切换到项目 B 的目录
cd /path/to/project-b
kest history

# 方案2：使用全局历史查看所有项目
kest history --global

# 方案3：在全局历史中搜索特定 URL
kest history --global | grep "project-b-api.com"
```

---

### Q3: 测试记录保存在哪里？

**A:** 所有测试记录保存在**全局 SQLite 数据库**中：

```
~/.kest/records.db
```

这个数据库包含：
- 所有项目的请求/响应历史
- 捕获的变量（按项目和环境隔离）
- 元数据（时间戳、ProjectID、环境等）

**查看数据库内容**：

```bash
# 使用 SQLite 查看
sqlite3 ~/.kest/records.db
> SELECT id, method, url, project_id FROM requests ORDER BY id DESC LIMIT 10;
```

---

### Q4: 日志文件在哪里？

**A:** Kest 支持两级日志：

#### 1. 项目级别日志（优先）
- **位置**：`.kest/logs/`
- **条件**：项目已初始化且 `log_enabled: true`
- **用途**：详细的请求/响应追踪

```bash
# 启用日志
cd my-project
cat .kest/config.yaml
# log_enabled: true

# 查看日志
ls -lh .kest/logs/
cat .kest/logs/2026-01-30_00-30-16_GET_api_users.log
```

#### 2. 全局日志（降级）
- **位置**：`~/.kest/logs/`
- **条件**：项目未初始化或未启用日志时的降级方案
- **用途**：确保所有请求都有日志可查

---

### Q5: 如何清理历史记录？

**A:** 目前 Kest 不自动清理历史，你可以手动操作：

```bash
# 方案1：删除整个数据库（慎用！）
rm ~/.kest/records.db

# 方案2：使用 SQLite 删除指定项目
sqlite3 ~/.kest/records.db
> DELETE FROM requests WHERE project_id = 'my-old-project';

# 方案3：删除旧记录
sqlite3 ~/.kest/records.db
> DELETE FROM requests WHERE created_at < datetime('now', '-30 days');

# 方案4：清空所有历史但保留结构
sqlite3 ~/.kest/records.db
> DELETE FROM requests;
> DELETE FROM variables;
```

---

## 功能相关

### Q6: Parallel 模式为什么没有显示详细输出？

**A:** 这是**有意设计**！在并行模式下：

- ❌ **不显示**：每个请求的详细响应 body
- ✅ **显示**：最终的测试汇总报告

**原因**：
1. 并行输出会混乱、难以阅读
2. 你关心的是整体结果，不是单个请求细节
3. 所有详细信息仍然保存在历史和日志中

**查看并行测试的详细信息**：

```bash
# 运行并行测试
kest run tests.kest --parallel

# 查看最后几条记录的详细信息
kest show last
kest show $(expr $(kest history | head -3 | tail -1 | awk '{print $1}' | sed 's/#//'))

# 或查看日志文件
cat .kest/logs/*.log | tail -100
```

---

### Q7: Duration 断言失败时会重试吗？

**A:** 会的！如果同时使用 `--max-duration` 和 `--retry`：

```bash
kest get /api/slow --max-duration 1000 --retry 3
```

**行为**：
1. 第一次请求：1500ms → 超时，触发重试
2. 重试 1：1200ms → 超时，继续重试
3. 重试 2：800ms → 成功！

**输出示例**：
```
⏱️  Retry attempt 1/3 (waiting 1000ms)...
⏱️  Retry attempt 2/3 (waiting 1000ms)...
✅ Request succeeded on retry 2
```

---

### Q8: gRPC 请求也会记录历史吗？

**A:** 是的！gRPC 请求和 REST 请求一样：

- ✅ 保存到历史记录数据库
- ✅ 可以通过 `kest history` 查看
- ✅ 可以使用 `kest show <id>` 查看详情
- ✅ 如果启用了日志，会生成日志文件

```bash
# 执行 gRPC 请求
kest grpc localhost:50051 test.Service Say '{"msg":"hi"}'

# 查看历史（会显示为 GRPC 方法）
kest history
# #35   00:40:12 today    GRPC   localhost:50051/test.Service/Say  200    45ms

# 查看详细信息
kest show 35
```

---

## 疑难解答

### Q9: 为什么 `kest history` 显示 "Total: 0 records"？

可能的原因：

1. **数据库未创建**：
   ```bash
   ls -l ~/.kest/records.db
   # 如果不存在，执行一次请求即可创建
   kest get https://httpbin.org/uuid
   ```

2. **ProjectID 不匹配**（当前项目没有测试）：
   ```bash
   # 使用全局模式查看
   kest history --global
   ```

3. **数据库权限问题**：
   ```bash
   chmod 644 ~/.kest/records.db
   ```

---

### Q10: 变量在不同项目间会共享吗？

**A:** 不会！变量是**按项目和环境隔离**的。

```bash
# 项目 A
cd /path/to/project-a
kest post /login -c "token=auth.token"
kest vars  # 可以看到 token

# 项目 B
cd /path/to/project-b
kest vars  # 看不到项目 A 的 token（这是正确的！）
```

**设计理念**：
- 不同项目的 API 完全独立
- 避免变量污染和意外冲突
- 每个项目有自己的变量空间和环境配置

---

## 最佳实践

### Q11: 应该在什么时候使用 `--no-record`？

**A:** 在以下场景使用：

1. **敏感数据测试**：
   ```bash
   kest post /auth -d '{"password":"secret"}' --no-record
   ```

2. **临时实验**：
   ```bash
   kest get /test-endpoint --no-record  # 不想污染历史
   ```

3. **高频轮询**：
   ```bash
   while true; do
     kest get /health --no-record
     sleep 5
   done
   ```

---

### Q12: 如何在 CI/CD 中使用 Kest？

**A:** 推荐配置：

```yaml
# .github/workflows/api-test.yml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Kest
        run: go install github.com/kest-lab/kest-cli/cmd/kest@latest
      
      - name: Run API Tests
        run: |
          cd api-tests
          kest run tests.kest --parallel --jobs 8
          
      - name: Performance Gate
        run: |
          kest get https://api.example.com/health --max-duration 500
          kest get https://api.example.com/search --max-duration 1000
```

**要点**：
- 使用 `--parallel` 加速测试
- 使用 `--max-duration` 设置性能门槛
- 测试失败会自动返回非零退出码
- 可以查看 test summary 报告

---

如有其他问题，欢迎提 Issue！🚀
