# API 文档

> 生成时间：2026-02-26 14:24:48

## 基础 URL

| 环境 | URL |
|-------------|-----|
| 🏠 本地 | `http://localhost:8025/api/v1` |

## 认证

受保护接口需要在 `Authorization` 请求头中携带 JWT 令牌：

```
Authorization: Bearer <token>
```

## 概览

接口总数：**115**

## 目录

- [API 规范（Apispec）](#apispec)（12 个接口）
- [分类（Category）](#category)（6 个接口）
- [集合（Collection）](#collection)（7 个接口）
- [环境（Environment）](#environment)（6 个接口）
- [示例（Example）](#example)（7 个接口）
- [导出（Export）](#export)（1 个接口）
- [流程（Flow）](#flow)（15 个接口）
- [历史记录（History）](#history)（2 个接口）
- [导入（Importer）](#importer)（1 个接口）
- [成员（Member）](#member)（4 个接口）
- [权限（Permission）](#permission)（9 个接口）
- [项目（Project）](#project)（7 个接口）
- [请求（Request）](#request)（7 个接口）
- [运行（Run）](#run)（1 个接口）
- [系统（System）](#system)（2 个接口）
- [测试用例（Testcase）](#testcase)（8 个接口）
- [用户（User）](#user)（11 个接口）
- [工作区（Workspace）](#workspace)（9 个接口）

---

<a id="apispec"></a>
## API 规范（Apispec）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/api-specs` | 获取 API 规范列表 | 🔓 |
| `POST` | `/v1/projects/:id/api-specs` | 创建 API 规范 | 🔓 |
| `POST` | `/v1/projects/:id/api-specs/import` | 导入 API 规范 | 🔓 |
| `GET` | `/v1/projects/:id/api-specs/export` | 导出 API 规范 | 🔓 |
| `GET` | `/v1/projects/:id/api-specs/:sid` | 获取 API 规范 | 🔓 |
| `GET` | `/v1/projects/:id/api-specs/:sid/full` | 获取包含示例的 API 规范 | 🔓 |
| `PATCH` | `/v1/projects/:id/api-specs/:sid` | 更新 API 规范 | 🔓 |
| `DELETE` | `/v1/projects/:id/api-specs/:sid` | 删除 API 规范 | 🔓 |
| `POST` | `/v1/projects/:id/api-specs/:sid/gen-doc` | 生成 API 文档 | 🔓 |
| `POST` | `/v1/projects/:id/api-specs/:sid/gen-test` | 生成测试用例 | 🔓 |
| `GET` | `/v1/projects/:id/api-specs/:sid/examples` | 获取 API 规范示例列表 | 🔓 |
| `POST` | `/v1/projects/:id/api-specs/:sid/examples` | 创建 API 规范示例 | 🔓 |

### GET `/v1/projects/:id/api-specs`

**获取 API 规范列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs'
```

---

### POST `/v1/projects/:id/api-specs`

**创建 API 规范**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/api-specs'
```

---

### POST `/v1/projects/:id/api-specs/import`

**导入 API 规范**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/api-specs/import'
```

---

### GET `/v1/projects/:id/api-specs/export`

**导出 API 规范**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs/export'
```

---

### GET `/v1/projects/:id/api-specs/:sid`

**获取 API 规范**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid'
```

---

### GET `/v1/projects/:id/api-specs/:sid/full`

**获取包含示例的 API 规范**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid/full'
```

---

### PATCH `/v1/projects/:id/api-specs/:sid`

**更新 API 规范**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid'
```

---

### DELETE `/v1/projects/:id/api-specs/:sid`

**删除 API 规范**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid'
```

---

### POST `/v1/projects/:id/api-specs/:sid/gen-doc`

**生成 API 文档**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid/gen-doc'
```

---

### POST `/v1/projects/:id/api-specs/:sid/gen-test`

**生成测试用例**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid/gen-test'
```

---

### GET `/v1/projects/:id/api-specs/:sid/examples`

**获取 API 规范示例列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid/examples'
```

---

### POST `/v1/projects/:id/api-specs/:sid/examples`

**创建 API 规范示例**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/api-specs/:sid/examples'
```

---

<a id="category"></a>
## 分类（Category）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/categories` | 获取分类列表 | 🔓 |
| `POST` | `/v1/projects/:id/categories` | 创建分类 | 🔓 |
| `PUT` | `/v1/projects/:id/categories/sort` | 分类排序 | 🔓 |
| `GET` | `/v1/projects/:id/categories/:cid` | 获取分类详情 | 🔓 |
| `PATCH` | `/v1/projects/:id/categories/:cid` | 更新分类 | 🔓 |
| `DELETE` | `/v1/projects/:id/categories/:cid` | 删除分类 | 🔓 |

### GET `/v1/projects/:id/categories`

**获取分类列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/categories'
```

---

### POST `/v1/projects/:id/categories`

**创建分类**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/categories'
```

---

### PUT `/v1/projects/:id/categories/sort`

**分类排序**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1/categories/sort'
```

---

### GET `/v1/projects/:id/categories/:cid`

**获取分类详情**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/categories/:cid'
```

---

### PATCH `/v1/projects/:id/categories/:cid`

**更新分类**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/categories/:cid'
```

---

### DELETE `/v1/projects/:id/categories/:cid`

**删除分类**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/categories/:cid'
```

---

<a id="collection"></a>
## 集合（Collection）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections` | 创建集合 | 🔓 |
| `GET` | `/v1/projects/:id/collections` | 获取集合列表 | 🔓 |
| `GET` | `/v1/projects/:id/collections/tree` | 获取集合树 | 🔓 |
| `GET` | `/v1/projects/:id/collections/:cid` | 获取集合详情 | 🔓 |
| `PUT` | `/v1/projects/:id/collections/:cid` | 更新集合 | 🔓 |
| `DELETE` | `/v1/projects/:id/collections/:cid` | 删除集合 | 🔓 |
| `PATCH` | `/v1/projects/:id/collections/:cid/move` | 移动集合 | 🔓 |

### POST `/v1/projects/:id/collections`

**创建集合**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `collections.create` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections'
```

---

### GET `/v1/projects/:id/collections`

**获取集合列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `collections.list` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections'
```

---

### GET `/v1/projects/:id/collections/tree`

**获取集合树**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `collections.tree` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/tree'
```

---

### GET `/v1/projects/:id/collections/:cid`

**获取集合详情**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `collections.show` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid'
```

---

### PUT `/v1/projects/:id/collections/:cid`

**更新集合**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `collections.update` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid'
```

---

### DELETE `/v1/projects/:id/collections/:cid`

**删除集合**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `collections.delete` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid'
```

---

### PATCH `/v1/projects/:id/collections/:cid/move`

**移动集合**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `collections.move` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "is_folder": true,
  "name": "John Doe",
  "parent_id": null,
  "project_id": 1,
  "settings": "object",
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/move'
```

---

<a id="environment"></a>
## 环境（Environment）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/environments` | 需要项目角色权限（环境） | 🔓 |
| `POST` | `/v1/projects/:id/environments` | 需要项目角色权限（环境） | 🔓 |
| `GET` | `/v1/projects/:id/environments/:eid` | 需要项目角色权限（环境） | 🔓 |
| `PATCH` | `/v1/projects/:id/environments/:eid` | 需要项目角色权限（环境） | 🔓 |
| `DELETE` | `/v1/projects/:id/environments/:eid` | 需要项目角色权限（环境） | 🔓 |
| `POST` | `/v1/projects/:id/environments/:eid/duplicate` | 需要项目角色权限（环境） | 🔓 |

### GET `/v1/projects/:id/environments`

**需要项目角色权限（环境）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/environments'
```

---

### POST `/v1/projects/:id/environments`

**需要项目角色权限（环境）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/environments'
```

---

### GET `/v1/projects/:id/environments/:eid`

**需要项目角色权限（环境）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/environments/:eid'
```

---

### PATCH `/v1/projects/:id/environments/:eid`

**需要项目角色权限（环境）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/environments/:eid'
```

---

### DELETE `/v1/projects/:id/environments/:eid`

**需要项目角色权限（环境）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/environments/:eid'
```

---

### POST `/v1/projects/:id/environments/:eid/duplicate`

**需要项目角色权限（环境）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/environments/:eid/duplicate'
```

---

<a id="example"></a>
## 示例（Example）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/examples` | 创建示例 | 🔓 |
| `GET` | `/v1/projects/:id/collections/:cid/requests/:rid/examples` | 获取示例列表 | 🔓 |
| `GET` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid` | 获取示例详情 | 🔓 |
| `PUT` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid` | 更新示例 | 🔓 |
| `DELETE` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid` | 删除示例 | 🔓 |
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/response` | 保存示例响应 | 🔓 |
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/default` | 设为默认示例 | 🔓 |

### POST `/v1/projects/:id/collections/:cid/requests/:rid/examples`

**创建示例**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `examples.create` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/examples'
```

---

### GET `/v1/projects/:id/collections/:cid/requests/:rid/examples`

**获取示例列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `examples.list` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/examples'
```

---

### GET `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid`

**获取示例详情**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `examples.show` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/examples/:eid'
```

---

### PUT `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid`

**更新示例**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `examples.update` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/examples/:eid'
```

---

### DELETE `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid`

**删除示例**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `examples.delete` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/examples/:eid'
```

---

### POST `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/response`

**保存示例响应**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `examples.save_response` |

#### 请求体

```json
{
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `response_status` | `int` | ❌ | - |
| `response_headers` | `map[string]string` | ❌ | - |
| `response_body` | `string` | ❌ | - |
| `response_time` | `int64` | ❌ | - |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/examples/:eid/response' \
  -H 'Content-Type: application/json' \
  -d '{"response_body": "string","response_headers": "object","response_status": 1,"response_time": 1}'
```

---

### POST `/v1/projects/:id/collections/:cid/requests/:rid/examples/:eid/default`

**设为默认示例**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `examples.set_default` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "is_default": true,
  "method": "string",
  "name": "John Doe",
  "query_params": [],
  "request_id": 1,
  "response_body": "string",
  "response_headers": "object",
  "response_status": 1,
  "response_time": 1,
  "sort_order": 1,
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/examples/:eid/default'
```

---

<a id="export"></a>
## 导出（Export）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/collections/:cid/export/postman` | 导出 Postman | 🔓 |

### GET `/v1/projects/:id/collections/:cid/export/postman`

**导出 Postman**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `export.postman` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/export/postman'
```

---

<a id="flow"></a>
## 流程（Flow）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/flows` | 获取流程列表 | 🔓 |
| `POST` | `/v1/projects/:id/flows` | 创建流程 | 🔓 |
| `GET` | `/v1/projects/:id/flows/:fid` | 获取流程 | 🔓 |
| `PATCH` | `/v1/projects/:id/flows/:fid` | 更新流程 | 🔓 |
| `PUT` | `/v1/projects/:id/flows/:fid` | 保存流程 | 🔓 |
| `DELETE` | `/v1/projects/:id/flows/:fid` | 删除流程 | 🔓 |
| `POST` | `/v1/projects/:id/flows/:fid/steps` | 创建流程步骤 | 🔓 |
| `PATCH` | `/v1/projects/:id/flows/:fid/steps/:sid` | 更新流程步骤 | 🔓 |
| `DELETE` | `/v1/projects/:id/flows/:fid/steps/:sid` | 删除流程步骤 | 🔓 |
| `POST` | `/v1/projects/:id/flows/:fid/edges` | 创建流程边 | 🔓 |
| `DELETE` | `/v1/projects/:id/flows/:fid/edges/:eid` | 删除流程边 | 🔓 |
| `POST` | `/v1/projects/:id/flows/:fid/run` | 运行流程 | 🔓 |
| `GET` | `/v1/projects/:id/flows/:fid/runs` | 获取流程运行列表 | 🔓 |
| `GET` | `/v1/projects/:id/flows/:fid/runs/:rid` | 获取流程运行记录 | 🔓 |
| `GET` | `/v1/projects/:id/flows/:fid/runs/:rid/events` | 执行流程 SSE 事件流 | 🔓 |

### GET `/v1/projects/:id/flows`

**获取流程列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows'
```

---

### POST `/v1/projects/:id/flows`

**创建流程**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 请求体

```json
{
  "description": "string",
  "name": "John Doe"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `name` | `string` | ✅ | 必填 |
| `description` | `string` | ❌ | - |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/flows' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","name": "John Doe"}'
```

---

### GET `/v1/projects/:id/flows/:fid`

**获取流程**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid'
```

---

### PATCH `/v1/projects/:id/flows/:fid`

**更新流程**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 请求体

```json
{
  "description": null,
  "name": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `name` | `*string` | ❌ | - |
| `description` | `*string` | ❌ | - |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"name": null}'
```

---

### PUT `/v1/projects/:id/flows/:fid`

**保存流程**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 请求体

```json
{
  "description": null,
  "edges": [],
  "name": null,
  "steps": []
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `name` | `*string` | ❌ | - |
| `description` | `*string` | ❌ | - |
| `steps` | `[]CreateStepRequest` | ❌ | - |
| `edges` | `[]CreateEdgeRequest` | ❌ | - |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"edges": [],"name": null,"steps": []}'
```

---

### DELETE `/v1/projects/:id/flows/:fid`

**删除流程**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid'
```

---

### POST `/v1/projects/:id/flows/:fid/steps`

**创建流程步骤**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 请求体

```json
{
  "asserts": "string",
  "body": "string",
  "captures": "string",
  "headers": "string",
  "method": "string",
  "name": "John Doe",
  "position_x": 1,
  "position_y": 1,
  "sort_order": 1,
  "url": "https://example.com"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `name` | `string` | ✅ | 必填 |
| `sort_order` | `int` | ❌ | - |
| `method` | `string` | ✅ | 必填 |
| `url` | `string` | ✅ | 必填 |
| `headers` | `string` | ❌ | - |
| `body` | `string` | ❌ | - |
| `captures` | `string` | ❌ | - |
| `asserts` | `string` | ❌ | - |
| `position_x` | `float64` | ❌ | - |
| `position_y` | `float64` | ❌ | - |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/steps' \
  -H 'Content-Type: application/json' \
  -d '{"asserts": "string","body": "string","captures": "string","headers": "string","method": "string","name": "John Doe","position_x": 1,"position_y": 1,"sort_order": 1,"url": "https://example.com"}'
```

---

### PATCH `/v1/projects/:id/flows/:fid/steps/:sid`

**更新流程步骤**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 请求体

```json
{
  "asserts": null,
  "body": null,
  "captures": null,
  "headers": null,
  "method": null,
  "name": null,
  "position_x": null,
  "position_y": null,
  "sort_order": null,
  "url": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `name` | `*string` | ❌ | - |
| `sort_order` | `*int` | ❌ | - |
| `method` | `*string` | ❌ | - |
| `url` | `*string` | ❌ | - |
| `headers` | `*string` | ❌ | - |
| `body` | `*string` | ❌ | - |
| `captures` | `*string` | ❌ | - |
| `asserts` | `*string` | ❌ | - |
| `position_x` | `*float64` | ❌ | - |
| `position_y` | `*float64` | ❌ | - |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/steps/:sid' \
  -H 'Content-Type: application/json' \
  -d '{"asserts": null,"body": null,"captures": null,"headers": null,"method": null,"name": null,"position_x": null,"position_y": null,"sort_order": null,"url": null}'
```

---

### DELETE `/v1/projects/:id/flows/:fid/steps/:sid`

**删除流程步骤**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |
| `sid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/steps/:sid'
```

---

### POST `/v1/projects/:id/flows/:fid/edges`

**创建流程边**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 请求体

```json
{
  "source_step_id": 1,
  "target_step_id": 1,
  "variable_mapping": "string"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `source_step_id` | `uint` | ✅ | 必填 |
| `target_step_id` | `uint` | ✅ | 必填 |
| `variable_mapping` | `string` | ❌ | - |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/edges' \
  -H 'Content-Type: application/json' \
  -d '{"source_step_id": 1,"target_step_id": 1,"variable_mapping": "string"}'
```

---

### DELETE `/v1/projects/:id/flows/:fid/edges/:eid`

**删除流程边**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |
| `eid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/edges/:eid'
```

---

### POST `/v1/projects/:id/flows/:fid/run`

**运行流程**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/run'
```

---

### GET `/v1/projects/:id/flows/:fid/runs`

**获取流程运行列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/runs'
```

---

### GET `/v1/projects/:id/flows/:fid/runs/:rid`

**获取流程运行记录**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/runs/:rid'
```

---

### GET `/v1/projects/:id/flows/:fid/runs/:rid/events`

**执行流程 SSE 事件流**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `fid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/flows/:fid/runs/:rid/events'
```

---

<a id="history"></a>
## 历史记录（History）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/history` | 获取历史记录列表 | 🔓 |
| `GET` | `/v1/projects/:id/history/:hid` | 获取历史详情 | 🔓 |

### GET `/v1/projects/:id/history`

**获取历史记录列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `history.list` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "action": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "data": "object",
  "diff": "object",
  "entity_id": 1,
  "entity_type": "string",
  "id": 1,
  "message": "string",
  "project_id": 1,
  "user_id": 1
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/history'
```

---

### GET `/v1/projects/:id/history/:hid`

**获取历史详情**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `history.show` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `hid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "action": "string",
  "created_at": "2024-01-01T00:00:00Z",
  "data": "object",
  "diff": "object",
  "entity_id": 1,
  "entity_type": "string",
  "id": 1,
  "message": "string",
  "project_id": 1,
  "user_id": 1
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/history/:hid'
```

---

<a id="importer"></a>
## 导入（Importer）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/import/postman` | 导入 Postman | 🔓 |

### POST `/v1/projects/:id/collections/import/postman`

**导入 Postman**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `importer.postman` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections/import/postman'
```

---

<a id="member"></a>
## 成员（Member）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/members` | 需要项目角色权限（成员） | 🔓 |
| `POST` | `/v1/projects/:id/members` | 添加成员 | 🔓 |
| `PATCH` | `/v1/projects/:id/members/:uid` | 更新成员 | 🔓 |
| `DELETE` | `/v1/projects/:id/members/:uid` | 删除成员 | 🔓 |

### GET `/v1/projects/:id/members`

**需要项目角色权限（成员）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/members'
```

---

### POST `/v1/projects/:id/members`

**添加成员**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/members'
```

---

### PATCH `/v1/projects/:id/members/:uid`

**更新成员**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `uid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/members/:uid'
```

---

### DELETE `/v1/projects/:id/members/:uid`

**删除成员**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `uid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/members/:uid'
```

---

<a id="permission"></a>
## 权限（Permission）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `POST` | `/v1/roles` | 创建角色 | 🔓 |
| `GET` | `/v1/roles` | 获取角色列表 | 🔓 |
| `GET` | `/v1/roles/:id` | 获取角色 | 🔓 |
| `PUT` | `/v1/roles/:id` | 更新角色 | 🔓 |
| `DELETE` | `/v1/roles/:id` | 删除角色 | 🔓 |
| `POST` | `/v1/roles/assign` | 分配角色 | 🔓 |
| `POST` | `/v1/roles/remove` | 移除角色 | 🔓 |
| `GET` | `/v1/users/:id/roles` | 获取用户角色 | 🔓 |
| `GET` | `/v1/permissions` | 获取权限列表 | 🔓 |

### POST `/v1/roles`

**创建角色**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `roles.store` |

#### 请求体

```json
{
  "description": "string",
  "display_name": "John Doe",
  "is_default": true,
  "name": "John Doe"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `name` | `string` | ✅ | 必填 |
| `display_name` | `string` | ❌ | - |
| `description` | `string` | ❌ | - |
| `is_default` | `bool` | ❌ | - |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/roles' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","display_name": "John Doe","is_default": true,"name": "John Doe"}'
```

---

### GET `/v1/roles`

**获取角色列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `roles.index` |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/roles'
```

---

### GET `/v1/roles/:id`

**获取角色**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `roles.show` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/roles/1'
```

---

### PUT `/v1/roles/:id`

**更新角色**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `roles.update` |

#### 请求体

```json
{
  "description": "string",
  "display_name": "John Doe",
  "name": "John Doe"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `name` | `string` | ❌ | - |
| `display_name` | `string` | ❌ | - |
| `description` | `string` | ❌ | - |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/roles/1' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","display_name": "John Doe","name": "John Doe"}'
```

---

### DELETE `/v1/roles/:id`

**删除角色**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `roles.destroy` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/roles/1'
```

---

### POST `/v1/roles/assign`

**分配角色**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `roles.assign` |

#### 请求体

```json
{
  "role_id": 1,
  "user_id": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `user_id` | `uint` | ✅ | 必填 |
| `role_id` | `uint` | ✅ | 必填 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/roles/assign' \
  -H 'Content-Type: application/json' \
  -d '{"role_id": 1,"user_id": 1}'
```

---

### POST `/v1/roles/remove`

**移除角色**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `roles.remove` |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/roles/remove'
```

---

### GET `/v1/users/:id/roles`

**获取用户角色**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `users.roles` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/1/roles'
```

---

### GET `/v1/permissions`

**获取权限列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `permissions.index` |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "deleted_at": "object",
  "description": "string",
  "display_name": "John Doe",
  "id": 1,
  "module": "string",
  "name": "John Doe",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/permissions'
```

---

<a id="project"></a>
## 项目（Project）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `POST` | `/v1/projects` | 创建项目 | 🔓 |
| `GET` | `/v1/projects` | 获取项目列表 | 🔓 |
| `GET` | `/v1/projects/:id` | 获取项目详情 | 🔓 |
| `PUT` | `/v1/projects/:id` | 更新项目 | 🔓 |
| `PATCH` | `/v1/projects/:id` | 更新项目 | 🔓 |
| `DELETE` | `/v1/projects/:id` | 删除项目 | 🔓 |
| `GET` | `/v1/projects/:id/stats` | 获取项目统计信息 | 🔓 |

### POST `/v1/projects`

**创建项目**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `projects.create` |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects'
```

---

### GET `/v1/projects`

**获取项目列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `projects.list` |

#### 响应

```json
{
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "slug": "string",
  "status": 1
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects'
```

---

### GET `/v1/projects/:id`

**获取项目详情**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1'
```

---

### PUT `/v1/projects/:id`

**更新项目**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1'
```

---

### PATCH `/v1/projects/:id`

**更新项目**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1'
```

---

### DELETE `/v1/projects/:id`

**删除项目**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1'
```

---

### GET `/v1/projects/:id/stats`

**获取项目统计信息**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "id": 1,
  "name": "John Doe",
  "platform": "string",
  "public_key": "string",
  "slug": "string",
  "status": 1,
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/stats'
```

---

<a id="request"></a>
## 请求（Request）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/:cid/requests` | 创建请求 | 🔓 |
| `GET` | `/v1/projects/:id/collections/:cid/requests` | 获取请求列表 | 🔓 |
| `GET` | `/v1/projects/:id/collections/:cid/requests/:rid` | 获取请求详情 | 🔓 |
| `PUT` | `/v1/projects/:id/collections/:cid/requests/:rid` | 更新请求 | 🔓 |
| `DELETE` | `/v1/projects/:id/collections/:cid/requests/:rid` | 删除请求 | 🔓 |
| `PATCH` | `/v1/projects/:id/collections/:cid/requests/:rid/move` | 移动请求 | 🔓 |
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/rollback` | 回滚请求 | 🔓 |

### POST `/v1/projects/:id/collections/:cid/requests`

**创建请求**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `requests.create` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests'
```

---

### GET `/v1/projects/:id/collections/:cid/requests`

**获取请求列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `requests.list` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests'
```

---

### GET `/v1/projects/:id/collections/:cid/requests/:rid`

**获取请求详情**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `requests.show` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid'
```

---

### PUT `/v1/projects/:id/collections/:cid/requests/:rid`

**更新请求**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `requests.update` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid'
```

---

### DELETE `/v1/projects/:id/collections/:cid/requests/:rid`

**删除请求**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `requests.delete` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid'
```

---

### PATCH `/v1/projects/:id/collections/:cid/requests/:rid/move`

**移动请求**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `requests.move` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/move'
```

---

### POST `/v1/projects/:id/collections/:cid/requests/:rid/rollback`

**回滚请求**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `requests.rollback` |

#### 请求体

```json
{
  "version_id": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `version_id` | `uint` | ✅ | 必填 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "auth": null,
  "body": "string",
  "body_type": "string",
  "collection_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "headers": [],
  "id": 1,
  "method": "string",
  "name": "John Doe",
  "path_params": "object",
  "pre_request": "string",
  "query_params": [],
  "sort_order": 1,
  "test": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "url": "https://example.com"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/rollback' \
  -H 'Content-Type: application/json' \
  -d '{"version_id": 1}'
```

---

<a id="run"></a>
## 运行（Run）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `POST` | `/v1/projects/:id/collections/:cid/requests/:rid/run` | 执行请求 | 🔓 |

### POST `/v1/projects/:id/collections/:cid/requests/:rid/run`

**执行请求**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `run.execute` |

#### 请求体

```json
{
  "environment_id": null,
  "variables": "object"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `environment_id` | `*uint` | ❌ | - |
| `variables` | `map[string]string` | ❌ | - |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `cid` | `integer` | 资源标识符 |
| `rid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/collections/:cid/requests/:rid/run' \
  -H 'Content-Type: application/json' \
  -d '{"environment_id": null,"variables": "object"}'
```

---

<a id="system"></a>
## 系统（System）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `GET` | `/v1/system-features` | 获取系统功能 | 🔓 |
| `GET` | `/v1/setup-status` | 获取初始化状态 | 🔓 |

### GET `/v1/system-features`

**获取系统功能**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/system-features'
```

---

### GET `/v1/setup-status`

**获取初始化状态**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/setup-status'
```

---

<a id="testcase"></a>
## 测试用例（Testcase）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `GET` | `/v1/projects/:id/test-cases` | 需要项目角色权限（测试用例） | 🔓 |
| `POST` | `/v1/projects/:id/test-cases` | 需要项目角色权限（测试用例） | 🔓 |
| `GET` | `/v1/projects/:id/test-cases/:tcid` | 需要项目角色权限（测试用例） | 🔓 |
| `PATCH` | `/v1/projects/:id/test-cases/:tcid` | 需要项目角色权限（测试用例） | 🔓 |
| `DELETE` | `/v1/projects/:id/test-cases/:tcid` | 需要项目角色权限（测试用例） | 🔓 |
| `POST` | `/v1/projects/:id/test-cases/:tcid/duplicate` | 需要项目角色权限（测试用例） | 🔓 |
| `POST` | `/v1/projects/:id/test-cases/from-spec` | 需要项目角色权限（测试用例） | 🔓 |
| `POST` | `/v1/projects/:id/test-cases/:tcid/run` | 需要项目角色权限（测试用例） | 🔓 |

### GET `/v1/projects/:id/test-cases`

**需要项目角色权限（测试用例）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/test-cases'
```

---

### POST `/v1/projects/:id/test-cases`

**需要项目角色权限（测试用例）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/test-cases'
```

---

### GET `/v1/projects/:id/test-cases/:tcid`

**需要项目角色权限（测试用例）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `tcid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid'
```

---

### PATCH `/v1/projects/:id/test-cases/:tcid`

**需要项目角色权限（测试用例）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `tcid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid'
```

---

### DELETE `/v1/projects/:id/test-cases/:tcid`

**需要项目角色权限（测试用例）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `tcid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid'
```

---

### POST `/v1/projects/:id/test-cases/:tcid/duplicate`

**需要项目角色权限（测试用例）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `tcid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid/duplicate'
```

---

### POST `/v1/projects/:id/test-cases/from-spec`

**需要项目角色权限（测试用例）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/test-cases/from-spec'
```

---

### POST `/v1/projects/:id/test-cases/:tcid/run`

**需要项目角色权限（测试用例）**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `tcid` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/projects/1/test-cases/:tcid/run'
```

---

<a id="user"></a>
## 用户（User）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `POST` | `/v1/register` | 注册新用户 | 🔓 |
| `POST` | `/v1/login` | 用户登录 | 🔓 |
| `POST` | `/v1/password/reset` | 重置密码 | 🔓 |
| `GET` | `/v1/users/profile` | 获取当前用户资料 | 🔓 |
| `PUT` | `/v1/users/profile` | 更新当前用户资料 | 🔓 |
| `PUT` | `/v1/users/password` | 修改密码 | 🔓 |
| `DELETE` | `/v1/users/account` | 删除账号 | 🔓 |
| `GET` | `/v1/users` | 获取用户列表 | 🔓 |
| `GET` | `/v1/users/search` | 搜索用户 | 🔓 |
| `GET` | `/v1/users/:id` | 获取用户详情 | 🔓 |
| `GET` | `/v1/users/:id/info` | 获取用户信息 | 🔓 |

### POST `/v1/register`

**注册新用户**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `auth.register` |

#### 请求体

```json
{
  "email": "user@example.com",
  "nickname": "John Doe",
  "password": "********",
  "phone": "+1234567890",
  "username": "John Doe"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `username` | `string` | ✅ | 必填，最小：3，最大：50 |
| `password` | `string` | ✅ | 必填，最小：6，最大：50 |
| `email` | `string` | ✅ | 必填，邮箱格式 |
| `nickname` | `string` | ❌ | 最大：50 |
| `phone` | `string` | ❌ | 最大：20 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/register' \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com","nickname": "John Doe","password": "********","phone": "+1234567890","username": "John Doe"}'
```

---

### POST `/v1/login`

**用户登录**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `auth.login` |

#### 请求体

```json
{
  "password": "********",
  "username": "John Doe"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `username` | `string` | ✅ | 必填 |
| `password` | `string` | ✅ | 必填 |

#### 响应

```json
{
  "access_token": "string",
  "user": null
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/login' \
  -H 'Content-Type: application/json' \
  -d '{"password": "********","username": "John Doe"}'
```

---

### POST `/v1/password/reset`

**重置密码**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `auth.password.reset` |

#### 请求体

```json
{
  "email": "user@example.com"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `email` | `string` | ✅ | 必填，邮箱格式 |

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/password/reset' \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com"}'
```

---

### GET `/v1/users/profile`

**获取当前用户资料**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `users.profile` |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/profile'
```

---

### PUT `/v1/users/profile`

**更新当前用户资料**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `users.profile.update` |

#### 请求体

```json
{
  "avatar": "https://example.com/avatar.jpg",
  "bio": "string",
  "nickname": "John Doe",
  "phone": "+1234567890"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `nickname` | `string` | ❌ | 最大：50 |
| `avatar` | `string` | ❌ | 最大：255 |
| `phone` | `string` | ❌ | 最大：20 |
| `bio` | `string` | ❌ | 最大：500 |

#### 示例

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/users/profile' \
  -H 'Content-Type: application/json' \
  -d '{"avatar": "https://example.com/avatar.jpg","bio": "string","nickname": "John Doe","phone": "+1234567890"}'
```

---

### PUT `/v1/users/password`

**修改密码**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `users.password.update` |

#### 请求体

```json
{
  "new_password": "********",
  "old_password": "********"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `old_password` | `string` | ✅ | 必填 |
| `new_password` | `string` | ✅ | 必填，最小：6，最大：50 |

#### 示例

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/users/password' \
  -H 'Content-Type: application/json' \
  -d '{"new_password": "********","old_password": "********"}'
```

---

### DELETE `/v1/users/account`

**删除账号**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `users.account.delete` |

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/users/account'
```

---

### GET `/v1/users`

**获取用户列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `users.index` |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users'
```

---

### GET `/v1/users/search`

**搜索用户**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `users.search` |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/search'
```

---

### GET `/v1/users/:id`

**获取用户详情**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `users.show` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/1'
```

---

### GET `/v1/users/:id/info`

**获取用户信息**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `users.info` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/1/info'
```

---

<a id="workspace"></a>
## 工作区（Workspace）

| 方法 | 接口路径 | 说明 | 认证 |
|--------|----------|-------------|------|
| `POST` | `/v1/workspaces` | 创建工作区 | 🔓 |
| `GET` | `/v1/workspaces` | 获取工作区列表 | 🔓 |
| `GET` | `/v1/workspaces/:id` | 获取工作区 | 🔓 |
| `PATCH` | `/v1/workspaces/:id` | 更新工作区 | 🔓 |
| `DELETE` | `/v1/workspaces/:id` | 删除工作区 | 🔓 |
| `POST` | `/v1/workspaces/:id/members` | 添加工作区成员 | 🔓 |
| `GET` | `/v1/workspaces/:id/members` | 获取工作区成员列表 | 🔓 |
| `PATCH` | `/v1/workspaces/:id/members/:uid` | 更新工作区成员角色 | 🔓 |
| `DELETE` | `/v1/workspaces/:id/members/:uid` | 移除工作区成员 | 🔓 |

### POST `/v1/workspaces`

**创建工作区**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `workspaces.create` |

#### 请求体

```json
{
  "description": "string",
  "name": "John Doe",
  "slug": "string",
  "type": "string",
  "visibility": "string"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `name` | `string` | ✅ | 必填，最大：100 |
| `slug` | `string` | ✅ | 必填，最大：50 |
| `description` | `string` | ❌ | 最大：500 |
| `type` | `string` | ✅ | 必填，可选值：personal、team、public |
| `visibility` | `string` | ❌ | 可选值：private、team、public |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/workspaces' \
  -H 'Content-Type: application/json' \
  -d '{"description": "string","name": "John Doe","slug": "string","type": "string","visibility": "string"}'
```

---

### GET `/v1/workspaces`

**获取工作区列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `workspaces.index` |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/workspaces'
```

---

### GET `/v1/workspaces/:id`

**获取工作区**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `workspaces.show` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/workspaces/1'
```

---

### PATCH `/v1/workspaces/:id`

**更新工作区**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `workspaces.update` |

#### 请求体

```json
{
  "description": null,
  "name": null,
  "visibility": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `name` | `*string` | ❌ | 可选，最大：100 |
| `description` | `*string` | ❌ | 可选，最大：500 |
| `visibility` | `*string` | ❌ | 可选，可选值：private、team、public |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/workspaces/1' \
  -H 'Content-Type: application/json' \
  -d '{"description": null,"name": null,"visibility": null}'
```

---

### DELETE `/v1/workspaces/:id`

**删除工作区**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `workspaces.delete` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/workspaces/1'
```

---

### POST `/v1/workspaces/:id/members`

**添加工作区成员**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `workspaces.members.add` |

#### 请求体

```json
{
  "role": "string",
  "user_id": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `user_id` | `uint` | ✅ | 必填 |
| `role` | `string` | ✅ | 必填，可选值：owner、admin、editor、viewer |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### 示例

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/workspaces/1/members' \
  -H 'Content-Type: application/json' \
  -d '{"role": "string","user_id": 1}'
```

---

### GET `/v1/workspaces/:id/members`

**获取工作区成员列表**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `workspaces.members.list` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### 示例

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/workspaces/1/members'
```

---

### PATCH `/v1/workspaces/:id/members/:uid`

**更新工作区成员角色**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `workspaces.members.update` |

#### 请求体

```json
{
  "role": "string"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-------|------|:--------:|-------------|
| `role` | `string` | ✅ | 必填，可选值：owner、admin、editor、viewer |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `uid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### 示例

```bash
curl -X PATCH 'http://localhost:8025/api/v1/v1/workspaces/1/members/:uid' \
  -H 'Content-Type: application/json' \
  -d '{"role": "string"}'
```

---

### DELETE `/v1/workspaces/:id/members/:uid`

**移除工作区成员**

| 属性 | 值 |
|----------|-------|
| 认证 | 🔓 无需认证 |
| 路由名 | `workspaces.members.remove` |

#### 路径参数

| 参数 | 类型 | 说明 |
|-----------|------|-------------|
| `id` | `integer` | 资源标识符 |
| `uid` | `integer` | 资源标识符 |

#### 响应

```json
{
  "created_at": "2024-01-01T00:00:00Z",
  "description": "string",
  "id": 1,
  "name": "John Doe",
  "owner_id": 1,
  "settings": "object",
  "slug": "string",
  "type": "string",
  "updated_at": "2024-01-01T00:00:00Z",
  "visibility": "string"
}
```

#### 示例

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/workspaces/1/members/:uid'
```

---

