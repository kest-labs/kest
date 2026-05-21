import request from '@/http';
import type { RequestConfig } from '@/http/request';
import type {
  ApiWorkspace,
  CreateWorkspaceRequest,
  DeleteWorkspaceResponse,
  GenerateWorkspaceCliTokenRequest,
  GenerateWorkspaceCliTokenResponse,
  WorkspaceListParams,
  WorkspaceListResponse,
  WorkspaceStats,
  UpdateWorkspaceRequest,
} from '@/types/workspace';

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
  list: ({ page = 1, perPage = 12 }: WorkspaceListParams = {}) =>
    request.get<WorkspaceListResponse>('/workspaces', {
      params: {
        page,
        per_page: perPage,
      },
    }),

  getById: (id: number | string, config?: RequestConfig) =>
    request.get<ApiWorkspace>(`/workspaces/${id}`, config),

  getStats: (id: number | string, config?: RequestConfig) =>
    request.get<WorkspaceStats>(`/workspaces/${id}/stats`, config),

  create: (data: CreateWorkspaceRequest) =>
    request.post<ApiWorkspace>('/workspaces', normalizeWorkspacePayload(data)),

  update: (id: number | string, data: UpdateWorkspaceRequest) =>
    request.patch<ApiWorkspace>(`/workspaces/${id}`, normalizeWorkspacePayload(data)),

  generateCliToken: (id: number | string, data: GenerateWorkspaceCliTokenRequest = {}) =>
    request.post<GenerateWorkspaceCliTokenResponse>(
      `/workspaces/${id}/cli-tokens`,
      normalizeWorkspacePayload(data)
    ),

  delete: (id: number | string) => request.delete<DeleteWorkspaceResponse>(`/workspaces/${id}`),
};

export type WorkspaceService = typeof workspaceService;
