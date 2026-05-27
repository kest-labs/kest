# Run API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/workspaces/:id/collections/:cid/requests/:rid/run` | Run run | 🔒 |

---

## Details

### POST `/v1/workspaces/:id/collections/:cid/requests/:rid/run`

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
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/collections/1/requests/1/run' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"environment_id": null,"variables": "object"}'
```

---

