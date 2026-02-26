# API Specifications API

## Overview

The API Specifications module manages OpenAPI/Swagger specifications for projects, including CRUD operations, import/export, and example management.

## Base Path

```
/v1/projects/:id/api-specs
```

All API spec endpoints require authentication and are scoped to a specific project.

---

## 1. List API Specifications

### GET /projects/:id/api-specs

List all API specifications for a project.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ No | 1 | Page number |
| `per_page` | integer | ❌ No | 20 | Items per page (max 100) |
| `search` | string | ❌ No | - | Search by name or version |
| `version` | string | ❌ No | - | Filter by version |
| `status` | string | ❌ No | - | Filter by status (draft, published, deprecated) |

#### Example Request

```
GET /projects/1/api-specs?page=1&per_page=10&status=published
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "User API",
        "version": "1.0.0",
        "description": "User management endpoints",
        "status": "published",
        "spec_type": "openapi",
        "created_at": "2024-02-05T01:00:00Z",
        "updated_at": "2024-02-05T01:00:00Z"
      },
      {
        "id": 2,
        "name": "Product API",
        "version": "1.1.0",
        "description": "Product catalog endpoints",
        "status": "draft",
        "spec_type": "openapi",
        "created_at": "2024-02-05T01:30:00Z",
        "updated_at": "2024-02-05T01:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 10,
      "total": 2,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

---

## 2. Create API Specification

### POST /projects/:id/api-specs

Create a new API specification.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ✅ Yes | min: 1, max: 100 | Specification name |
| `version` | string | ✅ Yes | semver format | Version (e.g., 1.0.0) |
| `description` | string | ❌ No | max: 500 | Description |
| `spec_type` | string | ❌ No | enum: openapi, swagger, postman | Specification type |
| `content` | object | ✅ Yes | - | OpenAPI/Swagger specification JSON |
| `status` | string | ❌ No | enum: draft, published, deprecated | Status (default: draft) |

#### Example Request

```json
{
  "name": "User API",
  "version": "1.0.0",
  "description": "User management endpoints",
  "spec_type": "openapi",
  "content": {
    "openapi": "3.0.0",
    "info": {
      "title": "User API",
      "version": "1.0.0",
      "description": "User management endpoints"
    },
    "paths": {
      "/users": {
        "get": {
          "summary": "List users",
          "responses": {
            "200": {
              "description": "Success"
            }
          }
        }
      }
    }
  },
  "status": "draft"
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "User API",
    "version": "1.0.0",
    "description": "User management endpoints",
    "status": "draft",
    "spec_type": "openapi",
    "content": {
      "openapi": "3.0.0",
      "info": {
        "title": "User API",
        "version": "1.0.0"
      },
      "paths": { ... }
    },
    "created_at": "2024-02-05T01:00:00Z",
    "updated_at": "2024-02-05T01:00:00Z"
  }
}
```

---

## 3. Get API Specification

### GET /projects/:id/api-specs/:sid

Get a specific API specification.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `sid` | integer | ✅ Yes | Specification ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "User API",
    "version": "1.0.0",
    "description": "User management endpoints",
    "status": "published",
    "spec_type": "openapi",
    "content": {
      "openapi": "3.0.0",
      "info": {
        "title": "User API",
        "version": "1.0.0",
        "description": "User management endpoints"
      },
      "paths": { ... },
      "components": { ... }
    },
    "created_at": "2024-02-05T01:00:00Z",
    "updated_at": "2024-02-05T01:00:00Z",
    "examples_count": 5
  }
}
```

---

## 4. Get API Specification with Examples

### GET /projects/:id/api-specs/:sid/full

