# Kest Workspace-first V1 Plus 6 PR 拆分清单

## 目标

把 `WORKSPACE_FIRST_V1_PLUS_PLAN.md` 拆成 6 个可合并的 PR，控制每个 PR 的范围、依赖和验收口径，避免把 workspace 迁移、执行链路、运行模型、testcase/flow 收口到同一张大 PR 里。

## 建议顺序

依赖顺序：

`PR1 -> PR2 -> PR3 -> PR4 -> PR5 -> PR6`

原则：

- 每个 PR 都要能独立 review。
- 前 3 个 PR 先完成 workspace 主壳、资源路由、Send/History 核心闭环。
- 后 3 个 PR 再做统一运行模型、TestCase、Flow/CliToken 收尾。

## 执行约束

以下约束适用于全部 6 个 PR，执行时必须遵守：

- [ ] 每开始做一个 PR 之前，先创建对应 branch。
- [ ] branch 命名默认使用文档里给出的 `codex/...` 名称。
- [ ] 一个 PR 只做该 PR 清单内的事项，不顺手扩展到其他 PR 范围。
- [ ] 每完成一个 todo list 条目，就做一次本地 commit。
- [ ] 每完成一个 todo list 条目对应的 commit 后，立刻 push 当前 branch。
- [ ] commit 必须和当前完成的 todo 条目直接对应，避免把多个不相关事项混在同一次提交里。
- [ ] 如果某个 todo 条目太大，允许拆成多个更小提交，但该条目完成时必须已经全部 push。
- [ ] 一个 PR 的 todo 没有全部完成之前，不开始下一个 PR。
- [ ] 一个 PR 全部完成后，立即停止继续开发，不提前进入下一个 PR。
- [ ] 一个 PR 全部完成后，把 branch 和已完成项交给人工 review。
- [ ] 只有在你 review 完并明确允许继续后，才开始下一个 PR。
- [ ] 如果 review 提出修改意见，这些修改仍然留在当前 PR 的 branch 上完成，不新开额外主线 branch。

## 单个 PR 的标准执行流程

每个 PR 都按下面流程推进：

1. 创建 branch。
2. 只实现当前 PR 范围内的 todo。
3. 每完成一个 todo 条目，立即 commit。
4. 每次 commit 后，立即 push。
5. 当前 PR 全部 todo 和验收项完成后，停止开发。
6. 把结果交给你 review。
7. 等待你批准后，再进入下一个 PR。

---

## PR1: Workspace Shell

建议分支名：

`codex/workspace-shell`

目标：

建立 workspace-first 的前端主入口和路由壳，但尽量不重写已有 UI。

Todo：

- [ ] 新增 `/workspace/[workspaceId]/...` 页面目录和对应路由入口。
- [ ] 新增 workspace 路由 helper，替代当前 `/project/:projectId/...` helper 的主路径职责。
- [ ] 建立 workspace 级页面壳，承接 collections / api-specs / environments / histories / test-cases / flows / keys。
- [ ] 侧边栏、breadcrumb、模块切换统一改成 `workspaceId`。
- [ ] 新增 workspace list / current workspace 基础 service 和 hooks。
- [ ] 建立 workspace 级 query key 命名，停止继续扩散 `project` 语义。
- [ ] 现有 `ProjectWorkspacePage` 尽量平移复用，避免在这个 PR 里做 UI 重写。
- [ ] 旧 `/project/...` 页面先做 redirect、入口隐藏或过渡跳转，避免双主线继续存在。

验收：

- [ ] 用户可以从 workspace 路由进入工作台。
- [ ] collections / api-specs / environments / histories 等模块能在 workspace 壳下正常切换。
- [ ] 不再新增任何新的 project-first 控制台入口。

不做：

- [ ] 不在这个 PR 里改 Send、Run、TestCase、Flow 逻辑。
- [ ] 不在这个 PR 里做统一 runs 模型。

---

## PR2: Workspace Resource Routes & Services

建议分支名：

`codex/workspace-resource-services`

目标：

把 workspace-first 资源访问链路打通，让前端和后端在 collection / request / environment / history / example / api-spec 等资源上统一使用 `/workspaces/:workspaceId/...`。

Todo：

