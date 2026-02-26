# Apispec API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/api-specs` | List Specs apispec | 🔓 |
| `POST` | `/v1/projects/:id/api-specs` | Create Spec apispec | 🔓 |
| `POST` | `/v1/projects/:id/api-specs/import` | Import Specs apispec | 🔓 |
| `GET` | `/v1/projects/:id/api-specs/export` | Export Specs apispec | 🔓 |
| `GET` | `/v1/projects/:id/api-specs/:sid` | Get Spec apispec | 🔓 |
| `GET` | `/v1/projects/:id/api-specs/:sid/full` | Get Spec With Examples apispec | 🔓 |
| `PATCH` | `/v1/projects/:id/api-specs/:sid` | Update Spec apispec | 🔓 |
| `DELETE` | `/v1/projects/:id/api-specs/:sid` | Delete Spec apispec | 🔓 |
| `GET` | `/v1/projects/:id/api-specs/:sid/examples` | List Examples apispec | 🔓 |
| `POST` | `/v1/projects/:id/api-specs/:sid/examples` | Create Example apispec | 🔓 |

---

## Details

### GET `/v1/projects/:id/api-specs`

**List Specs apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs'
```

---

### POST `/v1/projects/:id/api-specs`

**Create Spec apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/api-specs'
```

---

### POST `/v1/projects/:id/api-specs/import`

**Import Specs apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/api-specs/import'
```

---

### GET `/v1/projects/:id/api-specs/export`

**Export Specs apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs/export'
```

---

### GET `/v1/projects/:id/api-specs/:sid`

**Get Spec apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid'
```

---

### GET `/v1/projects/:id/api-specs/:sid/full`

**Get Spec With Examples apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid/full'
```

---

### PATCH `/v1/projects/:id/api-specs/:sid`

**Update Spec apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid'
```

---

### DELETE `/v1/projects/:id/api-specs/:sid`

**Delete Spec apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid'
```

---

### GET `/v1/projects/:id/api-specs/:sid/examples`

**List Examples apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid/examples'
```

---

### POST `/v1/projects/:id/api-specs/:sid/examples`

**Create Example apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid/examples'
```

---

