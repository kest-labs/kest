# Audit Module API

## Overview

审计日志模块用于查询项目操作日志。

- Base Path: `/v1`
- Auth: `Authorization: Bearer <token>`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/v1/projects/:id/audit-logs` | 获取项目审计日志列表 |

## Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | No | `1` | 页码 |
| `page_size` | integer | No | `20` | 每页数量 |

## Response Example

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "user_id": 12,
        "project_id": 35,
        "action": "PATCH",
        "resource": "/v1/projects/35/api-specs/50",
        "method": "PATCH",
        "path": "/v1/projects/35/api-specs/50",
        "status_code": 200,
        "duration_ms": 36,
        "ip": "127.0.0.1",
        "user_agent": "curl/8.5.0",
        "created_at": "2026-02-23T00:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```
