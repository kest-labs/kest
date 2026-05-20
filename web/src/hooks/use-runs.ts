'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runService } from '@/services/run';
import type { CreateUnifiedRunRequest, UnifiedRunListParams } from '@/types/run';

export const runKeys = {
  all: ['runs'] as const,
  workspace: (workspaceId: number | string) => [...runKeys.all, 'workspace', workspaceId] as const,
  lists: (workspaceId: number | string) => [...runKeys.workspace(workspaceId), 'lists'] as const,
  list: (params: UnifiedRunListParams) => [...runKeys.lists(params.workspaceId), params] as const,
  detail: (workspaceId: number | string, runId: number | string) =>
    [...runKeys.workspace(workspaceId), 'detail', runId] as const,
};

export function useRuns(params: UnifiedRunListParams) {
  return useQuery({
    queryKey: runKeys.list(params),
    queryFn: () => runService.list(params),
    placeholderData: previousData => previousData,
  });
}

export function useRun(workspaceId?: number | string, runId?: number | string) {
  return useQuery({
    queryKey: runKeys.detail(workspaceId ?? 'unknown', runId ?? 'unknown'),
    queryFn: () => runService.getById(workspaceId as number | string, runId as number | string),
    enabled:
      workspaceId !== undefined &&
      workspaceId !== null &&
      runId !== undefined &&
      runId !== null,
  });
}

export function useCreateRun(workspaceId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUnifiedRunRequest) => runService.create(workspaceId, data),
    onSuccess: run => {
      queryClient.invalidateQueries({ queryKey: runKeys.lists(workspaceId) });
      queryClient.setQueryData(runKeys.detail(workspaceId, run.id), run);
    },
  });
}
