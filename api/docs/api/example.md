# Example Module API

## Overview

示例模块用于管理请求级别的请求/响应示例。

- Base Path: `/v1`
- Auth: `Authorization: Bearer <token>`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/v1/projects/:id/collections/:cid/requests/:rid/examples` | 创建示例 |
| GET | `/v1/projects/:id/collections/:cid/requests/:rid/examples` | 获取示例列表 |
| GET | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid` | 获取示例详情 |
| PUT | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid` | 更新示例 |
| DELETE | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid` | 删除示例 |
| POST | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/response` | 保存响应示例 |
| POST | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/default` | 设置默认示例 |

## Create Example Request

```json
{
  "name": "200 - success",
  "request_headers": {
    "Content-Type": "application/json"
  },
  "request_body": {
    "username": "demo"
  },
  "response_status": 200,
  "response_body": {
    "id": 1001,
    "username": "demo"
  }
}
```
