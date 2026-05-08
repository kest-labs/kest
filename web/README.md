# 🚀 LlamaFront AI Scaffold

A modern, AI-powered frontend application scaffold designed for the AI era. Built specifically for vibe coding and AI-assisted development, LlamaFront provides everything you need to build intelligent, scalable, and performant frontend applications with maximum developer productivity.

## ✨ Frontend-First AI Features

- 🎨 **Component-Driven**: Extensive UI component library with Radix UI and custom designs
- 🚀 **Performance Optimized**: Next.js 16.1.1 App Router with automatic code splitting
- 🌙 **Theme System**: Beautiful dark/light themes with CSS variables
- 📱 **Mobile-First**: Responsive design for all screen sizes
- 🔍 **TypeScript**: Full type safety and excellent DX (TypeScript 5.9+)
- ⚡ **Hot Reload**: Instant development feedback with Next.js Turbopack
- 🤖 **AI-Ready**: Clean patterns for AI code generation and "vibe coding"
- 🔐 **Auth Integration**: Built-in authentication patterns with persistent storage
- 📊 **State Management**: Zustand 5.0 for predictable, granular state handling
- 🌍 **I18n**: Full internationalization support with `next-intl`
- 🎨 **Styleguide Explorer**: Pre-built component gallery and design system playground
- 🛠️ **Developer Tools**: Pre-configured ESLint 9, Prettier, and Vitest

## 🤖 AI Developer Experience

- **AI-Friendly Code Structure**: Clean, predictable patterns that AI tools (like Windsurf, Cursor, Bolt) understand
- **Smart Component Design**: Components designed for AI generation and modification, utilizing Atomic Design principles
- **Type Safety**: Comprehensive TypeScript types for better AI code completion and error prevention
- **Documentation**: Rich JSDoc comments for AI context understanding
- **Error Handling**: Standardized error handling patterns for AI debugging assistance

## 🆕 Latest Updates (v2.1.0)

- ✅ **Next.js 16.1.1** - Latest stable version
- ✅ **React 19.2.3** - Full support for React 19 features
- ✅ **Tailwind CSS 4.1.18** - Modern utility-first CSS
- ✅ **Next-Intl 4.6** - Comprehensive i18n solution
- ✅ **Zustand 5.0** - Optimized state management
- ✅ **Architecture Guide** - Comprehensive guide for building scalable AI-ready apps

👉 Check out the [Optimization Summary Report](docs/OPTIMIZATION_SUMMARY.md) for details.

## 🛠️ Frontend-Optimized Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Library**: React 19.2.3
- **Language**: TypeScript 5.9.3 (Strict Mode)
- **Styling**: Tailwind CSS 4.1.18 + PostCSS
- **UI Components**: Radix UI + Lucide Icons
- **State Management**: Zustand 5.0.9
- **Data Fetching**: TanStack Query v5
- **Forms**: React Hook Form 7.69 + Zod 4.2
- **Theming**: Next-Themes 0.4
- **Testing**: Vitest 4.0 + Testing Library

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 10+ (Recommended)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/llamacto/llamafront-ai-scaffold.git
   cd llamafront-ai-scaffold
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run the development server**

   ```bash
   pnpm dev
   ```

5. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Current Kest Frontend Structure

```text
src/
├── app/
│   ├── (site)/                    # 公开首页 `/`
│   ├── (auth)/                    # `/login` `/register` `/forgot-password`
│   ├── (normal)/                  # 受保护路由，统一走 `AuthGuard`
│   │   ├── console/               # 账号资料与控制台壳层
│   │   ├── project/               # 项目 dashboard、详情页、工作区
│   │   └── i18n-test/             # 多语言验证页
│   ├── invite/project/[slug]/     # 公开项目邀请页
│   └── share/api-spec/[slug]/     # 公开 API 文档分享页
├── components/
│   ├── ui/                        # 按钮、表格、对话框、Tabs 等基础组件
│   ├── common/                    # 语言切换、通用边界组件
│   └── features/
│       ├── site/                  # 营销首页
│       ├── auth/                  # 登录/注册/忘记密码
│       ├── console/               # 控制台壳层、账号设置
│       └── project/               # 项目核心业务模块
├── hooks/                         # React Query hooks，按业务拆分
├── services/                      # API 调用封装
├── http/                          # Axios client + 全局错误处理
├── store/                         # Auth / UI / Onboarding 的 Zustand 状态
├── providers/                     # Theme / Query / Auth Provider
├── i18n/                          # 多语言文案与 locale 解析
├── types/                         # 业务类型定义
└── test/ + utils/__tests__/       # 当前自动化测试
```

