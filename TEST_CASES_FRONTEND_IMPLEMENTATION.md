# Test Cases Use Cases API 与前端实现方案

本文面向当前仓库（`web` 前端）说明：

1. `docs/api/05-test-cases.md` 中 Test Cases 的完整 API 用例
2. 每个用例在前端应如何实现（类型、服务层、Hooks、页面挂载、交互流程）
3. 推荐的分阶段落地顺序

---

## 1. 目标与范围

Test Cases 模块的目标是支持以下核心能力：

- 查看测试用例列表（含筛选、分页）
- 创建/编辑/删除测试用例
- 复制测试用例
- 基于 API Spec 批量生成测试用例
- 运行单条测试并查看结果

Base Path：

`/v1/projects/:id/test-cases`

---

## 2. Use Cases 与 API 对照

### 2.1 列表查询（List Test Cases）

- Method: `GET`
- Path: `/projects/:id/test-cases`
- 用途: 获取项目下测试用例列表
- Query:
  - `page`
  - `per_page`
  - `api_spec_id`
  - `env`
  - `keyword`
  - `status`
  - `category_id`

前端建议：

- 列表页默认调用，支持筛选条件联动刷新
- 使用 React Query，queryKey 必须包含全部筛选条件，避免缓存串数据

---

### 2.2 创建（Create Test Case）

- Method: `POST`
- Path: `/projects/:id/test-cases`
- 用途: 新建测试用例
- Body 关键字段:
  - `name`, `method`, `path`
  - `api_spec_id`, `environment`, `category_id`
  - `request_headers`, `request_body`
  - `expected_status`, `expected_response`
  - `assertions`, `variables`
  - `setup_script`, `teardown_script`

前端建议：

- 使用弹窗或抽屉表单
- 先做基础字段，后续扩展 assertions/script 高级编辑区

---

### 2.3 详情（Get Test Case）

- Method: `GET`
- Path: `/projects/:id/test-cases/:tcid`
- 用途: 获取单条详情

前端建议：

- 列表点击行后右侧详情面板打开
- 详情用于编辑前预填充

---

### 2.4 更新（Update Test Case）

- Method: `PATCH`
- Path: `/projects/:id/test-cases/:tcid`
- 用途: 更新测试用例（部分字段）

前端建议：

- 编辑保存后，失效详情缓存 + 列表缓存
- 若当前筛选条件下对象可能被过滤掉（例如状态变更），应重新请求列表

---

### 2.5 删除（Delete Test Case）

- Method: `DELETE`
- Path: `/projects/:id/test-cases/:tcid`
- 用途: 删除测试用例

前端建议：

- 二次确认弹窗
- 删除成功后刷新列表并关闭详情面板

---

### 2.6 复制（Duplicate Test Case）

- Method: `POST`
- Path: `/projects/:id/test-cases/:tcid/duplicate`
- 用途: 基于已有用例快速复制
- Body:
  - `name` (required)
  - `environment`
  - `description`

前端建议：

- 列表行菜单提供 “Duplicate”
- 弹窗只输入新名称和可选环境/描述

---

### 2.7 从 API Spec 生成（Generate from Spec）

- Method: `POST`
- Path: `/projects/:id/test-cases/from-spec`
- 用途: 按 API Spec 自动生成测试用例
- Body:
  - `api_spec_id` (required)
  - `environment`
  - `category_id`
  - `options`

前端建议：

- 在 API Spec 详情或 Test Cases 页面提供 “Generate” 入口
- 成功后提示 `generated/updated` 数量并刷新列表

---

### 2.8 执行单条（Run Test Case）

- Method: `POST`
- Path: `/projects/:id/test-cases/:tcid/run`
- 用途: 执行测试并返回结果（同步或异步）
- Body:
  - `environment`
  - `variables`
  - `async`

前端建议：

- 行级 `Run` 按钮 + 结果弹层
- 同步执行直接展示结果
- 异步执行展示 “running” 并轮询运行状态（后端提供 run 查询接口时接入）

---

## 3. 当前前端现状（仓库内）

已存在：

- `web/src/services/kest-api.service.ts` 已有以下方法：
  - `list/get/create/update/delete/run`
- `web/src/hooks/use-kest-api.ts` 已有以下 hooks：
  - `useTestCases/useTestCase/useCreateTestCase/useRunTestCase`

缺失：

- `duplicate`、`from-spec` 对应 service/hook
- `update/delete` 的 hook
- 页面层实际挂载（目前无 Test Cases 路由和页面）

---

## 4. 前端实现设计（按层）

## 4.1 类型层（`web/src/types/kest-api.ts`）

建议新增/调整类型，贴近文档字段：

- `ListTestCasesParams`
- `UpdateTestCaseRequest`
- `DuplicateTestCaseRequest`
- `GenerateTestCasesFromSpecRequest`
- `GenerateTestCasesFromSpecResponse`
- `RunTestCaseRequest`
- `RunTestCaseResponse`（兼容 sync/async 返回）

