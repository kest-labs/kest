# Workspaces API

## Overview

The Workspaces module manages API workspaces, including creation, configuration, workspace stats, and CLI sync credentials.

## Base Path

```
/v1
```

All workspace endpoints require authentication.

---

## 1. Create Workspace

### POST /workspaces

Create a new API workspace.

**Authentication**: Required

#### Request Headers

```
Content-Type: application/json
Authorization: Bearer <token>
```

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ✅ Yes | min: 1, max: 100 | Workspace name |
| `slug` | string | ❌ No | min: 1, max: 50 | URL-friendly slug (auto-generated if not provided) |
| `platform` | string | ❌ No | enum: go, javascript, python, java, ruby, php, csharp | Primary platform/language |

#### Example Request

```json
{
  "name": "My E-commerce API",
  "slug": "ecommerce-api",
  "platform": "javascript"
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "My E-commerce API",
    "slug": "ecommerce-api",
    "public_key": "pk_live_51H2K3j...kLmN",
    "dsn": "https://api.kest.com/v1/ingest?public_key=pk_live_51H2K3j...kLmN&workspace_id=1",
    "platform": "javascript",
    "status": 1,
    "rate_limit_per_minute": 1000,
    "created_at": "2024-02-05T01:00:00Z"
  }
}
```

#### Error Responses

- **400 Bad Request**: Validation failed
- **409 Conflict**: Workspace slug already exists

---

## 2. List Workspaces

### GET /workspaces

List all workspaces for the authenticated user.

**Authentication**: Required

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ No | 1 | Page number |
| `per_page` | integer | ❌ No | 20 | Items per page (max 100) |
| `search` | string | ❌ No | - | Search by name or slug |
| `platform` | string | ❌ No | - | Filter by platform |
| `status` | integer | ❌ No | - | Filter by status (0=inactive, 1=active) |

#### Example Request

```
GET /workspaces?page=1&per_page=10&status=1
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
        "name": "My E-commerce API",
        "slug": "ecommerce-api",
        "platform": "javascript",
        "status": 1
      },
      {
        "id": 2,
        "name": "Mobile App Backend",
        "slug": "mobile-backend",
        "platform": "go",
        "status": 1
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

## 3. Get Workspace

### GET /workspaces/:id

Get detailed workspace information.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "My E-commerce API",
    "slug": "ecommerce-api",
    "public_key": "pk_live_51H2K3j...kLmN",
    "dsn": "https://api.kest.com/v1/ingest?public_key=pk_live_51H2K3j...kLmN&workspace_id=1",
    "platform": "javascript",
    "status": 1,
    "rate_limit_per_minute": 1000,
    "created_at": "2024-02-05T01:00:00Z"
  }
}
```

#### Error Responses

- **404 Not Found**: Workspace not found
- **403 Forbidden**: No access to workspace

---

## 4. Update Workspace

### PUT /workspaces/:id

Update workspace information.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ❌ No | min: 1, max: 100 | Workspace name |
| `platform` | string | ❌ No | enum: go, javascript, python, java, ruby, php, csharp | Primary platform |
| `status` | integer | ❌ No | enum: 0, 1 | Workspace status (0=inactive, 1=active) |
| `rate_limit_per_minute` | integer | ❌ No | min: 0, max: 100000 | Rate limit per minute |

#### Example Request

```json
{
  "name": "Updated E-commerce API",
  "platform": "typescript",
  "rate_limit_per_minute": 2000
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Workspace updated successfully",
  "data": {
    "id": 1,
    "name": "Updated E-commerce API",
    "slug": "ecommerce-api",
    "public_key": "pk_live_51H2K3j...kLmN",
    "dsn": "https://api.kest.com/v1/ingest?public_key=pk_live_51H2K3j...kLmN&workspace_id=1",
    "platform": "typescript",
    "status": 1,
    "rate_limit_per_minute": 2000,
    "created_at": "2024-02-05T01:00:00Z"
  }
}
```

---

## 5. Patch Workspace

### PATCH /workspaces/:id

Partially update workspace information (same as PUT but only updates provided fields).

**Authentication**: Required

Same parameters and response as PUT /workspaces/:id.

---

## 6. Delete Workspace

### DELETE /workspaces/:id

Delete a workspace and all associated data.

**⚠️ Warning**: This action is irreversible and will delete all API specs, test cases, and test results.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

---

## 7. Generate CLI Token

### POST /workspaces/:id/cli-tokens

