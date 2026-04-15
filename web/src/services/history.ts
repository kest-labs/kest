import request from '@/http';
import type {
  CreateHistoryRequest,
  HistoryListParams,
  HistoryListResponse,
  ProjectHistory,
} from '@/types/history';

const normalizeParams = <T extends object>(params: T) =>
  Object.fromEntries(
    Object.entries(params as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

export const historyService = {
  create: (projectId: number | string, data: CreateHistoryRequest) =>
    request.post<ProjectHistory>(`/projects/${projectId}/history`, data, {
      skipErrorHandler: true,
    }),

  list: ({
    projectId,
    page = 1,
    pageSize = 20,
    entityType,
    entityId,
  }: HistoryListParams) =>
    request.get<HistoryListResponse>(`/projects/${projectId}/history`, {
      params: normalizeParams({
        page,
        per_page: pageSize,
        entity_type: entityType,
        entity_id: entityId,
      }),
    }),

  getById: (projectId: number | string, historyId: number | string) =>
    request.get<ProjectHistory>(`/projects/${projectId}/history/${historyId}`),
};

export type HistoryService = typeof historyService;
