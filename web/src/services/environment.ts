import request from '@/http';
import type {
  CreateEnvironmentRequest,
  DuplicateEnvironmentRequest,
  EnvironmentListResponse,
  ProjectEnvironment,
  UpdateEnvironmentRequest,
} from '@/types/environment';

// Environments 服务层。
// 作用：集中封装项目级环境的增删改查和 duplicate 请求。
// 额外约束：请求体会先清理 `undefined` 字段，避免把无意义空字段发给后端。
const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

// 环境服务对象。
// 作用：把 environments 模块的 HTTP 调用统一收敛在一个出口，供 hooks 复用。
export const environmentService = {
  list: (projectId: number | string) =>
    request.get<EnvironmentListResponse>(`/workspaces/${projectId}/environments`),

  getById: (projectId: number | string, environmentId: number | string) =>
    request.get<ProjectEnvironment>(`/workspaces/${projectId}/environments/${environmentId}`),

  create: (projectId: number | string, data: CreateEnvironmentRequest) =>
    request.post<ProjectEnvironment>(
      `/workspaces/${projectId}/environments`,
      normalizePayload(data)
    ),

  update: (
    projectId: number | string,
    environmentId: number | string,
    data: UpdateEnvironmentRequest
  ) =>
    request.patch<ProjectEnvironment>(
      `/workspaces/${projectId}/environments/${environmentId}`,
      normalizePayload(data)
    ),

  delete: (projectId: number | string, environmentId: number | string) =>
    request.delete<void>(`/workspaces/${projectId}/environments/${environmentId}`),

  duplicate: (
    projectId: number | string,
    environmentId: number | string,
    data: DuplicateEnvironmentRequest
  ) =>
    request.post<ProjectEnvironment>(
      `/workspaces/${projectId}/environments/${environmentId}/duplicate`,
      normalizePayload(data)
    ),
};

export type EnvironmentService = typeof environmentService;
