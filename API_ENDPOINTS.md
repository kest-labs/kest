# 🚀 Kest API 接口清单

**更新时间**: 2026-02-22  
**API 版本**: v1  
**Base URL**: `http://localhost:8025/v1`

---

## 📊 接口统计

| 模块 | 接口数量 | 状态 |
|------|---------|------|
| 用户认证 (User) | 9 | ✅ 完整 |
| 项目管理 (Project) | 6 | ✅ 完整 |
| 工作空间 (Workspace) | 9 | ✅ 完整 |
| 权限管理 (Permission) | 9 | ✅ 完整 |
| **Flow 测试流程** | **14** | ✅ **完整** |
| API 规范 (APISpec) | 10 | ✅ 完整 |
| 测试用例 (TestCase) | 8 | ✅ 完整 |
| 环境管理 (Environment) | 6 | ✅ 完整 |
| 分类管理 (Category) | 6 | ✅ 完整 |
| 成员管理 (Member) | 4 | ✅ 完整 |
| 审计日志 (Audit) | 1 | ✅ 完整 |
| 系统功能 (System) | 2 | ✅ 完整 |
| **总计** | **83+** | ✅ **完整** |

---

## 🔐 认证相关 (User Module)

### 公开接口（无需认证）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/register` | 用户注册 |
| POST | `/login` | 用户登录 |
| POST | `/password/reset` | 重置密码 |

### 用户管理（需要认证）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/profile` | 获取当前用户信息 |
| PUT | `/users/profile` | 更新用户信息 |
| PUT | `/users/password` | 修改密码 |
| DELETE | `/users/account` | 删除账户 |
| GET | `/users` | 获取用户列表 |
| GET | `/users/search` | 搜索用户 |
| GET | `/users/:id` | 获取指定用户 |
| GET | `/users/:id/info` | 获取用户详细信息 |

---

## 📁 项目管理 (Project Module)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/projects` | 创建项目 |
| GET | `/projects` | 获取项目列表 |
| GET | `/projects/:id` | 获取项目详情 |
| PUT | `/projects/:id` | 更新项目（完整） |
| PATCH | `/projects/:id` | 更新项目（部分） |
| DELETE | `/projects/:id` | 删除项目 |
| GET | `/projects/:id/stats` | 获取项目统计信息 |

---

## 🏢 工作空间管理 (Workspace Module)

### 工作空间 CRUD
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/workspaces` | 创建工作空间 |
| GET | `/workspaces` | 获取工作空间列表 |
| GET | `/workspaces/:id` | 获取工作空间详情 |
| PATCH | `/workspaces/:id` | 更新工作空间 |
| DELETE | `/workspaces/:id` | 删除工作空间 |

### 成员管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/workspaces/:id/members` | 添加成员 |
| GET | `/workspaces/:id/members` | 获取成员列表 |
| PATCH | `/workspaces/:id/members/:uid` | 更新成员角色 |
| DELETE | `/workspaces/:id/members/:uid` | 移除成员 |

---

## 🔑 权限管理 (Permission Module)

### 角色管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/roles` | 创建角色 |
| GET | `/roles` | 获取角色列表 |
| GET | `/roles/:id` | 获取角色详情 |
| PUT | `/roles/:id` | 更新角色 |
| DELETE | `/roles/:id` | 删除角色 |

### 角色分配
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/roles/assign` | 分配角色 |
| POST | `/roles/remove` | 移除角色 |
| GET | `/users/:id/roles` | 获取用户角色 |

### 权限查询
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/permissions` | 获取权限列表 |

---

## 🌊 Flow 测试流程 (Flow Module) ⭐

