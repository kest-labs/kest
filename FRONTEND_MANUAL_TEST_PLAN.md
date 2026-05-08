# Kest 前端手动测试链路

## 1. 目标

本文档用于覆盖当前前端项目的完整手动测试链路，按依赖顺序执行，避免上游模块未通过时继续消耗时间排查下游问题。

推荐测试顺序：

`公开页 -> 认证 -> 项目 Dashboard -> 项目概览 -> 环境 -> 分类 -> API Specs -> Collections -> Test Cases -> Flows -> Histories -> Members/Invite -> 账号设置 -> 全局回归`

## 2. 测试准备

### 2.1 账号准备

| 角色 | 用途 |
| --- | --- |
| `Owner` 账号 | 主测试账号，拥有项目全部权限 |
| `Member` 账号 | 用于邀请、接受邀请、权限变更验证 |

### 2.2 项目准备

| 项目 | 用途 |
| --- | --- |
| `Project A` | 手工创建空项目，覆盖从 0 到 1 的完整创建链路 |
| `Project B` | 使用 Demo 项目，覆盖带示例数据的执行链路 |

### 2.3 环境准备

| 项目 | 建议 |
| --- | --- |
| 前端 | 正常启动，能访问 `/` |
| 后端 API | 正常启动，认证、项目、spec、request、flow 等接口可用 |
| 浏览器 | 准备普通窗口和无痕窗口 |
| 本地存储 | 开始前清空一次 `localStorage`，避免旧登录态污染 |

## 3. 总测试链路表

| 顺序 | 模块 | 入口 | 核心目标 |
| --- | --- | --- | --- |
| 0 | 基础健康检查 | `/` `/project` `/console` | 确认服务可访问、路由保护正常 |
| 1 | 公开站点 | `/` | 首页展示、多语言、导航可用 |
| 2 | 认证 | `/login` `/register` `/forgot-password` | 注册、登录、找回密码、回跳正常 |
| 3 | 控制台重定向 | `/console` `/console/settings` | 路由重定向正确 |
| 4 | 项目 Dashboard | `/project` | 项目 CRUD、搜索、预览、Demo 项目创建 |
| 5 | 项目概览页 | `/project/:projectId` | 概览展示、模块跳转、CLI token |
| 6 | 环境管理 | `/project/:projectId/environments` | 环境 CRUD、复制、变量持久化 |
| 7 | 分类管理 | `/project/:projectId/categories` | 分类树 CRUD |
| 8 | API Specs 基础 | `/project/:projectId/api-specs` | spec CRUD、详情联动、深链接 |
| 9 | API Specs AI/分享 | `/project/:projectId/api-specs?ai=create` | AI 草稿、accept、公开分享 |
| 10 | Collections | `/project/:projectId/collections` | collection/request CRUD、发送请求、导入、示例 |
| 11 | Test Cases | `/project/:projectId/test-cases` | 手工创建、从 spec 生成、运行、断言 |
| 12 | Flows | `/project/:projectId/flows` | flow 设计、保存、运行、变量透传 |
| 13 | Histories | `/project/:projectId/histories` | 历史列表、筛选、详情查看 |
| 14 | Members | `/project/:projectId/members` | 成员管理、角色变更、邀请 |
| 15 | Invite Public Flow | `/invite/project/:slug` | 登录前后接受/拒绝邀请 |
| 16 | 账号设置 | `/console/profile` | 更新资料、改密码、退出、删号 |
| 17 | 全局回归 | 全站关键页面 | i18n、移动端、错误态、空态、刷新恢复 |

## 4. 详细测试清单

> 建议执行时，在每个小项后手动补充 `通过 / 不通过 / 备注`。

### 0. 基础健康检查

- [ ] 打开 `/`，页面正常加载。
- [ ] 未登录直接访问 `/project`，会跳转到 `/login`。
- [ ] 未登录直接访问 `/console`，会跳转到 `/login`。
- [ ] 清空浏览器缓存并刷新受保护页，不出现白屏或无限 loading。

### 1. 公开站点

- [ ] 首页 Hero、导航、页脚正常显示。
- [ ] 顶部语言切换可在中文和英文之间切换。
- [ ] 首页 CTA 按钮跳转正常。
- [ ] 页面在桌面宽度下无明显布局错乱。
- [ ] 页面在移动端宽度下无明显布局错乱。

### 2. 认证

#### 2.1 注册

- [ ] 使用 `Owner` 账号完成注册。
- [ ] 注册表单校验正常。
- [ ] 密码与确认密码不一致时有阻止提示。
- [ ] 勾选协议前不能正常提交。
- [ ] 注册成功后自动登录并进入受保护区域。

