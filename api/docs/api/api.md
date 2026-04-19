# API Documentation

> Generated: 2026-04-12 23:33:37

## Base URLs

| Environment | URL |
|-------------|-----|
| 🏠 Local | `http://localhost:8025/api/v1` |

## Authentication

Protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Overview

Total endpoints: **133**

## Table of Contents

- [Apispec](#apispec) (21 endpoints)
- [Category](#category) (6 endpoints)
- [Collection](#collection) (7 endpoints)
- [Environment](#environment) (6 endpoints)
- [Example](#example) (7 endpoints)
- [Export](#export) (1 endpoints)
- [Flow](#flow) (15 endpoints)
- [History](#history) (2 endpoints)
- [Importer](#importer) (1 endpoints)
- [Member](#member) (11 endpoints)
- [Permission](#permission) (9 endpoints)
- [Project](#project) (9 endpoints)
- [Request](#request) (7 endpoints)
- [Run](#run) (1 endpoints)
- [System](#system) (2 endpoints)
- [Testcase](#testcase) (8 endpoints)
- [User](#user) (11 endpoints)
- [Workspace](#workspace) (9 endpoints)

---

## Apispec

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/api-specs` | List Specs apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs` | Create Spec apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs/import` | Import Specs apispec | 🔒 |
| `GET` | `/v1/projects/:id/api-specs/export` | Export Specs apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs/batch-gen-doc` | Batch Gen Doc apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs/ai-drafts` | Create A I Draft apispec | 🔒 |
| `GET` | `/v1/projects/:id/api-specs/ai-drafts/:aid` | Get A I Draft apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs/ai-drafts/:aid/refine` | Refine A I Draft apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs/ai-drafts/:aid/accept` | Accept A I Draft apispec | 🔒 |
| `GET` | `/v1/projects/:id/api-specs/:sid` | Get Spec apispec | 🔒 |
| `GET` | `/v1/projects/:id/api-specs/:sid/full` | Get Spec With Examples apispec | 🔒 |
| `PATCH` | `/v1/projects/:id/api-specs/:sid` | Update Spec apispec | 🔒 |
| `DELETE` | `/v1/projects/:id/api-specs/:sid` | Delete Spec apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs/:sid/gen-doc` | Gen Doc apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs/:sid/gen-test` | Gen Test apispec | 🔒 |
| `GET` | `/v1/projects/:id/api-specs/:sid/examples` | List Examples apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs/:sid/examples` | Create Example apispec | 🔒 |
| `GET` | `/v1/projects/:id/api-specs/:sid/share` | Get Share apispec | 🔒 |
| `POST` | `/v1/projects/:id/api-specs/:sid/share` | Publish Share apispec | 🔒 |
| `DELETE` | `/v1/projects/:id/api-specs/:sid/share` | Delete Share apispec | 🔒 |
| `GET` | `/v1/public/api-spec-shares/:slug` | Get Public Share apispec | 🔓 |

### GET `/v1/projects/:id/api-specs`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/api-specs' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/api-specs`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/api-specs/import`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs/import' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/api-specs/export`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/api-specs/export' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/api-specs/batch-gen-doc`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs/batch-gen-doc' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"category_id": null,"force": true,"lang": "string"}'
```

---

### POST `/v1/projects/:id/api-specs/ai-drafts`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs/ai-drafts' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/api-specs/ai-drafts/:aid`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/api-specs/ai-drafts/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/api-specs/ai-drafts/:aid/refine`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs/ai-drafts/1/refine' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/api-specs/ai-drafts/:aid/accept`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs/ai-drafts/1/accept' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/api-specs/:sid`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/api-specs/1' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/api-specs/:sid/full`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/api-specs/1/full' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/projects/:id/api-specs/:sid`

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
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/api-specs/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/api-specs/:sid`

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
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/api-specs/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/api-specs/:sid/gen-doc`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs/1/gen-doc' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/api-specs/:sid/gen-test`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs/1/gen-test' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/api-specs/:sid/examples`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/api-specs/1/examples' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/api-specs/:sid/examples`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs/1/examples' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/api-specs/:sid/share`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/api-specs/1/share' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/api-specs/:sid/share`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/api-specs/1/share' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/api-specs/:sid/share`

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
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/api-specs/1/share' \
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

## Category

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/categories` | List categorys | 🔒 |
| `POST` | `/v1/projects/:id/categories` | Create category | 🔒 |
| `PUT` | `/v1/projects/:id/categories/sort` | Sort category | 🔒 |
| `GET` | `/v1/projects/:id/categories/:cid` | Get category details | 🔒 |
| `PATCH` | `/v1/projects/:id/categories/:cid` | Update category | 🔒 |
| `DELETE` | `/v1/projects/:id/categories/:cid` | Delete category | 🔒 |

### GET `/v1/projects/:id/categories`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/categories' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/categories`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/categories' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/projects/:id/categories/sort`

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
curl -X PUT 'http://localhost:8025/api/v1/projects/1/categories/sort' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/categories/:cid`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/categories/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/projects/:id/categories/:cid`

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
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/categories/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/categories/:cid`

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
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/categories/1' \
  -H 'Authorization: Bearer <token>'
```

---

## Collection

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections` | Create collection | 🔒 |
| `GET` | `/v1/projects/:id/collections` | List collections | 🔒 |
| `GET` | `/v1/projects/:id/collections/tree` | Get Tree collection | 🔒 |
| `GET` | `/v1/projects/:id/collections/:cid` | Get collection details | 🔒 |
| `PUT` | `/v1/projects/:id/collections/:cid` | Update collection | 🔒 |
| `DELETE` | `/v1/projects/:id/collections/:cid` | Delete collection | 🔒 |
| `PATCH` | `/v1/projects/:id/collections/:cid/move` | Move collection | 🔒 |

### POST `/v1/projects/:id/collections`

**Create collection**

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
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/collections' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/collections`

**List collections**

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
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/collections' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/collections/tree`

**Get Tree collection**

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
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/collections/tree' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/collections/:cid`

**Get collection details**

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
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/collections/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/projects/:id/collections/:cid`

**Update collection**

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
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/projects/1/collections/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/collections/:cid`

**Delete collection**

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
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/collections/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/projects/:id/collections/:cid/move`

**Move collection**

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
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/collections/1/move' \
  -H 'Authorization: Bearer <token>'
```

---

## Environment

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/environments` | Require Project Role environment | 🔒 |
| `POST` | `/v1/projects/:id/environments` | Require Project Role environment | 🔒 |
| `GET` | `/v1/projects/:id/environments/:eid` | Require Project Role environment | 🔒 |
| `PATCH` | `/v1/projects/:id/environments/:eid` | Require Project Role environment | 🔒 |
| `DELETE` | `/v1/projects/:id/environments/:eid` | Require Project Role environment | 🔒 |
| `POST` | `/v1/projects/:id/environments/:eid/duplicate` | Require Project Role environment | 🔒 |

### GET `/v1/projects/:id/environments`

**Require Project Role environment**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/environments' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/environments`

**Require Project Role environment**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/environments' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/environments/:eid`

**Require Project Role environment**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/environments/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/projects/:id/environments/:eid`

**Require Project Role environment**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/environments/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/environments/:eid`

**Require Project Role environment**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/environments/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/environments/:eid/duplicate`

**Require Project Role environment**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/environments/1/duplicate' \
  -H 'Authorization: Bearer <token>'
```

---

## Example

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/examples` | Create example | 🔒 |
| `GET` | `/v1/projects/:id/collections/:cid/requests/:rid/examples` | List examples | 🔒 |
| `GET` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid` | Get example details | 🔒 |
| `PUT` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid` | Update example | 🔒 |
| `DELETE` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid` | Delete example | 🔒 |
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/response` | Save Response example | 🔒 |
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/default` | Set Default example | 🔒 |

### POST `/v1/projects/:id/collections/:cid/requests/:rid/examples`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/examples' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/collections/:cid/requests/:rid/examples`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/examples' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/examples/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid`

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
curl -X PUT 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/examples/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid`

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
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/examples/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/response`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/examples/1/response' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"response_body": "string","response_headers": "object","response_status": 1,"response_time": 1}'
```

---

### POST `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/default`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/examples/1/default' \
  -H 'Authorization: Bearer <token>'
```

---

## Export

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/collections/:cid/export/postman` | Export Postman export | 🔒 |

### GET `/v1/projects/:id/collections/:cid/export/postman`

**Export Postman export**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `export.postman` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/collections/1/export/postman' \
  -H 'Authorization: Bearer <token>'
```

---

## Flow

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/flows` | List Flows flow | 🔒 |
| `POST` | `/v1/projects/:id/flows` | Create Flow flow | 🔒 |
| `GET` | `/v1/projects/:id/flows/:fid` | Get Flow flow | 🔒 |
| `PATCH` | `/v1/projects/:id/flows/:fid` | Update Flow flow | 🔒 |
| `PUT` | `/v1/projects/:id/flows/:fid` | Save Flow flow | 🔒 |
| `DELETE` | `/v1/projects/:id/flows/:fid` | Delete Flow flow | 🔒 |
| `POST` | `/v1/projects/:id/flows/:fid/steps` | Create Step flow | 🔒 |
| `PATCH` | `/v1/projects/:id/flows/:fid/steps/:sid` | Update Step flow | 🔒 |
| `DELETE` | `/v1/projects/:id/flows/:fid/steps/:sid` | Delete Step flow | 🔒 |
| `POST` | `/v1/projects/:id/flows/:fid/edges` | Create Edge flow | 🔒 |
| `DELETE` | `/v1/projects/:id/flows/:fid/edges/:eid` | Delete Edge flow | 🔒 |
| `POST` | `/v1/projects/:id/flows/:fid/run` | Run Flow flow | 🔒 |
| `GET` | `/v1/projects/:id/flows/:fid/runs` | List Runs flow | 🔒 |
| `GET` | `/v1/projects/:id/flows/:fid/runs/:rid` | Get Run flow | 🔒 |
| `GET` | `/v1/projects/:id/flows/:fid/runs/:rid/events` | Execute Flow S S E flow | 🔒 |

### GET `/v1/projects/:id/flows`

**List Flows flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/flows' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/flows`

**Create Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "description": "string",
  "name": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✅ | Required |
| `description` | `string` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/flows' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","name": "John Doe"}'
```

---

### GET `/v1/projects/:id/flows/:fid`

**Get Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/flows/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/projects/:id/flows/:fid`

**Update Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "description": null,
  "name": null
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `*string` | ❌ | - |
| `description` | `*string` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/flows/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"name": null}'
```

---

### PUT `/v1/projects/:id/flows/:fid`

**Save Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "description": null,
  "edges": [],
  "name": null,
  "steps": []
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `*string` | ❌ | - |
| `description` | `*string` | ❌ | - |
| `steps` | `[]CreateStepRequest` | ❌ | - |
| `edges` | `[]CreateEdgeRequest` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/projects/1/flows/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"edges": [],"name": null,"steps": []}'
```

---

### DELETE `/v1/projects/:id/flows/:fid`

**Delete Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/flows/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/flows/:fid/steps`

**Create Step flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "asserts": "string",
  "body": "string",
  "captures": "string",
  "headers": "string",
  "method": "string",
  "name": "John Doe",
  "position_x": 1,
  "position_y": 1,
  "sort_order": 1,
  "url": "https://example.com"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✅ | Required |
| `sort_order` | `int` | ❌ | - |
| `method` | `string` | ✅ | Required |
| `url` | `string` | ✅ | Required |
| `headers` | `string` | ❌ | - |
| `body` | `string` | ❌ | - |
| `captures` | `string` | ❌ | - |
| `asserts` | `string` | ❌ | - |
| `position_x` | `float64` | ❌ | - |
| `position_y` | `float64` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/flows/1/steps' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"asserts": "string","body": "string","captures": "string","headers": "string","method": "string","name": "John Doe","position_x": 1,"position_y": 1,"sort_order": 1,"url": "https://example.com"}'
```

---

### PATCH `/v1/projects/:id/flows/:fid/steps/:sid`

**Update Step flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "asserts": null,
  "body": null,
  "captures": null,
  "headers": null,
  "method": null,
  "name": null,
  "position_x": null,
  "position_y": null,
  "sort_order": null,
  "url": null
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `*string` | ❌ | - |
| `sort_order` | `*int` | ❌ | - |
| `method` | `*string` | ❌ | - |
| `url` | `*string` | ❌ | - |
| `headers` | `*string` | ❌ | - |
| `body` | `*string` | ❌ | - |
| `captures` | `*string` | ❌ | - |
| `asserts` | `*string` | ❌ | - |
| `position_x` | `*float64` | ❌ | - |
| `position_y` | `*float64` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/flows/1/steps/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"asserts": null,"body": null,"captures": null,"headers": null,"method": null,"name": null,"position_x": null,"position_y": null,"sort_order": null,"url": null}'
```

---

### DELETE `/v1/projects/:id/flows/:fid/steps/:sid`

**Delete Step flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/flows/1/steps/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/flows/:fid/edges`

**Create Edge flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "source_step_id": 1,
  "target_step_id": 1,
  "variable_mapping": "string"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `source_step_id` | `uint` | ✅ | Required |
| `target_step_id` | `uint` | ✅ | Required |
| `variable_mapping` | `string` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/flows/1/edges' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"source_step_id": 1,"target_step_id": 1,"variable_mapping": "string"}'
```

---

### DELETE `/v1/projects/:id/flows/:fid/edges/:eid`

**Delete Edge flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/flows/1/edges/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/flows/:fid/run`

**Run Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/flows/1/run' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/flows/:fid/runs`

**List Runs flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/flows/1/runs' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/flows/:fid/runs/:rid`

**Get Run flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/flows/1/runs/1' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/flows/:fid/runs/:rid/events`

**Execute Flow S S E flow**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/flows/1/runs/1/events' \
  -H 'Authorization: Bearer <token>'
```

---

## History

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/history` | List historys | 🔒 |
| `GET` | `/v1/projects/:id/history/:hid` | Get history details | 🔒 |

### GET `/v1/projects/:id/history`

**List historys**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `history.list` |

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
  "entity_id": 1,
  "entity_type": "string",
  "id": 1,
  "message": "string",
  "project_id": 1,
  "user_id": 1
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/history' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/history/:hid`

**Get history details**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `history.show` |

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
  "entity_id": 1,
  "entity_type": "string",
  "id": 1,
  "message": "string",
  "project_id": 1,
  "user_id": 1
}
```

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/history/1' \
  -H 'Authorization: Bearer <token>'
```

---

## Importer

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/import/postman` | Import Postman importer | 🔒 |

### POST `/v1/projects/:id/collections/import/postman`

**Import Postman importer**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `importer.postman` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/collections/import/postman' \
  -H 'Authorization: Bearer <token>'
```

---

## Member

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/members` | List project members | 🔒 |
| `GET` | `/v1/projects/:id/members/me` | Get current user project role | 🔒 |
| `POST` | `/v1/projects/:id/members` | Add project member directly | 🔒 |
| `PATCH` | `/v1/projects/:id/members/:uid` | Update project member role | 🔒 |
| `DELETE` | `/v1/projects/:id/members/:uid` | Remove project member | 🔒 |
| `POST` | `/v1/projects/:id/invitations` | Create project invite link | 🔒 |
| `GET` | `/v1/projects/:id/invitations` | List project invite links | 🔒 |
| `DELETE` | `/v1/projects/:id/invitations/:inviteId` | Revoke project invite link | 🔒 |
| `GET` | `/v1/project-invitations/:slug` | Get public project invitation | 🔓 |
| `POST` | `/v1/project-invitations/:slug/accept` | Accept project invitation | 🔒 |
| `POST` | `/v1/project-invitations/:slug/reject` | Reject project invitation | 🔒 |

### GET `/v1/projects/:id/members`

**List project members**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/members' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/members/me`

**Get current user project role**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/members/me' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/members`

**Add project member directly**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "role": "read",
  "user_id": 2
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `user_id` | `uint` | ✅ | Target user ID |
| `role` | `string` | ✅ | One of `owner/admin/write/read` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/members' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"role":"read","user_id":2}'
```

---

### PATCH `/v1/projects/:id/members/:uid`

**Update project member role**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "role": "write"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `role` | `string` | ✅ | One of `owner/admin/write/read` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `uid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/members/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"role":"write"}'
```

---

### DELETE `/v1/projects/:id/members/:uid`

**Remove project member**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `uid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/members/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/invitations`

**Create project invite link**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "expires_at": "2026-05-01T00:00:00Z",
  "max_uses": 1,
  "role": "read"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `role` | `string` | ✅ | One of `admin/write/read` |
| `expires_at` | `*time.Time` | ❌ | Expiration time in RFC3339 format |
| `max_uses` | `*int` | ❌ | `0` means unlimited uses |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/invitations' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"expires_at":"2026-05-01T00:00:00Z","max_uses":1,"role":"read"}'
```

---

### GET `/v1/projects/:id/invitations`

**List project invite links**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/invitations' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/invitations/:inviteId`

**Revoke project invite link**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `inviteId` | `integer` | Invitation identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/invitations/1' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/project-invitations/:slug`

**Get public project invitation**

| Property | Value |
|----------|-------|
| Auth | 🔓 Public |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Invitation slug |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/project-invitations/pji_example'
```

---

### POST `/v1/project-invitations/:slug/accept`

**Accept project invitation**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Invitation slug |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/project-invitations/pji_example/accept' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/project-invitations/:slug/reject`

**Reject project invitation**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Invitation slug |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/project-invitations/pji_example/reject' \
  -H 'Authorization: Bearer <token>'
```

---

## Permission

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/roles` | Create Role permission | 🔒 |
| `GET` | `/v1/roles` | List Roles permission | 🔒 |
| `GET` | `/v1/roles/:id` | Get Role permission | 🔒 |
| `PUT` | `/v1/roles/:id` | Update Role permission | 🔒 |
| `DELETE` | `/v1/roles/:id` | Delete Role permission | 🔒 |
| `POST` | `/v1/roles/assign` | Assign Role permission | 🔒 |
| `POST` | `/v1/roles/remove` | Remove Role permission | 🔒 |
| `GET` | `/v1/users/:id/roles` | Get User Roles permission | 🔒 |
| `GET` | `/v1/permissions` | List Permissions permission | 🔒 |

### POST `/v1/roles`

**Create Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X POST 'http://localhost:8025/api/v1/roles' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","display_name": "John Doe","is_default": true,"name": "John Doe"}'
```

---

### GET `/v1/roles`

**List Roles permission**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X GET 'http://localhost:8025/api/v1/roles' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/roles/:id`

**Get Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X GET 'http://localhost:8025/api/v1/roles/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/roles/:id`

**Update Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X PUT 'http://localhost:8025/api/v1/roles/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","display_name": "John Doe","name": "John Doe"}'
```

---

### DELETE `/v1/roles/:id`

**Delete Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X DELETE 'http://localhost:8025/api/v1/roles/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/roles/assign`

**Assign Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X POST 'http://localhost:8025/api/v1/roles/assign' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"role_id": 1,"user_id": 1}'
```

---

### POST `/v1/roles/remove`

**Remove Role permission**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X POST 'http://localhost:8025/api/v1/roles/remove' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/users/:id/roles`

**Get User Roles permission**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X GET 'http://localhost:8025/api/v1/users/1/roles' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/permissions`

**List Permissions permission**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X GET 'http://localhost:8025/api/v1/permissions' \
  -H 'Authorization: Bearer <token>'
```

---

## Project

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects` | Create project | 🔒 |
| `GET` | `/v1/projects` | List projects | 🔒 |
| `GET` | `/v1/projects/:id` | Get project details | 🔒 |
| `PUT` | `/v1/projects/:id` | Update project | 🔒 |
| `PATCH` | `/v1/projects/:id` | Update project | 🔒 |
| `DELETE` | `/v1/projects/:id` | Delete project | 🔒 |
| `GET` | `/v1/projects/:id/stats` | Get Stats project | 🔒 |
| `POST` | `/v1/projects/:id/cli-tokens` | Generate C L I Token project | 🔒 |
| `POST` | `/v1/projects/:id/cli/spec-sync` | Sync Specs From C L I project | 🔓 |

### POST `/v1/projects`

**Create project**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X POST 'http://localhost:8025/api/v1/projects' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects`

**List projects**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
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
curl -X GET 'http://localhost:8025/api/v1/projects' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id`

**Get project details**

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
curl -X GET 'http://localhost:8025/api/v1/projects/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/projects/:id`

**Update project**

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
curl -X PUT 'http://localhost:8025/api/v1/projects/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/projects/:id`

**Update project**

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
curl -X PATCH 'http://localhost:8025/api/v1/projects/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id`

**Delete project**

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
curl -X DELETE 'http://localhost:8025/api/v1/projects/1' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/stats`

**Get Stats project**

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/stats' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/cli-tokens`

**Generate C L I Token project**

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/cli-tokens' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/cli/spec-sync`

**Sync Specs From C L I project**

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/cli/spec-sync'
```

---

## Request

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/:cid/requests` | Create request | 🔒 |
| `GET` | `/v1/projects/:id/collections/:cid/requests` | List requests | 🔒 |
| `GET` | `/v1/projects/:id/collections/:cid/requests/:rid` | Get request details | 🔒 |
| `PUT` | `/v1/projects/:id/collections/:cid/requests/:rid` | Update request | 🔒 |
| `DELETE` | `/v1/projects/:id/collections/:cid/requests/:rid` | Delete request | 🔒 |
| `PATCH` | `/v1/projects/:id/collections/:cid/requests/:rid/move` | Move request | 🔒 |
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/rollback` | Rollback request | 🔒 |

### POST `/v1/projects/:id/collections/:cid/requests`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/collections/1/requests' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/collections/:cid/requests`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/collections/1/requests' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/collections/:cid/requests/:rid`

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
curl -X GET 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/projects/:id/collections/:cid/requests/:rid`

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
curl -X PUT 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/collections/:cid/requests/:rid`

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
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/projects/:id/collections/:cid/requests/:rid/move`

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
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/move' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/collections/:cid/requests/:rid/rollback`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/rollback' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"version_id": 1}'
```

---

## Run

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/run` | Run run | 🔒 |

### POST `/v1/projects/:id/collections/:cid/requests/:rid/run`

**Run run**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Request Body

```json
{
  "environment_id": null,
  "variables": "object"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `environment_id` | `*uint` | ❌ | - |
| `variables` | `map[string]string` | ❌ | - |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/collections/1/requests/1/run' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"environment_id": null,"variables": "object"}'
```

---

## System

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/system-features` | Get System Features system | 🔓 |
| `GET` | `/v1/setup-status` | Get Setup Status system | 🔓 |

### GET `/v1/system-features`

**Get System Features system**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/system-features'
```

---

### GET `/v1/setup-status`

**Get Setup Status system**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/setup-status'
```

---

## Testcase

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/test-cases` | Require Project Role testcase | 🔒 |
| `POST` | `/v1/projects/:id/test-cases` | Require Project Role testcase | 🔒 |
| `GET` | `/v1/projects/:id/test-cases/:tcid` | Require Project Role testcase | 🔒 |
| `PATCH` | `/v1/projects/:id/test-cases/:tcid` | Require Project Role testcase | 🔒 |
| `DELETE` | `/v1/projects/:id/test-cases/:tcid` | Require Project Role testcase | 🔒 |
| `POST` | `/v1/projects/:id/test-cases/:tcid/duplicate` | Require Project Role testcase | 🔒 |
| `POST` | `/v1/projects/:id/test-cases/from-spec` | Require Project Role testcase | 🔒 |
| `POST` | `/v1/projects/:id/test-cases/:tcid/run` | Require Project Role testcase | 🔒 |

### GET `/v1/projects/:id/test-cases`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/test-cases' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/test-cases`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/test-cases' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/projects/:id/test-cases/:tcid`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/test-cases/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/projects/:id/test-cases/:tcid`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/test-cases/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/test-cases/:tcid`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/test-cases/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/test-cases/:tcid/duplicate`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/test-cases/1/duplicate' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/test-cases/from-spec`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/test-cases/from-spec' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/projects/:id/test-cases/:tcid/run`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/projects/1/test-cases/1/run' \
  -H 'Authorization: Bearer <token>'
```

---

## User

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/register` | Register new user | 🔓 |
| `POST` | `/v1/login` | user login | 🔓 |
| `POST` | `/v1/password/reset` | Reset password | 🔓 |
| `GET` | `/v1/users/profile` | Get current user profile | 🔒 |
| `PUT` | `/v1/users/profile` | Update current user profile | 🔒 |
| `PUT` | `/v1/users/password` | Change password | 🔒 |
| `DELETE` | `/v1/users/account` | Delete account | 🔒 |
| `GET` | `/v1/users` | List users | 🔒 |
| `GET` | `/v1/users/search` | Search Users user | 🔒 |
| `GET` | `/v1/users/:id` | Get user details | 🔒 |
| `GET` | `/v1/users/:id/info` | Get User Info user | 🔒 |

### POST `/v1/register`

**Register new user**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `auth.register` |

#### Request Body

```json
{
  "email": "user@example.com",
  "nickname": "John Doe",
  "password": "********",
  "phone": "+1234567890",
  "username": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `username` | `string` | ✅ | Required, Min: 3, Max: 50 |
| `password` | `string` | ✅ | Required, Min: 6, Max: 50 |
| `email` | `string` | ✅ | Required, Email format |
| `nickname` | `string` | ❌ | Max: 50 |
| `phone` | `string` | ❌ | Max: 20 |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/register' \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com","nickname": "John Doe","password": "********","phone": "+1234567890","username": "John Doe"}'
```

---

### POST `/v1/login`

**user login**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `auth.login` |

#### Request Body

```json
{
  "password": "********",
  "username": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `username` | `string` | ✅ | Required |
| `password` | `string` | ✅ | Required |

#### Response

```json
{
  "access_token": "string",
  "user": null
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/login' \
  -H 'Content-Type: application/json' \
  -d '{"password": "********","username": "John Doe"}'
```

---

### POST `/v1/password/reset`

**Reset password**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `auth.password.reset` |

#### Request Body

```json
{
  "email": "user@example.com"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `email` | `string` | ✅ | Required, Email format |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/password/reset' \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com"}'
```

---

### GET `/v1/users/profile`

**Get current user profile**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `users.profile` |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/users/profile' \
  -H 'Authorization: Bearer <token>'
```

---

### PUT `/v1/users/profile`

**Update current user profile**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `users.profile.update` |

#### Request Body

```json
{
  "avatar": "https://example.com/avatar.jpg",
  "bio": "string",
  "nickname": "John Doe",
  "phone": "+1234567890"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `nickname` | `string` | ❌ | Max: 50 |
| `avatar` | `string` | ❌ | Max: 255 |
| `phone` | `string` | ❌ | Max: 20 |
| `bio` | `string` | ❌ | Max: 500 |

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/users/profile' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"avatar": "https://example.com/avatar.jpg","bio": "string","nickname": "John Doe","phone": "+1234567890"}'
```

---

### PUT `/v1/users/password`

**Change password**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `users.password.update` |

#### Request Body

```json
{
  "new_password": "********",
  "old_password": "********"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `old_password` | `string` | ✅ | Required |
| `new_password` | `string` | ✅ | Required, Min: 6, Max: 50 |

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/users/password' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"new_password": "********","old_password": "********"}'
```

---

### DELETE `/v1/users/account`

**Delete account**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `users.account.delete` |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/users/account' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/users`

**List users**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `users.index` |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/users' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/users/search`

**Search Users user**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `users.search` |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/users/search' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/users/:id`

**Get user details**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `users.show` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/users/1' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/users/:id/info`

**Get User Info user**

| Property | Value |
|----------|-------|
| Auth | 🔒 JWT Required |
| Route Name | `users.info` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/users/1/info' \
  -H 'Authorization: Bearer <token>'
```

---

## Workspace

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
| `role` | `string` | ✅ | Required, One of: owner admin editor viewer |

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
| `role` | `string` | ✅ | Required, One of: owner admin editor viewer |

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
