import request from '@/http';
import type {
  CreateEnvironmentRequest,
  DuplicateEnvironmentRequest,
  EnvironmentListResponse,
  WorkspaceEnvironment,
  UpdateEnvironmentRequest,
} from '@/types/environment';

// Environments 服务层。
// 作用：集中封装工作区级环境的增删改查和 duplicate 请求。
// 额外约束：请求体会先清理 `undefined` 字段，避免把无意义空字段发给后端。
const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

// 环境服务对象。
// 作用：把 environments 模块的 HTTP 调用统一收敛在一个出口，供 hooks 复用。
export const environmentService = {
  list: (workspaceId: number | string) =>
    request.get<EnvironmentListResponse>(`/workspaces/${workspaceId}/environments`),

  getById: (workspaceId: number | string, environmentId: number | string) =>
    request.get<WorkspaceEnvironment>(`/workspaces/${workspaceId}/environments/${environmentId}`),

  create: (workspaceId: number | string, data: CreateEnvironmentRequest) =>
    request.post<WorkspaceEnvironment>(
      `/workspaces/${workspaceId}/environments`,
      normalizePayload(data)
    ),

  update: (
    workspaceId: number | string,
    environmentId: number | string,
    data: UpdateEnvironmentRequest
  ) =>
    request.patch<WorkspaceEnvironment>(
      `/workspaces/${workspaceId}/environments/${environmentId}`,
      normalizePayload(data)
    ),

  delete: (workspaceId: number | string, environmentId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/environments/${environmentId}`),

  duplicate: (
    workspaceId: number | string,
    environmentId: number | string,
    data: DuplicateEnvironmentRequest
  ) =>
    request.post<WorkspaceEnvironment>(
      `/workspaces/${workspaceId}/environments/${environmentId}/duplicate`,
      normalizePayload(data)
    ),
};

export type EnvironmentService = typeof environmentService;
