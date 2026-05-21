# API Quick Reference

## Base URL

```
Production: https://api.kest.com
Development: http://localhost:8025
```

## Authentication

```
Authorization: Bearer <jwt-token>
```

CLI upload endpoints accept a workspace-scoped CLI token:

```
Authorization: Bearer <kest_pat_...>
```

## Quick Endpoints Summary

### Authentication & Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Register new user | No |
| POST | `/login` | User login | No |
| POST | `/password/reset` | Reset password | No |
| GET | `/users/profile` | Get profile | Yes |
| PUT | `/users/profile` | Update profile | Yes |
| PUT | `/users/password` | Change password | Yes |
| DELETE | `/users/account` | Delete account | Yes |
| GET | `/users` | List users (Admin) | Yes |
| GET | `/users/:id` | Get user (Admin) | Yes |

### Workspaces

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/workspaces` | Create workspace | Yes |
| GET | `/workspaces` | List workspaces | Yes |
| GET | `/workspaces/:id` | Get workspace | Yes |
| PUT | `/workspaces/:id` | Update workspace | Yes |
| DELETE | `/workspaces/:id` | Delete workspace | Yes |
| GET | `/workspaces/:id/stats` | Get workspace stats | Yes |
| POST | `/workspaces/:id/cli-tokens` | Generate workspace CLI token | Yes |
| POST | `/workspaces/:id/cli/spec-sync` | Upload specs from CLI history | CLI Token |

### API Specifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/workspaces/:id/api-specs` | List specs | Yes |
| POST | `/workspaces/:id/api-specs` | Create spec | Yes |
| GET | `/workspaces/:id/api-specs/:sid` | Get spec | Yes |
| PATCH | `/workspaces/:id/api-specs/:sid` | Update spec | Yes |
| DELETE | `/workspaces/:id/api-specs/:sid` | Delete spec | Yes |
| POST | `/workspaces/:id/api-specs/import` | Import specs | Yes |
| GET | `/workspaces/:id/api-specs/export` | Export specs | Yes |
| POST | `/workspaces/:id/api-specs/:sid/examples` | Add example | Yes |

### Environments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/workspaces/:id/environments` | List environments | Yes |
| POST | `/workspaces/:id/environments` | Create environment | Yes |
| GET | `/workspaces/:id/environments/:eid` | Get environment | Yes |
| PATCH | `/workspaces/:id/environments/:eid` | Update environment | Yes |
| DELETE | `/workspaces/:id/environments/:eid` | Delete environment | Yes |
| POST | `/workspaces/:id/environments/:eid/duplicate` | Duplicate environment | Yes |

### Test Cases

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/workspaces/:id/test-cases` | List test cases | Yes |
| POST | `/workspaces/:id/test-cases` | Create test case | Yes |
| GET | `/workspaces/:id/test-cases/:tcid` | Get test case | Yes |
| PATCH | `/workspaces/:id/test-cases/:tcid` | Update test case | Yes |
| DELETE | `/workspaces/:id/test-cases/:tcid` | Delete test case | Yes |
| POST | `/workspaces/:id/test-cases/:tcid/duplicate` | Duplicate test case | Yes |
| POST | `/workspaces/:id/test-cases/from-spec` | Generate from spec | Yes |
| POST | `/workspaces/:id/test-cases/:tcid/run` | Run test case | Yes |

### Categories

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/workspaces/:id/categories` | List categories | Yes |
| POST | `/workspaces/:id/categories` | Create category | Yes |
| GET | `/workspaces/:id/categories/:cid` | Get category | Yes |
| PATCH | `/workspaces/:id/categories/:cid` | Update category | Yes |
| DELETE | `/workspaces/:id/categories/:cid` | Delete category | Yes |

