# API Specifications API

## Overview

The API Specifications module manages structured API definitions for projects, including CRUD operations, batch import/export, AI-generated documentation/tests, and request/response examples.

## Base Path

```
/v1/projects/:id/api-specs
```

All API spec endpoints require authentication and are scoped to a specific project.

## Permissions

- Read operations require at least the project `read` role.
- Write operations require at least the project `write` role.

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
| `page_size` | integer | ❌ No | 20 | Items per page (max 100) |
| `version` | string | ❌ No | - | Filter by version |
| `method` | string | ❌ No | - | Filter by HTTP method (GET, POST, PUT, DELETE, PATCH...) |
| `tag` | string | ❌ No | - | Filter by tag (partial match) |
| `keyword` | string | ❌ No | - | Search in path, summary, and description |

#### Example Request

```
GET /projects/1/api-specs?method=POST&tag=auth&keyword=login&page=1&page_size=10
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
        "project_id": 1,
        "method": "POST",
        "path": "/api/v1/auth/login",
        "summary": "User login",
        "version": "1.0.0",
        "description": "Authenticate user and return an access token.",
        "tags": [
          "auth",
          "public"
        ],
        "is_public": true,
        "created_at": "2026-02-05T01:00:00Z",
        "updated_at": "2026-02-05T01:00:00Z"
      },
      {
        "id": 2,
        "project_id": 1,
        "method": "GET",
        "path": "/api/v1/users/me",
        "summary": "Get current user",
        "version": "1.1.0",
        "description": "Fetch the current authenticated user profile.",
        "tags": [
          "user"
        ],
        "is_public": false,
        "created_at": "2026-02-05T01:30:00Z",
        "updated_at": "2026-02-05T01:30:00Z"
      }
    ],
    "meta": {
      "total": 2,
      "page": 1,
      "page_size": 10,
      "total_pages": 1
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
| `category_id` | integer | ❌ No | - | Optional category ID |
| `method` | string | ✅ Yes | oneof: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS | HTTP method |
| `path` | string | ✅ Yes | max: 500 | API path |
| `summary` | string | ❌ No | max: 500 | Short summary |
| `description` | string | ❌ No | - | Detailed description |
| `doc_markdown` | string | ❌ No | - | Default generated/manual markdown |
| `doc_markdown_zh` | string | ❌ No | - | Chinese markdown |
| `doc_markdown_en` | string | ❌ No | - | English markdown |
| `doc_source` | string | ❌ No | oneof: manual, ai | Documentation source |
| `tags` | string[] | ❌ No | - | Tags |
| `parameters` | object[] | ❌ No | - | Parameter definitions. Use `in: "header"` for request headers |
| `request_body` | object | ❌ No | - | Request body schema |
| `responses` | object | ❌ No | - | Response schema map keyed by status code |
| `version` | string | ✅ Yes | max: 50 | Version label |
| `is_public` | boolean | ❌ No | - | Whether the spec is public. Defaults to `true` |

#### Example Request

```json
{
  "method": "POST",
  "path": "/api/v1/auth/login",
  "summary": "User login",
  "description": "Authenticate user and return an access token.",
  "version": "1.0.0",
  "tags": ["auth", "public"],
  "parameters": [
    {
      "name": "X-Request-ID",
      "in": "header",
      "description": "Optional trace identifier",
      "required": false,
      "schema": {
        "type": "string"
      },
      "example": "req_123456"
    }
  ],
  "request_body": {
    "description": "Login credentials",
    "required": true,
    "content_type": "application/json",
    "schema": {
      "type": "object",
      "required": ["username", "password"],
      "properties": {
        "username": {
          "type": "string"
        },
        "password": {
          "type": "string"
        }
      }
    }
  },
  "responses": {
    "200": {
      "description": "Login succeeded",
      "content_type": "application/json",
      "schema": {
        "type": "object"
      }
    },
    "401": {
      "description": "Invalid credentials",
      "content_type": "application/json",
      "schema": {
        "type": "object"
      }
    }
  },
  "is_public": true
}
```

> Header definitions are stored in `parameters` with `in: "header"`. There is no separate top-level `headers` field on the API spec itself.

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "created",
  "data": {
    "id": 1,
    "project_id": 1,
    "method": "POST",
    "path": "/api/v1/auth/login",
    "summary": "User login",
    "version": "1.0.0",
    "description": "Authenticate user and return an access token.",
    "tags": ["auth", "public"],
    "parameters": [
      {
        "name": "X-Request-ID",
        "in": "header",
        "required": false,
        "schema": {
          "type": "string"
        },
        "example": "req_123456"
      }
    ],
    "request_body": {
      "description": "Login credentials",
      "required": true,
      "content_type": "application/json",
      "schema": {
        "type": "object"
      }
    },
    "responses": {
      "200": {
        "description": "Login succeeded",
        "content_type": "application/json",
        "schema": {
          "type": "object"
        }
      }
    },
    "is_public": true,
    "created_at": "2026-02-05T01:00:00Z",
    "updated_at": "2026-02-05T01:00:00Z"
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
    "project_id": 1,
    "category_id": 5,
    "method": "POST",
    "path": "/api/v1/auth/login",
    "summary": "User login",
    "version": "1.0.0",
    "description": "Authenticate user and return an access token.",
    "tags": ["auth", "public"],
    "request_body": {
      "description": "Login credentials",
      "required": true,
      "content_type": "application/json",
      "schema": {
        "type": "object"
      }
    },
    "parameters": [
      {
        "name": "X-Request-ID",
        "in": "header",
        "required": false,
        "schema": {
          "type": "string"
        }
      }
    ],
    "responses": {
      "200": {
        "description": "Login succeeded",
        "content_type": "application/json",
        "schema": {
          "type": "object"
        }
      }
    },
    "doc_markdown": "## POST /api/v1/auth/login",
    "doc_source": "manual",
    "is_public": true,
    "created_at": "2026-02-05T01:00:00Z",
    "updated_at": "2026-02-05T01:00:00Z"
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
    "project_id": 1,
    "method": "POST",
    "path": "/api/v1/auth/login",
    "version": "1.0.0",
    "summary": "User login",
    "examples": [
      {
        "id": 1,
        "api_spec_id": 1,
        "name": "Success case",
        "response_status": 200,
        "request_headers": {
          "Content-Type": "application/json"
        },
        "request_body": {
          "username": "john@example.com",
          "password": "secret"
        },
        "response_body": {
          "token": "jwt-token"
        },
        "duration_ms": 84,
        "created_at": "2026-02-05T03:00:00Z"
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
| `category_id` | integer | ❌ No | - | Optional category ID |
| `path` | string | ❌ No | max: 500 | API path |
| `summary` | string | ❌ No | max: 500 | Short summary |
| `description` | string | ❌ No | - | Detailed description |
| `doc_markdown` | string | ❌ No | - | Default markdown |
| `doc_markdown_zh` | string | ❌ No | - | Chinese markdown |
| `doc_markdown_en` | string | ❌ No | - | English markdown |
| `doc_source` | string | ❌ No | oneof: manual, ai | Documentation source |
| `tags` | string[] | ❌ No | - | Tags |
| `parameters` | object[] | ❌ No | - | Parameter definitions |
| `request_body` | object | ❌ No | - | Request body schema |
| `responses` | object | ❌ No | - | Response schema map |
| `is_public` | boolean | ❌ No | - | Public visibility |

#### Example Request

```json
{
  "summary": "User login (v2)",
  "description": "Authenticate user and return access and refresh tokens.",
  "tags": ["auth", "token"],
  "request_body": {
    "description": "Updated login payload",
    "required": true,
    "content_type": "application/json",
    "schema": {
      "type": "object"
    }
  },
  "is_public": false
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "project_id": 1,
    "method": "POST",
    "path": "/api/v1/auth/login",
    "summary": "User login (v2)",
    "version": "1.0.0",
    "description": "Authenticate user and return access and refresh tokens.",
    "tags": ["auth", "token"],
    "is_public": false,
    "updated_at": "2026-02-05T02:00:00Z"
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

#### Response (204 No Content)

This endpoint returns an empty response body on success.

---

## 7. Import API Specifications

### POST /projects/:id/api-specs/import

Import multiple API specifications using the same payload shape as `Create API Specification`.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `specs` | object[] | ✅ Yes | Array of API specs to create or upsert by `method + path` |

#### Example Requests

```json
{
  "specs": [
    {
      "method": "POST",
      "path": "/api/v1/auth/login",
      "summary": "User login",
      "version": "1.0.0",
      "request_body": {
        "required": true,
        "content_type": "application/json",
        "schema": {
          "type": "object"
        }
      }
    },
    {
      "method": "GET",
      "path": "/api/v1/users/me",
      "summary": "Get current user",
      "version": "1.0.0"
    }
  ]
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "message": "Specs imported successfully"
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
| `format` | string | ❌ No | json | Export format: `json`, `openapi`, `swagger`, or `markdown` |

#### Example Request

```
GET /projects/1/api-specs/export?format=openapi
```

#### Response (200 OK)

The response payload depends on `format`:

- `json`: array of API spec objects
- `openapi` / `swagger`: generated OpenAPI-like document
- `markdown`: markdown string

Example for `format=openapi`:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "openapi": "3.0.0",
    "info": {
      "title": "Generated API Documentation",
      "version": "1.0.0"
    },
    "paths": {
      "/api/v1/auth/login": {
        "post": {
          "summary": "User login",
          "description": "Authenticate user and return an access token.",
          "responses": {
            "200": {
              "description": "Successful response"
            }
          }
        }
      }
    }
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

> **Note**: After generation, the flow content is automatically saved as a new record in the `test_cases` table (name: `[AI Generated]`), making it immediately available in the test management workflow.

---

## 11. Batch Generate Documentation (AI)

### POST /projects/:id/api-specs/batch-gen-doc

Trigger AI documentation generation for multiple API specs at once. Returns immediately; generation runs in the background using a goroutine pool (concurrency = 3).

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|--------------|
| `id` | integer | ✅ Yes | Project ID |

#### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `category_id` | integer | ❌ No | - | Scope to a specific category. Omit to process the entire project |
| `lang` | string | ❌ No | `en` | Language for generated doc (`en` or `zh`) |
| `force` | boolean | ❌ No | `false` | `false` = skip specs that already have a doc; `true` = regenerate all |

#### Example Request

```json
{
  "category_id": 5,
  "lang": "zh",
  "force": false
}
```

#### Response (200 OK)

Returns immediately. Generation continues in the background.

```json
{
  "code": 0,
  "data": {
    "total": 12,
    "queued": 10,
    "skipped": 2
  }
}
```

| Field | Description |
|-------|-------------|
| `total` | Total specs in scope |
| `queued` | Specs queued for generation |
| `skipped` | Specs already have a doc (only when `force=false`) |

#### Configuration

Requires LLM configuration via environment variables:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | API key for LLM service |
| `OPENAI_BASE_URL` | Base URL for OpenAI-compatible API |
| `OPENAI_MODEL` | Model name (e.g., `qwen-plus`) |

---

## 12. List Examples

### GET /projects/:id/api-specs/:sid/examples

List all request/response examples for an API specification.

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
    "items": [
      {
        "id": 1,
        "api_spec_id": 1,
        "name": "Successful login",
        "request_headers": {
          "Content-Type": "application/json"
        },
        "request_body": {
          "username": "john_doe",
          "password": "SecurePass123!"
        },
        "response_status": 200,
        "response_body": {
          "code": 0,
          "data": {
            "access_token": "jwt-token"
          }
        },
        "duration_ms": 84,
        "created_at": "2026-02-05T01:00:00Z"
      }
    ],
    "total": 1
  }
}
```

---

## 13. Create Example

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
| `name` | string | ✅ Yes | Example name |
| `request_headers` | object | ❌ No | Request headers |
| `request_body` | any | ❌ No | Request body |
| `response_status` | integer | ✅ Yes | Response status code |
| `response_body` | any | ❌ No | Response body |
| `duration_ms` | integer | ❌ No | Request duration in milliseconds |

#### Example Request

```json
{
  "name": "Successful login",
  "request_headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer token"
  },
  "request_body": {
    "username": "john_doe",
    "password": "SecurePass123!"
  },
  "response_status": 200,
  "response_body": {
    "code": 0,
    "data": {
      "access_token": "jwt-token"
    }
  },
  "duration_ms": 84
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "created",
  "data": {
    "id": 1,
    "api_spec_id": 1,
    "name": "Successful login",
    "request_headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer token"
    },
    "request_body": {
      "username": "john_doe",
      "password": "SecurePass123!"
    },
    "response_status": 200,
    "response_body": {
      "code": 0,
      "data": {
        "access_token": "jwt-token"
      }
    },
    "duration_ms": 84,
    "created_at": "2026-02-05T01:00:00Z"
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
  const response = await fetch(`http://localhost:8025/v1/projects/${projectId}/api-specs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      method: 'GET',
      path: '/api/v1/products',
      summary: 'List products',
      version: '1.0.0',
      parameters: [
        {
          name: 'Authorization',
          in: 'header',
          required: false,
          schema: { type: 'string' }
        }
      ],
      responses: {
        '200': {
          description: 'Success',
          content_type: 'application/json',
          schema: { type: 'object' }
        }
      }
    })
  });
  
  return await response.json();
};

