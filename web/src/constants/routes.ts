// 全局路由表。
// 作用：统一管理站点、认证和控制台页面路径，避免硬编码散落在组件中。
export const ROUTES = {
  // 站点公开路由。
  SITE: {
    HOME: '/',
    ABOUT: '/about',
    CONTACT: '/contact',
    API_SPEC_SHARE: '/share/api-spec/:slug',
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
    PROJECTS: '/workspace',
    PROJECT_DETAIL: '/project/:projectId',
    PROJECT_COLLECTIONS: '/project/:projectId/collections',
    PROJECT_CATEGORIES: '/project/:projectId/categories',
    PROJECT_ENVIRONMENTS: '/project/:projectId/environments',
    PROJECT_MEMBERS: '/project/:projectId/members',
    PROJECT_KEYS: '/project/:projectId/keys',
    PROJECT_API_SPECS: '/project/:projectId/api-specs',
    PROJECT_HISTORIES: '/project/:projectId/histories',
    PROJECT_FLOWS: '/project/:projectId/flows',
    PROJECT_TEST_CASES: '/project/:projectId/test-cases',
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
export function buildWorkspaceDashboardRoute(): string {
  return ROUTES.CONSOLE.WORKSPACES;
}

export function buildWorkspaceDetailRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_DETAIL, { workspaceId });
}

export function buildWorkspaceCollectionsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_COLLECTIONS, { workspaceId });
}

export function buildWorkspaceEnvironmentsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_ENVIRONMENTS, { workspaceId });
}

export function buildWorkspaceMembersRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_MEMBERS, { workspaceId });
}

export function buildWorkspaceKeysRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_KEYS, { workspaceId });
}

export function buildWorkspaceCategoriesRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_CATEGORIES, { workspaceId });
}

export function buildWorkspaceApiSpecsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_API_SPECS, { workspaceId });
}

export function buildWorkspaceHistoriesRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_HISTORIES, { workspaceId });
}

export function buildWorkspaceFlowsRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_FLOWS, { workspaceId });
}

export function buildWorkspaceTestCasesRoute(workspaceId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.WORKSPACE_TEST_CASES, { workspaceId });
}

// Legacy project route helpers kept for old public/internal callers.
export function buildProjectDetailRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_DETAIL, { projectId });
}

export function buildProjectCollectionsRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_COLLECTIONS, { projectId });
}

export function buildProjectEnvironmentsRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_ENVIRONMENTS, { projectId });
}

export function buildProjectMembersRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_MEMBERS, { projectId });
}

export function buildProjectKeysRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_KEYS, { projectId });
}

export function buildProjectCategoriesRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_CATEGORIES, { projectId });
}

export function buildProjectApiSpecsRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_API_SPECS, { projectId });
}

export function buildProjectHistoriesRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_HISTORIES, { projectId });
}

export function buildProjectFlowsRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_FLOWS, { projectId });
}

export function buildProjectTestCasesRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_TEST_CASES, { projectId });
}

// API spec 分享页路由 helper。
// 作用：为匿名公开接口页生成稳定地址，便于复制外部访问链接。
export function buildApiSpecShareRoute(slug: string): string {
  return buildRoute(ROUTES.SITE.API_SPEC_SHARE, { slug });
}

// 项目邀请页路由 helper。
// 作用：为公开邀请页生成稳定地址，方便成员管理页复制可分享链接。
export function buildProjectInviteRoute(slug: string): string {
  return buildRoute(ROUTES.SITE.PROJECT_INVITE, { slug });
}
