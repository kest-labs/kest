# 🚀 Kest 部署上线指南

**版本**: v1.0.0  
**更新时间**: 2026-02-20  
**状态**: 生产就绪

---

## 📋 目录

1. [部署前准备](#部署前准备)
2. [环境变量配置](#环境变量配置)
3. [部署方式](#部署方式)
4. [健康检查](#健康检查)
5. [监控和日志](#监控和日志)
6. [回滚方案](#回滚方案)

---

## 🎯 部署前准备

### 系统要求

- **Go**: 1.21+
- **PostgreSQL**: 14+
- **内存**: 最低 512MB，推荐 1GB+
- **CPU**: 最低 1 核，推荐 2 核+
- **磁盘**: 最低 1GB

### 代码状态

✅ **已完成**:
- Trac 错误追踪模块已移除（-3,873 行代码）
- Swagger API 文档已生成（83+ 接口）
- Flow API 完整测试通过（14 个接口）
- 项目文档完整
- 部署配置就绪

✅ **Git 提交**:
```
Commit: e486e10
Message: refactor: remove Trac error tracking and add comprehensive docs
Status: Pushed to origin/main
```

---

## 🔧 环境变量配置

### 必需环境变量

```bash
# 应用配置
APP_NAME=Kest
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

# 服务器配置
SERVER_PORT=7111
SERVER_MODE=release
SERVER_READ_TIMEOUT=60
SERVER_WRITE_TIMEOUT=60

# 数据库配置
DB_ENABLED=true
DB_DRIVER=postgres
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=kest
DB_USERNAME=your-db-user
DB_PASSWORD=your-db-password
DB_SSLMODE=require

# JWT 配置
JWT_SECRET=your-strong-jwt-secret-min-32-chars
JWT_EXPIRE_DAYS=7

# CORS 配置
CORS_ALLOW_ORIGINS=https://your-frontend.com
CORS_ALLOW_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOW_HEADERS=Origin,Content-Type,Accept,Authorization
CORS_ALLOW_CREDENTIALS=true

# 日志配置
LOG_LEVEL=info
LOG_JSON=true
LOG_CH_ENABLED=false

# 追踪配置
TRACING_ENABLED=false
```

### 可选环境变量

```bash
# Redis (如果需要)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# OpenAI (如果需要 AI 功能)
OPENAI_API_KEY=your-openai-key

# 邮件服务 (如果需要)
MAIL_FROM=noreply@kest.dev
RESEND_API_KEY=your-resend-key
```

---

## 🚀 部署方式

### 方式 1: Docker Compose（推荐用于本地/测试）

```bash
# 1. 克隆代码
git clone https://github.com/kest-labs/kest.git
cd kest

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f api

# 5. 健康检查
curl http://localhost:7111/v1/system-features
```

### 方式 2: Zeabur 部署（推荐用于生产）

#### 准备工作
1. 注册 [Zeabur](https://zeabur.com) 账号
2. 安装 Zeabur CLI（可选）

#### 部署步骤

**通过 Web 界面**:
1. 登录 Zeabur Dashboard
2. 创建新项目
3. 选择 "Deploy from GitHub"
4. 选择 `kest-labs/kest` 仓库
5. Zeabur 会自动检测 `zeabur.yaml` 配置
6. 配置环境变量（参考上面的必需环境变量）
7. 点击 "Deploy"

**通过 CLI**:
```bash
# 1. 安装 Zeabur CLI
npm i -g @zeabur/cli

# 2. 登录
zeabur auth login

# 3. 部署
zeabur deploy
```

#### Zeabur 配置说明

`zeabur.yaml` 已配置:
- ✅ 自动构建 Docker 镜像
- ✅ PostgreSQL 数据库服务
- ✅ 自动域名分配
- ✅ HTTPS 证书自动配置
- ✅ 环境变量管理

### 方式 3: Render 部署

#### 部署步骤

1. 登录 [Render](https://render.com)
2. 创建新 Web Service
3. 连接 GitHub 仓库 `kest-labs/kest`
4. Render 会自动检测 `render.yaml`
5. 配置环境变量
6. 点击 "Create Web Service"

#### Render 配置说明

`render.yaml` 已配置:
- ✅ API 服务（Go）
- ✅ PostgreSQL 数据库
- ✅ 自动 HTTPS
- ✅ 健康检查
- ✅ 自动重启

### 方式 4: 手动部署

```bash
# 1. 编译
cd api
go build -o kest-api cmd/server/main.go

# 2. 运行数据库迁移
./kest-api migrate

# 3. 启动服务
./kest-api

# 或使用 systemd
sudo systemctl start kest-api
```

---

## 🏥 健康检查

### 基础健康检查

```bash
# 系统功能检查
curl https://your-domain.com/v1/system-features

# 预期响应
{
  "code": 0,
  "message": "success",
  "data": {
    "enable_email_password_login": true,
    "enable_social_oauth_login": false,
    "is_allow_register": true,
    "enable_api_documentation": true,
    "enable_test_runner": true,
    "enable_cli_sync": true
  }
}
```

### 设置状态检查

```bash
curl https://your-domain.com/v1/setup-status

# 预期响应
{
  "code": 0,
  "message": "success",
  "data": {
    "step": "finished",
    "is_setup": true,
    "has_admin": true,
    "version": "1.0.0"
  }
}
```

### Swagger 文档

访问: `https://your-domain.com/swagger/index.html`

---

## 📊 监控和日志

### 日志查看

**Docker Compose**:
```bash
docker-compose logs -f api
```

**Zeabur**:
- Dashboard → Service → Logs

**Render**:
- Dashboard → Service → Logs

### 关键指标监控

1. **API 响应时间**
   - 目标: < 500ms (P95)
   - 当前: 260-600ms

2. **数据库连接**
   - 监控连接池使用率
   - 慢查询日志

3. **错误率**
   - 目标: < 0.1%
   - 监控 5xx 错误

4. **内存使用**
   - 目标: < 80%
   - 当前: ~300MB

### 监控端点

```bash
# 监控面板
https://your-domain.com/monitor

# 统计 API
https://your-domain.com/monitor/stats
```

---

## 🔄 回滚方案

### 快速回滚

**Git 回滚**:
```bash
# 回滚到上一个版本
git revert e486e10
git push origin main

# 或回滚到特定版本
git reset --hard 36e806c
git push -f origin main
```

**Zeabur/Render**:
- Dashboard → Deployments → 选择之前的部署 → Redeploy

### 数据库回滚

```bash
# 如果有数据库迁移问题
# 1. 备份当前数据库
pg_dump -h $DB_HOST -U $DB_USERNAME -d $DB_NAME > backup.sql

# 2. 回滚迁移（如果需要）
# 根据具体迁移文件操作
```

---

## ✅ 部署检查清单

### 部署前

- [ ] 代码已推送到 main 分支
- [ ] 所有测试通过
- [ ] 环境变量已配置
- [ ] 数据库已准备
- [ ] SSL 证书已配置（生产环境）

### 部署中

- [ ] 服务成功启动
- [ ] 数据库迁移成功
- [ ] 健康检查通过
- [ ] Swagger 文档可访问

### 部署后

- [ ] API 接口正常响应
- [ ] 用户可以注册/登录
- [ ] Flow 功能正常
- [ ] 监控正常
- [ ] 日志正常输出

---

## 🎯 上线后验证

### 1. 用户注册测试

```bash
curl -X POST https://your-domain.com/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123456"
  }'
```

### 2. 用户登录测试

```bash
curl -X POST https://your-domain.com/v1/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123456"
  }'
```

### 3. Flow API 测试

```bash
# 获取 Token 后
curl -X GET https://your-domain.com/v1/projects \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📞 支持和帮助

### 文档

- **API 文档**: `API_ENDPOINTS.md`
- **快速开始**: `QUICK_START.md`
- **云部署**: `CLOUD_DEPLOYMENT.md`
- **Swagger**: `https://your-domain.com/swagger/index.html`

### 联系方式

- **GitHub Issues**: https://github.com/kest-labs/kest/issues
- **Email**: support@kest.dev

---

## 🎉 部署完成

恭喜！Kest 已成功部署上线！

**下一步**:
1. 配置域名和 SSL
2. 设置监控告警
3. 配置备份策略
4. 邀请团队成员
5. 开始使用 Flow 功能

**重要提醒**:
- 定期备份数据库
- 监控系统资源使用
- 及时更新依赖包
- 关注安全更新

---

**部署时间**: 2026-02-20  
**版本**: v1.0.0  
**状态**: ✅ 生产就绪
