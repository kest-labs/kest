# Issues API

## Overview

The Issues module tracks and manages issues found during API testing, including failed tests, performance problems, and security vulnerabilities.

## Base Path

```
/v1/workspaces/:id/issues
```

All issue endpoints require authentication and are scoped to a specific workspace.

---

## 1. List Issues

### GET /workspaces/:id/issues

List all issues for a workspace.

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
| `status` | string | ❌ No | - | Filter by status (open, in_progress, resolved, closed) |
| `severity` | string | ❌ No | - | Filter by severity (low, medium, high, critical) |
| `type` | string | ❌ No | - | Filter by type (bug, performance, security, feature) |
| `assignee_id` | integer | ❌ No | - | Filter by assignee |
| `test_case_id` | integer | ❌ No | - | Filter by test case |
| `search` | string | ❌ No | - | Search by title or description |

#### Example Request

```
GET /workspaces/1/issues?status=open&severity=high&page=1&per_page=10
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
        "title": "API response time exceeds 2 seconds",
        "description": "The user list endpoint is taking more than 2 seconds to respond",
        "type": "performance",
        "severity": "high",
        "status": "open",
        "test_case_id": 15,
        "test_case_name": "List Users Test",
        "api_endpoint": "GET /users",
        "assignee_id": 2,
        "assignee_name": "Jane Smith",
        "reporter_id": 1,
        "reporter_name": "John Doe",
        "environment": "production",
        "occurrences": 5,
        "first_seen_at": "2024-02-05T01:00:00Z",
        "last_seen_at": "2024-02-05T02:00:00Z",
        "created_at": "2024-02-05T01:00:00Z",
        "updated_at": "2024-02-05T01:30:00Z",
        "tags": ["performance", "database"]
      },
      {
        "id": 2,
        "title": "SQL injection vulnerability",
        "description": "User search endpoint is vulnerable to SQL injection",
        "type": "security",
        "severity": "critical",
        "status": "in_progress",
        "test_case_id": 20,
        "test_case_name": "Search Users Security Test",
        "api_endpoint": "GET /users/search",
        "assignee_id": 1,
        "assignee_name": "John Doe",
        "reporter_id": 3,
        "reporter_name": "Bob Wilson",
        "environment": "production",
        "occurrences": 1,
        "first_seen_at": "2024-02-05T01:45:00Z",
        "last_seen_at": "2024-02-05T01:45:00Z",
        "created_at": "2024-02-05T01:45:00Z",
        "updated_at": "2024-02-05T02:15:00Z",
        "tags": ["security", "sql-injection", "critical"]
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 10,
      "total": 2,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    },
    "summary": {
      "open": 1,
      "in_progress": 1,
      "resolved": 0,
      "closed": 0,
      "critical": 1,
      "high": 1,
      "medium": 0,
      "low": 0
    }
  }
}
```

---

## 2. Create Issue

### POST /workspaces/:id/issues

Create a new issue.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `title` | string | ✅ Yes | min: 1, max: 200 | Issue title |
| `description` | string | ✅ Yes | min: 1, max: 2000 | Detailed description |
| `type` | string | ✅ Yes | enum: bug, performance, security, feature | Issue type |
| `severity` | string | ✅ Yes | enum: low, medium, high, critical | Severity level |
| `test_case_id` | integer | ❌ No | - | Associated test case ID |
| `api_endpoint` | string | ❌ No | max: 255 | Affected API endpoint |
| `environment` | string | ❌ No | - | Environment where issue occurs |
| `assignee_id` | integer | ❌ No | - | Assign to user ID |
| `tags` | array | ❌ No | max: 10 | Issue tags |
| `metadata` | object | ❌ No | - | Additional metadata |

#### Example Request

```json
{
  "title": "Memory leak in user creation",
  "description": "Creating multiple users causes memory usage to increase indefinitely. Memory is not being released after user creation requests complete.",
  "type": "bug",
  "severity": "high",
  "test_case_id": 12,
  "api_endpoint": "POST /users",
  "environment": "production",
  "assignee_id": 2,
  "tags": ["memory", "leak", "performance"],
  "metadata": {
    "memory_usage": "500MB",
    "reproduction_steps": [
      "Send 1000 POST /users requests",
      "Monitor memory usage",
      "Memory remains allocated after requests complete"
    ]
  }
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 3,
    "title": "Memory leak in user creation",
    "type": "bug",
    "severity": "high",
    "status": "open",
    "assignee_id": 2,
    "reporter_id": 1,
    "created_at": "2024-02-05T02:30:00Z",
    "issue_key": "PROJ-123"
  }
}
```

