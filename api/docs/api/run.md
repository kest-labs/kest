# Run Module API

## Overview

Run 模块用于执行单个请求。

- Base Path: `/v1`
- Auth: `Authorization: Bearer <token>`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/v1/projects/:id/collections/:cid/requests/:rid/run` | 执行请求 |

## Response Example

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "status": 200,
    "duration_ms": 58,
    "headers": {
      "content-type": "application/json"
    },
    "body": {
      "id": 1,
      "username": "demo"
    }
  }
}
```