Get API specification including all request/response examples.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `sid` | integer | ✅ Yes | Specification ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "User API",
    "version": "1.0.0",
    "content": {
      "openapi": "3.0.0",
      "info": { ... },
      "paths": { ... }
    },
    "examples": [
      {
        "id": 1,
        "path": "/users",
        "method": "GET",
        "status_code": 200,
        "request_headers": {
          "Authorization": "Bearer token"
        },
        "response_body": {
          "users": [...]
        },
        "description": "Successful user list response"
      },
      {
        "id": 2,
        "path": "/users",
        "method": "POST",
        "status_code": 201,
        "request_body": {
          "username": "john",
          "email": "john@example.com"
        },
        "response_body": {
          "id": 1,
          "username": "john",
          "email": "john@example.com"
        },
        "description": "Create user example"
      }
    ]
  }
}
```

---

## 5. Update API Specification

### PATCH /projects/:id/api-specs/:sid

Update an existing API specification.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `sid` | integer | ✅ Yes | Specification ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ❌ No | min: 1, max: 100 | Specification name |
| `version` | string | ❌ No | semver format | Version |
| `description` | string | ❌ No | max: 500 | Description |
| `content` | object | ❌ No | - | OpenAPI/Swagger specification |
| `status` | string | ❌ No | enum: draft, published, deprecated | Status |

#### Example Request

```json
{
  "version": "1.1.0",
  "content": {
    "openapi": "3.0.0",
    "info": {
      "title": "User API",
      "version": "1.1.0"
    },
    "paths": {
      "/users": {
        "get": { ... },
        "post": { ... }
      }
    }
  },
  "status": "published"
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Specification updated successfully",
  "data": {
    "id": 1,
    "name": "User API",
    "version": "1.1.0",
    "status": "published",
    "updated_at": "2024-02-05T02:00:00Z"
  }
}
```

---

## 6. Delete API Specification

### DELETE /projects/:id/api-specs/:sid

Delete an API specification and all associated examples.

**⚠️ Warning**: This action is irreversible.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `sid` | integer | ✅ Yes | Specification ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Specification deleted successfully",
  "data": null
}
```

---

## 7. Import API Specifications

### POST /projects/:id/api-specs/import

Import API specifications from various sources.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | ✅ Yes | Import source: url, file, postman, swagger |
| `data` | object/string | ✅ Yes | Import data based on source |
| `options` | object | ❌ No | Import options |

#### Example Requests

**From URL:**

```json
{
  "source": "url",
  "data": "https://api.example.com/openapi.json",
  "options": {
    "auto_publish": false,
    "prefix": "Imported - "
  }
}
```

**From Postman Collection:**

```json
{
  "source": "postman",
  "data": {
    "info": {
      "name": "My API",
      "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "item": [...]
  }
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Import completed",
  "data": {
    "imported": 3,
    "updated": 1,
    "errors": [],
    "specs": [
      {
        "id": 1,
        "name": "User API",
        "version": "1.0.0",
        "status": "draft"
      }
    ]
  }
}
```

---

## 8. Export API Specifications

### GET /projects/:id/api-specs/export

Export API specifications in various formats.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | ❌ No | json | Export format: json, yaml, postman |
| `ids` | string | ❌ No | - | Comma-separated spec IDs (all if not provided) |
| `include_examples` | boolean | ❌ No | false | Include request/response examples |

#### Example Request

```
GET /projects/1/api-specs/export?format=yaml&include_examples=true
```

#### Response (200 OK)

**Content-Type**: application/json or application/x-yaml

```json
{
  "project": {
    "id": 1,
    "name": "My Project",
    "specs": [
      {
        "name": "User API",
        "version": "1.0.0",
        "content": { ... },
        "examples": [ ... ]
      }
    ]
  }
}
```

---

## 9. Generate API Documentation (AI)

### POST /projects/:id/api-specs/:sid/gen-doc

Generate API documentation using AI (LLM). The documentation is stored in the `doc_markdown` field of the API specification.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `sid` | integer | ✅ Yes | Specification ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lang` | string | ❌ No | `en` | Language for generated doc (`en` or `zh`) |

#### Example Request

```
POST /projects/1/api-specs/1/gen-doc?lang=zh
```

#### Response (200 OK)

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "method": "POST",
    "path": "/api/v1/auth/register",
    "doc_markdown": "## `POST /api/v1/auth/register`\n\n### 概述\n...",
    "doc_source": "ai",
    "doc_updated_at": "2026-02-26T14:27:15Z"
  }
}
```

#### Configuration

Requires LLM configuration via environment variables:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | API key for LLM service |
| `OPENAI_BASE_URL` | Base URL for OpenAI-compatible API |
| `OPENAI_MODEL` | Model name (e.g., `qwen-plus`) |

---

## 10. Generate Test Cases (AI)

### POST /projects/:id/api-specs/:sid/gen-test

