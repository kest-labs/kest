# Importer API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/workspaces/:id/collections/import/postman` | Import Postman importer | 🔒 |

---

## Details

### POST `/v1/workspaces/:id/collections/import/postman`

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
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/collections/import/postman' \
  -H 'Authorization: Bearer <token>'
```

---