| 层级 | 实际代码位置 | 主要职责 | 测试时最容易出问题的点 |
| --- | --- | --- | --- |
| 路由与布局层 | `src/app/**` | 路由分组、受保护页面、公开分享页 | 跳转链路、动态路由参数、刷新后状态恢复 |
| 业务组件层 | `src/components/features/**` | 项目 dashboard、API specs、collections、flows、members 等 | 表单状态、弹窗、列表与详情同步、权限控制 |
| 数据访问层 | `src/hooks/**` + `src/services/**` | React Query 缓存、接口请求、mutation 刷新 | 新增后列表不刷新、缓存 key 冲突、错误态未回收 |
| 状态层 | `src/store/**` | 登录态、引导态、UI 状态持久化 | 本地持久化污染、刷新后假登录、首次加载闪烁 |
| 跨领域能力 | `src/i18n/**` `src/providers/**` `src/http/**` | 国际化、主题、全局错误处理 | 多语言 key 缺失、toast 重复、深浅色/响应式回归 |

## 📊 Current Functional Areas

| 模块 | 页面入口 | 当前能力 | 依赖关系 |
| --- | --- | --- | --- |
| Public Site | `/` | 营销首页、导航、页脚、多语言切换 | 独立模块，主要验收展示与可访问性 |
| Auth | `/login` `/register` `/forgot-password` | 登录、注册、找回密码、`returnUrl` 回跳 | 所有受保护页面的前置条件 |
| Project Dashboard | `/project` | 项目列表、搜索、预览、创建/编辑/删除、创建 Demo 项目 | 进入全部工作区的主入口 |
| Project Detail | `/project/:projectId` | 项目概览、模块入口、CLI token 生成 | 依赖项目已创建 |
| Workspace Core | `/project/:projectId/*` | 模块侧栏、二层列表、详情区、深链接 `?item=` | 依赖项目详情与权限 |
| API Specs | `/project/:projectId/api-specs` | API spec CRUD、AI 草稿、文档分享、示例 | 依赖项目；测试用例与公开分享页依赖它 |
| Environments / Categories | `/environments` `/categories` | 环境变量、Base URL、分类树 | collections、test cases、flows 会复用环境或分类 |
| Collections | `/collections` | 请求集合、请求编辑器、运行、示例、导入 | 依赖环境；history 会记录执行结果 |
| Test Cases | `/test-cases` | 手工创建、从 spec 生成、运行、断言、提取变量 | 强依赖 API specs 与 environments |
| Flows | `/flows` | 节点编排、变量透传、保存、运行、SSE/本地执行 | 依赖请求定义、环境、history |
| Members / Invitation | `/members` + `/invite/project/:slug` | 成员管理、角色调整、邀请链接、接受/拒绝邀请 | 依赖登录态与角色权限 |
| Histories / Share | `/histories` + `/share/api-spec/:slug` | 请求/测试/flow 历史查看，公开文档页 | 依赖前面业务模块产生数据 |

## 🚀 Deployment

### Vercel (Recommended)
Deployment is seamless on Vercel with zero configuration.

### Docker
```bash
docker build -t llamafront-web .
docker run -p 3000:3000 llamafront-web
```

## 🧪 Scripts

```bash
pnpm dev          # Start development with Turbopack
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint & Type-check
pnpm test         # Run unit tests
pnpm format       # Format with Prettier
```

## ✅ Frontend Manual Test Order

建议顺序不要按“页面菜单顺序”测，而要按“依赖链”测：`认证 -> 项目 -> 环境/分类 -> API Specs -> Collections -> Test Cases -> Flows -> Histories/Invite/Share -> 账号与全局回归`。这样一旦上游有问题，可以更快定位。

