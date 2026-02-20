# 🚀 Kest 本地快速启动指南

## 方式一：使用 Docker Compose（推荐）

### 步骤 1：启动 PostgreSQL

```bash
docker run -d \
  --name kest-postgres \
  -e POSTGRES_PASSWORD=kest_password_123 \
  -p 5432:5432 \
  postgres:14-alpine

# 等待数据库启动
sleep 5

# 创建数据库和用户
docker exec -it kest-postgres psql -U postgres -c "CREATE DATABASE kest;"
docker exec -it kest-postgres psql -U postgres -c "CREATE USER kest_user WITH PASSWORD 'kest_password_123';"
docker exec -it kest-postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE kest TO kest_user;"
docker exec -it kest-postgres psql -U postgres -c "ALTER DATABASE kest OWNER TO kest_user;"
```

### 步骤 2：设置环境变量并启动 API

```bash
cd api

# 设置环境变量
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=kest
export DB_USERNAME=kest_user
export DB_PASSWORD=kest_password_123
export JWT_SECRET=your_jwt_secret_key_min_32_characters_change_in_production
export PORT=8025
export GIN_MODE=debug

# 运行数据库迁移
go run cmd/server/main.go migrate

# 运行数据库种子（可选）
go run cmd/server/main.go db:seed

# 启动服务
go run cmd/server/main.go
```

### 步骤 3：访问服务

- **API 地址**: http://localhost:8025
- **健康检查**: http://localhost:8025/v1/health
- **Swagger 文档**: http://localhost:8025/swagger/index.html

---

## 方式二：一键启动脚本

我已经为你创建了 `start-local.sh` 脚本，但需要先手动创建数据库。

### 步骤 1：启动 PostgreSQL 并创建数据库

```bash
# 启动 PostgreSQL
docker run -d \
  --name kest-postgres \
  -e POSTGRES_PASSWORD=kest_password_123 \
  -p 5432:5432 \
  postgres:14-alpine

# 等待启动
sleep 5

# 创建数据库和用户
docker exec kest-postgres psql -U postgres -c "CREATE DATABASE kest;"
docker exec kest-postgres psql -U postgres -c "CREATE USER kest_user WITH PASSWORD 'kest_password_123';"
docker exec kest-postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE kest TO kest_user;"
docker exec kest-postgres psql -U postgres -c "ALTER DATABASE kest OWNER TO kest_user;"
```

### 步骤 2：运行启动脚本

```bash
./start-local.sh
```

---

## 常用命令

### 停止服务

```bash
# 停止 API（Ctrl+C）

# 停止并删除数据库
docker stop kest-postgres
docker rm kest-postgres
```

### 查看日志

```bash
# 查看数据库日志
docker logs kest-postgres

# 查看 API 日志（在终端中直接显示）
```

### 重置数据库

```bash
# 删除并重新创建
docker exec kest-postgres psql -U postgres -c "DROP DATABASE kest;"
docker exec kest-postgres psql -U postgres -c "CREATE DATABASE kest;"
docker exec kest-postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE kest TO kest_user;"
docker exec kest-postgres psql -U postgres -c "ALTER DATABASE kest OWNER TO kest_user;"

# 重新运行迁移
cd api
export DB_USERNAME=kest_user DB_PASSWORD=kest_password_123 JWT_SECRET=your_jwt_secret_key_min_32_characters_change_in_production
go run cmd/server/main.go migrate
```

---

## 故障排查

### 问题 1：数据库连接失败

**错误**: `FATAL: role "kest_user" does not exist`

**解决方案**: 确保已经创建了数据库用户
```bash
docker exec kest-postgres psql -U postgres -c "CREATE USER kest_user WITH PASSWORD 'kest_password_123';"
docker exec kest-postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE kest TO kest_user;"
```

### 问题 2：端口被占用

**错误**: `bind: address already in use`

**解决方案**: 更改端口或停止占用端口的服务
```bash
export PORT=8026  # 使用其他端口
```

### 问题 3：编译错误

**解决方案**: 确保 Go 版本正确
```bash
go version  # 应该是 1.24+
cd api
go mod download
go build ./cmd/server
```

---

## 下一步

1. ✅ 服务启动成功后，访问 http://localhost:8025/v1/health 验证
2. 📚 查看 Swagger 文档了解 API 接口
3. 🧪 使用 Kest CLI 进行 API 测试
4. 📖 阅读 `cli/FLOW_GUIDE.md` 学习如何编写测试流程

---

## 开发建议

- 使用 `GIN_MODE=debug` 查看详细日志
- 修改代码后，重启服务即可生效（Go 会自动重新编译）
- 数据库迁移文件在 `api/database/migrations/`
- 添加新的 API 模块参考 `api/internal/modules/README.md`