#### 2.2 登录

- [ ] 退出后重新登录 `Owner`。
- [ ] 从一个受保护页触发登录，例如先访问 `/project` 再登录。
- [ ] 登录成功后能回到原始 `returnUrl`。
- [ ] 刷新浏览器后登录态可恢复。

#### 2.3 忘记密码

- [ ] 访问 `/forgot-password`。
- [ ] 输入邮箱后可正常提交。
- [ ] 成功后页面有成功反馈。

### 3. 控制台重定向

- [ ] 打开 `/console`，应重定向到 `/project`。
- [ ] 打开 `/console/settings`，应重定向到 `/console/profile`。

### 4. 项目 Dashboard

#### 4.1 手工项目链路

- [ ] 在 `/project` 创建 `Project A`。
- [ ] 创建后项目出现在列表中。
- [ ] 搜索项目名称可筛选出目标项目。
- [ ] 编辑项目名称或平台后列表与预览同步更新。
- [ ] 创建一个临时项目并删除，删除后列表刷新正常。

#### 4.2 Demo 项目链路

- [ ] 使用 “Create Demo Project” 创建 `Project B`。
- [ ] Demo 项目创建成功后自动出现在 Dashboard。
- [ ] Demo 项目内至少存在 environment、api spec、request、test case 数据。

### 5. 项目概览页

- [ ] 打开 `/project/:projectId`。
- [ ] 项目概览信息、统计卡片正常显示。
- [ ] 点击各模块入口，路由跳转正确。
- [ ] 生成 CLI token 成功。
- [ ] 复制 CLI token 或命令时无异常。

### 6. 环境管理

- [ ] 新建环境。
- [ ] 编辑环境的 `name`、`display_name`、`base_url`。
- [ ] 编辑环境的 `variables`。
- [ ] 编辑环境的 `headers`。
- [ ] 复制环境成功，复制后的数据可见。
- [ ] 删除环境成功。
- [ ] 新建的环境能在 collections、test cases、flows 中被选择。

### 7. 分类管理

- [ ] 新建根分类。
- [ ] 新建子分类。
- [ ] 编辑分类名称或描述。
- [ ] 删除子分类。
- [ ] 删除根分类。
- [ ] 树结构展示正确，无重复节点或错位。

### 8. API Specs 基础

- [ ] 在 `Project A` 新建一个 API spec。
- [ ] 填写 method、path、summary、description、version、tags。
- [ ] 填写 parameters。
- [ ] 填写 responses。
- [ ] 保存后列表与详情区同步更新。
- [ ] 通过 `?item=` 深链接直达某个 spec。
- [ ] 编辑 spec 后数据正确刷新。
- [ ] 删除 spec 后列表正确更新。

### 9. API Specs AI 与公开分享

#### 9.1 AI 草稿

- [ ] 打开 `/project/:projectId/api-specs?ai=create`。
- [ ] 输入自然语言意图。
- [ ] 流式输出过程正常，无卡死。
- [ ] 可执行 refine。
- [ ] accept 后生成正式 spec。

#### 9.2 分享页

- [ ] 发布 API spec 分享链接。
- [ ] 复制分享链接。
- [ ] 在无痕窗口打开 `/share/api-spec/:slug`。
- [ ] 匿名页面能正确展示 method、path、description、parameters、responses。

### 10. Collections 工作台

#### 10.1 结构与请求 CRUD

- [ ] 新建 folder。
- [ ] 新建 collection。
- [ ] 新建 request。
- [ ] 编辑 request 名称、method、url。
- [ ] 删除 request。
- [ ] 删除 collection。

#### 10.2 请求编辑能力

- [ ] 切换 query params 编辑模式。
- [ ] 切换 headers 编辑模式。
- [ ] 切换 auth 模式。
- [ ] 切换 body 模式，至少覆盖 `json`、`raw`、`form-data`。
- [ ] scratchpad request 能正常创建。
- [ ] tab 复制功能正常。

#### 10.3 请求执行能力

- [ ] 使用环境变量执行请求。
- [ ] GET 请求可返回结果。
- [ ] POST 请求可返回结果。
- [ ] response 面板能看到状态码、headers、body、耗时。
- [ ] 失败请求能正确显示错误反馈。

#### 10.4 导入与示例

- [ ] 导入 Postman collection。
- [ ] 导入 Markdown collection。
- [ ] 导入后 collection tree 正常显示。
- [ ] 保存 response example。
- [ ] 设置默认 example。
- [ ] 重新进入页面 example 仍然存在。

