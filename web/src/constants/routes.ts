// 全局路由表。
// 作用：统一管理站点、认证和控制台页面路径，避免硬编码散落在组件中。
export const ROUTES = {
  // 站点公开路由。
  SITE: {
    HOME: '/',
    ABOUT: '/about',
    CONTACT: '/contact',
    API_SPEC_SHARE: '/share/api-spec/:slug',
    WORKSPACE_INVITE: '/invite/workspace/:slug',
  },

  // 认证相关路由。
  AUTH: {
    LOGIN: '/login',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
  },

  // 控制台相关路由。
  CONSOLE: {
    HOME: '/console',
    ANALYTICS: '/console/analytics',
    WORKSPACES: '/workspace',
    WORKSPACE_DETAIL: '/workspace/:workspaceId',
    WORKSPACE_COLLECTIONS: '/workspace/:workspaceId/collections',
    WORKSPACE_CATEGORIES: '/workspace/:workspaceId/categories',
    WORKSPACE_ENVIRONMENTS: '/workspace/:workspaceId/environments',
    WORKSPACE_MEMBERS: '/workspace/:workspaceId/members',
    WORKSPACE_KEYS: '/workspace/:workspaceId/keys',
    WORKSPACE_API_SPECS: '/workspace/:workspaceId/api-specs',
    WORKSPACE_HISTORIES: '/workspace/:workspaceId/histories',
    WORKSPACE_FLOWS: '/workspace/:workspaceId/flows',
    WORKSPACE_TEST_CASES: '/workspace/:workspaceId/test-cases',
    PROFILE: '/console/profile',
    SETTINGS: '/console/settings',
  },
} as const;

// 类型安全的路由 key。
type SiteRoutes = keyof typeof ROUTES.SITE;
type AuthRoutes = keyof typeof ROUTES.AUTH;
type ConsoleRoutes = keyof typeof ROUTES.CONSOLE;

// 路由 value 类型导出，方便组件层拿到精确字符串联合类型。
export type SiteRoute = (typeof ROUTES.SITE)[SiteRoutes];
export type AuthRoute = (typeof ROUTES.AUTH)[AuthRoutes];
export type ConsoleRoute = (typeof ROUTES.CONSOLE)[ConsoleRoutes];

// 动态路由替换工具。
// 作用：把 `/users/:id` 这类模板路径安全替换成实际地址。
export function buildRoute(basePath: string, params?: Record<string, string | number>): string {
  let route = basePath;

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      route = route.replace(`:${key}`, String(value));
    });
  }

  return route;
}

// 导航辅助方法，减少直接访问对象属性时的重复代码。
export function getSiteRoute(route: SiteRoutes): string {
  return ROUTES.SITE[route];
}

export function getAuthRoute(route: AuthRoutes): string {
  return ROUTES.AUTH[route];
}

export function getConsoleRoute(route: ConsoleRoutes): string {
  return ROUTES.CONSOLE[route];
}

// 工作区详情动态路由 helper。
// 作用：为 `/workspace/:workspaceId` 生成稳定地址，作为工作区 stats 与详情页入口。
export function buildWorkspaceDetailRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_DETAIL, { workspaceId });
}

// 工作区 collections 动态路由 helper。
// 作用：为 `/workspace/:workspaceId/collections` 生成稳定地址，供工作区一级导航复用。
export function buildWorkspaceCollectionsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_COLLECTIONS, { workspaceId });
}

// 工作区环境动态路由 helper。
// 作用：为 `/workspace/:workspaceId/environments` 生成稳定地址，作为环境管理页入口。
export function buildWorkspaceEnvironmentsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_ENVIRONMENTS, { workspaceId });
}

// 工作区成员动态路由 helper。
// 作用：为 `/workspace/:workspaceId/members` 生成稳定地址，作为成员管理页入口。
export function buildWorkspaceMembersRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_MEMBERS, { workspaceId });
}

// 工作区 Keys 动态路由 helper。
// 作用：为 `/workspace/:workspaceId/keys` 生成稳定地址，作为 CLI/Web 连接密钥管理入口。
export function buildWorkspaceKeysRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_KEYS, { workspaceId });
}

// 工作区分类动态路由 helper。
// 作用：为 `/workspace/:workspaceId/categories` 生成稳定地址，作为分类管理页入口。
export function buildWorkspaceCategoriesRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_CATEGORIES, { workspaceId });
}

// 工作区 API 规格动态路由 helper。
// 作用：为 `/workspace/:workspaceId/api-specs` 生成稳定地址，避免业务组件手写模板字符串。
export function buildWorkspaceApiSpecsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_API_SPECS, { workspaceId });
}

// 工作区 Histories 动态路由 helper。
// 作用：为 `/workspace/:workspaceId/histories` 生成稳定地址，供工作区一级导航复用。
export function buildWorkspaceHistoriesRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_HISTORIES, { workspaceId });
}

// 工作区 Flows 动态路由 helper。
// 作用：为 `/workspace/:workspaceId/flows` 生成稳定地址，供工作区一级导航复用。
export function buildWorkspaceFlowsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_FLOWS, { workspaceId });
}

// 工作区 Test Cases 动态路由 helper。
// 作用：为 `/workspace/:workspaceId/test-cases` 生成稳定地址，避免业务组件手写模板字符串。
export function buildWorkspaceTestCasesRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_TEST_CASES, { workspaceId });
}

// API spec 分享页路由 helper。
// 作用：为匿名公开接口页生成稳定地址，便于复制外部访问链接。
export function buildApiSpecShareRoute(slug: string): string {
  return buildRoute(ROUTES.SITE.API_SPEC_SHARE, { slug });
}

// Workspace invitation page route helper.
export function buildWorkspaceInviteRoute(slug: string): string {
  return buildRoute(ROUTES.SITE.WORKSPACE_INVITE, { slug });
}