- [ ] 前端 `collection` service 改成 workspace 路径。
- [ ] 前端 `request` service 改成 workspace 路径。
- [ ] 前端 `environment` service 改成 workspace 路径。
- [ ] 前端 `history` service 改成 workspace 路径。
- [ ] 前端 `example` service 改成 workspace 路径。
- [ ] 前端 `api-spec` service 改成 workspace 路径。
- [ ] 前端 `importer` / `category` 等相关资源调用统一改成 workspace 路径。
- [ ] 相关 hooks、page props、query keys 全量把 `projectId` 改成 `workspaceId`。
- [ ] 后端补齐或统一这些资源的 workspace membership 校验。
- [ ] 清理残留的 project-scoped 前端调用和不再需要的 project 资源路径依赖。

验收：

- [ ] collection / request / environment / history / example / api-spec CRUD 全部只走 workspace 接口。
- [ ] 前端网络请求里不再出现这些资源的 `/projects/:id/...` 主路径。

不做：

- [ ] 不在这个 PR 里正式落地变量优先级体系。
- [ ] 不在这个 PR 里做 unified runs。

---

## PR3: Variables + Send + History/Example

建议分支名：

`codex/workspace-send-history`

目标：

打通 API Client 核心闭环：变量解析、Environment 选择、Local Bridge Send、History 回写、Save as Example。

Todo：

- [ ] 明确并实现四层变量：`workspace / environment / collection / runtime`。
- [ ] 实现统一变量 resolver，优先级固定为 `Runtime > Environment > Collection > Workspace`。
- [ ] Request workbench 提供 Environment Selector。
- [ ] 补 runtime variable 输入或覆盖入口。
- [ ] 发送前完成 resolved URL / headers / params / body 组装。
- [ ] Send 默认走 Local Bridge。
- [ ] bridge 未启动时给出明确错误提示。
- [ ] 变量缺失时给出明确错误提示。
- [ ] 超时、非 2xx、响应体过大时给出明确错误提示。
- [ ] RequestHistory 保存 resolved request 和 response snapshot。
- [ ] UI 提供 history sidebar 和 history detail。
- [ ] 支持从当前响应保存 example。
- [ ] response example 与 request history 都按 workspace 资源边界工作。

验收：

- [ ] 创建 workspace environment 和 `base_url` 后可以成功 Send。
- [ ] Send 成功后能写入 history。
- [ ] Send 失败也能落失败 history。
- [ ] 能从当前响应保存 example。

不做：

- [ ] 不在这个 PR 里做 Collection Runner。
- [ ] 不在这个 PR 里迁移 TestCase / Flow。

---

## PR4: Unified Runs

建议分支名：

`codex/unified-runs`

目标：

建立统一的 `runs` / `run_steps` 模型，作为 collection、testcase、flow 的公共执行记录基础设施。

Todo：

- [ ] 新建 `runs`、`run_steps` 数据模型。
- [ ] 新建对应 migration、repository、service、handler。
- [ ] 定义统一的 run source 类型，例如 `request / collection / test_case / flow`。
- [ ] 定义统一的 step status、run status、duration、error、request snapshot、response snapshot 字段。
- [ ] request run 写入统一 run 记录。
- [ ] collection run 写入统一 run 记录。
- [ ] collection runner 按 collection tree / `sort_order` 顺序执行 request。
- [ ] history 和 run 的关联关系理顺，避免语义重叠。
- [ ] run detail 至少能查看 step 状态、耗时、请求快照、响应快照、错误信息。

验收：

- [ ] 触发 request run / collection run 后能生成统一 `run / run_steps`。
- [ ] 运行记录可以独立查询，不依赖旧 flow/testcase 专属 run 表。

不做：

- [ ] 不在这个 PR 里把 TestCase 和 Flow 全量迁入。
- [ ] 不在这个 PR 里补复杂 flow branching。

---

## PR5: Workspace TestCase

建议分支名：

`codex/workspace-testcase`

目标：

把 TestCase 从 project-scoped 迁到 workspace-scoped，并接入统一 runs 模型。

Todo：

