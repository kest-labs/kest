'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { workspaceService } from '@/services/workspace';
import type {
  ApiWorkspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
} from '@/types/workspace';

interface WorkspaceQueryOptions {
  enabled?: boolean;
}

export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: () => [...workspaceKeys.lists(), 'all'] as const,
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...workspaceKeys.details(), id] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: () => workspaceService.list(),
  });
}

export function useWorkspace(id?: number | string, options: WorkspaceQueryOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery({
    queryKey: workspaceKeys.detail(id ?? 'unknown'),
    queryFn: ({ signal }) => workspaceService.getById(id as number | string, { signal }),
    enabled: isEnabled && id !== undefined && id !== null && id !== '',
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const t = useT('project');

  return useMutation({
    mutationFn: (data: CreateWorkspaceRequest) => workspaceService.create(data),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
      queryClient.setQueryData<ApiWorkspace>(workspaceKeys.detail(workspace.id), workspace);
      toast.success(t('toasts.workspaceCreated', { name: workspace.name }));
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  const t = useT('project');

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number | string;
      data: UpdateWorkspaceRequest;
    }) => workspaceService.update(id, data),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
      queryClient.setQueryData<ApiWorkspace>(workspaceKeys.detail(workspace.id), workspace);
      toast.success(t('toasts.workspaceUpdated', { name: workspace.name }));
    },
  });
}
