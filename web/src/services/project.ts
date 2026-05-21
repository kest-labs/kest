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
const normalizeProjectPayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as T;

// 项目服务层。
// 作用：集中封装项目相关 HTTP 请求，供 hooks 和页面复用。
export const projectService = {
  list: ({ page = 1, perPage = 12 }: ProjectListParams = {}) =>
    request.get<ProjectListResponse>('/projects', {
      params: {
        page,
        per_page: perPage,
      },
    }),

  getById: (id: number | string, config?: RequestConfig) =>
    request.get<ApiProject>(`/projects/${id}`, config),

  getStats: (id: number | string, config?: RequestConfig) =>
    request.get<ProjectStats>(`/projects/${id}/stats`, config),

  create: (data: CreateProjectRequest) =>
    request.post<ApiProject>('/projects', normalizeProjectPayload(data)),

  update: (id: number | string, data: UpdateProjectRequest) =>
    request.patch<ApiProject>(`/projects/${id}`, normalizeProjectPayload(data)),

  generateCliToken: (id: number | string, data: GenerateProjectCliTokenRequest = {}) =>
    request.post<GenerateProjectCliTokenResponse>(
      `/workspaces/${id}/cli-tokens`,
      normalizeProjectPayload(data)
    ),

  delete: (id: number | string) => request.delete<DeleteProjectResponse>(`/projects/${id}`),
};

export type ProjectService = typeof projectService;