- [ ] TestCase 路由从 `/projects/:id/test-cases` 改到 `/workspaces/:workspaceId/test-cases`。
- [ ] 权限从 `RequireProjectRole` 切到 workspace membership / role 校验。
- [ ] TestCase 数据模型改成 workspace-first 关系。
- [ ] 支持 TestCase 绑定 Request 或 Collection。
- [ ] TestCase 第一版 assertion 只保留以下类型：
  - [ ] `status code`
  - [ ] `header exists`
  - [ ] `json path exists`
  - [ ] `json path equals`
  - [ ] `response time less than`
- [ ] TestCase 运行统一写入 `runs / run_steps`。
- [ ] 前端 TestCase 页面和运行入口切到 workspace 路由。
- [ ] 补 TestCase 运行详情读取统一 run 数据。

验收：

- [ ] workspace 下可以创建、编辑、运行 TestCase。
- [ ] TestCase 运行结果进入统一 runs。
- [ ] 非 workspace member 不能访问 TestCase。

不做：

- [ ] 不在这个 PR 里处理 Flow。
- [ ] 不在这个 PR 里处理 CLI token 收尾。

---

## PR6: Workspace Flow + CliToken + Permission Hardening

建议分支名：

`codex/workspace-flow-cli-token`

目标：

完成 Flow 的 workspace 迁移、接入统一 runs，并把 workspace CLI token 和权限测试一起收口。

Todo：

- [ ] Flow 路由从 `/projects/:id/flows` 改到 `/workspaces/:workspaceId/flows`。
- [ ] 权限从 `RequireProjectRole` 切到 workspace membership / role 校验。
- [ ] Flow 数据模型改成 workspace-first 关系。
- [ ] 第一版 Flow 只保留顺序执行，不做复杂 branching / edge 条件分支。
- [ ] FlowStep 支持 `request`、`script`、`delay`。
- [ ] Flow 运行统一写入 `runs / run_steps`。
- [ ] 前端 Flow 页面和运行入口切到 workspace 路由。
- [ ] workspace CLI token 前端入口接到 `/workspaces/:id/cli-tokens`。
- [ ] token 仅在创建时返回明文。
- [ ] 数据库存 hash，列表只显示 prefix。
- [ ] 第一版 scopes 只保留：
  - [ ] `collection:read`
  - [ ] `collection:run`
  - [ ] `environment:read`
  - [ ] `test_case:run`
  - [ ] `flow:run`
- [ ] 补权限测试：
  - [ ] 非 workspace member 不能访问资源
  - [ ] `read` 不能修改
  - [ ] `write` 可以编辑和运行
  - [ ] `owner/admin` 可以管理成员和 token
- [ ] 补核心 demo 回归流程：
  - [ ] 注册登录
  - [ ] 创建 Workspace
  - [ ] 创建 Environment 和 `base_url`
  - [ ] 创建 Collection / Request
  - [ ] Send
  - [ ] 保存 History
  - [ ] 保存 Example
  - [ ] Run Collection
  - [ ] 创建并运行 TestCase
  - [ ] 创建并运行 Flow
  - [ ] 创建 CliToken

验收：

- [ ] workspace 下可以创建、编辑、运行 Flow。
- [ ] Flow 运行结果进入统一 runs。
- [ ] workspace CLI token 可创建、可列出、权限正确。
- [ ] 核心 demo 流程完整通过。

不做：

- [ ] Organization
- [ ] Audit
- [ ] Mock / Monitor
- [ ] Public Share 主链路
- [ ] AI 主流程
- [ ] 复杂 OAuth2
- [ ] 复杂 Flow branching

---

## 合并建议

- PR1、PR2 可以连续合并，尽快消灭前端 project-first 主入口。
- PR3 合并后，V1 核心 API Client 闭环基本成立。
- PR4 是后续 TestCase / Flow 的基础，不建议和 PR5、PR6 合并。
- PR5、PR6 如果 review 资源紧张，也可以在 PR4 合并后并行开发，但最终仍建议分开提审。

## 最终完成标准

满足以下条件时，可以认为这轮 Workspace-first V1 Plus 基本结束：

- [ ] 前后端主路径统一为 workspace。
- [ ] Send 默认走 Local Bridge，history/example 闭环成立。
- [ ] request / collection / testcase / flow 运行记录统一到 `runs / run_steps`。
- [ ] TestCase 和 Flow 不再依赖 project-scoped 主模型。
- [ ] workspace CLI token 和权限矩阵完成收口。