### Members

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/workspaces/:id/members` | List members | Yes |
| GET | `/workspaces/:id/members/me` | Get current user role | Yes |
| PATCH | `/workspaces/:id/members/:uid` | Update role | Yes |
| DELETE | `/workspaces/:id/members/:uid` | Remove member | Yes |
| POST | `/workspaces/:id/invitations` | Create invitation | Yes |
| GET | `/workspaces/:id/invitations` | List invitations | Yes |
| DELETE | `/workspaces/:id/invitations/:inviteId` | Revoke invitation | Yes |
| GET | `/workspace-invitations/received` | List my invitations | Yes |
| GET | `/workspace-invitations/:slug` | Get invitation detail | No |
| POST | `/workspace-invitations/:slug/accept` | Accept invitation | Yes |
| POST | `/workspace-invitations/:slug/reject` | Reject invitation | Yes |

### Permissions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/workspaces/:id/permissions` | List permissions | Yes |
| GET | `/workspaces/:id/permissions/roles/:role` | Get role permissions | Yes |
| POST | `/workspaces/:id/permissions/check` | Check permission | Yes |
| POST | `/workspaces/:id/permissions/roles` | Create custom role | Yes |
| PATCH | `/workspaces/:id/permissions/roles/:rid` | Update role | Yes |
| DELETE | `/workspaces/:id/permissions/roles/:rid` | Delete role | Yes |

### Issues

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/workspaces/:id/issues` | List issues | Yes |
| POST | `/workspaces/:id/issues` | Create issue | Yes |
| GET | `/workspaces/:id/issues/:iid` | Get issue | Yes |
| PATCH | `/workspaces/:id/issues/:iid` | Update issue | Yes |
| DELETE | `/workspaces/:id/issues/:iid` | Delete issue | Yes |
| POST | `/workspaces/:id/issues/:iid/comments` | Add comment | Yes |
| POST | `/workspaces/:id/issues/:iid/attachments` | Upload attachment | Yes |
| POST | `/workspaces/:id/issues/:iid/link` | Link to test case | Yes |

### System

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Health check | No |
| GET | `/health/detailed` | Detailed health | Admin |
| GET | `/system/info` | System info | Admin |
| GET | `/system/metrics` | System metrics | Admin |
| GET | `/system/logs` | System logs | Admin |
| POST | `/system/cache/clear` | Clear cache | Admin |
| GET | `/system/queue/status` | Queue status | Admin |
| POST | `/system/queue/retry` | Retry jobs | Admin |
| POST | `/system/maintenance` | Maintenance mode | Admin |
| GET | `/version` | API version | No |
| GET | `/system/features` | Feature flags | Admin |
| PATCH | `/system/features/:feature` | Toggle feature | Admin |

## Common Response Format

### Success
```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

### Error
```json
{
  "code": 400,
  "message": "Error description",
  "error": "Detailed error"
}
```

## Common Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

## Common Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page (max 100) |
| `search` | string | - | Search term |
| `sort` | string | - | Sort field |
| `order` | string | asc | Sort order (asc/desc) |

## Rate Limits

- Default: 1000 requests/minute
- Authentication: 100 requests/minute
- Admin endpoints: 60 requests/minute

## SDK Examples

### JavaScript

```javascript
import Kest from '@kest-lab/kest-js';

const kest = new Kest({
  baseURL: 'https://api.kest.com',
  token: 'your-jwt-token'
});

// List workspaces
const workspaces = await kest.workspaces.list();

// Create test case
const testCase = await kest.testCases.create(workspaceId, {
  name: 'API Test',
  method: 'GET',
  path: '/health'
});
```

### Go

```go
import "github.com/kest-lab/kest-go"

client := kest.NewClient("https://api.kest.com", "your-jwt-token")

// List workspaces
workspaces, err := client.Workspaces.List()

// Create test case
testCase, err := client.TestCases.Create(workspaceId, &kest.TestCase{
  Name:   "API Test",
  Method: "GET",
  Path:   "/health",
})
```

### Python

```python
from kest import Kest

kest = Kest(
    base_url='https://api.kest.com',
    token='your-jwt-token'
)

# List workspaces
workspaces = kest.workspaces.list()

# Create test case
test_case = kest.test_cases.create(workspace_id, {
    'name': 'API Test',
    'method': 'GET',
    'path': '/health'
})
```
