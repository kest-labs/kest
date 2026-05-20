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
    PROJECT_INVITE: '/invite/project/:slug',
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
    PROJECTS: '/workspace',
    PROJECT_DETAIL: '/workspace/:workspaceId',
    PROJECT_COLLECTIONS: '/workspace/:workspaceId/collections',
    PROJECT_CATEGORIES: '/workspace/:workspaceId/categories',
    PROJECT_ENVIRONMENTS: '/workspace/:workspaceId/environments',
    PROJECT_MEMBERS: '/workspace/:workspaceId/members',
    PROJECT_KEYS: '/workspace/:workspaceId/keys',
    PROJECT_API_SPECS: '/workspace/:workspaceId/api-specs',
    PROJECT_HISTORIES: '/workspace/:workspaceId/histories',
    PROJECT_FLOWS: '/workspace/:workspaceId/flows',
    PROJECT_TEST_CASES: '/workspace/:workspaceId/test-cases',
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

// 项目详情动态路由 helper。
// 作用：为 `/project/:projectId` 生成稳定地址，作为项目 stats 与详情页入口。
export function buildProjectDetailRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_DETAIL, { workspaceId });
}

// 项目 collections 动态路由 helper。
// 作用：为 `/project/:projectId/collections` 生成稳定地址，供工作区一级导航复用。
export function buildProjectCollectionsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_COLLECTIONS, { workspaceId });
}

// 项目环境动态路由 helper。
// 作用：为 `/project/:projectId/environments` 生成稳定地址，作为环境管理页入口。
export function buildProjectEnvironmentsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_ENVIRONMENTS, { workspaceId });
}

// 项目成员动态路由 helper。
// 作用：为 `/project/:projectId/members` 生成稳定地址，作为成员管理页入口。
export function buildProjectMembersRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_MEMBERS, { workspaceId });
}

// 项目 Keys 动态路由 helper。
// 作用：为 `/project/:projectId/keys` 生成稳定地址，作为 CLI/Web 连接密钥管理入口。
export function buildProjectKeysRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_KEYS, { workspaceId });
}

// 项目分类动态路由 helper。
// 作用：为 `/project/:projectId/categories` 生成稳定地址，作为分类管理页入口。
export function buildProjectCategoriesRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_CATEGORIES, { workspaceId });
}

// 项目 API 规格动态路由 helper。
// 作用：为 `/project/:projectId/api-specs` 生成稳定地址，避免业务组件手写模板字符串。
export function buildProjectApiSpecsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_API_SPECS, { workspaceId });
}

// 项目 Histories 动态路由 helper。
// 作用：为 `/project/:projectId/histories` 生成稳定地址，供工作区一级导航复用。
export function buildProjectHistoriesRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_HISTORIES, { workspaceId });
}

// 项目 Flows 动态路由 helper。
// 作用：为 `/project/:projectId/flows` 生成稳定地址，供工作区一级导航复用。
export function buildProjectFlowsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_FLOWS, { workspaceId });
}

// 项目 Test Cases 动态路由 helper。
// 作用：为 `/project/:projectId/test-cases` 生成稳定地址，避免业务组件手写模板字符串。
export function buildProjectTestCasesRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_TEST_CASES, { workspaceId });
}

// API spec 分享页路由 helper。
// 作用：为匿名公开接口页生成稳定地址，便于复制外部访问链接。
export function buildApiSpecShareRoute(slug: string): string {
  return buildRoute(ROUTES.SITE.API_SPEC_SHARE, { slug });
}

// 项目邀请页路由 helper。
// 作用：为公开邀请页生成稳定地址，方便成员管理页复制可分享链接。
export function buildProjectInviteRoute(slug: string): string {
  return buildRoute(ROUTES.SITE.WORKSPACE_INVITE, { slug });
}