### Flow 基础操作
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/projects/:id/flows` | 获取 Flow 列表 | Read |
| POST | `/projects/:id/flows` | 创建 Flow | Write |
| GET | `/projects/:id/flows/:fid` | 获取 Flow 详情 | Read |
| PATCH | `/projects/:id/flows/:fid` | 更新 Flow（部分） | Write |
| PUT | `/projects/:id/flows/:fid` | 保存 Flow（完整） | Write |
| DELETE | `/projects/:id/flows/:fid` | 删除 Flow | Write |

### Flow Steps（步骤管理）
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/projects/:id/flows/:fid/steps` | 创建步骤 | Write |
| PATCH | `/projects/:id/flows/:fid/steps/:sid` | 更新步骤 | Write |
| DELETE | `/projects/:id/flows/:fid/steps/:sid` | 删除步骤 | Write |

### Flow Edges（连接管理）
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/projects/:id/flows/:fid/edges` | 创建连接 | Write |
| DELETE | `/projects/:id/flows/:fid/edges/:eid` | 删除连接 | Write |

### Flow 执行
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/projects/:id/flows/:fid/run` | 执行 Flow | Write |
| GET | `/projects/:id/flows/:fid/runs` | 获取执行历史 | Read |
| GET | `/projects/:id/flows/:fid/runs/:rid` | 获取执行详情 | Read |
| GET | `/projects/:id/flows/:fid/runs/:rid/events` | SSE 实时执行事件流 | Read |

**Flow 特性**:
- ✅ 支持步骤（Steps）管理
- ✅ 支持连接（Edges）管理
- ✅ 支持 Flow 执行
- ✅ 支持执行历史查询
- ✅ 支持 SSE 实时事件流
- ✅ 完整的权限控制（Read/Write）

---

## 📋 API 规范管理 (APISpec Module)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:id/api-specs` | 获取 API 规范列表 |
| POST | `/projects/:id/api-specs` | 创建 API 规范 |
| POST | `/projects/:id/api-specs/import` | 导入 API 规范 |
| GET | `/projects/:id/api-specs/export` | 导出 API 规范 |
| GET | `/projects/:id/api-specs/:sid` | 获取规范详情 |
| GET | `/projects/:id/api-specs/:sid/full` | 获取规范（含示例） |
| PATCH | `/projects/:id/api-specs/:sid` | 更新规范 |
| DELETE | `/projects/:id/api-specs/:sid` | 删除规范 |
| GET | `/projects/:id/api-specs/:sid/examples` | 获取示例列表 |
| POST | `/projects/:id/api-specs/:sid/examples` | 创建示例 |

---

## 🧪 测试用例管理 (TestCase Module)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/projects/:id/test-cases` | 获取测试用例列表 | Read |
| POST | `/projects/:id/test-cases` | 创建测试用例 | Write |
| GET | `/projects/:id/test-cases/:tcid` | 获取用例详情 | Read |
| PATCH | `/projects/:id/test-cases/:tcid` | 更新测试用例 | Write |
| DELETE | `/projects/:id/test-cases/:tcid` | 删除测试用例 | Write |
| POST | `/projects/:id/test-cases/:tcid/duplicate` | 复制测试用例 | Write |
| POST | `/projects/:id/test-cases/from-spec` | 从规范创建用例 | Write |
| POST | `/projects/:id/test-cases/:tcid/run` | 执行测试用例 | Write |

---

## 🌍 环境管理 (Environment Module)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/projects/:id/environments` | 获取环境列表 | Read |
| POST | `/projects/:id/environments` | 创建环境 | Write |
| GET | `/projects/:id/environments/:eid` | 获取环境详情 | Read |
| PATCH | `/projects/:id/environments/:eid` | 更新环境 | Write |
| DELETE | `/projects/:id/environments/:eid` | 删除环境 | Write |
| POST | `/projects/:id/environments/:eid/duplicate` | 复制环境 | Write |

---

## 📂 分类管理 (Category Module)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/projects/:id/categories` | 获取分类列表 | Read |
| POST | `/projects/:id/categories` | 创建分类 | Write |
| GET | `/projects/:id/categories/:cid` | 获取分类详情 | Read |
| PATCH | `/projects/:id/categories/:cid` | 更新分类 | Write |
| DELETE | `/projects/:id/categories/:cid` | 删除分类 | Write |
| POST | `/projects/:id/categories/:cid/move` | 移动分类 | Write |

