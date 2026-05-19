# Apispec API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/workspaces/:id/api-specs` | List Specs apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs` | Create Spec apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs/import` | Import Specs apispec | 🔒 |
| `GET` | `/v1/workspaces/:id/api-specs/export` | Export Specs apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs/batch-gen-doc` | Batch Gen Doc apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs/ai-drafts` | Create A I Draft apispec | 🔒 |
| `GET` | `/v1/workspaces/:id/api-specs/ai-drafts/:aid` | Get A I Draft apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs/ai-drafts/:aid/refine` | Refine A I Draft apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs/ai-drafts/:aid/accept` | Accept A I Draft apispec | 🔒 |
| `GET` | `/v1/workspaces/:id/api-specs/:sid` | Get Spec apispec | 🔒 |
| `GET` | `/v1/workspaces/:id/api-specs/:sid/full` | Get Spec With Examples apispec | 🔒 |
| `PATCH` | `/v1/workspaces/:id/api-specs/:sid` | Update Spec apispec | 🔒 |
| `DELETE` | `/v1/workspaces/:id/api-specs/:sid` | Delete Spec apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs/:sid/gen-doc` | Gen Doc apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs/:sid/gen-test` | Gen Test apispec | 🔒 |
| `GET` | `/v1/workspaces/:id/api-specs/:sid/examples` | List Examples apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs/:sid/examples` | Create Example apispec | 🔒 |
| `GET` | `/v1/workspaces/:id/api-specs/:sid/share` | Get Share apispec | 🔒 |
| `POST` | `/v1/workspaces/:id/api-specs/:sid/share` | Publish Share apispec | 🔒 |
| `DELETE` | `/v1/workspaces/:id/api-specs/:sid/share` | Delete Share apispec | 🔒 |
| `GET` | `/v1/public/api-spec-shares/:slug` | Get Public Share apispec | 🔓 |

---

## Details

### GET `/v1/workspaces/:id/api-specs`

**List Specs apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/api-specs' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/api-specs`

**Create Spec apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/api-specs/import`

**Import Specs apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs/import' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/api-specs/export`

**Export Specs apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/api-specs/export' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/api-specs/batch-gen-doc`

**Batch Gen Doc apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "category_id": null,
  "force": true,
  "lang": "string"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `category_id` | `*uint` | ❌ | - |
| `lang` | `string` | ❌ | - |
| `force` | `bool` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Response

```json
{
  "queued": 1,
  "skipped": 1,
  "total": 1
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs/batch-gen-doc' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"category_id": null,"force": true,"lang": "string"}'
```

---

### POST `/v1/workspaces/:id/api-specs/ai-drafts`

**Create A I Draft apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs/ai-drafts' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/api-specs/ai-drafts/:aid`

**Get A I Draft apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `aid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/api-specs/ai-drafts/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/api-specs/ai-drafts/:aid/refine`

**Refine A I Draft apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `aid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs/ai-drafts/1/refine' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/api-specs/ai-drafts/:aid/accept`

**Accept A I Draft apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `aid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs/ai-drafts/1/accept' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/api-specs/:sid`

**Get Spec apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/api-specs/1' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/api-specs/:sid/full`

**Get Spec With Examples apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/api-specs/1/full' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/workspaces/:id/api-specs/:sid`

**Update Spec apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1/api-specs/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/workspaces/:id/api-specs/:sid`

**Delete Spec apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/api-specs/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/api-specs/:sid/gen-doc`

**Gen Doc apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs/1/gen-doc' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/api-specs/:sid/gen-test`

**Gen Test apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs/1/gen-test' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/api-specs/:sid/examples`

**List Examples apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/api-specs/1/examples' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/api-specs/:sid/examples`

**Create Example apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs/1/examples' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/api-specs/:sid/share`

**Get Share apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/api-specs/1/share' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/api-specs/:sid/share`

**Publish Share apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/api-specs/1/share' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/workspaces/:id/api-specs/:sid/share`

**Delete Share apispec**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/api-specs/1/share' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/public/api-spec-shares/:slug`

**Get Public Share apispec**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/public/api-spec-shares/example'
```

---

