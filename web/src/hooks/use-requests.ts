'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { requestService } from '@/services/request';
import type { CreateRequestRequest, UpdateRequestRequest } from '@/types/request';

export const requestKeys = {
  all: ['requests'] as const,
  workspace: (workspaceId: number | string) => [...requestKeys.all, 'workspace', workspaceId] as const,
  collection: (workspaceId: number | string, collectionId: number | string) =>
    [...requestKeys.workspace(workspaceId), 'collection', collectionId] as const,
  list: (workspaceId: number | string, collectionId: number | string) =>
    [...requestKeys.collection(workspaceId, collectionId), 'list'] as const,
  detail: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string
  ) => [...requestKeys.collection(workspaceId, collectionId), 'detail', requestId] as const,
};

export function useCreateRequest(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      collectionId,
      data,
    }: {
      collectionId: number | string;
      data: CreateRequestRequest;
    }) => requestService.create(workspaceId, collectionId, data),
    onSuccess: (createdRequest, variables) => {
      queryClient.invalidateQueries({
        queryKey: requestKeys.collection(workspaceId, variables.collectionId),
      });
      toast.success(t.workspace('toasts.requestCreated', { name: createdRequest.name }));
    },
  });
}

export function useUpdateRequest(workspaceId: number | string) {
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
      data: UpdateRequestRequest;
    }) => requestService.update(workspaceId, collectionId, requestId, data),
    onSuccess: (updatedRequest, variables) => {
      queryClient.invalidateQueries({
        queryKey: requestKeys.collection(workspaceId, variables.collectionId),
      });
      queryClient.invalidateQueries({
        queryKey: requestKeys.detail(workspaceId, variables.collectionId, variables.requestId),
      });
      toast.success(t.workspace('toasts.requestUpdated', { name: updatedRequest.name }));
    },
  });
}

export function useGenRequestDoc(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
      lang,
    }: {
      collectionId: number | string;
      requestId: number | string;
      lang: 'en' | 'zh';
    }) => requestService.genDoc(workspaceId, collectionId, requestId, { lang }),
    onSuccess: (updatedRequest, variables) => {
      queryClient.invalidateQueries({
        queryKey: requestKeys.collection(workspaceId, variables.collectionId),
      });
      queryClient.invalidateQueries({
        queryKey: requestKeys.detail(workspaceId, variables.collectionId, variables.requestId),
      });
      toast.success(t.workspace('toasts.documentationGenerated', { path: updatedRequest.url }));
    },
  });
}

export function useDeleteRequest(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      collectionId,
      requestId,
    }: {
      collectionId: number | string;
      requestId: number | string;
    }) => requestService.delete(workspaceId, collectionId, requestId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: requestKeys.collection(workspaceId, variables.collectionId),
      });
      queryClient.removeQueries({
        queryKey: requestKeys.detail(workspaceId, variables.collectionId, variables.requestId),
      });
      toast.success(t.workspace('toasts.requestDeleted'));
    },
  });
}
