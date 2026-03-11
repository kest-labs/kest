# Apispec API

> Updated to match `api/internal/modules/apispec` on 2026-03-10

## Base URL

Use the API base URL plus:

```text
/v1/projects/:id/api-specs
```

All endpoints in this module require authentication and project membership.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/api-specs` | List API specs | Required |
| `POST` | `/v1/projects/:id/api-specs` | Create API spec | Required |
| `POST` | `/v1/projects/:id/api-specs/import` | Batch import API specs | Required |
| `GET` | `/v1/projects/:id/api-specs/export` | Export API specs | Required |
| `POST` | `/v1/projects/:id/api-specs/batch-gen-doc` | Batch generate docs | Required |
| `GET` | `/v1/projects/:id/api-specs/:sid` | Get API spec | Required |
| `GET` | `/v1/projects/:id/api-specs/:sid/full` | Get API spec with examples | Required |
| `PATCH` | `/v1/projects/:id/api-specs/:sid` | Update API spec | Required |
| `DELETE` | `/v1/projects/:id/api-specs/:sid` | Delete API spec | Required |
| `POST` | `/v1/projects/:id/api-specs/:sid/gen-doc` | Generate AI documentation | Required |
| `POST` | `/v1/projects/:id/api-specs/:sid/gen-test` | Generate AI test flow | Required |
| `GET` | `/v1/projects/:id/api-specs/:sid/examples` | List examples | Required |
| `POST` | `/v1/projects/:id/api-specs/:sid/examples` | Create example | Required |

---

## Data Model

### API Spec fields

- `method`: HTTP method
- `path`: endpoint path
- `summary`: short summary
- `description`: detailed description
- `version`: version label
- `tags`: string array
- `parameters`: parameter array
- `request_body`: request body schema
- `responses`: response schema map
- `is_public`: public/private flag

### Parameter shape

```json
{
  "name": "Authorization",
  "in": "header",
  "required": true,
  "schema": {
    "type": "string"
  }
}
```

Use `parameters[].in` to distinguish `query`, `header`, `path`, and `cookie`. There is no separate top-level `headers` field on the API spec resource.

### Example shape

```json
{
  "name": "Successful login",
  "request_headers": {
    "Content-Type": "application/json"
  },
  "request_body": {
    "username": "john@example.com",
    "password": "secret"
  },
  "response_status": 200,
  "response_body": {
    "code": 0,
    "data": {
      "access_token": "jwt-token"
    }
  },
  "duration_ms": 84
}
```

---

## Request Bodies

### Create API spec

```json
{
  "method": "POST",
  "path": "/api/v1/auth/login",
  "summary": "User login",
  "description": "Authenticate user and return an access token.",
  "version": "1.0.0",
  "tags": ["auth"],
  "parameters": [
    {
      "name": "X-Request-ID",
      "in": "header",
      "required": false,
      "schema": {
        "type": "string"
      }
    }
  ],
  "request_body": {
    "required": true,
    "content_type": "application/json",
    "schema": {
      "type": "object"
    }
  },
  "responses": {
    "200": {
      "description": "Login succeeded",
      "content_type": "application/json",
      "schema": {
        "type": "object"
      }
    }
  },
  "is_public": true
}
```

### Update API spec

Any subset of these fields may be sent:

- `category_id`
- `path`
- `summary`
- `description`
- `doc_markdown`
- `doc_markdown_zh`
- `doc_markdown_en`
- `doc_source`
- `tags`
- `parameters`
- `request_body`
- `responses`
- `is_public`

### Import API specs

```json
{
  "specs": [
    {
      "method": "POST",
      "path": "/api/v1/auth/login",
      "summary": "User login",
      "version": "1.0.0"
    }
  ]
}
```

### Batch generate docs

```json
{
  "category_id": 5,
  "lang": "zh",
  "force": false
}
```

### Create example

```json
{
  "name": "Successful login",
  "request_headers": {
    "Content-Type": "application/json"
  },
  "request_body": {
    "username": "john@example.com",
    "password": "secret"
  },
  "response_status": 200,
  "response_body": {
    "code": 0
  },
  "duration_ms": 84
}
```

---

## Query Parameters

### List API specs

- `page`
- `page_size`
- `version`
- `method`
- `tag`
- `keyword`

### Export API specs

- `format`: `json`, `openapi`, `swagger`, or `markdown`

### Generate doc / test

- `lang`: `en` or `zh`

---

## Example cURL

```bash
curl -X POST 'http://localhost:8025/v1/projects/1/api-specs' \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "method": "GET",
    "path": "/api/v1/users/me",
    "summary": "Get current user",
    "version": "1.0.0"
  }'
```

```bash
curl -X POST 'http://localhost:8025/v1/projects/1/api-specs/1/examples' \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Successful login",
    "response_status": 200
  }'
```
