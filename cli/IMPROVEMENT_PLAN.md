# Kest CLI 改进计划

**基于用户反馈**: 2026-02-20  
**优先级**: 高优先级功能优先实现

---

## 📊 用户反馈分析

### 核心痛点

1. **变量缺失时的错误不明确** - 导致无意义的 API 请求和调试困难
2. **变量解析优先级不清楚** - 用户不知道哪个变量会生效
3. **失败步骤后继续执行** - 浪费时间和资源
4. **重复配置请求头** - 代码冗余

---

## 🎯 改进方案（按优先级）

### 高优先级（立即实现）

#### 1. 变量缺失时的明确报错 ⭐⭐⭐

**当前问题**:
```bash
# 未传 --var student_password
# 请求体: {"password": "{{student_password}}"}
# 服务器返回: 401 Unauthorized
# 用户需要猜测是变量问题还是密码错误
```

**改进方案**:
```go
// variable/variable.go
type ValidationMode int

const (
    ModePermissive ValidationMode = iota  // 当前行为：保留 {{var}}
    ModeStrict                             // 新增：变量缺失时报错
)

func InterpolateStrict(text string, vars map[string]string) (string, error) {
    var missing []string
    result := varRegex.ReplaceAllStringFunc(text, func(match string) string {
        name := strings.TrimSpace(match[2 : len(match)-2])
        
        // 内置变量
        if isBuiltinVar(name) {
            return resolveBuiltin(name)
        }
        
        if val, ok := vars[name]; ok {
            return val
        }
        
        // 记录缺失的变量
        missing = append(missing, name)
        return match
    })
    
    if len(missing) > 0 {
        return "", fmt.Errorf("Required variables not provided: %s", 
            strings.Join(missing, ", "))
    }
    
    return result, nil
}
```

**使用示例**:
```bash
$ kest run login.flow.md
❌ Error: Required variables not provided: student_password
   
   Hint: Use --var student_password=<value> or define it in config.yaml
   
   Available variables:
     - base_url (from config.yaml)
     - env (from config.yaml)
```

**实现位置**:
- `cli/internal/variable/variable.go` - 添加严格模式
- `cli/run.go` - 在执行前验证所有变量
- `cli/request.go` - 请求发送前再次验证

---

#### 2. 变量默认值语法 ⭐⭐⭐

**语法设计**:
```markdown
# 方案 1: 管道语法（推荐）
{{student_password | default: "Studi@312"}}

# 方案 2: 双问号语法
{{student_password ?? "Studi@312"}}

# 方案 3: 函数语法
{{default(student_password, "Studi@312")}}
```

**实现方案**（推荐方案 1）:
```go
// variable/variable.go
var defaultVarRegex = regexp.MustCompile(`\{\{([^|}]+)(?:\s*\|\s*default:\s*"([^"]+)")?\}\}`)

func InterpolateWithDefaults(text string, vars map[string]string) string {
    return defaultVarRegex.ReplaceAllStringFunc(text, func(match string) string {
        matches := defaultVarRegex.FindStringSubmatch(match)
        if len(matches) < 2 {
            return match
        }
        
        varName := strings.TrimSpace(matches[1])
        defaultValue := ""
        if len(matches) >= 3 {
            defaultValue = matches[2]
        }
        
        // 内置变量
        if isBuiltinVar(varName) {
            return resolveBuiltin(varName)
        }
        
        // 用户变量
        if val, ok := vars[varName]; ok {
            return val
        }
        
        // 使用默认值
        if defaultValue != "" {
            return defaultValue
        }
        
        // 无默认值，保留原样（或在严格模式下报错）
        return match
    })
}
```

**使用示例**:
```markdown
### Step: Login Student A

POST /api/v1/auth/login
```json
{
  "username": "{{username | default: \"student_a\"}}",
  "password": "{{password | default: \"Studi@312\"}}"
}
```

[Captures]
- token = data.token
```

---

#### 3. --fail-fast 模式 ⭐⭐

**实现方案**:
```go
// run.go
var runFailFast bool

func init() {
    runCmd.Flags().BoolVar(&runFailFast, "fail-fast", false, 
        "Stop execution on first failed step")
}

// 在步骤执行循环中
for i, step := range steps {
    result := executeStep(step, vars)
    
    if !result.Success {
        logger.Error("Step %d failed: %s", i+1, step.Name)
        
        if runFailFast {
            logger.Info("Stopping execution (--fail-fast enabled)")
            return fmt.Errorf("step '%s' failed", step.Name)
        }
        
        // 标记失败步骤的变量为不可用
        markStepVariablesUnavailable(step, vars)
    }
}
```

**错误提示改进**:
```bash
$ kest run flow.md --fail-fast

✅ Step 1: Register Student A - OK
✅ Step 2: Login Student A - OK
❌ Step 3: Get Student List - FAILED
   Status: 403 Forbidden
   
