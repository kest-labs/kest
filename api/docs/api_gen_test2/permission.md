# Permission API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/roles` | Create Role permission | 🔓 |
| `GET` | `/v1/roles` | List Roles permission | 🔓 |
| `GET` | `/v1/roles/:id` | Get Role permission | 🔓 |
| `PUT` | `/v1/roles/:id` | Update Role permission | 🔓 |
| `DELETE` | `/v1/roles/:id` | Delete Role permission | 🔓 |
| `POST` | `/v1/roles/assign` | Assign Role permission | 🔓 |
| `POST` | `/v1/roles/remove` | Remove Role permission | 🔓 |
| `GET` | `/v1/users/:id/roles` | Get User Roles permission | 🔓 |
| `GET` | `/v1/permissions` | List Permissions permission | 🔓 |

---

## Details

### POST `/v1/roles`

**Create Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `roles.store` |

#### Request Body

```json
{
  "description": "string",
  "display_name": "John Doe",
  "is_default": true,
  "name": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✅ | Required |
| `display_name` | `string` | ❌ | - |
| `description` | `string` | ❌ | - |
| `is_default` | `bool` | ❌ | - |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/roles' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","display_name": "John Doe","is_default": true,"name": "John Doe"}'
```

---

### GET `/v1/roles`

**List Roles permission**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `roles.index` |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/roles'
```

---

### GET `/v1/roles/:id`

**Get Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `roles.show` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/roles/1'
```

---

### PUT `/v1/roles/:id`

**Update Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `roles.update` |

#### Request Body

```json
{
  "description": "string",
  "display_name": "John Doe",
  "name": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ❌ | - |
| `display_name` | `string` | ❌ | - |
| `description` | `string` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/roles/1' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","display_name": "John Doe","name": "John Doe"}'
```

---

### DELETE `/v1/roles/:id`

**Delete Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `roles.destroy` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/roles/1'
```

---

### POST `/v1/roles/assign`

**Assign Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `roles.assign` |

#### Request Body

```json
{
  "role_id": 1,
  "user_id": 1
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `user_id` | `uint` | ✅ | Required |
| `role_id` | `uint` | ✅ | Required |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/roles/assign' \
  -H 'Content-Type: application/json' \
  -d '{"role_id": 1,"user_id": 1}'
```

---

### POST `/v1/roles/remove`

**Remove Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `roles.remove` |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/roles/remove'
```

---

### GET `/v1/users/:id/roles`

**Get User Roles permission**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `users.roles` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/1/roles'
```

---

### GET `/v1/permissions`

**List Permissions permission**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `permissions.index` |

#### Response

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/permissions'
```

---

