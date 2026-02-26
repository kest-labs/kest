# Category API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/categories` | List categorys | 🔓 |
| `POST` | `/v1/projects/:id/categories` | Create category | 🔓 |
| `PUT` | `/v1/projects/:id/categories/sort` | Sort category | 🔓 |
| `GET` | `/v1/projects/:id/categories/:cid` | Get category details | 🔓 |
| `PATCH` | `/v1/projects/:id/categories/:cid` | Update category | 🔓 |
| `DELETE` | `/v1/projects/:id/categories/:cid` | Delete category | 🔓 |

---

## Details

### GET `/v1/projects/:id/categories`

**List categorys**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/categories'
```

---

### POST `/v1/projects/:id/categories`

**Create category**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/categories'
```

---

### PUT `/v1/projects/:id/categories/sort`

**Sort category**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1/categories/sort'
```

---

### GET `/v1/projects/:id/categories/:cid`

**Get category details**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/categories/:cid'
```

---

### PATCH `/v1/projects/:id/categories/:cid`

**Update category**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/categories/:cid'
```

---

### DELETE `/v1/projects/:id/categories/:cid`

**Delete category**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/categories/:cid'
```

---

