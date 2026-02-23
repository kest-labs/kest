# Collection Module API

## Overview

集合（目录）模块用于管理项目下的请求分组树。

- Base Path: `/v1`
- Auth: `Authorization: Bearer <token>`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/v1/projects/:id/collections` | 创建集合 |
| GET | `/v1/projects/:id/collections` | 获取集合列表 |
| GET | `/v1/projects/:id/collections/tree` | 获取集合树 |
| GET | `/v1/projects/:id/collections/:cid` | 获取集合详情 |
| PUT | `/v1/projects/:id/collections/:cid` | 更新集合 |
| DELETE | `/v1/projects/:id/collections/:cid` | 删除集合 |
| PATCH | `/v1/projects/:id/collections/:cid/move` | 移动集合 |

## Create Request Example

```json
{
  "name": "User APIs",
  "description": "User related API collection"
}
```
