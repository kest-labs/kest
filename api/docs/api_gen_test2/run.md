# Run API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/run` | Run run | 🔓 |

---

## Details

### POST `/v1/projects/:id/collections/:cid/requests/:rid/run`

**Run run**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `run.execute` |

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
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/run' \
  -H 'Content-Type: application/json' \
  -d '{"environment_id": null,"variables": "object"}'
```

---

