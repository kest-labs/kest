# Request API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/workspaces/:id/collections/:cid/requests` | Create request | 🔒 |
| `GET` | `/v1/workspaces/:id/collections/:cid/requests` | List requests | 🔒 |
| `GET` | `/v1/workspaces/:id/collections/:cid/requests/:rid` | Get request details | 🔒 |
| `PUT` | `/v1/workspaces/:id/collections/:cid/requests/:rid` | Update request | 🔒 |
| `DELETE` | `/v1/workspaces/:id/collections/:cid/requests/:rid` | Delete request | 🔒 |
| `PATCH` | `/v1/workspaces/:id/collections/:cid/requests/:rid/move` | Move request | 🔒 |
| `POST` | `/v1/workspaces/:id/collections/:cid/requests/:rid/rollback` | Rollback request | 🔒 |

---

## Details

### POST `/v1/workspaces/:id/collections/:cid/requests`

**Create request**

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
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/collections/:cid/requests`

**List requests**

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
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/collections/:cid/requests/:rid`

**Get request details**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/workspaces/:id/collections/:cid/requests/:rid`

**Update request**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/workspaces/:id/collections/:cid/requests/:rid`

**Delete request**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/workspaces/:id/collections/:cid/requests/:rid/move`

**Move request**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/move' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/collections/:cid/requests/:rid/rollback`

**Rollback request**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "version_id": 1
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `version_id` | `uint` | ✅ | Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/rollback' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"version_id": 1}'
```

---