Generate Kest flow test file (`.flow.md`) using AI (LLM). Returns the generated test content directly.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `sid` | integer | ✅ Yes | Specification ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lang` | string | ❌ No | `en` | Language for generated test (`en` or `zh`) |

#### Example Request

```
POST /projects/1/api-specs/1/gen-test?lang=zh
```

#### Response (200 OK)

```json
{
  "code": 0,
  "data": {
    "flow_content": "# 用户注册接口测试\n\n## 成功注册\n\n### Step: 发送注册请求\nPOST {{base_url}}/api/v1/auth/register\n...\n[Asserts]\n- status == 201\n\n[Captures]\n- user_email = json.email"
  }
}
```

#### Generated Test Scenarios

The AI generates test cases covering:

1. **Happy Path** - Successful request with valid data
2. **Validation Error** - Missing required fields or invalid data
3. **Unauthorized** - Test without token (if auth required)

---

## 11. Create Example

### POST /projects/:id/api-specs/:sid/examples

Create a request/response example for an API specification.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `sid` | integer | ✅ Yes | Specification ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | ✅ Yes | API path (e.g., /users) |
| `method` | string | ✅ Yes | HTTP method (GET, POST, etc.) |
| `status_code` | integer | ✅ Yes | Response status code |
| `request_headers` | object | ❌ No | Request headers |
| `request_body` | any | ❌ No | Request body |
| `response_headers` | object | ❌ No | Response headers |
| `response_body` | any | ❌ No | Response body |
| `description` | string | ❌ No | Example description |

#### Example Request

```json
{
  "path": "/users",
  "method": "POST",
  "status_code": 201,
  "request_headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer token"
  },
  "request_body": {
    "username": "john_doe",
    "email": "john@example.com"
  },
  "response_headers": {
    "Content-Type": "application/json"
  },
  "response_body": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "created_at": "2024-02-05T01:00:00Z"
  },
  "description": "Create a new user"
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "Example created successfully",
  "data": {
    "id": 1,
    "path": "/users",
    "method": "POST",
    "status_code": 201,
    "description": "Create a new user",
    "created_at": "2024-02-05T01:00:00Z"
  }
}
```

---

## Usage Examples

### JavaScript (Fetch API)

```javascript
const token = 'your-jwt-token';
const projectId = 1;

// Create a new API specification
const createSpec = async () => {
  const response = await fetch(`http://localhost:8025/projects/${projectId}/api-specs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Product API',
      version: '1.0.0',
      spec_type: 'openapi',
      content: {
        openapi: '3.0.0',
        info: {
          title: 'Product API',
          version: '1.0.0'
        },
        paths: {
          '/products': {
            get: {
              summary: 'List products',
              responses: {
                '200': { description: 'Success' }
              }
            }
          }
        }
      }
    })
  });
  
  return await response.json();
};

// Import from URL
const importSpec = async () => {
  const response = await fetch(`http://localhost:8025/projects/${projectId}/api-specs/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      source: 'url',
      data: 'https://petstore.swagger.io/v2/swagger.json',
      options: {
        auto_publish: false
      }
    })
  });
  
  return await response.json();
};

// Export specifications
const exportSpecs = async () => {
  const response = await fetch(`http://localhost:8025/projects/${projectId}/api-specs/export?format=yaml&include_examples=true`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const yaml = await response.text();
  console.log('Exported YAML:', yaml);
};
```

### cURL

```bash
# Create API spec
curl -X POST http://localhost:8025/projects/1/api-specs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "User API",
    "version": "1.0.0",
    "spec_type": "openapi",
    "content": {
      "openapi": "3.0.0",
      "info": {
        "title": "User API",
        "version": "1.0.0"
      },
      "paths": {
        "/users": {
          "get": {
            "summary": "List users"
          }
        }
      }
    }
  }'

# List API specs
curl -X GET "http://localhost:8025/projects/1/api-specs?page=1&per_page=10" \
  -H "Authorization: Bearer TOKEN"

# Import from URL
curl -X POST http://localhost:8025/projects/1/api-specs/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "source": "url",
    "data": "https://api.example.com/openapi.json"
  }'

# Export as YAML
curl -X GET "http://localhost:8025/projects/1/api-specs/export?format=yaml" \
  -H "Authorization: Bearer TOKEN" \
  -o exported-specs.yaml
```

---

## Supported Specification Formats

### OpenAPI 3.0.x

```json
{
  "openapi": "3.0.0",
  "info": { ... },
  "paths": { ... },
  "components": { ... }
}
```

### Swagger 2.0

```json
{
  "swagger": "2.0",
  "info": { ... },
  "paths": { ... },
  "definitions": { ... }
}
```

### Postman Collection

```json
{
  "info": { ... },
  "item": [ ... ],
  "variable": [ ... ]
}
```

---

## Best Practices

1. **Version Management**: Use semantic versioning (semver)
2. **Status Workflow**: draft → published → deprecated
3. **Documentation**: Always provide clear descriptions
4. **Examples**: Include comprehensive request/response examples
5. **Validation**: Validate OpenAPI specs before importing

---

## Testing

Run the API specification tests:

```bash
# Unit tests
go test ./internal/modules/apispec/...

# Integration tests
go test ./tests/feature/apispec_test.go
```
