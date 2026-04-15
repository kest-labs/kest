'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { exampleService } from '@/services/example';
import type {
  CreateExampleRequest,
  RequestExamplePathParams,
  SaveExampleResponseRequest,
  UpdateExampleRequest,
} from '@/types/example';

export const exampleKeys = {
  all: ['examples'] as const,
  project: (projectId: number | string) => [...exampleKeys.all, 'project', projectId] as const,
  request: (
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string
  ) => [...exampleKeys.project(projectId), 'collection', collectionId, 'request', requestId] as const,
  list: (
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string
  ) => [...exampleKeys.request(projectId, collectionId, requestId), 'list'] as const,
  detail: (
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string
  ) => [...exampleKeys.request(projectId, collectionId, requestId), 'detail', exampleId] as const,
};

export function useRequestExamples(params?: Partial<RequestExamplePathParams>) {
  return useQuery({
    queryKey: exampleKeys.list(
      params?.projectId ?? 'unknown',
      params?.collectionId ?? 'unknown',
      params?.requestId ?? 'unknown'
    ),
    queryFn: () =>
      exampleService.list(
        params?.projectId as number | string,
        params?.collectionId as number | string,
        params?.requestId as number | string
      ),
    enabled:
      params?.projectId !== undefined &&
      params?.projectId !== null &&
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
      params?.projectId ?? 'unknown',
      params?.collectionId ?? 'unknown',
      params?.requestId ?? 'unknown',
      params?.exampleId ?? 'unknown'
    ),
    queryFn: () =>
      exampleService.getById(
        params?.projectId as number | string,
        params?.collectionId as number | string,
        params?.requestId as number | string,
        params?.exampleId as number | string
      ),
    enabled:
      params?.projectId !== undefined &&
      params?.projectId !== null &&
      params?.collectionId !== undefined &&
      params?.collectionId !== null &&
      params?.requestId !== undefined &&
      params?.requestId !== null &&
      params?.exampleId !== undefined &&
      params?.exampleId !== null,
  });
}

export function useCreateRequestExample(projectId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      data,
    }: {
      collectionId: number | string;
      requestId: number | string;
      data: CreateExampleRequest;
    }) => exampleService.create(projectId, collectionId, requestId, data),
    onSuccess: (example, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(projectId, variables.collectionId, variables.requestId),
      });
      queryClient.setQueryData(
        exampleKeys.detail(projectId, variables.collectionId, variables.requestId, example.id),
        example
      );
      toast.success(`Created example "${example.name}"`);
    },
  });
}

export function useUpdateRequestExample(projectId: number | string) {
  const queryClient = useQueryClient();

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
    }) => exampleService.update(projectId, collectionId, requestId, exampleId, data),
    onSuccess: (example, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(projectId, variables.collectionId, variables.requestId),
      });
      queryClient.setQueryData(
        exampleKeys.detail(projectId, variables.collectionId, variables.requestId, example.id),
        example
      );
      toast.success(`Updated example "${example.name}"`);
    },
  });
}

export function useDeleteRequestExample(projectId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      exampleId,
    }: {
      collectionId: number | string;
      requestId: number | string;
      exampleId: number | string;
    }) => exampleService.delete(projectId, collectionId, requestId, exampleId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(projectId, variables.collectionId, variables.requestId),
      });
      queryClient.removeQueries({
        queryKey: exampleKeys.detail(projectId, variables.collectionId, variables.requestId, variables.exampleId),
      });
      toast.success('Example deleted');
    },
  });
}

export function useSaveRequestExampleResponse(projectId: number | string) {
  const queryClient = useQueryClient();

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
    }) => exampleService.saveResponse(projectId, collectionId, requestId, exampleId, data),
    onSuccess: (example, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(projectId, variables.collectionId, variables.requestId),
      });
      queryClient.setQueryData(
        exampleKeys.detail(projectId, variables.collectionId, variables.requestId, example.id),
        example
      );
      toast.success(`Captured response for "${example.name}"`);
    },
  });
}

export function useSetDefaultRequestExample(projectId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      exampleId,
    }: {
      collectionId: number | string;
      requestId: number | string;
      exampleId: number | string;
    }) => exampleService.setDefault(projectId, collectionId, requestId, exampleId),
    onSuccess: (example, variables) => {
      queryClient.invalidateQueries({
        queryKey: exampleKeys.list(projectId, variables.collectionId, variables.requestId),
      });
      queryClient.setQueryData(
        exampleKeys.detail(projectId, variables.collectionId, variables.requestId, example.id),
        example
      );
      toast.success(`Set "${example.name}" as default example`);
    },
  });
}
