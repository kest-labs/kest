import request from '@/http';
import type { RequestConfig } from '@/http/request';
import type {
  ApiWorkspace,
  ApiProject,
  CreateProjectRequest,
  DeleteProjectResponse,
  GenerateProjectCliTokenRequest,
  GenerateProjectCliTokenResponse,
  ProjectListParams,
  ProjectListResponse,
  ProjectStats,
  UpdateProjectRequest,
} from '@/types/project';

// 统一清理空字段。
// 作用：避免把空字符串或未定义值传给后端，保持请求体更贴近实际更新字段。
const normalizeProjectPayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as T;

const toApiProject = (workspace: ApiWorkspace): ApiProject => ({
  id: workspace.id,
  name: workspace.name,
  slug: workspace.slug,
  platform: '',
  role: workspace.role,
  status: 1,
  created_at: workspace.created_at,
});

const toProjectListResponse = (workspaces: ApiWorkspace[]): ProjectListResponse => ({
  items: workspaces.map(toApiProject),
  meta: {
    total: workspaces.length,
    page: 1,
    per_page: workspaces.length,
    pages: 1,
  },
});

const toCreateWorkspacePayload = (data: CreateProjectRequest) =>
  normalizeProjectPayload({
    name: data.name,
    slug: data.slug,
    type: data.type ?? 'team',
    visibility: data.visibility ?? 'team',
    description: data.description,
  });

const toUpdateWorkspacePayload = (data: UpdateProjectRequest) =>
  normalizeProjectPayload({
    name: data.name,
    visibility: data.visibility,
    description: data.description,
  });

// 项目服务层。
// 作用：集中封装项目相关 HTTP 请求，供 hooks 和页面复用。
export const projectService = {
  list: ({ page = 1, perPage = 12 }: ProjectListParams = {}) =>
    request.get<ApiWorkspace[]>('/workspaces').then(workspaces => {
      const start = (page - 1) * perPage;
      const paginated = workspaces.slice(start, start + perPage);
      return {
        ...toProjectListResponse(paginated),
        meta: {
          total: workspaces.length,
          page,
          per_page: perPage,
          pages: Math.max(1, Math.ceil(workspaces.length / perPage)),
        },
      };
    }),

  getById: (id: number | string, config?: RequestConfig) =>
    request.get<ApiWorkspace>(`/workspaces/${id}`, config).then(toApiProject),

  getStats: (id: number | string, config?: RequestConfig) =>
    Promise.all([
      request.get<{ items?: unknown[]; total?: number } | unknown[]>(`/workspaces/${id}/api-specs`, {
        ...config,
        params: { page: 1, page_size: 1 },
        skipErrorHandler: true,
      }),
      request.get<{ items?: unknown[]; total?: number } | unknown[]>(`/workspaces/${id}/environments`, {
        ...config,
        skipErrorHandler: true,
      }),
      request.get<unknown[]>(`/workspaces/${id}/members`, {
        ...config,
        skipErrorHandler: true,
      }),
      request.get<{ items?: unknown[]; total?: number } | unknown[]>(`/workspaces/${id}/categories`, {
        ...config,
        params: { tree: true },
        skipErrorHandler: true,
      }),
    ])
      .then(([apiSpecs, environments, members, categories]): ProjectStats => ({
        api_spec_count: Array.isArray(apiSpecs) ? apiSpecs.length : apiSpecs.total ?? apiSpecs.items?.length ?? 0,
        flow_count: 0,
        environment_count: Array.isArray(environments)
          ? environments.length
          : environments.total ?? environments.items?.length ?? 0,
        member_count: Array.isArray(members) ? members.length : 0,
        category_count: Array.isArray(categories)
          ? categories.length
          : categories.total ?? categories.items?.length ?? 0,
      }))
      .catch((): ProjectStats => ({
        api_spec_count: 0,
        flow_count: 0,
        environment_count: 0,
        member_count: 0,
        category_count: 0,
      })),

  create: (data: CreateProjectRequest) =>
    request.post<ApiWorkspace>('/workspaces', toCreateWorkspacePayload(data)).then(toApiProject),

  update: (id: number | string, data: UpdateProjectRequest) =>
    request.patch<ApiWorkspace>(`/workspaces/${id}`, toUpdateWorkspacePayload(data)).then(toApiProject),

  generateCliToken: (id: number | string, data: GenerateProjectCliTokenRequest = {}) =>
    request.post<GenerateProjectCliTokenResponse>(
      `/workspaces/${id}/cli-tokens`,
      normalizeProjectPayload(data)
    ),

  delete: (id: number | string) => request.delete<DeleteProjectResponse>(`/workspaces/${id}`),
};

export type ProjectService = typeof projectService;
