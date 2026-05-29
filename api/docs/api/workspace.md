# Workspace API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/workspaces` | Create workspace | 🔒 |
| `GET` | `/v1/workspaces` | List workspaces | 🔒 |
| `GET` | `/v1/workspaces/:id` | Get workspace details | 🔒 |
| `PUT` | `/v1/workspaces/:id` | Update workspace | 🔒 |
| `PATCH` | `/v1/workspaces/:id` | Update workspace | 🔒 |
| `DELETE` | `/v1/workspaces/:id` | Delete workspace | 🔒 |
| `GET` | `/v1/workspaces/:id/stats` | Get Stats workspace | 🔒 |
| `POST` | `/v1/workspaces/:id/cli/spec-sync` | Sync Specs From C L I workspace | 🔒 |
| `POST` | `/v1/workspaces/:id/cli/history-sync` | Sync History From C L I workspace | 🔒 |

---

## Details

### POST `/v1/workspaces`

**Create workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.create` |

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
curl -X POST 'http://localhost:8025/api/v1/workspaces' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces`

**List workspaces**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.list` |

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
curl -X GET 'http://localhost:8025/api/v1/workspaces' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id`

**Get workspace details**

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
curl -X GET 'http://localhost:8025/api/v1/workspaces/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/workspaces/:id`

**Update workspace**

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
curl -X PUT 'http://localhost:8025/api/v1/workspaces/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/workspaces/:id`

**Update workspace**

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
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/workspaces/:id`

**Delete workspace**

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
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/stats`

**Get Stats workspace**

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
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/stats' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/cli/spec-sync`

**Sync Specs From C L I workspace**

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
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/cli/spec-sync' \
  -H 'Authorization: Bearer <workspace-cli-token>'
```

---

### POST `/v1/workspaces/:id/cli/history-sync`

**Sync History From C L I workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 Workspace CLI token required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/cli/history-sync' \
  -H 'Authorization: Bearer <workspace-cli-token>'
```

---
