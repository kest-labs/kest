import request from '@/http';
import type {
  CreateUnifiedRunRequest,
  UnifiedRun,
  UnifiedRunListParams,
  UnifiedRunListResponse,
} from '@/types/run';

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

export const runService = {
  create: (workspaceId: number | string, data: CreateUnifiedRunRequest) =>
    request.post<UnifiedRun>(`/workspaces/${workspaceId}/runs`, normalizePayload(data)),

  list: ({
    workspaceId,
    page = 1,
    pageSize = 20,
    sourceType,
    sourceId,
  }: UnifiedRunListParams) =>
    request.get<UnifiedRunListResponse>(`/workspaces/${workspaceId}/runs`, {
      params: normalizePayload({
        page,
        per_page: pageSize,
        source_type: sourceType,
        source_id: sourceId,
      }),
    }),

  getById: (workspaceId: number | string, runId: number | string) =>
    request.get<UnifiedRun>(`/workspaces/${workspaceId}/runs/${runId}`),
};

export type RunService = typeof runService;