| 顺序 | 功能域 | 入口 | 前置条件 | 重点验证 | 通过标准 |
| --- | --- | --- | --- | --- | --- |
| 0 | 基础健康检查 | `pnpm lint` `pnpm type-check` `pnpm test` | Node / env 正常 | 编译、类型、现有单测先过 | 没有构建级错误，再进入手工测试 |
| 1 | 登录态与路由保护 | `/login` `/register` `/forgot-password` 任一受保护页 | 无 | 表单提交、错误 toast、`returnUrl` 回跳、未登录访问受保护页自动跳转、刷新后会话恢复 | 登录成功跳回目标页；未登录不能直接进 `/project` |
| 2 | 项目 dashboard | `/project` | 已登录 | 项目列表加载、搜索、预览切换、创建、编辑、删除、创建 Demo 项目 | 新项目立即可见；Demo 项目能自动种出 environment/spec/request/test case |
| 3 | 项目概览页 | `/project/:projectId` | 至少 1 个项目 | 概览卡片、模块跳转、CLI token 生成与复制、状态展示 | 各模块入口跳转正确，生成的 token/命令可复制 |
| 4 | 环境管理 | `/project/:projectId/environments` | 已有项目 | 新增、编辑、复制、删除环境；`base_url`、`variables`、`headers` 持久化 | 新环境能在 collections / test cases / flows 的环境选择器里出现 |
| 5 | 分类管理 | `/project/:projectId/categories` | 已有项目 | 根分类/子分类新增、编辑、删除、树结构显示 | API spec 创建或编辑时能正确关联分类 |
| 6 | API Specs 基础 CRUD | `/project/:projectId/api-specs` | 已有项目，最好先有分类 | 新建/编辑/删除 spec，版本、标签、参数、响应、详情区同步、`?item=` 深链接 | 列表和详情联动正确，刷新后数据不丢 |
| 7 | API Specs AI 与公开分享 | `/project/:projectId/api-specs?ai=create` | 已有项目 | AI 草稿流式输出、接受草稿、二次 refine、发布分享、打开公开分享页 | 接受后生成正式 spec；分享页匿名可访问并正确展示 method/path/doc/params/responses |
| 8 | Collections 工作台 | `/project/:projectId/collections` | 已有项目，最好已有环境 | 新建 collection/folder/request、scratchpad tab、复制 tab、保存请求、切换 body/auth 模式、发送请求、导入 Postman/Markdown、响应示例保存/设默认 | 请求可执行、响应面板正常、示例可回读、导入后树结构可继续编辑 |
| 9 | Test Cases | `/project/:projectId/test-cases` | 已有 API spec 与环境 | 手工创建、从 spec 生成、复制、编辑、运行、断言结果、变量提取、运行历史筛选 | 运行结果与断言显示完整，环境变量和提取变量生效 |
| 10 | Flows | `/project/:projectId/flows` | 已有环境；最好已有请求场景 | 新建 flow、添加 step/edge、保存、运行、本地变量透传、运行结果流式更新 | 下游 step 能拿到上游变量；run 状态、step log、历史链接正常 |
| 11 | Histories | `/project/:projectId/histories` | 先执行过 request/test case/flow | 历史列表、按 `entityType` 过滤、详情页查看 request/response/run 数据 | collections、test cases、flows 的操作都能沉淀可读历史 |
| 12 | 成员与邀请 | `/project/:projectId/members`、`/invite/project/:slug` | 至少两个用户更佳 | 搜索用户加成员、改角色、移除成员、生成邀请、复制链接、撤销邀请、登录前后接受/拒绝邀请 | 角色权限生效；邀请页对未登录用户能跳登录并回跳 |
| 13 | 账号设置 | `/console/profile` | 已登录 | 更新资料、改密码、登出、删除账号 | 更新后 UI 立即同步；删除账号后强制退出 |
| 14 | 全局回归 | `/` + 全站关键页 | 前面流程已测过 | 中英文切换、主题切换、移动端、toast、空态、加载态、接口失败态 | 无明显布局破坏、无死链、无持续 console error |

## 🧪 Current Automated Coverage

| 覆盖区域 | 文件 | 说明 |
| --- | --- | --- |
| 营销首页渲染 | `src/test/marketing-home-page.test.tsx` | 只覆盖公开首页的大块内容渲染 |
| i18n 解析与文案一致性 | `src/test/resolve-locale.test.ts` `src/test/i18n-key-parity.test.ts` | 主要保证 locale 解析和中英文 key 对齐 |
| Flow 本地执行核心逻辑 | `src/services/local-flow-runner.test.ts` | 覆盖了变量透传、相对 URL 解析、失败场景 |
| 通用交互与工具函数 | `src/components/features/project/action-menu.test.tsx` `src/utils/__tests__/*` | 只覆盖局部交互和纯函数 |

业务主链路目前仍应以手工联调为主，优先测试 `AuthGuard`、项目工作区、collections、test cases、flows 和邀请/分享链路。

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

Made with ❤️ by Llamacto Team for the AI Development Community
