# Test Cases API

## Overview

The Test Cases module manages API test cases, including creation, execution, and result tracking. Test cases can be created manually or generated from API specifications.

## Base Path

```
/v1/projects/:id/test-cases
```

All test case endpoints require authentication and are scoped to a specific project.

---

## 1. List Test Cases

### GET /projects/:id/test-cases

List all test cases for a project.

**Authentication**: Required (Project Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ No | 1 | Page number |
| `per_page` | integer | ❌ No | 20 | Items per page (max 100) |
| `api_spec_id` | integer | ❌ No | - | Filter by API specification ID |
| `env` | string | ❌ No | - | Filter by environment |
| `keyword` | string | ❌ No | - | Search by name or description |
| `status` | string | ❌ No | - | Filter by status (active, inactive, archived) |
| `category_id` | integer | ❌ No | - | Filter by category ID |

#### Example Request

```
GET /projects/1/test-cases?page=1&per_page=10&api_spec_id=1&env=production
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
        "name": "Create User Test",
        "description": "Test user creation endpoint",
        "method": "POST",
        "path": "/users",
        "api_spec_id": 1,
        "api_spec_name": "User API",
        "environment": "production",
        "category_id": 1,
        "category_name": "User Management",
        "status": "active",
        "last_run_at": "2024-02-05T02:00:00Z",
        "last_run_status": "passed",
        "created_at": "2024-02-05T01:00:00Z",
        "updated_at": "2024-02-05T01:00:00Z"
      },
      {
        "id": 2,
        "name": "List Users Test",
        "description": "Test user listing endpoint",
        "method": "GET",
        "path": "/users",
        "api_spec_id": 1,
        "api_spec_name": "User API",
        "environment": "production",
        "category_id": 1,
        "category_name": "User Management",
        "status": "active",
        "last_run_at": "2024-02-05T01:30:00Z",
        "last_run_status": "failed",
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

## 2. Create Test Case

### POST /projects/:id/test-cases

Create a new test case.

**Authentication**: Required (Project Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ✅ Yes | min: 1, max: 100 | Test case name |
| `description` | string | ❌ No | max: 500 | Description |
| `method` | string | ✅ Yes | enum: GET, POST, PUT, PATCH, DELETE | HTTP method |
| `path` | string | ✅ Yes | min: 1, max: 255 | API path |
| `api_spec_id` | integer | ❌ No | - | Associated API specification ID |
| `environment` | string | ❌ No | - | Target environment |
| `category_id` | integer | ❌ No | - | Category ID |
| `request_headers` | object | ❌ No | - | Request headers |
| `request_body` | any | ❌ No | - | Request body |
| `expected_status` | integer | ❌ No | default: 200 | Expected HTTP status code |
| `expected_response` | any | ❌ No | - | Expected response body |
| `assertions` | array | ❌ No | - | Response assertions |
| `variables` | object | ❌ No | - | Test variables |
| `setup_script` | string | ❌ No | - | Pre-test script |
| `teardown_script` | string | ❌ No | - | Post-test script |

#### Example Request

```json
{
  "name": "Create User Test",
  "description": "Test user creation with valid data",
  "method": "POST",
  "path": "/users",
  "api_spec_id": 1,
  "environment": "production",
  "category_id": 1,
  "request_headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{token}}"
  },
  "request_body": {
    "username": "test_user_{{$randomInt}}",
    "email": "test{{$randomInt}}@example.com",
    "password": "TestPass123"
  },
  "expected_status": 201,
  "expected_response": {
    "id": "{{$exists}}",
    "username": "{{$request.body.username}}",
    "email": "{{$request.body.email}}"
  },
  "assertions": [
    {
      "type": "status",
      "value": 201
    },
    {
      "type": "json_path",
      "path": "$.id",
      "operator": "exists"
    },
    {
      "type": "json_path",
      "path": "$.username",
      "operator": "equals",
      "value": "{{$request.body.username}}"
    }
  ],
  "variables": {
    "token": "Bearer sk_test_123456789"
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
    "name": "Create User Test",
    "description": "Test user creation with valid data",
    "method": "POST",
    "path": "/users",
    "api_spec_id": 1,
    "environment": "production",
    "category_id": 1,
    "status": "active",
    "created_at": "2024-02-05T02:00:00Z",
    "updated_at": "2024-02-05T02:00:00Z"
  }
}
```

---

## 3. Get Test Case

### GET /projects/:id/test-cases/:tcid

Get a specific test case details.

**Authentication**: Required (Project Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `tcid` | integer | ✅ Yes | Test case ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "Create User Test",
    "description": "Test user creation with valid data",
    "method": "POST",
    "path": "/users",
    "api_spec_id": 1,
    "api_spec_name": "User API",
    "environment": "production",
    "category_id": 1,
    "category_name": "User Management",
    "status": "active",
    "request_headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer {{token}}"
    },
    "request_body": {
      "username": "test_user",
      "email": "test@example.com",
      "password": "TestPass123"
    },
    "expected_status": 201,
    "expected_response": {
      "id": "{{$exists}}",
      "username": "{{$request.body.username}}"
    },
    "assertions": [
      {
        "type": "status",
        "value": 201
      }
    ],
    "variables": {
      "token": "Bearer sk_test_123456789"
    },
    "setup_script": "// Pre-test setup",
    "teardown_script": "// Post-test cleanup",
    "last_run_at": "2024-02-05T02:00:00Z",
    "last_run_status": "passed",
    "created_at": "2024-02-05T01:00:00Z",
    "updated_at": "2024-02-05T01:00:00Z"
  }
}
```

