# Collection API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections` | Create collection | 🔓 |
| `GET` | `/v1/projects/:id/collections` | List collections | 🔓 |
| `GET` | `/v1/projects/:id/collections/tree` | Get Tree collection | 🔓 |
| `GET` | `/v1/projects/:id/collections/:cid` | Get collection details | 🔓 |
| `PUT` | `/v1/projects/:id/collections/:cid` | Update collection | 🔓 |
| `DELETE` | `/v1/projects/:id/collections/:cid` | Delete collection | 🔓 |
| `PATCH` | `/v1/projects/:id/collections/:cid/move` | Move collection | 🔓 |

---

## Details

### POST `/v1/projects/:id/collections`

**Create collection**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `collections.create` |

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
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections'
```

---

### GET `/v1/projects/:id/collections`

**List collections**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `collections.list` |

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
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections'
```

---

### GET `/v1/projects/:id/collections/tree`

**Get Tree collection**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `collections.tree` |

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
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/tree'
```

---

### GET `/v1/projects/:id/collections/:cid`

**Get collection details**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `collections.show` |

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
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid'
```

---

### PUT `/v1/projects/:id/collections/:cid`

**Update collection**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `collections.update` |

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
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid'
```

---

### DELETE `/v1/projects/:id/collections/:cid`

**Delete collection**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `collections.delete` |

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
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid'
```

---

### PATCH `/v1/projects/:id/collections/:cid/move`

**Move collection**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `collections.move` |

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
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/move'
```

---

