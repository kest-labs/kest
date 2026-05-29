'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { flowService } from '@/services/flow';
import type { CreateFlowRequest, SaveFlowRequest, UpdateFlowRequest } from '@/types/flow';

export const flowKeys = {
  all: ['flows'] as const,
  workspace: (workspaceId: number | string) => [...flowKeys.all, 'workspace', workspaceId] as const,
  list: (workspaceId: number | string) => [...flowKeys.workspace(workspaceId), 'list'] as const,
  detail: (workspaceId: number | string, flowId: number | string) =>
    [...flowKeys.workspace(workspaceId), 'detail', flowId] as const,
  runs: (workspaceId: number | string, flowId: number | string) =>
    [...flowKeys.workspace(workspaceId), 'runs', flowId] as const,
  run: (workspaceId: number | string, flowId: number | string, runId: number | string) =>
    [...flowKeys.runs(workspaceId, flowId), 'detail', runId] as const,
};

export function useFlows(workspaceId?: number | string) {
  return useQuery({
    queryKey: flowKeys.list(workspaceId ?? 'unknown'),
    queryFn: () => flowService.list(workspaceId as number | string),
    enabled: workspaceId !== undefined && workspaceId !== null,
  });
}

export function useFlow(workspaceId?: number | string, flowId?: number | string) {
  return useQuery({
    queryKey: flowKeys.detail(workspaceId ?? 'unknown', flowId ?? 'unknown'),
    queryFn: () => flowService.getById(workspaceId as number | string, flowId as number | string),
    enabled: workspaceId !== undefined && workspaceId !== null && flowId !== undefined && flowId !== null,
  });
}

export function useFlowRuns(workspaceId?: number | string, flowId?: number | string) {
  return useQuery({
    queryKey: flowKeys.runs(workspaceId ?? 'unknown', flowId ?? 'unknown'),
    queryFn: () => flowService.listRuns(workspaceId as number | string, flowId as number | string),
    enabled: workspaceId !== undefined && workspaceId !== null && flowId !== undefined && flowId !== null,
  });
}

export function useFlowRun(
  workspaceId?: number | string,
  flowId?: number | string,
  runId?: number | string
) {
  return useQuery({
    queryKey: flowKeys.run(workspaceId ?? 'unknown', flowId ?? 'unknown', runId ?? 'unknown'),
    queryFn: () =>
      flowService.getRun(workspaceId as number | string, flowId as number | string, runId as number | string),
    enabled:
      workspaceId !== undefined &&
      workspaceId !== null &&
      flowId !== undefined &&
      flowId !== null &&
      runId !== undefined &&
      runId !== null,
  });
}

export function useCreateFlow(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateFlowRequest) => flowService.create(workspaceId, data),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.list(workspaceId) });
      toast.success(t.workspace('toasts.flowCreated', { name: flow.name }));
    },
  });
}

export function useUpdateFlow(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({ flowId, data }: { flowId: number | string; data: UpdateFlowRequest }) =>
      flowService.update(workspaceId, flowId, data),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.list(workspaceId) });
      queryClient.invalidateQueries({ queryKey: flowKeys.detail(workspaceId, flow.id) });
      toast.success(t.workspace('toasts.flowUpdated', { name: flow.name }));
    },
  });
}

export function useDeleteFlow(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (flowId: number | string) => flowService.delete(workspaceId, flowId),
    onSuccess: (_, flowId) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.list(workspaceId) });
      queryClient.removeQueries({ queryKey: flowKeys.detail(workspaceId, flowId) });
      queryClient.removeQueries({ queryKey: flowKeys.runs(workspaceId, flowId) });
      toast.success(t.workspace('toasts.flowDeleted'));
    },
  });
}

export function useSaveFlow(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({ flowId, data }: { flowId: number | string; data: SaveFlowRequest }) =>
      flowService.save(workspaceId, flowId, data),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.list(workspaceId) });
      queryClient.setQueryData(flowKeys.detail(workspaceId, flow.id), flow);
      toast.success(t.workspace('toasts.flowSaved', { name: flow.name }));
    },
  });
}

export function useRunFlow(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (flowId: number | string) => flowService.run(workspaceId, flowId),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.runs(workspaceId, run.flow_id) });
      queryClient.setQueryData(flowKeys.run(workspaceId, run.flow_id, run.id), run);
      toast.success(t.workspace('toasts.flowRunStarted'));
    },
  });
}
