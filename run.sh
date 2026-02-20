#!/bin/bash
set -e

echo "🚀 Kest 本地启动"
echo ""

# 1. 启动 PostgreSQL
echo "📦 启动 PostgreSQL..."
if docker ps | grep -q kest-postgres; then
    echo "✅ PostgreSQL 已在运行"
else
    docker run -d \
        --name kest-postgres \
        -e POSTGRES_PASSWORD=kest_password_123 \
        -e POSTGRES_DB=kest \
        -p 5432:5432 \
        postgres:14-alpine
    
    echo "⏳ 等待 PostgreSQL 启动..."
    sleep 10
    echo "✅ PostgreSQL 启动完成"
fi

# 2. 运行数据库迁移
echo ""
echo "🔄 运行数据库迁移..."
cd api
DB_HOST=localhost \
DB_PORT=5432 \
DB_NAME=kest \
DB_USERNAME=postgres \
DB_PASSWORD=kest_password_123 \
JWT_SECRET=your_jwt_secret_key_min_32_characters_change_in_production \
go run cmd/server/main.go migrate

# 3. 启动 API 服务
echo ""
echo "🚀 启动 Kest API..."
echo "   访问地址: http://localhost:8025"
echo "   健康检查: http://localhost:8025/v1/health"
echo "   Swagger: http://localhost:8025/swagger/index.html"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

DB_HOST=localhost \
DB_PORT=5432 \
DB_NAME=kest \
DB_USERNAME=postgres \
DB_PASSWORD=kest_password_123 \
JWT_SECRET=your_jwt_secret_key_min_32_characters_change_in_production \
PORT=8025 \
GIN_MODE=debug \
go run cmd/server/main.go
