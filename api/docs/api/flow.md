# Flow API

> Generated: 2026-04-12 23:33:37

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/workspaces/:id/flows` | List Flows flow | 🔒 |
| `POST` | `/v1/workspaces/:id/flows` | Create Flow flow | 🔒 |
| `GET` | `/v1/workspaces/:id/flows/:fid` | Get Flow flow | 🔒 |
| `PATCH` | `/v1/workspaces/:id/flows/:fid` | Update Flow flow | 🔒 |
| `PUT` | `/v1/workspaces/:id/flows/:fid` | Save Flow flow | 🔒 |
| `DELETE` | `/v1/workspaces/:id/flows/:fid` | Delete Flow flow | 🔒 |
| `POST` | `/v1/workspaces/:id/flows/:fid/steps` | Create Step flow | 🔒 |
| `PATCH` | `/v1/workspaces/:id/flows/:fid/steps/:sid` | Update Step flow | 🔒 |
| `DELETE` | `/v1/workspaces/:id/flows/:fid/steps/:sid` | Delete Step flow | 🔒 |
| `POST` | `/v1/workspaces/:id/flows/:fid/edges` | Create Edge flow | 🔒 |
| `DELETE` | `/v1/workspaces/:id/flows/:fid/edges/:eid` | Delete Edge flow | 🔒 |
| `POST` | `/v1/workspaces/:id/flows/:fid/run` | Run Flow flow | 🔒 |
| `GET` | `/v1/workspaces/:id/flows/:fid/runs` | List Runs flow | 🔒 |
| `GET` | `/v1/workspaces/:id/flows/:fid/runs/:rid` | Get Run flow | 🔒 |
| `GET` | `/v1/workspaces/:id/flows/:fid/runs/:rid/events` | Execute Flow S S E flow | 🔒 |

---

## Details

### GET `/v1/workspaces/:id/flows`

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
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/flows' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/flows`

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
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/flows' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","name": "John Doe"}'
```

---

### GET `/v1/workspaces/:id/flows/:fid`

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
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/flows/1' \
  -H 'Authorization: Bearer <token>'
```

---

### PATCH `/v1/workspaces/:id/flows/:fid`

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
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1/flows/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"name": null}'
```

---

### PUT `/v1/workspaces/:id/flows/:fid`

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
curl -X PUT 'http://localhost:8025/api/v1/workspaces/1/flows/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"edges": [],"name": null,"steps": []}'
```

---

### DELETE `/v1/workspaces/:id/flows/:fid`

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
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/flows/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/flows/:fid/steps`

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
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/flows/1/steps' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"asserts": "string","body": "string","captures": "string","headers": "string","method": "string","name": "John Doe","position_x": 1,"position_y": 1,"sort_order": 1,"url": "https://example.com"}'
```

---

### PATCH `/v1/workspaces/:id/flows/:fid/steps/:sid`

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
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1/flows/1/steps/1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"asserts": null,"body": null,"captures": null,"headers": null,"method": null,"name": null,"position_x": null,"position_y": null,"sort_order": null,"url": null}'
```

---

### DELETE `/v1/workspaces/:id/flows/:fid/steps/:sid`

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
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/flows/1/steps/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/flows/:fid/edges`

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
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/flows/1/edges' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"source_step_id": 1,"target_step_id": 1,"variable_mapping": "string"}'
```

---

### DELETE `/v1/workspaces/:id/flows/:fid/edges/:eid`

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
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/flows/1/edges/1' \
  -H 'Authorization: Bearer <token>'
```

---

### POST `/v1/workspaces/:id/flows/:fid/run`

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
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/flows/1/run' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/flows/:fid/runs`

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
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/flows/1/runs' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/flows/:fid/runs/:rid`

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
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/flows/1/runs/1' \
  -H 'Authorization: Bearer <token>'
```

---

### GET `/v1/workspaces/:id/flows/:fid/runs/:rid/events`

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

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `base_url` | `string` | Optional. Override the execution base URL used to resolve relative step URLs. Must be an absolute `http` or `https` URL. |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/flows/1/runs/1/events?base_url=https%3A%2F%2Fapi.example.com' \
  -H 'Authorization: Bearer <token>'
```

---
