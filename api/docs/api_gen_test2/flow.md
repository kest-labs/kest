# Flow API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/flows` | List Flows flow | 🔓 |
| `POST` | `/v1/projects/:id/flows` | Create Flow flow | 🔓 |
| `GET` | `/v1/projects/:id/flows/:fid` | Get Flow flow | 🔓 |
| `PATCH` | `/v1/projects/:id/flows/:fid` | Update Flow flow | 🔓 |
| `PUT` | `/v1/projects/:id/flows/:fid` | Save Flow flow | 🔓 |
| `DELETE` | `/v1/projects/:id/flows/:fid` | Delete Flow flow | 🔓 |
| `POST` | `/v1/projects/:id/flows/:fid/steps` | Create Step flow | 🔓 |
| `PATCH` | `/v1/projects/:id/flows/:fid/steps/:sid` | Update Step flow | 🔓 |
| `DELETE` | `/v1/projects/:id/flows/:fid/steps/:sid` | Delete Step flow | 🔓 |
| `POST` | `/v1/projects/:id/flows/:fid/edges` | Create Edge flow | 🔓 |
| `DELETE` | `/v1/projects/:id/flows/:fid/edges/:eid` | Delete Edge flow | 🔓 |
| `POST` | `/v1/projects/:id/flows/:fid/run` | Run Flow flow | 🔓 |
| `GET` | `/v1/projects/:id/flows/:fid/runs` | List Runs flow | 🔓 |
| `GET` | `/v1/projects/:id/flows/:fid/runs/:rid` | Get Run flow | 🔓 |
| `GET` | `/v1/projects/:id/flows/:fid/runs/:rid/events` | Execute Flow S S E flow | 🔓 |

---

## Details

### GET `/v1/projects/:id/flows`

**List Flows flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows'
```

---

### POST `/v1/projects/:id/flows`

**Create Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/flows' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","name": "John Doe"}'
```

---

### GET `/v1/projects/:id/flows/:fid`

**Get Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid'
```

---

### PATCH `/v1/projects/:id/flows/:fid`

**Update Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"name": null}'
```

---

### PUT `/v1/projects/:id/flows/:fid`

**Save Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"edges": [],"name": null,"steps": []}'
```

---

### DELETE `/v1/projects/:id/flows/:fid`

**Delete Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid'
```

---

### POST `/v1/projects/:id/flows/:fid/steps`

**Create Step flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/steps' \
  -H 'Content-Type: application/json' \
  -d '{"asserts": "string","body": "string","captures": "string","headers": "string","method": "string","name": "John Doe","position_x": 1,"position_y": 1,"sort_order": 1,"url": "https://example.com"}'
```

---

### PATCH `/v1/projects/:id/flows/:fid/steps/:sid`

**Update Step flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/steps/:sid' \
  -H 'Content-Type: application/json' \
  -d '{"asserts": null,"body": null,"captures": null,"headers": null,"method": null,"name": null,"position_x": null,"position_y": null,"sort_order": null,"url": null}'
```

---

### DELETE `/v1/projects/:id/flows/:fid/steps/:sid`

**Delete Step flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |
| `sid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/steps/:sid'
```

---

### POST `/v1/projects/:id/flows/:fid/edges`

**Create Edge flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

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
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/edges' \
  -H 'Content-Type: application/json' \
  -d '{"source_step_id": 1,"target_step_id": 1,"variable_mapping": "string"}'
```

---

### DELETE `/v1/projects/:id/flows/:fid/edges/:eid`

**Delete Edge flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |
| `eid` | `integer` | Resource identifier |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/edges/:eid'
```

---

### POST `/v1/projects/:id/flows/:fid/run`

**Run Flow flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/run'
```

---

### GET `/v1/projects/:id/flows/:fid/runs`

**List Runs flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/runs'
```

---

### GET `/v1/projects/:id/flows/:fid/runs/:rid`

**Get Run flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/runs/:rid'
```

---

### GET `/v1/projects/:id/flows/:fid/runs/:rid/events`

**Execute Flow S S E flow**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |
| `fid` | `integer` | Resource identifier |
| `rid` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/runs/:rid/events'
```

---

