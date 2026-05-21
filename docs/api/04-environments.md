# Environments API

## Overview

The Environments module manages environment configurations for workspaces, including variables, secrets, and deployment settings.

## Base Path

```
/v1/workspaces/:id/environments
```

All environment endpoints require authentication and are scoped to a specific workspace.

---

## 1. List Environments

### GET /workspaces/:id/environments

List all environments for a workspace.

**Authentication**: Required (Workspace Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ No | 1 | Page number |
| `per_page` | integer | ❌ No | 20 | Items per page (max 100) |
| `search` | string | ❌ No | - | Search by name |
| `type` | string | ❌ No | - | Filter by type (development, staging, production) |

#### Example Request

```
GET /workspaces/1/environments?page=1&per_page=10
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
        "name": "Development",
        "slug": "dev",
        "type": "development",
        "description": "Development environment",
        "variables": {
          "API_URL": "https://dev-api.example.com",
          "DEBUG": "true"
        },
        "secrets": {
          "API_KEY": "********"
        },
        "is_default": true,
        "created_at": "2024-02-05T01:00:00Z",
        "updated_at": "2024-02-05T01:00:00Z"
      },
      {
        "id": 2,
        "name": "Production",
        "slug": "prod",
        "type": "production",
        "description": "Production environment",
        "variables": {
          "API_URL": "https://api.example.com",
          "DEBUG": "false"
        },
        "secrets": {
          "API_KEY": "********"
        },
        "is_default": false,
        "created_at": "2024-02-05T01:00:00Z",
        "updated_at": "2024-02-05T01:00:00Z"
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

## 2. Create Environment

### POST /workspaces/:id/environments

Create a new environment for a workspace.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ✅ Yes | min: 1, max: 100 | Environment name |
| `slug` | string | ❌ No | min: 1, max: 50 | URL-friendly slug (auto-generated) |
| `type` | string | ✅ Yes | enum: development, staging, production | Environment type |
| `description` | string | ❌ No | max: 500 | Description |
| `variables` | object | ❌ No | - | Environment variables (key-value pairs) |
| `secrets` | object | ❌ No | - | Secret variables (encrypted) |
| `is_default` | boolean | ❌ No | - | Set as default environment |

#### Example Request

```json
{
  "name": "Staging",
  "slug": "staging",
  "type": "staging",
  "description": "Staging environment for testing",
  "variables": {
    "API_URL": "https://staging-api.example.com",
    "DEBUG": "false",
    "LOG_LEVEL": "info"
  },
  "secrets": {
    "API_KEY": "sk_test_123456789",
    "DATABASE_PASSWORD": "staging_pass_123"
  },
  "is_default": false
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 3,
    "name": "Staging",
    "slug": "staging",
    "type": "staging",
    "description": "Staging environment for testing",
    "variables": {
      "API_URL": "https://staging-api.example.com",
      "DEBUG": "false",
      "LOG_LEVEL": "info"
    },
    "secrets": {
      "API_KEY": "********",
      "DATABASE_PASSWORD": "********"
    },
    "is_default": false,
    "created_at": "2024-02-05T01:30:00Z",
    "updated_at": "2024-02-05T01:30:00Z"
  }
}
```

---

## 3. Get Environment

### GET /workspaces/:id/environments/:eid

Get a specific environment details.

**Authentication**: Required (Workspace Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `eid` | integer | ✅ Yes | Environment ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "Development",
    "slug": "dev",
    "type": "development",
    "description": "Development environment",
    "variables": {
      "API_URL": "https://dev-api.example.com",
      "DEBUG": "true",
      "LOG_LEVEL": "debug"
    },
    "secrets": {
      "API_KEY": "sk_dev_123456789",
      "DATABASE_URL": "postgres://user:pass@localhost:5432/dev"
    },
    "is_default": true,
    "created_at": "2024-02-05T01:00:00Z",
    "updated_at": "2024-02-05T01:00:00Z",
    "last_deployed_at": "2024-02-05T02:00:00Z"
  }
}
```

---

## 4. Update Environment

### PATCH /workspaces/:id/environments/:eid

Update an existing environment.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `eid` | integer | ✅ Yes | Environment ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ❌ No | min: 1, max: 100 | Environment name |
| `type` | string | ❌ No | enum: development, staging, production | Environment type |
| `description` | string | ❌ No | max: 500 | Description |
| `variables` | object | ❌ No | - | Environment variables (merge with existing) |
| `secrets` | object | ❌ No | - | Secret variables (merge with existing) |
| `is_default` | boolean | ❌ No | - | Set as default environment |

#### Example Request

