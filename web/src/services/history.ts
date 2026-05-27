import request from '@/http';
import type {
  CreateHistoryRequest,
  HistoryListParams,
  HistoryListResponse,
  WorkspaceHistory,
} from '@/types/history';

const normalizeParams = <T extends object>(params: T) =>
  Object.fromEntries(
    Object.entries(params as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

export const historyService = {
  create: (workspaceId: number | string, data: CreateHistoryRequest) =>
    request.post<WorkspaceHistory>(`/workspaces/${workspaceId}/history`, data, {
      skipErrorHandler: true,
    }),

  list: ({
    workspaceId,
    page = 1,
    pageSize = 20,
    entityType,
    entityId,
  }: HistoryListParams) =>
    request.get<HistoryListResponse>(`/workspaces/${workspaceId}/history`, {
      params: normalizeParams({
        page,
        per_page: pageSize,
        entity_type: entityType,
        entity_id: entityId,
      }),
    }),

  getById: (workspaceId: number | string, historyId: number | string) =>
    request.get<WorkspaceHistory>(`/workspaces/${workspaceId}/history/${historyId}`),
};

export type HistoryService = typeof historyService;
