'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { historyService } from '@/services/history';
import type { CreateHistoryRequest, HistoryListParams } from '@/types/history';

export const historyKeys = {
  all: ['histories'] as const,
  workspace: (workspaceId: number | string) => [...historyKeys.all, 'workspace', workspaceId] as const,
  lists: (workspaceId: number | string) => [...historyKeys.workspace(workspaceId), 'lists'] as const,
  list: (params: HistoryListParams) => [...historyKeys.lists(params.workspaceId), params] as const,
  detail: (workspaceId: number | string, historyId: number | string) =>
    [...historyKeys.workspace(workspaceId), 'detail', historyId] as const,
};

export function useWorkspaceHistories(params: HistoryListParams) {
  return useQuery({
    queryKey: historyKeys.list(params),
    queryFn: () => historyService.list(params),
    enabled: Boolean(params.workspaceId),
    placeholderData: (previousData) => previousData,
  });
}

export function useWorkspaceHistory(workspaceId?: number | string, historyId?: number | string) {
  return useQuery({
    queryKey: historyKeys.detail(workspaceId ?? 'unknown', historyId ?? 'unknown'),
    queryFn: () => historyService.getById(workspaceId as number | string, historyId as number | string),
    enabled: Boolean(workspaceId) && Boolean(historyId),
  });
}

export function useCreateWorkspaceHistory(workspaceId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHistoryRequest) => historyService.create(workspaceId, data),
    onSuccess: (history) => {
      queryClient.invalidateQueries({ queryKey: historyKeys.lists(workspaceId) });
      queryClient.setQueryData(historyKeys.detail(workspaceId, history.id), history);
    },
  });
}
