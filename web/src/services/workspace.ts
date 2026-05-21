import request from '@/http';
import type { RequestConfig } from '@/http/request';
import type {
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
const normalizeWorkspacePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as T;

// Workspace 服务层。
// 作用：集中封装 workspace 相关 HTTP 请求，供 hooks 和页面复用。
export const workspaceService = {
  list: ({ page = 1, perPage = 12 }: ProjectListParams = {}) =>
    request.get<ProjectListResponse>('/workspaces', {
      params: {
        page,
        per_page: perPage,
      },
    }),

  getById: (id: number | string, config?: RequestConfig) =>
    request.get<ApiProject>(`/workspaces/${id}`, config),

  getStats: (id: number | string, config?: RequestConfig) =>
    request.get<ProjectStats>(`/workspaces/${id}/stats`, config),

  create: (data: CreateProjectRequest) =>
    request.post<ApiProject>('/workspaces', normalizeWorkspacePayload(data)),

  update: (id: number | string, data: UpdateProjectRequest) =>
    request.patch<ApiProject>(`/workspaces/${id}`, normalizeWorkspacePayload(data)),

  generateCliToken: (id: number | string, data: GenerateProjectCliTokenRequest = {}) =>
    request.post<GenerateProjectCliTokenResponse>(
      `/workspaces/${id}/cli-tokens`,
      normalizeWorkspacePayload(data)
    ),

  delete: (id: number | string) => request.delete<DeleteProjectResponse>(`/workspaces/${id}`),
};

// Transitional export: hooks/components are renamed in the next module.
export const projectService = workspaceService;

export type WorkspaceService = typeof workspaceService;
export type ProjectService = typeof projectService;
