# Importer API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/import/postman` | Import Postman importer | 🔓 |

---

## Details

### POST `/v1/projects/:id/collections/import/postman`

**Import Postman importer**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `importer.postman` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections/import/postman'
```

---

