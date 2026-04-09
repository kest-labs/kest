'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { collectionService } from '@/services/collection';
import type {
  CollectionListParams,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from '@/types/collection';

// Collections 域的 React Query key。
// 作用：统一 collection 树、详情和写入后的缓存命名，供工作台读写共用。
export const collectionKeys = {
  all: ['collections'] as const,
  project: (projectId: number | string) => [...collectionKeys.all, 'project', projectId] as const,
  list: (projectId: number | string) => [...collectionKeys.project(projectId), 'list'] as const,
  tree: (projectId: number | string) => [...collectionKeys.project(projectId), 'tree'] as const,
  detail: (projectId: number | string, collectionId: number | string) =>
    [...collectionKeys.project(projectId), 'detail', collectionId] as const,
};

export function useProjectCollectionTree(projectId?: number | string) {
  return useQuery({
    queryKey: collectionKeys.tree(projectId ?? 'unknown'),
    queryFn: () => collectionService.tree(projectId as number | string),
    enabled: projectId !== undefined && projectId !== null,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useProjectCollections(params?: CollectionListParams) {
  return useQuery({
    queryKey: collectionKeys.list(params?.projectId ?? 'unknown'),
    queryFn: () => collectionService.list(params as CollectionListParams),
    enabled: Boolean(params?.projectId),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateCollection(projectId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCollectionRequest) => collectionService.create(projectId, data),
    onSuccess: (collection) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.project(projectId) });
      queryClient.setQueryData(collectionKeys.detail(projectId, collection.id), collection);
      toast.success(`Created collection "${collection.name}"`);
    },
  });
}

// 删除 collection mutation。
// 作用：调用后端删除接口，并清理当前项目下 collection 相关缓存。
export function useDeleteCollection(projectId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collectionId: number | string) =>
      collectionService.delete(projectId, collectionId),
    onSuccess: (_, collectionId) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.project(projectId) });
      queryClient.removeQueries({
        queryKey: collectionKeys.detail(projectId, collectionId),
      });
      toast.success('Collection deleted');
    },
  });
}

// 更新 collection mutation。
// 作用：提交名称等字段的更新，并刷新当前项目下的 collection 缓存。
export function useUpdateCollection(projectId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      data,
    }: {
      collectionId: number | string;
      data: UpdateCollectionRequest;
    }) => collectionService.update(projectId, collectionId, data),
    onSuccess: (collection) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.project(projectId) });
      queryClient.setQueryData(collectionKeys.detail(projectId, collection.id), collection);
      toast.success(`Updated collection "${collection.name}"`);
    },
  });
}
