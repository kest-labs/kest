# Project API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects` | Create project | 🔓 |
| `GET` | `/v1/projects` | List projects | 🔓 |
| `GET` | `/v1/projects/:id` | Get project details | 🔓 |
| `PUT` | `/v1/projects/:id` | Update project | 🔓 |
| `PATCH` | `/v1/projects/:id` | Update project | 🔓 |
| `DELETE` | `/v1/projects/:id` | Delete project | 🔓 |
| `GET` | `/v1/projects/:id/stats` | Get Stats project | 🔓 |

---

## Details

### POST `/v1/projects`

**Create project**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
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
curl -X POST 'http://localhost:8025/api/v1/v1/projects'
```

---

### GET `/v1/projects`

**List projects**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
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
curl -X GET 'http://localhost:8025/api/v1/v1/projects'
```

---

### GET `/v1/projects/:id`

**Get project details**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1'
```

---

### PUT `/v1/projects/:id`

**Update project**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1'
```

---

### PATCH `/v1/projects/:id`

**Update project**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1'
```

---

### DELETE `/v1/projects/:id`

**Delete project**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1'
```

---

### GET `/v1/projects/:id/stats`

**Get Stats project**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/stats'
```

---

