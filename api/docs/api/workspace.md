# Workspace API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/workspaces` | Create Workspace workspace | 🔒 |
| `GET` | `/v1/workspaces` | List Workspaces workspace | 🔒 |
| `GET` | `/v1/workspaces/:id` | Get Workspace workspace | 🔒 |
| `PATCH` | `/v1/workspaces/:id` | Update Workspace workspace | 🔒 |
| `DELETE` | `/v1/workspaces/:id` | Delete Workspace workspace | 🔒 |
| `POST` | `/v1/workspaces/:id/members` | Add Member workspace | 🔒 |
| `GET` | `/v1/workspaces/:id/members` | List Members workspace | 🔒 |
| `PATCH` | `/v1/workspaces/:id/members/:uid` | Update Member Role workspace | 🔒 |
| `DELETE` | `/v1/workspaces/:id/members/:uid` | Remove Member workspace | 🔒 |
| `POST` | `/v1/workspaces/:id/cli-tokens` | Generate C L I Token workspace | 🔒 |
| `GET` | `/v1/workspaces/:id/cli-tokens` | List C L I Tokens workspace | 🔒 |

---

## Details

### POST `/v1/workspaces`

**Create Workspace workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.create` |

#### Request Body

```json
{
  "description": "string",
  "name": "John Doe",
  "slug": "string",
  "type": "string",
  "visibility": "string"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✅ | Required, Max: 100 |
| `slug` | `string` | ✅ | Required, Max: 50 |
| `description` | `string` | ❌ | Max: 500 |
| `type` | `string` | ✅ | Required, One of: personal team public |
| `visibility` | `string` | ❌ | One of: private team public |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","name": "John Doe","slug": "string","type": "string","visibility": "string"}'
```

---

### GET `/v1/workspaces`

**List Workspaces workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.index` |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id`

**Get Workspace workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.show` |

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
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/workspaces/:id`

**Update Workspace workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.update` |

#### Request Body

```json
{
  "description": null,
  "name": null,
  "visibility": null
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `*string` | ❌ | Optional, Max: 100 |
| `description` | `*string` | ❌ | Optional, Max: 500 |
| `visibility` | `*string` | ❌ | Optional, One of: private team public |

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
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"name": null,"visibility": null}'
```

---

### DELETE `/v1/workspaces/:id`

**Delete Workspace workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.delete` |

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
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/members`

**Add Member workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.members.add` |

#### Request Body

```json
{
  "role": "string",
  "user_id": 1
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `user_id` | `uint` | ✅ | Required |
| `role` | `string` | ✅ | Required, One of: owner admin write read |

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
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/members' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"role": "string","user_id": 1}'
```

---

### GET `/v1/workspaces/:id/members`

**List Members workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.members.list` |

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
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/members' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/workspaces/:id/members/:uid`

**Update Member Role workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.members.update` |

#### Request Body

```json
{
  "role": "string"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `role` | `string` | ✅ | Required, One of: owner admin write read |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `uid` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1/members/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"role": "string"}'
```

---

### DELETE `/v1/workspaces/:id/members/:uid`

**Remove Member workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.members.remove` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `uid` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/members/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/cli-tokens`

**Generate C L I Token workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.cli_tokens.create` |

#### Request Body

```json
{
  "expires_at": null,
  "name": "Workspace CLI sync",
  "scopes": ["collection:read", "collection:run"]
}
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "token": "kest_pat_...",
  "token_type": "bearer",
  "workspace_id": "1",
  "token_info": {
    "id": "string",
    "workspace_id": "1",
    "name": "Workspace CLI sync",
    "token_prefix": "kest_pat_...",
    "scopes": ["collection:read", "collection:run"],
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/cli-tokens' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Workspace CLI sync","scopes":["collection:read","collection:run"]}'
```

---

### GET `/v1/workspaces/:id/cli-tokens`

**List C L I Tokens workspace**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `workspaces.cli_tokens.list` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
[
  {
    "id": "string",
    "workspace_id": "1",
    "name": "Workspace CLI sync",
    "token_prefix": "kest_pat_...",
    "scopes": ["collection:read", "collection:run"],
    "last_used_at": null,
    "expires_at": null,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/cli-tokens' \
  -H 'Authorization: Bearer <token>'
```

---
