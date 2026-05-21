# Permissions API

## Overview

The Permissions module provides role-based access control (RBAC) for fine-grained permission management within workspaces.

## Base Path

```
/v1/workspaces/:id/permissions
```

All permission endpoints require authentication and are scoped to a specific workspace.

---

## 1. List Available Permissions

### GET /workspaces/:id/permissions

List all available permissions in the system.

**Authentication**: Required (Workspace Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category` | string | ❌ No | - | Filter by category (workspace, testcase, apispec, environment, member) |
| `role` | string | ❌ No | - | Show permissions for specific role |

#### Example Request

```
GET /workspaces/1/permissions?category=testcase
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "permissions": [
      {
        "name": "testcase.read",
        "display_name": "Read Test Cases",
        "description": "View test cases and results",
        "category": "testcase",
        "roles": ["owner", "admin", "write", "read"]
      },
      {
        "name": "testcase.write",
        "display_name": "Write Test Cases",
        "description": "Create and edit test cases",
        "category": "testcase",
        "roles": ["owner", "admin", "write"]
      },
      {
        "name": "testcase.delete",
        "display_name": "Delete Test Cases",
        "description": "Delete test cases",
        "category": "testcase",
        "roles": ["owner", "admin"]
      },
      {
        "name": "testcase.run",
        "display_name": "Run Tests",
        "description": "Execute test cases",
        "category": "testcase",
        "roles": ["owner", "admin", "write", "read"]
      }
    ]
  }
}
```

---

## 2. Get Role Permissions

### GET /workspaces/:id/permissions/roles/:role

Get all permissions for a specific role.

**Authentication**: Required (Workspace Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `role` | string | ✅ Yes | Role name (owner, admin, write, read) |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "role": "write",
    "permissions": [
      {
        "category": "workspace",
        "permissions": [
          "workspace.read",
          "workspace.write"
        ]
      },
      {
        "category": "testcase",
        "permissions": [
          "testcase.read",
          "testcase.write",
          "testcase.run"
        ]
      },
      {
        "category": "apispec",
        "permissions": [
          "apispec.read",
          "apispec.write"
        ]
      },
      {
        "category": "environment",
        "permissions": [
          "environment.read"
        ]
      }
    ]
  }
}
```

---

## 3. Check User Permission

### POST /workspaces/:id/permissions/check

Check if a user has a specific permission.

**Authentication**: Required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | integer | ❌ No | User ID (default: current user) |
| `permission` | string | ✅ Yes | Permission name to check |
| `resource_id` | integer | ❌ No | Specific resource ID for resource-level checks |

#### Example Request

```json
{
  "permission": "testcase.delete",
  "resource_id": 123
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "has_permission": true,
    "permission": "testcase.delete",
    "granted_by": "role",
    "role": "admin",
    "resource_id": 123
  }
}
```

---

## 4. Create Custom Role

### POST /workspaces/:id/permissions/roles

Create a custom role with specific permissions (Enterprise feature).

