'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { historyService } from '@/services/history';
import type { CreateHistoryRequest, HistoryListParams } from '@/types/history';

export const historyKeys = {
  all: ['histories'] as const,
  project: (projectId: number | string) => [...historyKeys.all, 'project', projectId] as const,
  lists: (projectId: number | string) => [...historyKeys.project(projectId), 'lists'] as const,
  list: (params: HistoryListParams) => [...historyKeys.lists(params.projectId), params] as const,
  detail: (projectId: number | string, historyId: number | string) =>
    [...historyKeys.project(projectId), 'detail', historyId] as const,
};

export function useProjectHistories(params: HistoryListParams) {
  return useQuery({
    queryKey: historyKeys.list(params),
    queryFn: () => historyService.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useProjectHistory(projectId?: number | string, historyId?: number | string) {
  return useQuery({
    queryKey: historyKeys.detail(projectId ?? 'unknown', historyId ?? 'unknown'),
    queryFn: () => historyService.getById(projectId as number | string, historyId as number | string),
    enabled:
      projectId !== undefined &&
      projectId !== null &&
      historyId !== undefined &&
      historyId !== null,
  });
}

export function useCreateProjectHistory(projectId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHistoryRequest) => historyService.create(projectId, data),
    onSuccess: (history) => {
      queryClient.invalidateQueries({ queryKey: historyKeys.lists(projectId) });
      queryClient.setQueryData(historyKeys.detail(projectId, history.id), history);
    },
  });
}
