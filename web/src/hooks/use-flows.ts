'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { flowService } from '@/services/flow';
import type { CreateFlowRequest, SaveFlowRequest, UpdateFlowRequest } from '@/types/flow';

export const flowKeys = {
  all: ['flows'] as const,
  project: (projectId: number | string) => [...flowKeys.all, 'workspace', projectId] as const,
  list: (projectId: number | string) => [...flowKeys.project(projectId), 'list'] as const,
  detail: (projectId: number | string, flowId: number | string) =>
    [...flowKeys.project(projectId), 'detail', flowId] as const,
  runs: (projectId: number | string, flowId: number | string) =>
    [...flowKeys.project(projectId), 'runs', flowId] as const,
  run: (projectId: number | string, flowId: number | string, runId: number | string) =>
    [...flowKeys.runs(projectId, flowId), 'detail', runId] as const,
};

export function useFlows(projectId?: number | string) {
  return useQuery({
    queryKey: flowKeys.list(projectId ?? 'unknown'),
    queryFn: () => flowService.list(projectId as number | string),
    enabled: projectId !== undefined && projectId !== null,
  });
}

export function useFlow(projectId?: number | string, flowId?: number | string) {
  return useQuery({
    queryKey: flowKeys.detail(projectId ?? 'unknown', flowId ?? 'unknown'),
    queryFn: () => flowService.getById(projectId as number | string, flowId as number | string),
    enabled: projectId !== undefined && projectId !== null && flowId !== undefined && flowId !== null,
  });
}

export function useFlowRuns(projectId?: number | string, flowId?: number | string) {
  return useQuery({
    queryKey: flowKeys.runs(projectId ?? 'unknown', flowId ?? 'unknown'),
    queryFn: () => flowService.listRuns(projectId as number | string, flowId as number | string),
    enabled: projectId !== undefined && projectId !== null && flowId !== undefined && flowId !== null,
  });
}

export function useFlowRun(
  projectId?: number | string,
  flowId?: number | string,
  runId?: number | string
) {
  return useQuery({
    queryKey: flowKeys.run(projectId ?? 'unknown', flowId ?? 'unknown', runId ?? 'unknown'),
    queryFn: () =>
      flowService.getRun(projectId as number | string, flowId as number | string, runId as number | string),
    enabled:
      projectId !== undefined &&
      projectId !== null &&
      flowId !== undefined &&
      flowId !== null &&
      runId !== undefined &&
      runId !== null,
  });
}

export function useCreateFlow(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateFlowRequest) => flowService.create(projectId, data),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.list(projectId) });
      toast.success(t.project('toasts.flowCreated', { name: flow.name }));
    },
  });
}

export function useUpdateFlow(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({ flowId, data }: { flowId: number | string; data: UpdateFlowRequest }) =>
      flowService.update(projectId, flowId, data),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: flowKeys.detail(projectId, flow.id) });
      toast.success(t.project('toasts.flowUpdated', { name: flow.name }));
    },
  });
}

export function useDeleteFlow(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (flowId: number | string) => flowService.delete(projectId, flowId),
    onSuccess: (_, flowId) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.list(projectId) });
      queryClient.removeQueries({ queryKey: flowKeys.detail(projectId, flowId) });
      queryClient.removeQueries({ queryKey: flowKeys.runs(projectId, flowId) });
      toast.success(t.project('toasts.flowDeleted'));
    },
  });
}

export function useSaveFlow(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({ flowId, data }: { flowId: number | string; data: SaveFlowRequest }) =>
      flowService.save(projectId, flowId, data),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.list(projectId) });
      queryClient.setQueryData(flowKeys.detail(projectId, flow.id), flow);
      toast.success(t.project('toasts.flowSaved', { name: flow.name }));
    },
  });
}

export function useRunFlow(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (flowId: number | string) => flowService.run(projectId, flowId),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: flowKeys.runs(projectId, run.flow_id) });
      queryClient.setQueryData(flowKeys.run(projectId, run.flow_id, run.id), run);
      toast.success(t.project('toasts.flowRunStarted'));
    },
  });
}