**Authentication**: Required (Workspace Owner access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ✅ Yes | min: 1, max: 50 | Role name |
| `display_name` | string | ✅ Yes | min: 1, max: 100 | Display name |
| `description` | string | ❌ No | max: 500 | Role description |
| `permissions` | array | ✅ Yes | - | List of permission names |
| `is_system_role` | boolean | ❌ No | default: false | System role flag |

#### Example Request

```json
{
  "name": "tester",
  "display_name": "Tester",
  "description": "Can run and view tests but cannot modify",
  "permissions": [
    "workspace.read",
    "testcase.read",
    "testcase.run",
    "apispec.read",
    "environment.read"
  ]
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "Role created successfully",
  "data": {
    "id": 5,
    "name": "tester",
    "display_name": "Tester",
    "description": "Can run and view tests but cannot modify",
    "permissions": [
      "workspace.read",
      "testcase.read",
      "testcase.run",
      "apispec.read",
      "environment.read"
    ],
    "created_at": "2024-02-05T02:00:00Z"
  }
}
```

---

## 5. Update Custom Role

### PATCH /workspaces/:id/permissions/roles/:roleId

Update a custom role.

**Authentication**: Required (Workspace Owner access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `roleId` | integer | ✅ Yes | Role ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_name` | string | ❌ No | Display name |
| `description` | string | ❌ No | Role description |
| `permissions` | array | ❌ No | Updated list of permissions |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Role updated successfully",
  "data": {
    "id": 5,
    "updated_at": "2024-02-05T02:30:00Z"
  }
}
```

---

## 6. Delete Custom Role

### DELETE /workspaces/:id/permissions/roles/:roleId

Delete a custom role.

**Authentication**: Required (Workspace Owner access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `roleId` | integer | ✅ Yes | Role ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `migrate_to` | string | ❌ No | - | Migrate users to this role |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Role deleted successfully",
  "data": {
    "migrated_users": 3
  }
}
```

---

## Permission Categories

### Workspace Permissions

- `workspace.read` - View workspace details
- `workspace.write` - Edit workspace settings
- `workspace.admin` - Manage workspace (excluding deletion)
- `workspace.delete` - Delete workspace

### Test Case Permissions

- `testcase.read` - View test cases
- `testcase.write` - Create/edit test cases
- `testcase.delete` - Delete test cases
- `testcase.run` - Execute test cases
- `testcase.manage` - Manage test execution settings

### API Specification Permissions

- `apispec.read` - View API specifications
- `apispec.write` - Create/edit API specifications
- `apispec.delete` - Delete API specifications
- `apispec.import` - Import API specifications

### Environment Permissions

- `environment.read` - View environments
- `environment.write` - Create/edit environments
- `environment.delete` - Delete environments
- `environment.secrets` - Access environment secrets

### Member Permissions

- `member.read` - View workspace members
- `member.invite` - Invite new members
- `member.manage` - Manage member roles
- `member.remove` - Remove members

---

## Usage Examples

### JavaScript (Fetch API)

```javascript
const token = 'your-jwt-token';
const workspaceId = 1;

// Check permission
const checkPermission = async (permission) => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/permissions/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      permission: permission
    })
  });
  
  return await response.json();
};

// Get all permissions
const getAllPermissions = async () => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/permissions`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};

// Get role permissions
const getRolePermissions = async (role) => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/permissions/roles/${role}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};

// Usage
(async () => {
  // Check if user can delete test cases
  const canDelete = await checkPermission('testcase.delete');
  console.log('Can delete test cases:', canDelete.data.has_permission);
  
  // Get all available permissions
  const permissions = await getAllPermissions();
  console.log('Available permissions:', permissions.data.permissions);
})();
```

### cURL

```bash
# Check permission
curl -X POST http://localhost:8025/workspaces/1/permissions/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "permission": "testcase.run"
  }'

# List all permissions
curl -X GET "http://localhost:8025/workspaces/1/permissions" \
  -H "Authorization: Bearer TOKEN"

# Get role permissions
curl -X GET http://localhost:8025/workspaces/1/permissions/roles/admin \
  -H "Authorization: Bearer TOKEN"

# Create custom role
curl -X POST http://localhost:8025/workspaces/1/permissions/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "viewer",
    "display_name": "Viewer",
    "description": "Read-only access",
    "permissions": [
      "workspace.read",
      "testcase.read",
      "apispec.read",
      "environment.read"
    ]
  }'
```

---

## Best Practices

1. **Principle of Least Privilege**: Grant minimum necessary permissions
2. **Role-Based Design**: Use roles rather than assigning individual permissions
3. **Regular Audits**: Periodically review and adjust permissions
4. **Custom Roles**: Create custom roles for specific team needs
5. **Resource-Level Control**: Use resource-level permissions for fine-grained control

---

## Security Considerations

1. **Permission Caching**: Permissions are cached for performance
2. **Audit Logging**: All permission checks are logged
3. **Role Hierarchy**: Higher roles include lower role permissions
4. **System Roles**: System roles cannot be deleted
5. **Permission Inheritance**: Resources inherit parent permissions
