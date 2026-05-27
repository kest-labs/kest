# Category API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/workspaces/:id/categories` | List categorys | 🔒 |
| `POST` | `/v1/workspaces/:id/categories` | Create category | 🔒 |
| `PUT` | `/v1/workspaces/:id/categories/sort` | Sort category | 🔒 |
| `GET` | `/v1/workspaces/:id/categories/:cid` | Get category details | 🔒 |
| `PATCH` | `/v1/workspaces/:id/categories/:cid` | Update category | 🔒 |
| `DELETE` | `/v1/workspaces/:id/categories/:cid` | Delete category | 🔒 |

---

## Details

### GET `/v1/workspaces/:id/categories`

**List categorys**

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
  "items": [],
  "pagination": null,
  "total": 1
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/categories' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/categories`

**Create category**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/categories' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/workspaces/:id/categories/sort`

**Sort category**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/workspaces/1/categories/sort' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/categories/:cid`

**Get category details**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/categories/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/workspaces/:id/categories/:cid`

**Update category**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1/categories/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/workspaces/:id/categories/:cid`

**Delete category**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/categories/1' \
  -H 'Authorization: Bearer <token>'
```

---

