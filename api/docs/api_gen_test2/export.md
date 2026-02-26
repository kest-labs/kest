# Export API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/collections/:cid/export/postman` | Export Postman export | 🔓 |

---

## Details

### GET `/v1/projects/:id/collections/:cid/export/postman`

**Export Postman export**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `export.postman` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `cid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/export/postman'
```

---

