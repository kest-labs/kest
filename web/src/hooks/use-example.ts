'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { exampleService } from '@/services/example';
import type {
  CreateExampleRequest,
  GenerateAIExamplesRequest,
  RequestExamplePathParams,
  SaveExampleResponseRequest,
  UpdateExampleRequest,
} from '@/types/example';

export const exampleKeys = {
  all: ['examples'] as const,
  workspace: (workspaceId: number | string) => [...exampleKeys.all, 'workspace', workspaceId] as const,
  request: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string
  ) => [...exampleKeys.workspace(workspaceId), 'collection', collectionId, 'request', requestId] as const,
  list: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string
  ) => [...exampleKeys.request(workspaceId, collectionId, requestId), 'list'] as const,
  detail: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string
  ) => [...exampleKeys.request(workspaceId, collectionId, requestId), 'detail', exampleId] as const,
};

export function useRequestExamples(params?: Partial<RequestExamplePathParams>) {
  return useQuery({
    queryKey: exampleKeys.list(
      params?.workspaceId ?? 'unknown',
      params?.collectionId ?? 'unknown',
      params?.requestId ?? 'unknown'
    ),
    queryFn: () =>
      exampleService.list(
        params?.workspaceId as number | string,
        params?.collectionId as number | string,
        params?.requestId as number | string
      ),
    enabled:
      params?.workspaceId !== undefined &&
      params?.workspaceId !== null &&
      params?.collectionId !== undefined &&
      params?.collectionId !== null &&
      params?.requestId !== undefined &&
      params?.requestId !== null,
    staleTime: 30_000,
  });
}

export function useRequestExample(
  params?: Partial<RequestExamplePathParams> & { exampleId?: number | string }
) {
  return useQuery({
    queryKey: exampleKeys.detail(
      params?.workspaceId ?? 'unknown',
      params?.collectionId ?? 'unknown',
      params?.requestId ?? 'unknown',
      params?.exampleId ?? 'unknown'
    ),
    queryFn: () =>
      exampleService.getById(
        params?.workspaceId as number | string,
        params?.collectionId as number | string,
        params?.requestId as number | string,
        params?.exampleId as number | string
      ),
    enabled:
      params?.workspaceId !== undefined &&
      params?.workspaceId !== null &&
      params?.collectionId !== undefined &&
      params?.collectionId !== null &&
      params?.requestId !== undefined &&
      params?.requestId !== null &&
      params?.exampleId !== undefined &&
      params?.exampleId !== null,
  });
}

export function useCreateRequestExample(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      data,
    }: {
      collectionId: number | string;
      requestId: number | string;
      data: CreateExampleRequest;
    }) => exampleService.create(workspaceId, collectionId, requestId, data),
    onSuccess: (example, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(workspaceId, variables.collectionId, variables.requestId),
      });
      queryClient.setQueryData(
        exampleKeys.detail(workspaceId, variables.collectionId, variables.requestId, example.id),
        example
      );
      toast.success(t.workspace('toasts.exampleCreated', { name: example.name }));
    },
  });
}

export function useGenerateRequestExamples(workspaceId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      data,
    }: {
      collectionId: number | string;
      requestId: number | string;
      data?: GenerateAIExamplesRequest;
    }) => exampleService.generateAI(workspaceId, collectionId, requestId, data),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(workspaceId, variables.collectionId, variables.requestId),
      });
      result.items.forEach(example => {
        queryClient.setQueryData(
          exampleKeys.detail(workspaceId, variables.collectionId, variables.requestId, example.id),
          example
        );
      });
    },
  });
}

export function useUpdateRequestExample(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      exampleId,
      data,
    }: {
      collectionId: number | string;
      requestId: number | string;
      exampleId: number | string;
      data: UpdateExampleRequest;
    }) => exampleService.update(workspaceId, collectionId, requestId, exampleId, data),
    onSuccess: (example, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(workspaceId, variables.collectionId, variables.requestId),
      });
      queryClient.setQueryData(
        exampleKeys.detail(workspaceId, variables.collectionId, variables.requestId, example.id),
        example
      );
      toast.success(t.workspace('toasts.exampleUpdated', { name: example.name }));
    },
  });
}

export function useDeleteRequestExample(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      exampleId,
    }: {
      collectionId: number | string;
      requestId: number | string;
      exampleId: number | string;
    }) => exampleService.delete(workspaceId, collectionId, requestId, exampleId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(workspaceId, variables.collectionId, variables.requestId),
      });
      queryClient.removeQueries({
        queryKey: exampleKeys.detail(workspaceId, variables.collectionId, variables.requestId, variables.exampleId),
      });
      toast.success(t.workspace('toasts.exampleDeleted'));
    },
  });
}

export function useSaveRequestExampleResponse(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      exampleId,
      data,
    }: {
      collectionId: number | string;
      requestId: number | string;
      exampleId: number | string;
      data: SaveExampleResponseRequest;
    }) => exampleService.saveResponse(workspaceId, collectionId, requestId, exampleId, data),
    onSuccess: (example, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(workspaceId, variables.collectionId, variables.requestId),
      });
      queryClient.setQueryData(
        exampleKeys.detail(workspaceId, variables.collectionId, variables.requestId, example.id),
        example
      );
      toast.success(t.workspace('toasts.responseCaptured', { name: example.name }));
    },
  });
}

export function useSetDefaultRequestExample(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      exampleId,
    }: {
      collectionId: number | string;
      requestId: number | string;
      exampleId: number | string;
    }) => exampleService.setDefault(workspaceId, collectionId, requestId, exampleId),
    onSuccess: (example, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(workspaceId, variables.collectionId, variables.requestId),
      });
      queryClient.setQueryData(
        exampleKeys.detail(workspaceId, variables.collectionId, variables.requestId, example.id),
        example
      );
      toast.success(t.workspace('toasts.defaultExampleSet', { name: example.name }));
    },
  });
}