```json
{
  "description": "Updated development environment",
  "variables": {
    "API_URL": "https://new-dev-api.example.com",
    "NEW_FEATURE": "enabled"
  },
  "secrets": {
    "NEW_SECRET": "secret_value_123"
  }
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Environment updated successfully",
  "data": {
    "id": 1,
    "name": "Development",
    "description": "Updated development environment",
    "variables": {
      "API_URL": "https://new-dev-api.example.com",
      "DEBUG": "true",
      "LOG_LEVEL": "debug",
      "NEW_FEATURE": "enabled"
    },
    "secrets": {
      "API_KEY": "sk_dev_123456789",
      "DATABASE_URL": "postgres://user:pass@localhost:5432/dev",
      "NEW_SECRET": "********"
    },
    "updated_at": "2024-02-05T02:00:00Z"
  }
}
```

---

## 5. Delete Environment

### DELETE /workspaces/:id/environments/:eid

Delete an environment.

**⚠️ Warning**: This action is irreversible and will affect all tests using this environment.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `eid` | integer | ✅ Yes | Environment ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Environment deleted successfully",
  "data": null
}
```

---

## 6. Duplicate Environment

### POST /workspaces/:id/environments/:eid/duplicate

Duplicate an environment with a new name.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `eid` | integer | ✅ Yes | Source Environment ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ✅ Yes | min: 1, max: 100 | New environment name |
| `slug` | string | ❌ No | min: 1, max: 50 | URL-friendly slug |
| `include_secrets` | boolean | ❌ No | default: false | Include secrets in duplicate |

#### Example Request

```json
{
  "name": "Development Copy",
  "slug": "dev-copy",
  "include_secrets": true
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "Environment duplicated successfully",
  "data": {
    "id": 4,
    "name": "Development Copy",
    "slug": "dev-copy",
    "type": "development",
    "description": "Duplicated from Development",
    "variables": {
      "API_URL": "https://dev-api.example.com",
      "DEBUG": "true"
    },
    "secrets": {
      "API_KEY": "********"
    },
    "is_default": false,
    "created_at": "2024-02-05T02:30:00Z"
  }
}
```

---

## Environment Types

### Development

- Used for local development
- Debug mode enabled
- Verbose logging
- No rate limiting

### Staging

- Pre-production testing
- Production-like configuration
- Basic rate limiting
- Error tracking enabled

### Production

- Live environment
- Strict rate limiting
- Minimal logging
- Full monitoring

---

## Variable Types

### Variables

- Plain text key-value pairs
- Visible to all workspace members
- Used for non-sensitive configuration

### Secrets

- Encrypted key-value pairs
- Masked in responses (shown as ********)
- Only visible to users with write access
- Used for sensitive data (API keys, passwords)

---

## Usage Examples

### JavaScript (Fetch API)

```javascript
const token = 'your-jwt-token';
const workspaceId = 1;

// Create environment
const createEnvironment = async () => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/environments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Testing',
      type: 'staging',
      variables: {
        API_URL: 'https://test-api.example.com',
        DEBUG: 'true'
      },
      secrets: {
        API_KEY: 'sk_test_123456789'
      }
    })
  });
  
  return await response.json();
};

// Update environment
const updateEnvironment = async (envId) => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/environments/${envId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      variables: {
        NEW_VAR: 'new_value'
      }
    })
  });
  
  return await response.json();
};

// Duplicate environment
const duplicateEnvironment = async (envId) => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/environments/${envId}/duplicate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Environment Copy',
      include_secrets: false
    })
  });
  
  return await response.json();
};
```

### cURL

```bash
# Create environment
curl -X POST http://localhost:8025/workspaces/1/environments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Production",
    "type": "production",
    "variables": {
      "API_URL": "https://api.example.com",
      "DEBUG": "false"
    },
    "secrets": {
      "API_KEY": "sk_prod_123456789"
    }
  }'

# List environments
curl -X GET "http://localhost:8025/workspaces/1/environments?page=1&per_page=10" \
  -H "Authorization: Bearer TOKEN"

# Update environment
curl -X PATCH http://localhost:8025/workspaces/1/environments/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "variables": {
      "NEW_SETTING": "enabled"
    }
  }'

# Duplicate environment
curl -X POST http://localhost:8025/workspaces/1/environments/1/duplicate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Environment Copy",
    "include_secrets": true
  }'
```

---

## Security Considerations

1. **Secret Encryption**: All secrets are encrypted at rest
2. **Access Control**: Only users with write access can view secrets
3. **Audit Log**: All environment changes are logged
4. **Default Environment**: Only one environment can be marked as default
5. **Production Protection**: Additional verification required for production changes

---

## Best Practices

1. **Naming Convention**: Use clear, descriptive names
2. **Variable Grouping**: Group related variables with prefixes
3. **Secret Rotation**: Regularly rotate sensitive secrets
4. **Environment Promotion**: Use duplication to promote environments
5. **Documentation**: Document all variables and their purposes

---

## Testing

Run the environment tests:

```bash
# Unit tests
go test ./internal/modules/environment/...

# Integration tests
go test ./tests/feature/environment_test.go
```