// Batch import specs
const importSpecs = async () => {
  const response = await fetch(`http://localhost:8025/v1/projects/${projectId}/api-specs/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      specs: [
        {
          method: 'POST',
          path: '/api/v1/auth/login',
          summary: 'User login',
          version: '1.0.0',
          request_body: {
            required: true,
            content_type: 'application/json',
            schema: { type: 'object' }
          }
        }
      ]
    })
  });
  
  return await response.json();
};

// Export specifications
const exportSpecs = async () => {
  const response = await fetch(`http://localhost:8025/v1/projects/${projectId}/api-specs/export?format=openapi`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  console.log('Exported document:', result.data);
};
```

### cURL

```bash
# Create API spec
curl -X POST http://localhost:8025/v1/projects/1/api-specs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "method": "GET",
    "path": "/api/v1/users/me",
    "summary": "Get current user",
    "version": "1.0.0",
    "parameters": [
      {
        "name": "Authorization",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string"
        }
      }
    ]
  }'

# List API specs
curl -X GET "http://localhost:8025/v1/projects/1/api-specs?page=1&page_size=10" \
  -H "Authorization: Bearer TOKEN"

# Batch import
curl -X POST http://localhost:8025/v1/projects/1/api-specs/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "specs": [
      {
        "method": "POST",
        "path": "/api/v1/auth/login",
        "summary": "User login",
        "version": "1.0.0"
      }
    ]
  }'

# Export as OpenAPI
curl -X GET "http://localhost:8025/v1/projects/1/api-specs/export?format=openapi" \
  -H "Authorization: Bearer TOKEN" \
  -o exported-specs.json
```

---

## Supported Export Formats

### JSON

Returns an array of API spec objects in the internal Kest schema.

### OpenAPI / Swagger

```json
{
  "openapi": "3.0.0",
  "info": { ... },
  "paths": { ... }
}
```

### Markdown

```md
# API Documentation

## GET /api/v1/users/me

**Summary**: Get current user
```

---

## Best Practices

1. **Version Management**: Keep `version` meaningful and consistent across related endpoints
2. **Headers as Parameters**: Store request headers in `parameters` with `in: "header"`
3. **Schema Clarity**: Define request and response schemas explicitly, even for simple payloads
4. **Examples**: Add example records for common success and failure cases
5. **AI Docs/Test Generation**: Treat generated docs/tests as drafts and review them before publishing

---

## Testing

Run the API module test suite from the `api/` directory:

```bash
# Unit tests
go test ./internal/modules/apispec/...

# Full backend suite
go test ./...
```
