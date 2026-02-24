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

---

## POST /v1/projects/:id/collections

创建项目下的集合（目录）。

### Request Headers

| Header | Required | Description |
| --- | --- | --- |
| Authorization | Yes | `Bearer <token>` |
| Content-Type | Yes | `application/json` |

### Path Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| id | integer | Yes | 项目 ID |

### Request Body

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| name | string | Yes | `required,min=1,max=100` | 集合名称 |
| description | string | No | `max=500` | 集合描述 |
| parent_id | integer \| null | No | - | 父集合 ID，不传表示根节点 |
| is_folder | boolean | No | - | 是否文件夹，默认建议传 `true` |
| sort_order | integer | No | - | 同级排序值 |

### Request Example

```json
{
  "name": "User APIs",
  "description": "User related API collection",
  "parent_id": null,
  "is_folder": true,
  "sort_order": 1
}
```

### Success Response (201)

```json
{
  "code": 0,
  "message": "created",
  "data": {
    "id": 12,
    "name": "User APIs",
    "description": "User related API collection",
    "project_id": 1001,
    "parent_id": null,
    "is_folder": true,
    "sort_order": 1,
    "created_at": "2026-02-23T23:56:00Z",
    "updated_at": "2026-02-23T23:56:00Z"
  }
}
```

### Error Responses

#### 400 Bad Request（参数错误）

```json
{
  "code": 400,
  "message": "invalid request",
  "data": null
}
```

#### 400 Bad Request（父节点非法）

```json
{
  "code": 400,
  "message": "invalid parent collection",
  "data": null
}
```

#### 401 Unauthorized（未登录）

```json
{
  "code": 401,
  "message": "unauthorized",
  "data": null
}
```

#### 500 Internal Server Error（服务内部错误）

```json
{
  "code": 500,
  "message": "internal server error",
  "data": null
}
```

### Notes

- 当前创建接口返回结构为统一响应包装：`code + message + data`。
- 其中 `data` 对应 `CollectionResponse` 字段。
- 该接口由 `POST /projects/:id/collections` 提供，见 @api/internal/modules/collection/routes.go#13-13。