---

## 4. Update Test Case

### PATCH /projects/:id/test-cases/:tcid

Update an existing test case.

**Authentication**: Required (Project Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `tcid` | integer | ✅ Yes | Test case ID |

#### Request Body

Same fields as Create Test Case, all optional.

#### Example Request

```json
{
  "name": "Updated Create User Test",
  "description": "Updated description",
  "expected_status": 200,
  "assertions": [
    {
      "type": "status",
      "value": 200
    },
    {
      "type": "response_time",
      "operator": "less_than",
      "value": 1000
    }
  ]
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Test case updated successfully",
  "data": {
    "id": 1,
    "name": "Updated Create User Test",
    "description": "Updated description",
    "updated_at": "2024-02-05T02:30:00Z"
  }
}
```

---

## 5. Delete Test Case

### DELETE /projects/:id/test-cases/:tcid

Delete a test case.

**Authentication**: Required (Project Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `tcid` | integer | ✅ Yes | Test case ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Test case deleted successfully",
  "data": null
}
```

---

## 6. Duplicate Test Case

### POST /projects/:id/test-cases/:tcid/duplicate

Duplicate a test case with modifications.

**Authentication**: Required (Project Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `tcid` | integer | ✅ Yes | Source Test Case ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | ✅ Yes | min: 1, max: 100 | New test case name |
| `environment` | string | ❌ No | - | New environment |
| `description` | string | ❌ No | max: 500 | New description |

#### Example Request

```json
{
  "name": "Create User Test (Staging)",
  "environment": "staging",
  "description": "Same test but for staging environment"
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "Test case duplicated successfully",
  "data": {
    "id": 4,
    "name": "Create User Test (Staging)",
    "environment": "staging",
    "created_at": "2024-02-05T02:30:00Z"
  }
}
```

---

## 7. Generate Test Cases from API Spec

### POST /projects/:id/test-cases/from-spec

Generate test cases automatically from an API specification.

**Authentication**: Required (Project Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api_spec_id` | integer | ✅ Yes | API specification ID |
| `environment` | string | ❌ No | Target environment |
| `category_id` | integer | ❌ No | Category for generated tests |
| `options` | object | ❌ No | Generation options |

#### Example Request

```json
{
  "api_spec_id": 1,
  "environment": "production",
  "category_id": 1,
  "options": {
    "generate_positive_tests": true,
    "generate_negative_tests": true,
    "include_auth_tests": true,
    "max_tests_per_endpoint": 5
  }
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Test cases generated successfully",
  "data": {
    "generated": 15,
    "updated": 3,
    "test_cases": [
      {
        "id": 5,
        "name": "GET /users - Success",
        "method": "GET",
        "path": "/users"
      },
      {
        "id": 6,
        "name": "POST /users - Success",
        "method": "POST",
        "path": "/users"
      }
    ]
  }
}
```

---

## 8. Run Test Case

### POST /projects/:id/test-cases/:tcid/run

Execute a single test case.

**Authentication**: Required (Project Write access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `tcid` | integer | ✅ Yes | Test case ID |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `environment` | string | ❌ No | Override environment |
| `variables` | object | ❌ No | Override test variables |
| `async` | boolean | ❌ No | default: false | Run asynchronously |

#### Example Request

```json
{
  "environment": "staging",
  "variables": {
    "token": "Bearer new_token_123"
  },
  "async": true
}
```

#### Response (200 OK) - Synchronous

```json
{
  "code": 0,
  "message": "Test completed",
  "data": {
    "test_run_id": "tr_123456789",
    "status": "passed",
    "duration": 523,
    "started_at": "2024-02-05T02:00:00Z",
    "completed_at": "2024-02-05T02:00:00Z",
    "request": {
      "method": "POST",
      "url": "https://api.example.com/users",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer token"
      },
      "body": {
        "username": "test_user",
        "email": "test@example.com"
      }
    },
    "response": {
      "status": 201,
      "status_text": "Created",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "id": 1,
        "username": "test_user",
        "email": "test@example.com"
      },
      "response_time": 523
    },
    "assertions": [
      {
        "type": "status",
        "expected": 201,
        "actual": 201,
        "passed": true
      },
      {
        "type": "json_path",
        "path": "$.id",
        "operator": "exists",
        "passed": true
      }
    ],
    "error": null
  }
}
```

#### Response (202 Accepted) - Asynchronous

```json
{
  "code": 0,
  "message": "Test started",
  "data": {
    "test_run_id": "tr_123456789",
    "status": "running",
    "started_at": "2024-02-05T02:00:00Z"
  }
}
```

---

## 9. List Test Run History

### GET /projects/:id/test-cases/:tcid/runs

List execution history for a specific test case.

**Authentication**: Required (Project Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `tcid` | integer | ✅ Yes | Test case ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ No | 1 | Page number |
| `page_size` | integer | ❌ No | 20 | Items per page |
| `status` | string | ❌ No | - | Filter by result: `passed` or `failed` |

#### Example Request

```
GET /projects/1/test-cases/5/runs?page=1&page_size=10&status=failed
```

#### Response (200 OK)

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 42,
        "test_case_id": 5,
        "status": "failed",
        "duration_ms": 312,
        "error": "assertion failed: status expected 200, got 401",
        "created_at": "2026-02-26T10:00:00Z"
      },
      {
        "id": 41,
        "test_case_id": 5,
        "status": "passed",
        "duration_ms": 287,
        "error": "",
        "created_at": "2026-02-26T09:45:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "page_size": 10
  }
}
```

---

## 10. Get Single Test Run

### GET /projects/:id/test-cases/:tcid/runs/:rid

Get the full detail of a single test run, including request, response, and assertion results.

**Authentication**: Required (Project Read access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | Project ID |
| `tcid` | integer | ✅ Yes | Test case ID |
| `rid` | integer | ✅ Yes | Run ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "data": {
    "id": 42,
    "test_case_id": 5,
    "status": "passed",
    "duration_ms": 287,
    "error": "",
    "request": {
      "method": "POST",
      "url": "https://api.example.com/users",
      "headers": { "Content-Type": "application/json" },
      "body": { "username": "alice" }
    },
    "response": {
      "status": 201,
      "headers": { "Content-Type": "application/json" },
      "body": { "id": 1, "username": "alice" },
      "duration_ms": 287
    },
    "assertions": [
      { "expr": "status == 201", "passed": true, "actual": "201" }
    ],
    "variables": { "user_id": "1" },
    "created_at": "2026-02-26T09:45:00Z"
  }
}
```

---

## Assertion Types

### Status Assertion

```json
{
  "type": "status",
  "value": 200
}
```

### JSON Path Assertion

```json
{
  "type": "json_path",
  "path": "$.data.id",
  "operator": "equals",
  "value": 123
}
```

Operators: `equals`, `not_equals`, `exists`, `not_exists`, `contains`, `greater_than`, `less_than`

### Header Assertion

```json
{
  "type": "header",
  "key": "Content-Type",
  "operator": "contains",
  "value": "application/json"
}
```

### Response Time Assertion

```json
{
  "type": "response_time",
  "operator": "less_than",
  "value": 1000
}
```

### Body Contains Assertion

```json
{
  "type": "body_contains",
  "value": "success"
}
```

---

## Template Variables

### Built-in Variables

- `{{$randomInt}}` - Random integer
- `{{$randomString}}` - Random string
- `{{$timestamp}}` - Current timestamp
- `{{$uuid}}` - Random UUID
- `{{$request.body.<path>}}` - Access request body
- `{{$response.body.<path>}}` - Access response body
- `{{$env.<variable>}}` - Environment variable

### Example Usage

```json
{
  "request_body": {
    "username": "test_user_{{$randomInt}}",
    "email": "test_{{$timestamp}}@example.com"
  },
  "assertions": [
    {
      "type": "json_path",
      "path": "$.username",
      "operator": "equals",
      "value": "{{$request.body.username}}"
    }
  ]
}
```

---

## Usage Examples

### JavaScript (Fetch API)

```javascript
const token = 'your-jwt-token';
const projectId = 1;

// Create test case
const createTestCase = async () => {
  const response = await fetch(`http://localhost:8025/projects/${projectId}/test-cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'API Health Check',
      method: 'GET',
      path': '/health',
      expected_status: 200
    })
  });
  
  return await response.json();
};

