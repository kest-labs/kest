# Export Module API

## Overview

导出模块用于将集合导出为 Postman Collection。

- Base Path: `/v1`
- Auth: `Authorization: Bearer <token>`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/v1/projects/:id/collections/:cid/export/postman` | 导出 Postman Collection |

## Notes

- 返回 JSON 文件内容，通常用于下载。
- 可直接导入 Postman。
