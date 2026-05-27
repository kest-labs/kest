# Example API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/workspaces/:id/collections/:cid/requests/:rid/examples` | Create example | 🔒 |
| `GET` | `/v1/workspaces/:id/collections/:cid/requests/:rid/examples` | List examples | 🔒 |
| `GET` | `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid` | Get example details | 🔒 |
| `PUT` | `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid` | Update example | 🔒 |
| `DELETE` | `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid` | Delete example | 🔒 |
| `POST` | `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid/response` | Save Response example | 🔒 |
| `POST` | `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid/default` | Set Default example | 🔒 |

---

## Details

### POST `/v1/workspaces/:id/collections/:cid/requests/:rid/examples`

**Create example**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `examples.create` |

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
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/examples' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/collections/:cid/requests/:rid/examples`

**List examples**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `examples.list` |

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
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/examples' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid`

**Get example details**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `examples.show` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/examples/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid`

**Update example**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `examples.update` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/examples/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid`

**Delete example**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `examples.delete` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/examples/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid/response`

**Save Response example**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `examples.save_response` |

#### Request Body

```json
{
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `response_status` | `int` | ❌ | - |
| `response_headers` | `map[string]string` | ❌ | - |
| `response_body` | `string` | ❌ | - |
| `response_time` | `int64` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/examples/1/response' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"response_body": "string","response_headers": "object","response_status": 1,"response_time": 1}'
```

---

### POST `/v1/workspaces/:id/collections/:cid/requests/:rid/examples/:eid/default`

**Set Default example**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `examples.set_default` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Response

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/examples/1/default' \
  -H 'Authorization: Bearer <token>'
```

---

