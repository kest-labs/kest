# Workspace Module Implementation

## 📁 模块结构

```
workspace/
├── model.go       # 数据模型 (WorkspacePO, WorkspaceMemberPO)
├── repository.go  # 数据访问层
├── service.go     # 业务逻辑层
├── handler.go     # HTTP处理器
├── routes.go      # 路由注册
└── dto.go         # 数据传输对象
```

## 🚀 部署步骤

### 1. 运行数据库迁移

```bash
cd /Users/stark/item/kest-lab/kest/api

# 连接到数据库并执行迁移
psql $DATABASE_URL -f migrations/workspace_migration.sql
```

### 2. 更新 User 持久化模型

需要更新 `internal/modules/user/model.go` 中的 `UserPO` 结构：

```go
type UserPO struct {
    // ... 现有字段
    IsSuperAdmin bool `gorm:"default:false;index:,where:is_super_admin = true"`
    // ...
}
```

### 3. 更新 Project 模型

在 `internal/modules/project/model.go` 中添加：

```go
type ProjectPO struct {
    // ... 现有字段
    WorkspaceID uint `gorm:"not null;index"`
    // ...
}
```

### 4. 注册 Workspace 模块

在 `cmd/server/main.go` 或模块注册文件中添加：

```go
import (
    "github.com/zgiai/kest-api/internal/modules/workspace"
)

// 初始化 workspace 模块
workspaceRepo := workspace.NewRepository(db)
workspaceService := workspace.NewService(workspaceRepo)
workspaceHandler := workspace.NewHandler(workspaceService)

// 注册路由
workspaceHandler.RegisterRoutes(router)
```

### 5. 创建超级管理员

```sql
-- 方式1: 通过 SQL 直接设置
UPDATE users SET is_super_admin = TRUE WHERE username = 'admin';

-- 方式2: 或者在应用启动时创建
```

## 🎭 权限体系

### 系统级别
- **Super Admin**: 可以访问和管理所有 Workspace 和资源

### Workspace 级别
- **Owner** (40): 完全控制，可以删除 Workspace
- **Admin** (30): 可以邀请/移除成员，管理项目
- **Write** (20): 可以创建和编辑资源
- **Read** (10): 只读权限

### 权限检查逻辑
```go
// 超级管理员绕过所有检查
if user.IsSuperAdmin {
    return true
}

// 常规用户检查 Workspace 权限
roleLevel := RoleLevel[userRole]
requiredLevel := RoleLevel[requiredRole]
return roleLevel >= requiredLevel
```

## 🔄 API 端点

### Workspace 管理
```
POST   /workspaces              # 创建 Workspace
GET    /workspaces              # 列出所有可访问的 Workspace
GET    /workspaces/:id          # 获取 Workspace 详情
PATCH  /workspaces/:id          # 更新 Workspace
DELETE /workspaces/:id          # 删除 Workspace (仅 Owner/Super Admin)
```

### 成员管理
```
POST   /workspaces/:id/members            # 添加成员
GET    /workspaces/:id/members            # 列出成员
PATCH  /workspaces/:id/members/:uid       # 更新成员角色
DELETE /workspaces/:id/members/:uid       # 移除成员
```

### 项目管理 (需要更新)
```
# 旧路由 (将废弃)
GET    /projects
POST   /projects

# 新路由 (推荐)
GET    /workspaces/:workspace_id/projects
POST   /workspaces/:workspace_id/projects
GET    /workspaces/:workspace_id/projects/:id
PATCH  /workspaces/:workspace_id/projects/:id
DELETE /workspaces/:workspace_id/projects/:id
```

## 📝 使用示例

### 1. 创建 Team Workspace

```bash
curl -X POST https://api.kest.dev/v1/workspaces \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Frontend Team",
    "slug": "frontend-team",
    "description": "Workspace for frontend development",
    "type": "team",
    "visibility": "team"
  }'
```

### 2. 邀请成员

```bash
curl -X POST https://api.kest.dev/v1/workspaces/1/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 18,
    "role": "write"
  }'
```

### 3. 在 Workspace 中创建项目

```bash
curl -X POST https://api.kest.dev/v1/workspaces/1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App API",
    "slug": "mobile-api"
  }'
```

## 🔐 安全考虑

### 1. 资源隔离
所有资源查询必须先验证 Workspace 权限：

```go
// ❌ 错误: 直接查询项目
project, err := repo.FindByID(projectID)

// ✅ 正确: 先验证 Workspace 权限
hasAccess, _ := workspaceService.HasPermission(workspaceID, userID, RoleRead, user.IsSuperAdmin)
if !hasAccess {
    return errors.New("access denied")
}
project, err := repo.FindByID(projectID)
```

### 2. 超级管理员特权
Super Admin 可以：
- 查看所有 Workspace
- 管理任何 Workspace 的成员
- 删除任何 Workspace (除非特别限制)
- 访问所有资源

### 3. Owner 保护
- Workspace Owner 不能被移除
- Owner 的角色不能被更改
- 只有 Owner 或 Super Admin 可以删除 Workspace

## 📊 数据迁移策略

### 现有用户
1. 自动为每个现有用户创建 Personal Workspace
2. 用户自动成为其 Personal Workspace 的 Owner
3. 现有项目分配到用户的 Personal Workspace

### 新用户注册流程
```go
// 注册时自动创建 личный Workspace
func (s *UserService) Register(req *RegisterRequest) (*User, error) {
    // 1. 创建用户
    user, err := s.createUser(req)
    if err != nil {
        return nil, err
    }
    
    // 2. 创建默认 Personal Workspace
    workspace, err := s.workspaceService.CreateWorkspace(&CreateWorkspaceRequest{
        Name:       user.Username + "'s Workspace",
        Slug:       user.Username + "-personal",
        Type:       "personal",
        Visibility: "private",
    }, user.ID)
    
    return user, nil
}
```

## 🧪 测试

### 单元测试
```bash
go test ./internal/modules/workspace/...
```

### 集成测试
```bash
# 创建测试用户和 Workspace
# 验证权限控制
# 测试成员管理流程
```

## 📚 后续优化

### Phase 3: 前端适配
- [ ] 添加 Workspace Switcher UI 组件
- [ ] 更新所有 API 调用以包含 workspace_id
- [ ] 实现成员邀请界面
- [ ] 添加权限可视化

### Phase 4: 高级功能
- [ ] Workspace 模板系统
- [ ] 跨 Workspace 资源共享
- [ ] Activity Log 和审计追踪
- [ ] Workspace Analytics 统计
- [ ] 批量操作支持

## 🐛 已知问题

1. **项目迁移**: 需要手动关联现有项目到 Workspace
2. **依赖问题**: `gorm.io/datatypes` 可能需要在 go.mod 中添加

## 💡 最佳实践

1. **Personal Workspace**: 每个用户一个，用于个人实验
2. **Team Workspace**: 团队协作，明确角色分工
3. **Public Workspace**: 开源项目，只读访问
4. **命名规范**: 使用清晰的 slug，如 `team-frontend` 而不是 `ws1`
5. **权限最小化**: 默认给予最小权限，按需提升
