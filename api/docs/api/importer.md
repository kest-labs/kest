# Importer Module API

## Overview

导入模块用于将 Postman Collection 导入到项目集合中。

- Base Path: `/v1`
- Auth: `Authorization: Bearer <token>`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/v1/projects/:id/collections/import/postman` | 导入 Postman Collection |

## Request

- Content-Type: `multipart/form-data`
- Form field: `file`

## Response Example

```json
{
  "code": 200,
  "message": "import success",
  "data": {
    "collections": 3,
    "requests": 26
  }
}
```
