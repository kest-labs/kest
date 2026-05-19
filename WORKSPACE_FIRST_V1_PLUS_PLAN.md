# Kest Workspace-first API Client V1 Plus 开发计划

## Summary

这版计划需要修改后再执行：原计划适合从零开发，但当前 Kest 已有 `project / collection / request / environment / api-spec / flow / testcase / history` 等模块。V1 Plus 应改成 **Workspace-first 重构 + Postman 核心链路补齐**。

已锁定默认方案：

- Workspace 是最终根资源边界。
- 旧 Project 架构不长期兼容，开发环境允许重置数据。
- Request Send 第一版默认走 Local Bridge。
- RequestHistory 由前端拿到 Local Bridge 响应后回写后端。
- Organization 后置，不阻塞核心 API Client 闭环。
- Run / RunStep 统一建模，Collection / TestCase / Flow 都接入同一运行记录模型。

## Key Changes

- 删除“初始化项目”式 Milestone 0，改为现有能力盘点、Project 到 Workspace 的数据模型切换、前后端路由切换。
- 不新增独立 `folders` 模块；继续使用现有 collection tree，folder 由 `is_folder + parent_id` 表达。
- 不把 Organization 放在第一主线；V1 先保证个人/团队 Workspace 可用。
- 新 API 统一以 `/workspaces/:workspaceId/...` 为主，不再新增 `/projects/:id/...` 兼容路线。
- Auth 路由暂不强改；保留当前 `/login`、`/register`、`/users/profile`，避免非核心迁移扩大范围。
- Request Execution Engine 不做后端直连默认路径；第一版以 Local Bridge 执行，后端负责持久化资源、history、runs。
- `history` 概念拆清楚：RequestHistory 保存执行快照；实体变更/CLI sync history 不混用。
- 现有 AI、public share、复杂 OpenAPI 拆解、Mock、Monitor、Audit 暂不纳入 V1 主线。

## Milestones

1. **M0：基线整理与重构准备**
   - 盘点现有 backend modules、frontend services/hooks/pages、migrations。
   - 确认 Workspace-first 命名、路由、权限、数据表变更。
   - 开发环境允许 reset/seed，不要求保留旧 Project 数据。

2. **M1：Workspace 数据模型和权限**
   - Workspace 直接拥有 collections、environments、variables、requests、api-specs、runs、test-cases、flows、cli-tokens。
   - 角色统一为 `owner/admin/write/read`，后续可再改名为 `editor/viewer`。
   - 所有资源查询必须校验 Workspace membership。

3. **M2：前端 Workspace Shell**
   - 将现有 project 工作台迁移为 workspace 工作台。
   - 路由改为 `/workspace/[workspaceId]/...`。
   - services/hooks/query keys 从 `projectId` 迁移为 `workspaceId`。
   - 保留现有页面能力，避免重写 UI。

4. **M3：Environment / Variable**
   - 支持 workspace、environment、collection、runtime 四类变量。
   - 变量优先级固定为 `Runtime > Environment > Collection > Workspace`。
   - 前端提供 Environment Selector 和 Variable Editor。

5. **M4：Collection / Folder / Request**
   - 复用现有 collection tree。
   - Request Editor 支持 method、url、headers、params、body、auth、scripts 字段。
   - Folder 不做独立表或独立模块。

6. **M5：Local Bridge Request Send**
   - 点击 Send 后由前端调用 Local Bridge。
   - 前端完成变量解析请求编排，或调用共享 resolver 后再发给 bridge。
   - 返回 status、headers、body、duration、size。
   - 前端再调用后端保存 RequestHistory。

7. **M6：RequestHistory / ResponseExample**
   - 新增或重构 RequestHistory 为执行历史，保存 resolved request 和 response snapshot。
   - ResponseExample 复用现有 examples 能力，支持从当前响应保存。
   - UI 提供 history sidebar、history detail、save as example。

8. **M7：Unified Run / RunStep**
   - 建统一 `runs`、`run_steps` 模型。
   - Collection Runner 按 collection tree / sort_order 顺序运行 request。
   - TestCase 和 Flow 后续都写入同一 Run / RunStep。

9. **M8：TestCase / Assertion**
   - TestCase 绑定 Request 或 Collection。
   - 第一版 assertion 支持 status code、header exists、json path exists/equals、response time less than。
   - 运行结果写入统一 Run / RunStep。

10. **M9：Flow / FlowStep**
    - 第一版只做顺序执行，不做复杂 FlowEdge 分支。
    - FlowStep 支持 request、script、delay。
    - 运行结果写入统一 Run / RunStep。

11. **M10：ApiSpec / Documentation**
    - 复用现有 api-spec 模块。
    - 支持手动创建、上传 raw OpenAPI、基础 documentation。
    - AI draft、public share 暂时冻结或隐藏，不作为 V1 验收项。

12. **M11：Workspace CliToken**
    - Token 改为 workspace scope。
    - 只在创建时返回明文 token。
    - 数据库只保存 hash，列表显示 prefix。
    - 第一版 scopes：`collection:read`、`collection:run`、`environment:read`、`test_case:run`、`flow:run`。

## Test Plan

- 后端：`go test ./...`
- 前端：`pnpm type-check && pnpm build && pnpm test`
- 权限测试：非 workspace member 不能访问资源；read 不能修改；write 可以编辑和运行；owner/admin 管理成员和 token。
- 核心 Demo 流程：注册登录 -> 创建 Workspace -> 创建 Environment 和 `base_url` -> 创建 Collection/Request -> Send -> 保存 History -> 保存 Example -> Run Collection -> 创建 TestCase -> Run TestCase -> 创建 Flow -> Run Flow -> 创建 CliToken。
- Local Bridge 场景：bridge 未启动、变量缺失、超时、非 2xx、响应体过大都要有明确错误展示。

## Assumptions

- 当前阶段以开发环境为准，允许清空或重建旧 Project 数据。
- 不做 `/projects/:id/...` 长期兼容；迁移完成后前后端统一使用 Workspace 路由。
- Organization、Audit、Mock、Monitor、AI、Public Share、复杂 OAuth2、复杂 Flow 分支全部后置。
- 第一版目标是跑通真实 API Client 闭环，不追求一次性完成完整 Postman 平台能力。