---

## 👥 项目成员管理 (Member Module)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/projects/:id/members` | 获取成员列表 | Read |
| POST | `/projects/:id/members` | 添加成员 | Admin |
| PATCH | `/projects/:id/members/:uid` | 更新成员角色 | Admin |
| DELETE | `/projects/:id/members/:uid` | 移除成员 | Admin |

---

## 📝 审计日志 (Audit Module)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/projects/:id/audit-logs` | 获取审计日志 | Read |

---

## ⚙️ 系统功能 (System Module)

### 公开接口（无需认证）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/system-features` | 获取系统功能列表 |
| GET | `/setup-status` | 获取系统设置状态 |

---

## 🔒 权限说明

### 项目级权限
- **Read**: 只读权限，可查看项目资源
- **Write**: 读写权限，可修改项目资源
- **Admin**: 管理员权限，可管理项目成员

### 认证方式
- **Bearer Token**: JWT 认证
- Header: `Authorization: Bearer <token>`

---

## 📊 Flow 模块详细说明

### Flow 是什么？
Flow 是 Kest 的核心功能，用于定义和执行 API 测试流程。

### Flow 组成
1. **Steps（步骤）**: 测试流程中的单个操作
   - HTTP 请求步骤
   - Exec 命令步骤
   - 断言步骤

2. **Edges（连接）**: 步骤之间的连接关系
   - 定义执行顺序
   - 支持条件分支

3. **Variables（变量）**: 步骤间共享的数据
   - 从响应中捕获
   - 在后续步骤中使用

### Flow 执行
- **同步执行**: `POST /projects/:id/flows/:fid/run`
- **异步执行**: 通过 SSE 获取实时事件
- **执行历史**: 保存每次执行的详细记录

### Flow 文件格式
参考 `cli/FLOW_GUIDE.md` 了解 Flow 文件的详细语法。

---

## 🧪 测试状态

### Flow 模块测试
- ✅ 单元测试: 已完成
- ✅ 集成测试: 已完成
- ✅ API 接口: 14 个接口全部实现
- ✅ 权限控制: 完整实现
- ✅ SSE 实时流: 已实现

### 其他模块测试
- ✅ 用户认证: 完整测试
- ✅ 项目管理: 完整测试
- ✅ 权限管理: 完整测试
- ⚠️ 部分模块: 需要补充集成测试

---

## 📚 相关文档

- **Flow 语法指南**: `cli/FLOW_GUIDE.md`
- **API 文档**: `api/README.md`
- **Swagger UI**: `http://localhost:8025/swagger/index.html`
- **快速启动**: `QUICK_START.md`
- **构建测试报告**: `BUILD_TEST_REPORT.md`

---

## 🚀 快速开始

### 1. 启动服务
```bash
./run.sh
```

### 2. 访问 Swagger 文档
```
http://localhost:8025/swagger/index.html
```

### 3. 测试 Flow API
```bash
# 登录获取 token
curl -X POST http://localhost:8025/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# 创建 Flow
curl -X POST http://localhost:8025/v1/projects/1/flows \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My First Flow","description":"Test flow"}'

# 执行 Flow
curl -X POST http://localhost:8025/v1/projects/1/flows/1/run \
  -H "Authorization: Bearer <token>"
```

---

## ✅ 总结

**Kest Flow 已完整实现！**

- ✅ **14 个 Flow API 接口**全部实现
- ✅ 支持完整的 Flow 生命周期管理
- ✅ 支持步骤和连接的 CRUD 操作
- ✅ 支持 Flow 执行和历史查询
- ✅ 支持 SSE 实时事件流
- ✅ 完整的权限控制
- ✅ **总计 83+ API 接口**

**Kest 是一个功能完整的 AI-native API 测试平台！** 🎉