// Run test case
const runTestCase = async (testCaseId) => {
  const response = await fetch(`http://localhost:8025/projects/${projectId}/test-cases/${testCaseId}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      environment: 'production',
      async: false
    })
  });
  
  return await response.json();
};

// Generate from API spec
const generateFromSpec = async () => {
  const response = await fetch(`http://localhost:8025/projects/${projectId}/test-cases/from-spec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      api_spec_id: 1,
      environment: 'production',
      options: {
        generate_positive_tests: true,
        generate_negative_tests: true
      }
    })
  });
  
  return await response.json();
};
```

### cURL

```bash
# Create test case
curl -X POST http://localhost:8025/projects/1/test-cases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "List Users Test",
    "method": "GET",
    "path": "/users",
    "expected_status": 200
  }'

# Run test case
curl -X POST http://localhost:8025/projects/1/test-cases/1/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "environment": "production"
  }'

# Generate from spec
curl -X POST http://localhost:8025/projects/1/test-cases/from-spec \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "api_spec_id": 1,
    "environment": "production"
  }'
```

---

## Best Practices

1. **Naming**: Use descriptive names following pattern: "Action + Resource + Test"
2. **Organization**: Group related tests in categories
3. **Data Management**: Use variables for dynamic data
4. **Assertions**: Include multiple assertions for thorough testing
5. **Environment Testing**: Test across all environments
6. **Error Cases**: Include negative test scenarios

---

## Testing

Run the test case tests:

```bash
# Unit tests
go test ./internal/modules/testcase/...

# Integration tests
go test ./tests/feature/testcase_test.go
```
