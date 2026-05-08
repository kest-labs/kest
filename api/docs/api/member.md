# Member API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/members` | Require Project Role member | 🔒 |
| `PATCH` | `/v1/projects/:id/members/:uid` | Update member | 🔒 |
| `DELETE` | `/v1/projects/:id/members/:uid` | Delete member | 🔒 |

---

## Details

### GET `/v1/projects/:id/members`

**Require Project Role member**

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

### PATCH `/v1/projects/:id/members/:uid`

**Update member**

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
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/members/1' \
  -H 'Authorization: Bearer <token>'
```

---

### DELETE `/v1/projects/:id/members/:uid`

**Delete member**

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
