# Categories API

## Overview

The Categories module manages test case categories for better organization and grouping of test cases.

## Base Path

```
/v1/workspaces/:id/categories
```

All category endpoints require authentication and are scoped to a specific workspace.

---

## 1. List Categories

### GET /workspaces/:id/categories

List all categories for a workspace.

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
| `include_count` | boolean | ❌ No | false | Include test case count |

#### Example Request

```
GET /workspaces/1/categories?include_count=true
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
        "name": "User Management",
        "description": "User-related endpoints",
        "color": "#3B82F6",
        "icon": "users",
        "parent_id": null,
        "test_cases_count": 15,
        "created_at": "2024-02-05T01:00:00Z",
        "updated_at": "2024-02-05T01:00:00Z"
      },
      {
        "id": 2,
        "name": "Authentication",
        "description": "Auth endpoints",
        "color": "#10B981",
        "icon": "lock",
        "parent_id": null,
        "test_cases_count": 8,
        "created_at": "2024-02-05T01:00:00Z",
        "updated_at": "2024-02-05T01:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 2,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

---

## 2. Create Category

### POST /workspaces/:id/categories

Create a new category.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ✅ Yes | min: 1, max: 100 | Category name |
| `description` | string | ❌ No | max: 500 | Description |
| `color` | string | ❌ No | hex color | Color code (default: #3B82F6) |
| `icon` | string | ❌ No | max: 50 | Icon name |
| `parent_id` | integer | ❌ No | - | Parent category ID for nesting |

#### Example Request

```json
{
  "name": "Payment Processing",
  "description": "Payment and billing endpoints",
  "color": "#F59E0B",
  "icon": "credit-card",
  "parent_id": null
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 3,
    "name": "Payment Processing",
    "description": "Payment and billing endpoints",
    "color": "#F59E0B",
    "icon": "credit-card",
    "parent_id": null,
    "created_at": "2024-02-05T02:00:00Z",
    "updated_at": "2024-02-05T02:00:00Z"
  }
}
```

---

## 3. Get Category

### GET /workspaces/:id/categories/:cid

Get a specific category details.

**Authentication**: Required (Workspace Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `cid` | integer | ✅ Yes | Category ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "User Management",
    "description": "User-related endpoints",
    "color": "#3B82F6",
    "icon": "users",
    "parent_id": null,
    "parent_name": null,
    "children": [
      {
        "id": 4,
        "name": "User Profile",
        "parent_id": 1
      }
    ],
    "test_cases_count": 15,
    "created_at": "2024-02-05T01:00:00Z",
    "updated_at": "2024-02-05T01:00:00Z"
  }
}
```

---

## 4. Update Category

### PATCH /workspaces/:id/categories/:cid

Update a category.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `cid` | integer | ✅ Yes | Category ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ❌ No | min: 1, max: 100 | Category name |
| `description` | string | ❌ No | max: 500 | Description |
| `color` | string | ❌ No | hex color | Color code |
| `icon` | string | ❌ No | max: 50 | Icon name |
| `parent_id` | integer | ❌ No | - | Parent category ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Category updated successfully",
  "data": {
    "id": 1,
    "name": "Updated Category Name",
    "updated_at": "2024-02-05T02:30:00Z"
  }
}
```

---

## 5. Delete Category

### DELETE /workspaces/:id/categories/:cid

Delete a category.

**⚠️ Warning**: This will unassociate all test cases from this category.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `cid` | integer | ✅ Yes | Category ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `move_to` | integer | ❌ No | - | Move test cases to another category ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Category deleted successfully",
  "data": {
    "moved_test_cases": 15
  }
}
```

---

## Usage Examples

### JavaScript (Fetch API)

```javascript
const token = 'your-jwt-token';
const workspaceId = 1;

// Create category
const createCategory = async () => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'API Integration',
      description: 'Third-party integration tests',
      color: '#8B5CF6',
      icon: 'plug'
    })
  });
  
  return await response.json();
};

// List categories with counts
const listCategories = async () => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/categories?include_count=true`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

### cURL

```bash
# Create category
curl -X POST http://localhost:8025/workspaces/1/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Database Tests",
    "description": "Database operation tests",
    "color": "#EF4444",
    "icon": "database"
  }'

# List categories
curl -X GET "http://localhost:8025/workspaces/1/categories?include_count=true" \
  -H "Authorization: Bearer TOKEN"
```