⚠️  Stopping execution (--fail-fast enabled)
   
   Failed step: Get Student List
   Reason: HTTP 403 - Permission denied
   
   Skipped steps:
     - Step 4: Update Student A
     - Step 5: Delete Student A
```

---

#### 4. 变量解析优先级文档 ⭐⭐

**创建文档**: `cli/VARIABLES.md`

```markdown
# Kest 变量系统

## 变量优先级（从高到低）

1. **CLI 参数** `--var key=value`
   - 最高优先级
   - 覆盖所有其他来源
   - 用于临时覆盖或 CI/CD 注入

2. **Flow 内捕获** `[Captures]`
   - 步骤执行时动态捕获
   - 作用域：当前 flow 执行上下文
   - 后续步骤可使用

3. **环境配置** `config.yaml` 中的 `environments.*.variables`
   - 环境切换时自动加载
   - 作用域：当前环境

4. **全局配置** `config.yaml` 中的 `variables`
   - 所有环境共享
   - 作用域：项目级别

5. **默认值** `{{var | default: "value"}}`
   - 最低优先级
   - 仅在变量未定义时使用

## 示例

```yaml
# config.yaml
variables:
  base_url: http://localhost:3000  # 全局默认

environments:
  dev:
    variables:
      base_url: http://dev.api.com  # 覆盖全局
      api_key: dev_key_123
  
  prod:
    variables:
      base_url: https://api.com
      api_key: prod_key_456
```

```bash
# 优先级演示
$ kest env set dev
$ kest run flow.md
# base_url = http://dev.api.com (来自 environments.dev)

$ kest run flow.md --var base_url=http://localhost:8080
# base_url = http://localhost:8080 (CLI 覆盖)
```
```

---

### 中优先级（后续实现）

#### 5. 失败步骤变量追踪 ⭐⭐

**实现方案**:
```go
// run_context.go
type VariableSource struct {
    Value      string
    SourceStep string  // 来自哪个步骤
    StepStatus string  // 步骤状态：success/failed
}

type RunContext struct {
    Variables map[string]*VariableSource
    // ...
}

func (rc *RunContext) GetVariable(name string) (string, error) {
    src, ok := rc.Variables[name]
    if !ok {
        return "", fmt.Errorf("variable '%s' not defined", name)
    }
    
    if src.StepStatus == "failed" {
        return "", fmt.Errorf(
            "variable '%s' unavailable (step '%s' failed)", 
            name, src.SourceStep)
    }
    
    return src.Value, nil
}
```

**错误提示**:
```bash
❌ Step 4: Update Student A - FAILED
   Error: Variable 'student_a_token' unavailable
   
   Reason: Variable was captured from step 'Login Student A' which failed
   
   Suggestion: Fix the 'Login Student A' step or use --fail-fast to stop earlier
```

---

#### 6. 默认请求头复用 ⭐

**方案 1: Flow 级别默认头**
```markdown
---
default_headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
---

### Step 1: Get Profile
GET /api/profile
# 自动添加 Authorization 和 Content-Type

### Step 2: Update Profile  
PATCH /api/profile
# 也会自动添加默认头
```

**方案 2: 认证快捷方式**
```markdown
### Step 1: Get Profile
GET /api/profile
@auth Bearer {{token}}
# 等同于: Authorization: Bearer {{token}}

### Step 2: Get Admin Data
GET /api/admin/data
@auth Bearer {{admin_token}}
```

**实现**:
```go
// flow_parse.go
type FlowMeta struct {
    // ...
    DefaultHeaders map[string]string `yaml:"default_headers"`
}

// 解析步骤时合并默认头
func parseStep(block string, meta FlowMeta) Step {
    step := parseStepBasic(block)
    
    // 合并默认头（步骤头优先）
    for k, v := range meta.DefaultHeaders {
        if _, exists := step.Headers[k]; !exists {
            step.Headers[k] = v
        }
    }
    
    return step
}
```

---

#### 7. 数组路径支持 ⭐

**当前支持**:
```
data.students.0.student.id  ✅
```

**需要支持**:
```
data.students[0].student.id  ✅
data.students[0].student['full_name']  ✅
```

**实现**:
```go
// internal/scanner/json.go
func normalizeJSONPath(path string) string {
    // 转换 [0] 为 .0
    path = regexp.MustCompile(`\[(\d+)\]`).ReplaceAllString(path, ".$1")
    
    // 转换 ['key'] 为 .key
    path = regexp.MustCompile(`\['([^']+)'\]`).ReplaceAllString(path, ".$1")
    path = regexp.MustCompile(`\["([^"]+)"\]`).ReplaceAllString(path, ".$1")
    
    return path
}
```

---

### 低优先级（可选）

#### 8. 调试增强 ⭐

**--debug-vars 增强**:
```bash
$ kest run flow.md --debug-vars

