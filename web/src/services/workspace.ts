import request from '@/http';
import type { RequestConfig } from '@/http/request';
import type {
  ApiWorkspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
} from '@/types/workspace';

const normalizeWorkspacePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as T;

export const workspaceService = {
  list: (config?: RequestConfig) => request.get<ApiWorkspace[]>('/workspaces', config),

  getById: (id: number | string, config?: RequestConfig) =>
    request.get<ApiWorkspace>(`/workspaces/${id}`, config),

  create: (data: CreateWorkspaceRequest) =>
    request.post<ApiWorkspace>('/workspaces', normalizeWorkspacePayload(data)),

  update: (id: number | string, data: UpdateWorkspaceRequest) =>
    request.patch<ApiWorkspace>(`/workspaces/${id}`, normalizeWorkspacePayload(data)),
};

export type WorkspaceService = typeof workspaceService;