Generate a workspace-scoped CLI token for `kest sync` uploads.

**Authentication**: Required + workspace write access

#### Request Body

```json
{
  "name": "Catalog API CLI sync",
  "scopes": ["spec:write"]
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "token": "kest_pat_3f3b7c...",
    "token_type": "bearer",
    "workspace_id": 12,
    "token_info": {
      "id": 5,
      "workspace_id": 12,
      "name": "Catalog API CLI sync",
      "token_prefix": "kest_pat_3f3b7c12",
      "scopes": ["spec:write"],
      "created_at": "2026-04-09T10:00:00Z"
    }
  }
}
```

#### Notes

- The full token value is returned once.
- Supported scopes: `spec:write`, `run:write`
- Use the returned token with `Authorization: Bearer <kest_pat_...>`

---

## 8. Upload Specs From CLI

### POST /workspaces/:id/cli/spec-sync

Upload API specs inferred from local CLI history.

**Authentication**: Workspace-scoped CLI token with `spec:write`

#### Request Body

```json
{
  "workspace_id": 12,
  "source": "cli",
  "specs": [
    {
      "method": "GET",
      "path": "/v1/users",
      "title": "List users",
      "summary": "List users",
      "version": "v1"
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
    "created": 1,
    "updated": 0,
    "skipped": 0,
    "errors": []
  }
}
```

#### Notes

- The URL workspace ID and token scope must match.
- Common auth headers and secret-shaped JSON fields are redacted before examples are stored.

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Workspace deleted successfully",
  "data": null
}
```

---

## Usage Examples

### JavaScript (Fetch API)

```javascript
const token = 'your-jwt-token';

// Create a new workspace
const createWorkspace = async () => {
  const response = await fetch('http://localhost:8025/workspaces', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'My API Workspace',
      platform: 'javascript'
    })
  });
  
  const data = await response.json();
  console.log('Workspace created:', data.data);
  return data.data;
};

// List workspaces
const listWorkspaces = async () => {
  const response = await fetch('http://localhost:8025/workspaces?page=1&per_page=10', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  console.log('Workspaces:', data.data.items);
  return data.data;
};

// Generate a CLI token
const createCliToken = async (workspaceId) => {
  const response = await fetch(`http://localhost:8025/v1/workspaces/${workspaceId}/cli-tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Payments API CLI sync',
      scopes: ['spec:write']
    })
  });
  
  const data = await response.json();
  console.log('CLI token:', data.data.token);
  return data.data;
};
```

### cURL

```bash
# Create workspace
curl -X POST http://localhost:8025/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "My API Workspace",
    "platform": "go"
  }'

# List workspaces
curl -X GET "http://localhost:8025/workspaces?page=1&per_page=10" \
  -H "Authorization: Bearer TOKEN"

# Get workspace details
curl -X GET http://localhost:8025/workspaces/1 \
  -H "Authorization: Bearer TOKEN"

# Update workspace
curl -X PUT http://localhost:8025/workspaces/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Updated Workspace Name",
    "rate_limit_per_minute": 5000
  }'

# Generate CLI token
curl -X POST http://localhost:8025/v1/workspaces/1/cli-tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Payments API CLI sync",
    "scopes": ["spec:write"]
  }'
```

---

## CLI Configuration

After generating a workspace-scoped CLI token, run this inside your Kest workspace:

```bash
kest sync config \
  --platform-url "https://api.kest.dev/v1" \
  --platform-token "kest_pat_..." \
  --workspace-id "1"
```

Then push local request history:

```bash
kest sync push
```

---

## Rate Limits

Each workspace has its own rate limit:

- **Default**: 1000 requests per minute
- **Maximum**: 100,000 requests per minute
- **Burst**: Up to 2x the rate limit for short bursts

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641234567
```

---

## Security Considerations

1. **CLI Token Scope**: Generate CLI tokens per workspace and keep them scoped as tightly as possible.
2. **One-Time Copy**: The full CLI token is only returned once. Store it securely in `.kest/config.yaml`.
3. **HTTPS**: Always use HTTPS for production CLI uploads.
4. **Environment Separation**: Use different workspaces for dev, staging, and production.
5. **Access Control**: Only members with workspace write access should generate upload tokens.

---

## Testing

Run the workspace tests:

```bash
# Unit tests
go test ./internal/modules/workspace/...

# Integration tests
go test ./tests/feature/workspace_test.go
```