📝 Variable Resolution Debug:

Step 1: Login Student A
  Request Body (before):
    {"password": "{{student_password}}"}  ← unresolved
  
  Available variables:
    ✅ base_url = http://localhost:3000 (from config.yaml)
    ❌ student_password = <not defined>
  
  Request Body (after):
    {"password": "{{student_password}}"}  ← still unresolved!
  
❌ Error: Variable 'student_password' not provided
```

**失败原因分类统计**:
```bash
📊 Execution Summary:

Total Steps: 10
✅ Passed: 7
❌ Failed: 3

Failure Breakdown:
  - Variable missing: 1 (student_password)
  - Assertion failed: 1 (status code 403 != 200)
  - HTTP error: 1 (connection timeout)
```

---

#### 9. 前置条件检查

**语法设计**:
```markdown
---
prerequisites:
  - name: Test account exists
    check: env.has_test_account
    message: "Please create test account first"
  
  - name: Database seeded
    check: env.db_seeded
    message: "Run: npm run db:seed"
---

### Step 1: Login
POST /api/login
```

**或使用 @setup 步骤**:
```markdown
### @setup: Prepare Test Data
POST /api/admin/seed
Authorization: Bearer {{admin_token}}

[Asserts]
- status == 200

[OnFailure]
- message: "Failed to seed test data. Cannot continue."
- exit: true
```

---

## 📅 实施计划

### Phase 1: 核心改进（1-2 周）

- [ ] 变量缺失明确报错（严格模式）
- [ ] 变量默认值语法支持
- [ ] --fail-fast 模式
- [ ] 变量优先级文档

### Phase 2: 增强功能（2-3 周）

- [ ] 失败步骤变量追踪
- [ ] 默认请求头复用
- [ ] 数组路径语法支持
- [ ] 调试输出增强

### Phase 3: 高级功能（可选）

- [ ] 前置条件检查
- [ ] @setup 步骤支持
- [ ] 更多内置变量

---

## 🔧 技术实现要点

### 1. 向后兼容

所有新功能都应该是**可选的**，不破坏现有用户的 flow 文件：

```go
// 默认保持宽松模式
var strictMode = false

// 通过 flag 启用
runCmd.Flags().BoolVar(&strictMode, "strict", false, 
    "Enable strict variable validation")
```

### 2. 渐进式增强

```markdown
# 旧语法仍然有效
{{student_password}}

# 新语法提供更好的体验
{{student_password | default: "Studi@312"}}
```

### 3. 清晰的错误消息

```bash
# ❌ 差的错误消息
Error: variable not found

# ✅ 好的错误消息
Error: Required variable 'student_password' not provided

Hint: Use one of the following:
  1. --var student_password=<value>
  2. Add to config.yaml:
     environments:
       dev:
         variables:
           student_password: "Studi@312"
  3. Use default value:
     {{student_password | default: "Studi@312"}}
```

---

## 📊 成功指标

实施后，应该看到：

1. **减少调试时间**: 变量错误立即发现，不需要猜测
2. **减少重复配置**: 默认值和默认头减少代码重复
3. **提高执行效率**: --fail-fast 避免无意义的后续请求
4. **降低学习曲线**: 清晰的文档和错误提示

---

## 🎯 优先级总结

| 优先级 | 功能 | 预计工作量 | 用户价值 |
|--------|------|-----------|---------|
| 🔴 高 | 变量缺失明确报错 | 2-3 天 | ⭐⭐⭐⭐⭐ |
| 🔴 高 | 变量默认值语法 | 3-4 天 | ⭐⭐⭐⭐⭐ |
| 🔴 高 | --fail-fast 模式 | 1-2 天 | ⭐⭐⭐⭐ |
| 🔴 高 | 变量优先级文档 | 1 天 | ⭐⭐⭐⭐ |
| 🟡 中 | 失败步骤变量追踪 | 2-3 天 | ⭐⭐⭐ |
| 🟡 中 | 默认请求头复用 | 2-3 天 | ⭐⭐⭐ |
| 🟡 中 | 数组路径支持 | 1-2 天 | ⭐⭐⭐ |
| 🟢 低 | 调试输出增强 | 2-3 天 | ⭐⭐ |
| 🟢 低 | 前置条件检查 | 3-4 天 | ⭐⭐ |

---

## 📝 下一步行动

1. **立即**: 创建 GitHub Issues 跟踪这些改进
2. **本周**: 实现高优先级功能（变量验证 + 默认值）
3. **下周**: 添加 --fail-fast 和文档
4. **两周后**: 发布 v1.1.0 包含核心改进
5. **持续**: 收集用户反馈，迭代优化

---

**创建时间**: 2026-02-20  
**状态**: 待实施  
**负责人**: Kest 开发团队
