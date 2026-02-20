# Kest API

> Backend service for Kest - AI-Native API Testing Platform

## 📦 Overview

Kest API is the backend service that powers the Kest platform, providing:

- **Project Management** - Organize API tests by projects
- **Team Collaboration** - Multi-user support with role-based access control
- **Test Flow Execution** - Run `.flow.md` test flows from the CLI
- **API Specifications** - Manage and version API documentation
- **Environment Management** - Configure multiple testing environments
- **Test Case Management** - Store and organize test cases
- **Audit Logging** - Track all system activities

## 🚀 Quick Start

### Prerequisites

- Go 1.24+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/kest-labs/kest.git
   cd kest/api
   ```

2. **Install dependencies**
   ```bash
   go mod download
   ```

3. **Set up environment variables**
   ```bash
   cp ../.env.example ../.env
   # Edit .env with your configuration
   ```

4. **Run database migrations**
   ```bash
   go run cmd/server/main.go migrate
   ```

5. **Start the server**
   ```bash
   go run cmd/server/main.go
   ```

   The API will be available at `http://localhost:8025`

### Docker Deployment

```bash
# From project root
docker-compose up -d
```

## 📚 API Documentation

Once the server is running, visit:

- **Swagger UI**: `http://localhost:8025/swagger/index.html`
- **Health Check**: `http://localhost:8025/v1/health`

## 🏗️ Architecture

```
api/
├── cmd/
│   ├── server/          # Main server entry point
│   └── api/             # API-only entry point (for cloud deployment)
├── internal/
│   ├── app/             # Application container
│   ├── bootstrap/       # Application bootstrap
│   ├── contracts/       # Interfaces and contracts
│   ├── infra/           # Infrastructure layer
│   │   ├── config/      # Configuration management
│   │   ├── database/    # Database connection
│   │   ├── jwt/         # JWT authentication
│   │   ├── middleware/  # HTTP middleware
│   │   └── router/      # Routing utilities
│   ├── modules/         # Business modules (DDD)
│   │   ├── user/        # User management
│   │   ├── project/     # Project management
│   │   ├── member/      # Team member management
│   │   ├── flow/        # Test flow execution
│   │   ├── testcase/    # Test case management
│   │   ├── apispec/     # API specification
│   │   ├── environment/ # Environment management
│   │   ├── category/    # Category management
│   │   ├── permission/  # Permission & roles
│   │   └── audit/       # Audit logging
│   └── wiring/          # Dependency injection (Wire)
├── database/
│   ├── migrations/      # Database migrations
│   └── seeders/         # Database seeders
└── routes/              # Route registration

```

## 🔧 Configuration

Key environment variables:

```bash
# Server
PORT=8025
GIN_MODE=release

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kest
DB_USER=kest_user
DB_PASSWORD=kest_password_123

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=24h

# CORS
ALLOWED_ORIGINS=http://localhost:8025
```

## 🧪 Testing

```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run specific module tests
go test ./internal/modules/project/...
```

## 📦 Building

```bash
# Build for production
make build-prod

# Build API-only (for cloud deployment)
go build -o kest-api ./cmd/api
```

## 🚢 Deployment

See [CLOUD_DEPLOYMENT.md](../CLOUD_DEPLOYMENT.md) for cloud deployment instructions.

## 🤝 Contributing

1. Follow Go best practices and project conventions
2. Write tests for new features
3. Update documentation as needed
4. Use conventional commits

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details

## 🔗 Links

- [Main Repository](https://github.com/kest-labs/kest)
- [CLI Documentation](../cli/README.md)
- [Web Dashboard](../web/README.md)
- [Flow Guide](../cli/FLOW_GUIDE.md)
