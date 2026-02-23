# History Module API

## Overview

历史模块用于查看请求执行历史记录。

- Base Path: `/v1`
- Auth: `Authorization: Bearer <token>`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/v1/projects/:id/history` | 获取历史列表 |
| GET | `/v1/projects/:id/history/:hid` | 获取历史详情 |

## Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | 页码 |
| `page_size` | integer | No | 每页数量 |