---

## 3. Get Issue

### GET /workspaces/:id/issues/:issueId

Get details of a specific issue.

**Authentication**: Required (Workspace Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `issueId` | integer | ✅ Yes | Issue ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "issue_key": "PROJ-123",
    "title": "API response time exceeds 2 seconds",
    "description": "The user list endpoint is taking more than 2 seconds to respond",
    "type": "performance",
    "severity": "high",
    "status": "open",
    "test_case_id": 15,
    "test_case_name": "List Users Test",
    "api_endpoint": "GET /users",
    "environment": "production",
    "assignee": {
      "id": 2,
      "username": "jane_smith",
      "nickname": "Jane Smith",
      "avatar": "https://example.com/avatar.jpg"
    },
    "reporter": {
      "id": 1,
      "username": "john_doe",
      "nickname": "John Doe",
      "avatar": "https://example.com/avatar2.jpg"
    },
    "occurrences": 5,
    "first_seen_at": "2024-02-05T01:00:00Z",
    "last_seen_at": "2024-02-05T02:00:00Z",
    "due_date": "2024-02-12T00:00:00Z",
    "tags": ["performance", "database"],
    "metadata": {
      "average_response_time": "2.5s",
      "affected_queries": ["SELECT * FROM users", "COUNT(*) FROM users"]
    },
    "comments": [
      {
        "id": 1,
        "content": "Investigating the database query performance",
        "author": {
          "id": 2,
          "username": "jane_smith",
          "nickname": "Jane Smith"
        },
        "created_at": "2024-02-05T01:30:00Z"
      }
    ],
    "attachments": [
      {
        "id": 1,
        "filename": "performance_graph.png",
        "url": "https://example.com/attachments/performance_graph.png",
        "size": 245760,
        "created_at": "2024-02-05T01:15:00Z"
      }
    ],
    "created_at": "2024-02-05T01:00:00Z",
    "updated_at": "2024-02-05T01:30:00Z"
  }
}
```

---

## 4. Update Issue

### PATCH /workspaces/:id/issues/:issueId

Update an existing issue.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `issueId` | integer | ✅ Yes | Issue ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ❌ No | Issue title |
| `description` | string | ❌ No | Issue description |
| `status` | string | ❌ No | New status |
| `severity` | string | ❌ No | New severity |
| `assignee_id` | integer | ❌ No | New assignee |
| `tags` | array | ❌ No | Updated tags |
| `due_date` | string | ❌ No | Due date (ISO 8601) |

#### Example Request

```json
{
  "status": "in_progress",
  "assignee_id": 1,
  "due_date": "2024-02-10T00:00:00Z",
  "tags": ["performance", "database", "urgent"]
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Issue updated successfully",
  "data": {
    "id": 1,
    "status": "in_progress",
    "assignee_id": 1,
    "updated_at": "2024-02-05T02:45:00Z"
  }
}
```

---

## 5. Delete Issue

### DELETE /workspaces/:id/issues/:issueId

Delete an issue.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `issueId` | integer | ✅ Yes | Issue ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Issue deleted successfully",
  "data": null
}
```

---

## 6. Add Comment

### POST /workspaces/:id/issues/:issueId/comments

Add a comment to an issue.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `issueId` | integer | ✅ Yes | Issue ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `content` | string | ✅ Yes | min: 1, max: 2000 | Comment content |
| `internal` | boolean | ❌ No | default: false | Internal comment (visible to team only) |

#### Example Request

```json
{
  "content": "Fixed the slow query by adding database index. Performance improved to 500ms.",
  "internal": false
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "Comment added successfully",
  "data": {
    "id": 2,
    "content": "Fixed the slow query by adding database index. Performance improved to 500ms.",
    "internal": false,
    "author_id": 1,
    "created_at": "2024-02-05T03:00:00Z"
  }
}
```

---

