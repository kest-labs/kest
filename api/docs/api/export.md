# Export API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/workspaces/:id/collections/:cid/export/postman` | Export Postman export | 🔒 |

---

## Details

### GET `/v1/workspaces/:id/collections/:cid/export/postman`

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
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/collections/1/export/postman' \
  -H 'Authorization: Bearer <token>'
```

---

