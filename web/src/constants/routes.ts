// 全局路由表。
// 作用：统一管理站点、认证和控制台页面路径，避免硬编码散落在组件中。
export const ROUTES = {
  // 站点公开路由。
  SITE: {
    HOME: '/',
    ABOUT: '/about',
    CONTACT: '/contact',
    API_SPEC_SHARE: '/share/api-spec/:slug',
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
    PROJECTS: '/project',
    PROJECT_DETAIL: '/project/:projectId',
    PROJECT_COLLECTIONS: '/project/:projectId/collections',
    PROJECT_CATEGORIES: '/project/:projectId/categories',
    PROJECT_ENVIRONMENTS: '/project/:projectId/environments',
    PROJECT_API_SPECS: '/project/:projectId/api-specs',
    PROJECT_HISTORIES: '/project/:projectId/histories',
    PROJECT_FLOWS: '/project/:projectId/flows',
    PROJECT_TEST_CASES: '/project/:projectId/test-cases',
    SETTINGS: '/console/settings',
    USERS: '/console/users',
    STYLEGUIDE: '/styleguide',
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
export function buildRoute(
  basePath: string,
  params?: Record<string, string | number>
): string {
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
export function buildProjectDetailRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_DETAIL, { projectId });
}

// 项目 collections 动态路由 helper。
// 作用：为 `/project/:projectId/collections` 生成稳定地址，供工作区一级导航复用。
export function buildProjectCollectionsRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_COLLECTIONS, { projectId });
}

// 项目环境动态路由 helper。
// 作用：为 `/project/:projectId/environments` 生成稳定地址，作为环境管理页入口。
export function buildProjectEnvironmentsRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_ENVIRONMENTS, { projectId });
}

// 项目分类动态路由 helper。
// 作用：为 `/project/:projectId/categories` 生成稳定地址，作为分类管理页入口。
export function buildProjectCategoriesRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_CATEGORIES, { projectId });
}

// 项目 API 规格动态路由 helper。
// 作用：为 `/project/:projectId/api-specs` 生成稳定地址，避免业务组件手写模板字符串。
export function buildProjectApiSpecsRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_API_SPECS, { projectId });
}

// 项目 Histories 动态路由 helper。
// 作用：为 `/project/:projectId/histories` 生成稳定地址，供工作区一级导航复用。
export function buildProjectHistoriesRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_HISTORIES, { projectId });
}

// 项目 Flows 动态路由 helper。
// 作用：为 `/project/:projectId/flows` 生成稳定地址，供工作区一级导航复用。
export function buildProjectFlowsRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_FLOWS, { projectId });
}

// 项目 Test Cases 动态路由 helper。
// 作用：为 `/project/:projectId/test-cases` 生成稳定地址，避免业务组件手写模板字符串。
export function buildProjectTestCasesRoute(projectId: string | number): string {
  return buildRoute(ROUTES.CONSOLE.PROJECT_TEST_CASES, { projectId });
}

// API spec 分享页路由 helper。
// 作用：为匿名公开接口页生成稳定地址，便于复制外部访问链接。
export function buildApiSpecShareRoute(slug: string): string {
  return buildRoute(ROUTES.SITE.API_SPEC_SHARE, { slug });
}