### 11. Test Cases

#### 11.1 用例管理

- [ ] 手工新建 test case。
- [ ] 从 API spec 生成 test case。
- [ ] 复制 test case。
- [ ] 编辑 test case。
- [ ] 删除 test case。

#### 11.2 执行链路

- [ ] 选择环境运行 test case。
- [ ] 断言成功时状态显示正常。
- [ ] 断言失败时状态显示正常。
- [ ] error 状态显示正常。
- [ ] 变量提取结果可查看。
- [ ] run history 列表可查看。
- [ ] run detail 可查看 request/response/assertions。

### 12. Flows

#### 12.1 设计链路

- [ ] 新建 flow。
- [ ] 添加多个 step。
- [ ] 修改 step 的 method、url、headers、body。
- [ ] 配置 capture。
- [ ] 配置 edge 变量映射。
- [ ] 保存 flow 成功。
- [ ] 刷新页面后 flow 结构保持一致。

#### 12.2 执行链路

- [ ] 运行 flow。
- [ ] step 状态随执行推进而更新。
- [ ] 下游 step 能拿到上游捕获变量。
- [ ] flow run 成功时状态正确。
- [ ] flow run 失败时状态和错误信息正确。
- [ ] run detail 中能看到 step results。

### 13. Histories

- [ ] 在执行过 request、test case、flow 后打开 `/histories`。
- [ ] 历史列表正常展示。
- [ ] 按 `entityType` 过滤正常。
- [ ] 打开某条 history 详情。
- [ ] request 类型历史能看到 request/response 数据。
- [ ] flow 类型历史能看到 run/step 数据。

### 14. Members

- [ ] 使用 `Owner` 搜索 `Member` 用户。
- [ ] 添加 `Member` 进入项目。
- [ ] 修改 `Member` 角色。
- [ ] 移除 `Member`。
- [ ] 列表与角色状态实时刷新正常。

### 15. Invite Public Flow

- [ ] 生成邀请链接。
- [ ] 复制邀请链接。
- [ ] 无痕窗口打开 `/invite/project/:slug`。
- [ ] 未登录状态下，邀请页能引导去登录。
- [ ] 登录后接受邀请成功。
- [ ] 重新生成一条邀请并测试拒绝链路。
- [ ] 撤销邀请后，旧邀请不可继续使用。

### 16. 账号设置

- [ ] 打开 `/console/profile`。
- [ ] 修改昵称、头像、手机号、简介。
- [ ] 修改密码。
- [ ] 退出登录。
- [ ] 重新登录验证新密码。
- [ ] 如允许在测试环境操作，再单独验证删号链路。

### 17. 全局回归

- [ ] 全站中英文切换后关键页面文案正常。
- [ ] 桌面端关键页面布局正常。
- [ ] 移动端关键页面布局正常。
- [ ] 空列表、加载中、失败态 UI 正常。
- [ ] toast 不重复弹出。
- [ ] 刷新受保护页后不会出现假登录或无限 loading。
- [ ] 浏览器控制台无持续报错。

## 5. 建议重点关注的高风险点

| 场景 | 原因 |
| --- | --- |
| 登录后刷新受保护页 | 当前登录态依赖 `auth-store` 持久化与恢复，最容易出现假登录或白屏 |
| `?item=`、`?ai=create`、`?quickRequest=1`、`?fromSpec=` | 这些深链接是工作区真实入口，不测容易漏回归 |
| 分享页与邀请页 | 都是公开路由，和受保护页面链路不同，必须单独测 |
| Demo 项目和手工项目都要测 | Demo 验证联动执行，手工项目验证真实 CRUD 链路 |
| 第二账号权限变化 | 成员、邀请、项目访问控制会一起暴露问题 |

## 6. 简易测试记录表

| 编号 | 模块 | 是否通过 | 问题描述 | 复现步骤 |
| --- | --- | --- | --- | --- |
| 1 | 公开站点 |  |  |  |
| 2 | 认证 |  |  |  |
| 3 | 项目 Dashboard |  |  |  |
| 4 | 项目概览 |  |  |  |
| 5 | 环境管理 |  |  |  |
| 6 | 分类管理 |  |  |  |
| 7 | API Specs |  |  |  |
| 8 | Collections |  |  |  |
| 9 | Test Cases |  |  |  |
| 10 | Flows |  |  |  |
| 11 | Histories |  |  |  |
| 12 | Members/Invite |  |  |  |
| 13 | 账号设置 |  |  |  |
| 14 | 全局回归 |  |  |  |
