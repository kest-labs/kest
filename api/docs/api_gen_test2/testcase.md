# Testcase API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/test-cases` | Require Project Role testcase | 🔓 |
| `POST` | `/v1/projects/:id/test-cases` | Require Project Role testcase | 🔓 |
| `GET` | `/v1/projects/:id/test-cases/:tcid` | Require Project Role testcase | 🔓 |
| `PATCH` | `/v1/projects/:id/test-cases/:tcid` | Require Project Role testcase | 🔓 |
| `DELETE` | `/v1/projects/:id/test-cases/:tcid` | Require Project Role testcase | 🔓 |
| `POST` | `/v1/projects/:id/test-cases/:tcid/duplicate` | Require Project Role testcase | 🔓 |
| `POST` | `/v1/projects/:id/test-cases/from-spec` | Require Project Role testcase | 🔓 |
| `POST` | `/v1/projects/:id/test-cases/:tcid/run` | Require Project Role testcase | 🔓 |

---

## Details

### GET `/v1/projects/:id/test-cases`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/test-cases'
```

---

### POST `/v1/projects/:id/test-cases`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/test-cases'
```

---

### GET `/v1/projects/:id/test-cases/:tcid`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid'
```

---

### PATCH `/v1/projects/:id/test-cases/:tcid`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid'
```

---

### DELETE `/v1/projects/:id/test-cases/:tcid`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid'
```

---

### POST `/v1/projects/:id/test-cases/:tcid/duplicate`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid/duplicate'
```

---

### POST `/v1/projects/:id/test-cases/from-spec`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/test-cases/from-spec'
```

---

### POST `/v1/projects/:id/test-cases/:tcid/run`

**Require Project Role testcase**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `tcid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid/run'
```

---

