# Environments API

## Overview

The Environments module manages project-scoped runtime configurations such as `base_url`,
`variables`, and `headers`.

## Base Path

```text
/v1/projects/:id/environments
```

All endpoints require authentication and are scoped to a specific project.

## Actual API Shape

This document is aligned with the current backend implementation in
`api/internal/modules/environment`.

Current implementation notes:

- There are 6 endpoints: `list`, `create`, `get`, `update`, `delete`, `duplicate`
- The resource fields are `name`, `display_name`, `base_url`, `variables`, `headers`
- The list endpoint returns `{ items, total }` and does not support pagination or search
- There is no `slug`, `type`, `description`, `secrets`, `is_default`, or `last_deployed_at`

---

## Environment Object

```json
{
  "id": 1,
  "project_id": 12,
  "name": "production",
  "display_name": "Production",
  "base_url": "https://api.example.com",
  "variables": {
    "APP_ENV": "prod",
    "LOG_LEVEL": "info"
  },
  "headers": {
    "X-API-Key": "demo-key"
  },
  "created_at": "2024-02-05T01:00:00Z",
  "updated_at": "2024-02-05T01:00:00Z"
}
```

---

## 1. List Environments

### GET /projects/:id/environments

List all environments under a project.

**Authentication**: Required (`Project Read` access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Project ID |

#### Query Parameters

None.

#### Example Request

```text
GET /projects/12/environments
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
        "project_id": 12,
        "name": "production",
        "display_name": "Production",
        "base_url": "https://api.example.com",
        "variables": {
          "APP_ENV": "prod"
        },
        "headers": {
          "X-API-Key": "demo-key"
        },
        "created_at": "2024-02-05T01:00:00Z",
        "updated_at": "2024-02-05T01:00:00Z"
      }
    ],
    "total": 1
  }
}
```

---

## 2. Create Environment

### POST /projects/:id/environments

Create a new environment under a project.

**Authentication**: Required (`Project Write` access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Project ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | Yes | max: 50 | Internal environment name |
| `display_name` | string | No | max: 100 | Human-readable display name |
| `base_url` | string | No | max: 500 | Base URL used by the environment |
| `variables` | object | No | - | Arbitrary JSON object stored as variables |
| `headers` | object | No | - | String key/value headers |

#### Example Request

```json
{
  "name": "staging",
  "display_name": "Staging",
  "base_url": "https://staging-api.example.com",
  "variables": {
    "APP_ENV": "staging",
    "DEBUG": false
  },
  "headers": {
    "X-Trace-Env": "staging"
  }
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "created",
  "data": {
    "id": 2,
    "project_id": 12,
    "name": "staging",
    "display_name": "Staging",
    "base_url": "https://staging-api.example.com",
    "variables": {
      "APP_ENV": "staging",
      "DEBUG": false
    },
    "headers": {
      "X-Trace-Env": "staging"
    },
    "created_at": "2024-02-05T01:30:00Z",
    "updated_at": "2024-02-05T01:30:00Z"
  }
}
```

---

## 3. Get Environment

### GET /projects/:id/environments/:eid

Get a single environment by ID.

**Authentication**: Required (`Project Read` access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Project ID |
| `eid` | integer | Yes | Environment ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "project_id": 12,
    "name": "production",
    "display_name": "Production",
    "base_url": "https://api.example.com",
    "variables": {
      "APP_ENV": "prod",
      "TIMEOUT_MS": 5000
    },
    "headers": {
      "X-API-Key": "demo-key"
    },
    "created_at": "2024-02-05T01:00:00Z",
    "updated_at": "2024-02-05T01:00:00Z"
  }
}
```

---

## 4. Update Environment

### PATCH /projects/:id/environments/:eid

Update an existing environment.

**Authentication**: Required (`Project Write` access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Project ID |
| `eid` | integer | Yes | Environment ID |

#### Request Body

All fields are optional. Only send the fields you want to update.

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | No | max: 50 | Internal environment name |
| `display_name` | string | No | max: 100 | Human-readable display name |
| `base_url` | string | No | max: 500 | Base URL used by the environment |
| `variables` | object | No | - | Replaces the stored variables object |
| `headers` | object | No | - | Replaces the stored headers object |

#### Example Request

```json
{
  "display_name": "Production CN",
  "base_url": "https://api-cn.example.com",
  "variables": {
    "APP_ENV": "prod",
    "REGION": "cn"
  },
  "headers": {
    "X-Region": "cn"
  }
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "project_id": 12,
    "name": "production",
    "display_name": "Production CN",
    "base_url": "https://api-cn.example.com",
    "variables": {
      "APP_ENV": "prod",
      "REGION": "cn"
    },
    "headers": {
      "X-Region": "cn"
    },
    "created_at": "2024-02-05T01:00:00Z",
    "updated_at": "2024-02-05T02:00:00Z"
  }
}
```

---

## 5. Delete Environment

### DELETE /projects/:id/environments/:eid

Delete an environment.

**Authentication**: Required (`Project Write` access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Project ID |
| `eid` | integer | Yes | Environment ID |

#### Response (204 No Content)

This endpoint returns no response body on success.

---

## 6. Duplicate Environment

### POST /projects/:id/environments/:eid/duplicate

Create a new environment by copying an existing one.

**Authentication**: Required (`Project Write` access)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Project ID |
| `eid` | integer | Yes | Source environment ID |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | Yes | max: 50 | New environment name |
| `override_vars` | object | No | - | Variables to override on top of the copied source |

#### Example Request

```json
{
  "name": "production-copy",
  "override_vars": {
    "REGION": "us",
    "DEBUG": false
  }
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "created",
  "data": {
    "id": 3,
    "project_id": 12,
    "name": "production-copy",
    "display_name": "Production",
    "base_url": "https://api.example.com",
    "variables": {
      "APP_ENV": "prod",
      "REGION": "us",
      "DEBUG": false
    },
    "headers": {
      "X-API-Key": "demo-key"
    },
    "created_at": "2024-02-05T03:00:00Z",
    "updated_at": "2024-02-05T03:00:00Z"
  }
}
```
