# Project API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects` | Create project | 🔒 |
| `GET` | `/v1/projects` | List projects | 🔒 |
| `GET` | `/v1/projects/:id` | Get project details | 🔒 |
| `PUT` | `/v1/projects/:id` | Update project | 🔒 |
| `PATCH` | `/v1/projects/:id` | Update project | 🔒 |
| `DELETE` | `/v1/projects/:id` | Delete project | 🔒 |
| `GET` | `/v1/projects/:id/stats` | Get Stats project | 🔒 |
| `POST` | `/v1/projects/:id/cli/spec-sync` | Sync Specs From C L I project | 🔒 |
| `POST` | `/v1/projects/:id/cli/history-sync` | Sync History From C L I project | 🔒 |

---

## Details

### POST `/v1/projects`

**Create project**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `projects.create` |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects`

**List projects**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `projects.list` |

#### Response

```json
{
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "slug": "string",
  "status": 1
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id`

**Get project details**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/projects/:id`

**Update project**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/projects/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/projects/:id`

**Update project**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/projects/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id`

**Delete project**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/stats`

**Get Stats project**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/stats' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/cli/spec-sync`

**Sync Specs From C L I project**

| Property | Value |
|----------|-------|
| Auth | 🔒 Workspace CLI token required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/cli/spec-sync' \
  -H 'Authorization: Bearer <workspace-cli-token>'
```

---

### POST `/v1/projects/:id/cli/history-sync`

**Sync History From C L I project**

| Property | Value |
|----------|-------|
| Auth | 🔒 Workspace CLI token required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/cli/history-sync' \
  -H 'Authorization: Bearer <workspace-cli-token>'
```

---
