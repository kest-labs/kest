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

CLI upload endpoints accept a project-scoped CLI token:

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

### Projects

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/projects` | Create project | Yes |
| GET | `/projects` | List projects | Yes |
| GET | `/projects/:id` | Get project | Yes |
| PUT | `/projects/:id` | Update project | Yes |
| DELETE | `/projects/:id` | Delete project | Yes |
| GET | `/projects/:id/stats` | Get project stats | Yes |
| POST | `/projects/:id/cli-tokens` | Generate project CLI token | Yes |
| POST | `/projects/:id/cli/spec-sync` | Upload specs from CLI history | CLI Token |

### API Specifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/projects/:id/api-specs` | List specs | Yes |
| POST | `/projects/:id/api-specs` | Create spec | Yes |
| GET | `/projects/:id/api-specs/:sid` | Get spec | Yes |
| PATCH | `/projects/:id/api-specs/:sid` | Update spec | Yes |
| DELETE | `/projects/:id/api-specs/:sid` | Delete spec | Yes |
| POST | `/projects/:id/api-specs/import` | Import specs | Yes |
| GET | `/projects/:id/api-specs/export` | Export specs | Yes |
| POST | `/projects/:id/api-specs/:sid/examples` | Add example | Yes |

### Environments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/projects/:id/environments` | List environments | Yes |
| POST | `/projects/:id/environments` | Create environment | Yes |
| GET | `/projects/:id/environments/:eid` | Get environment | Yes |
| PATCH | `/projects/:id/environments/:eid` | Update environment | Yes |
| DELETE | `/projects/:id/environments/:eid` | Delete environment | Yes |
| POST | `/projects/:id/environments/:eid/duplicate` | Duplicate environment | Yes |

### Test Cases

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/projects/:id/test-cases` | List test cases | Yes |
| POST | `/projects/:id/test-cases` | Create test case | Yes |
| GET | `/projects/:id/test-cases/:tcid` | Get test case | Yes |
| PATCH | `/projects/:id/test-cases/:tcid` | Update test case | Yes |
| DELETE | `/projects/:id/test-cases/:tcid` | Delete test case | Yes |
| POST | `/projects/:id/test-cases/:tcid/duplicate` | Duplicate test case | Yes |
| POST | `/projects/:id/test-cases/from-spec` | Generate from spec | Yes |
| POST | `/projects/:id/test-cases/:tcid/run` | Run test case | Yes |

### Categories

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/projects/:id/categories` | List categories | Yes |
| POST | `/projects/:id/categories` | Create category | Yes |
| GET | `/projects/:id/categories/:cid` | Get category | Yes |
| PATCH | `/projects/:id/categories/:cid` | Update category | Yes |
| DELETE | `/projects/:id/categories/:cid` | Delete category | Yes |

### Members

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/projects/:id/members` | List members | Yes |
| GET | `/projects/:id/members/me` | Get current user role | Yes |
| PATCH | `/projects/:id/members/:uid` | Update role | Yes |
| DELETE | `/projects/:id/members/:uid` | Remove member | Yes |
| POST | `/projects/:id/invitations` | Create invitation | Yes |
| GET | `/projects/:id/invitations` | List invitations | Yes |
| DELETE | `/projects/:id/invitations/:inviteId` | Revoke invitation | Yes |
| GET | `/project-invitations/received` | List my invitations | Yes |
| GET | `/project-invitations/:slug` | Get invitation detail | No |
| POST | `/project-invitations/:slug/accept` | Accept invitation | Yes |
| POST | `/project-invitations/:slug/reject` | Reject invitation | Yes |

### Permissions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/projects/:id/permissions` | List permissions | Yes |
| GET | `/projects/:id/permissions/roles/:role` | Get role permissions | Yes |
| POST | `/projects/:id/permissions/check` | Check permission | Yes |
| POST | `/projects/:id/permissions/roles` | Create custom role | Yes |
| PATCH | `/projects/:id/permissions/roles/:rid` | Update role | Yes |
| DELETE | `/projects/:id/permissions/roles/:rid` | Delete role | Yes |

### Issues

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/projects/:id/issues` | List issues | Yes |
| POST | `/projects/:id/issues` | Create issue | Yes |
| GET | `/projects/:id/issues/:iid` | Get issue | Yes |
| PATCH | `/projects/:id/issues/:iid` | Update issue | Yes |
| DELETE | `/projects/:id/issues/:iid` | Delete issue | Yes |
| POST | `/projects/:id/issues/:iid/comments` | Add comment | Yes |
| POST | `/projects/:id/issues/:iid/attachments` | Upload attachment | Yes |
| POST | `/projects/:id/issues/:iid/link` | Link to test case | Yes |

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

// List projects
const projects = await kest.projects.list();

// Create test case
const testCase = await kest.testCases.create(projectId, {
  name: 'API Test',
  method: 'GET',
  path: '/health'
});
```

### Go

```go
import "github.com/kest-lab/kest-go"

client := kest.NewClient("https://api.kest.com", "your-jwt-token")

// List projects
projects, err := client.Projects.List()

// Create test case
testCase, err := client.TestCases.Create(projectId, &kest.TestCase{
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

# List projects
projects = kest.projects.list()

# Create test case
test_case = kest.test_cases.create(project_id, {
    'name': 'API Test',
    'method': 'GET',
    'path': '/health'
})
```
