# History API

> Generated: 2026-05-18 23:18:16

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/workspaces/:id/history` | Create history | 🔒 |
| `GET` | `/v1/workspaces/:id/history` | List historys | 🔒 |
| `GET` | `/v1/workspaces/:id/history/:hid` | Get history details | 🔒 |

---

## Details

### POST `/v1/workspaces/:id/history`

**Create history**

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
  "action": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "data": "object",
  "diff": "object",
  "entity_id": "string",
  "entity_type": "string",
  "id": "string",
  "message": "string",
  "source": "string",
  "source_event_id": "string",
  "user_id": "string",
  "workspace_id": "string"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/history' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/history`

**List historys**

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
  "action": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "data": "object",
  "diff": "object",
  "entity_id": "string",
  "entity_type": "string",
  "id": "string",
  "message": "string",
  "source": "string",
  "source_event_id": "string",
  "user_id": "string",
  "workspace_id": "string"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/history' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/history/:hid`

**Get history details**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `hid` | `integer` | Resource identifier |

#### Response

```json
{
  "action": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "data": "object",
  "diff": "object",
  "entity_id": "string",
  "entity_type": "string",
  "id": "string",
  "message": "string",
  "source": "string",
  "source_event_id": "string",
  "user_id": "string",
  "workspace_id": "string"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/history/1' \
  -H 'Authorization: Bearer <token>'
```

---

