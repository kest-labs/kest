#!/bin/bash

# Kest Local Development Startup Script

set -e

echo "🚀 Starting Kest Local Development Environment..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set default values
export DB_HOST=${DB_HOST:-localhost}
export DB_PORT=${DB_PORT:-5432}
export DB_NAME=${DB_NAME:-kest}
export DB_USERNAME=${DB_USERNAME:-kest_user}
export DB_PASSWORD=${DB_PASSWORD:-kest_password_123}
export JWT_SECRET=${JWT_SECRET:-your_jwt_secret_key_min_32_characters_change_in_production}
export PORT=${PORT:-8025}
export GIN_MODE=${GIN_MODE:-debug}

echo "📦 Environment variables loaded:"
echo "  - DB_HOST: $DB_HOST"
echo "  - DB_PORT: $DB_PORT"
echo "  - DB_NAME: $DB_NAME"
echo "  - DB_USERNAME: $DB_USERNAME"
echo "  - PORT: $PORT"
echo ""

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
if docker ps | grep -q kest-postgres; then
    echo "✅ PostgreSQL container is running"
else
    echo "⚠️  PostgreSQL container not found. Starting it..."
    docker run -d \
        --name kest-postgres \
        -e POSTGRES_DB=$DB_NAME \
        -e POSTGRES_USER=$DB_USERNAME \
        -e POSTGRES_PASSWORD=$DB_PASSWORD \
        -p $DB_PORT:5432 \
        postgres:14-alpine
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 8
    
    # Wait for PostgreSQL to accept connections
    until docker exec kest-postgres pg_isready -U $DB_USERNAME > /dev/null 2>&1; do
        echo "   Still waiting for PostgreSQL..."
        sleep 2
    done
    
    # Additional wait for user initialization
    echo "   Waiting for database initialization..."
    sleep 3
    echo "✅ PostgreSQL is ready"
fi

echo ""
echo "🔄 Running database migrations..."
cd api
go run cmd/server/main.go migrate || true

echo ""
echo "🌱 Running database seeders (optional)..."
go run cmd/server/main.go db:seed || true

echo ""
echo "🚀 Starting Kest API Server..."
echo "   API will be available at: http://localhost:$PORT"
echo "   Health check: http://localhost:$PORT/v1/health"
echo "   Swagger UI: http://localhost:$PORT/swagger/index.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

go run cmd/server/main.go