## 7. Upload Attachment

### POST /workspaces/:id/issues/:issueId/attachments

Upload an attachment to an issue.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `issueId` | integer | ✅ Yes | Issue ID |

#### Request Body (multipart/form-data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | ✅ Yes | File to upload (max 10MB) |
| `description` | string | ❌ No | File description |

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "Attachment uploaded successfully",
  "data": {
    "id": 2,
    "filename": "screenshot.png",
    "url": "https://example.com/attachments/screenshot_123456.png",
    "size": 524288,
    "content_type": "image/png",
    "description": "Error screenshot",
    "created_at": "2024-02-05T03:00:00Z"
  }
}
```

---

## 8. Link Issue to Test Case

### POST /workspaces/:id/issues/:issueId/link

Link an issue to a test case.

**Authentication**: Required (Workspace Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Workspace ID |
| `issueId` | integer | ✅ Yes | Issue ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `test_case_id` | integer | ✅ Yes | Test case ID to link |
| `relationship` | string | ❌ No | Relationship type (causes, caused_by, relates_to) |

#### Example Request

```json
{
  "test_case_id": 25,
  "relationship": "causes"
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Issue linked successfully",
  "data": {
    "test_case_id": 25,
    "relationship": "causes"
  }
}
```

---

## Issue Types

### Bug
- Functional errors
- Unexpected behavior
- Regression issues

### Performance
- Slow response times
- Memory leaks
- Resource exhaustion

### Security
- Vulnerabilities
- Authentication issues
- Authorization problems

### Feature
- New requirements
- Enhancement requests
- Improvements

---

## Severity Levels

### Critical
- Security vulnerabilities
- Data loss
- System downtime

### High
- Major functionality broken
- Significant performance impact
- User experience severely affected

### Medium
- Partial functionality broken
- Moderate performance impact
- Workarounds available

### Low
- Minor issues
- Cosmetic problems
- Nice-to-have improvements

---

## Status Workflow

```
open → in_progress → resolved → closed
  ↓         ↓
reopened ← testing
```

---

## Usage Examples

### JavaScript (Fetch API)

```javascript
const token = 'your-jwt-token';
const workspaceId = 1;

// Create issue
const createIssue = async () => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/issues`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: 'Authentication failing on mobile',
      description: 'Users cannot login using mobile app',
      type: 'bug',
      severity: 'high',
      test_case_id: 10,
      api_endpoint: 'POST /auth/login',
      tags: ['mobile', 'auth', 'critical']
    })
  });
  
  return await response.json();
};

// List issues
const listIssues = async () => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/issues?status=open&severity=high`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};

// Add comment
const addComment = async (issueId) => {
  const response = await fetch(`http://localhost:8025/workspaces/${workspaceId}/issues/${issueId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      content: 'Investigating the mobile authentication flow',
      internal: true
    })
  });
  
  return await response.json();
};
```

### cURL

```bash
# Create issue
curl -X POST http://localhost:8025/workspaces/1/issues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "title": "Database connection timeout",
    "description": "Database connections are timing out after 30 seconds",
    "type": "performance",
    "severity": "high",
    "assignee_id": 2
  }'

# List issues
curl -X GET "http://localhost:8025/workspaces/1/issues?status=open&page=1&per_page=10" \
  -H "Authorization: Bearer TOKEN"

# Update issue
curl -X PATCH http://localhost:8025/workspaces/1/issues/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "status": "resolved",
    "assignee_id": 1
  }'

# Add comment
curl -X POST http://localhost:8025/workspaces/1/issues/1/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "content": "Fixed by increasing connection pool size"
  }'
```

---

## Best Practices

1. **Clear Titles**: Use descriptive, concise titles
2. **Detailed Descriptions**: Include steps to reproduce
3. **Proper Classification**: Use correct type and severity
4. **Timely Updates**: Keep issue status current
5. **Documentation**: Attach relevant screenshots and logs

---

## Security Considerations

1. **Access Control**: Only authorized users can view issues
2. **Sensitive Data**: Avoid passwords in issue descriptions
3. **Attachment Scanning**: All attachments are scanned for malware
4. **Audit Trail**: All issue changes are logged
5. **Privacy**: Internal comments are hidden from external users
