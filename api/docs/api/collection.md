# Collection API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/workspaces/:id/collections` | Create collection | 🔒 |
| `GET` | `/v1/workspaces/:id/collections` | List collections | 🔒 |
| `GET` | `/v1/workspaces/:id/collections/tree` | Get Tree collection | 🔒 |
| `GET` | `/v1/workspaces/:id/collections/:cid` | Get collection details | 🔒 |
| `PUT` | `/v1/workspaces/:id/collections/:cid` | Update collection | 🔒 |
| `DELETE` | `/v1/workspaces/:id/collections/:cid` | Delete collection | 🔒 |
| `PATCH` | `/v1/workspaces/:id/collections/:cid/move` | Move collection | 🔒 |

---

## Details

### POST `/v1/workspaces/:id/collections`

**Create collection**

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
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "workspace_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/collections' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/collections`

**List collections**

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
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "workspace_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/collections' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/collections/tree`

**Get Tree collection**

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
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "workspace_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/collections/tree' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/collections/:cid`

**Get collection details**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "workspace_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/collections/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/workspaces/:id/collections/:cid`

**Update collection**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "workspace_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/workspaces/1/collections/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/workspaces/:id/collections/:cid`

**Delete collection**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "workspace_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/collections/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/workspaces/:id/collections/:cid/move`

**Move collection**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "workspace_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1/collections/1/move' \
  -H 'Authorization: Bearer <token>'
```

---

