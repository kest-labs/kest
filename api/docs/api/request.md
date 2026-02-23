# Request Module API

## Overview

请求模块用于管理集合下的 API 请求定义。

- Base Path: `/v1`
- Auth: `Authorization: Bearer <token>`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/v1/projects/:id/collections/:cid/requests` | 创建请求 |
| GET | `/v1/projects/:id/collections/:cid/requests` | 获取请求列表 |
| GET | `/v1/projects/:id/collections/:cid/requests/:rid` | 获取请求详情 |
| PUT | `/v1/projects/:id/collections/:cid/requests/:rid` | 更新请求 |
| DELETE | `/v1/projects/:id/collections/:cid/requests/:rid` | 删除请求 |
| PATCH | `/v1/projects/:id/collections/:cid/requests/:rid/move` | 移动请求 |
| POST | `/v1/projects/:id/collections/:cid/requests/:rid/rollback` | 回滚请求版本 |

## Create Request Example

```json
{
  "name": "Create User",
  "method": "POST",
  "path": "/users",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "username": "test"
  }
}
```