建议注意：

- 文档使用 `environment`，当前类型里较多使用 `env`，应统一并兼容映射
- 列表建议使用分页结构（`items + pagination`），不要只定义 `TestCase[]`

---

## 4.2 服务层（`web/src/services/kest-api.service.ts`）

推荐将 testCase API 调整为：

```ts
list: (projectId: number, params?: ListTestCasesParams) =>
  request.get<PaginatedResponse<TestCase>>(`/v1/projects/${projectId}/test-cases`, { params })

get: (projectId: number, id: number) =>
  request.get<TestCase>(`/v1/projects/${projectId}/test-cases/${id}`)

create: (projectId: number, data: CreateTestCaseRequest) =>
  request.post<TestCase>(`/v1/projects/${projectId}/test-cases`, data)

update: (projectId: number, id: number, data: UpdateTestCaseRequest) =>
  request.patch<TestCase>(`/v1/projects/${projectId}/test-cases/${id}`, data)

delete: (projectId: number, id: number) =>
  request.delete(`/v1/projects/${projectId}/test-cases/${id}`)

duplicate: (projectId: number, id: number, data: DuplicateTestCaseRequest) =>
  request.post<TestCase>(`/v1/projects/${projectId}/test-cases/${id}/duplicate`, data)

generateFromSpec: (projectId: number, data: GenerateTestCasesFromSpecRequest) =>
  request.post<GenerateTestCasesFromSpecResponse>(`/v1/projects/${projectId}/test-cases/from-spec`, data)

run: (projectId: number, id: number, data?: RunTestCaseRequest) =>
  request.post<RunTestCaseResponse>(`/v1/projects/${projectId}/test-cases/${id}/run`, data)
```

---

## 4.3 React Query Hooks（`web/src/hooks/use-kest-api.ts`）

建议补齐：

- `useUpdateTestCase(projectId)`
- `useDeleteTestCase(projectId)`
- `useDuplicateTestCase(projectId)`
- `useGenerateTestCasesFromSpec(projectId)`

Query key 建议：

- `testCases(projectId, filters)`，而不是仅 `apiSpecId`
- `testCase(projectId, id)`

缓存策略：

- create/update/delete/duplicate/generate 成功后统一 invalidate 当前项目 test-cases 列表
- update/delete 后同步 invalidate 单条详情

---

## 4.4 页面挂载（建议新建）

推荐新增页面：

- `web/src/pages/projects/test-cases.tsx`

挂载方式（二选一）：

1. 在 `ProjectDetailPage` 加 `viewMode: 'test-cases'`
2. 新路由：`/projects/:id/test-cases`

页面结构建议：

- 顶部：筛选区（keyword/status/env/api_spec/category）
- 中部：表格（名称、方法、路径、状态、最后运行结果、更新时间）
- 行操作：`Run / Edit / Duplicate / Delete`
- 右侧或弹窗：详情/编辑表单

---

## 5. 关键交互流程（前端）

### 5.1 创建流程

1. 打开创建弹窗
2. 填写基础信息与断言
3. `useCreateTestCase` 提交
4. 成功后关闭弹窗 + 刷新列表 + toast

### 5.2 运行流程

1. 点击 `Run`
2. 选择环境（可选）
3. 调用 `useRunTestCase`
4. 展示 request/response/assertions 结果
5. 刷新列表中的 `last_run_status/last_run_at`

### 5.3 生成流程

1. 选择 `api_spec_id` + 生成选项
2. 调用 `useGenerateTestCasesFromSpec`
3. 展示返回的 `generated/updated` 数量
4. 刷新列表

---

## 6. 错误处理与体验建议

- 表单校验：优先在前端校验必填字段（`name/method/path`）
- 服务端错误：沿用现有 `request.ts` 统一错误处理
- 长操作反馈：生成/运行时按钮 loading，避免重复提交
- 空态：无数据时提供 “Create” 和 “Generate from Spec” 双入口

---

## 7. 推荐实施顺序

Phase 1（MVP）：

1. 补齐 service + hooks（含 duplicate/from-spec/update/delete）
2. 新建 Test Cases 列表页
3. 打通 Create / Run / Delete

Phase 2：

1. 打通 Edit / Detail
2. 打通 Duplicate
3. 完善筛选和分页

Phase 3：

1. 打通 Generate from Spec
2. 完善断言编辑器（json_path/header/response_time）
3. 增加运行结果可视化

---

## 8. 验收清单（Checklist）

- [ ] 列表支持分页与多条件筛选
- [ ] 可创建、查看、更新、删除测试用例
- [ ] 可复制测试用例
- [ ] 可按 API Spec 生成测试用例
- [ ] 可执行单条测试并展示结果
- [ ] 所有 mutation 后缓存刷新正确
- [ ] 异常提示、空态、加载态完整

