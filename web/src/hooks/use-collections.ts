'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { requestKeys } from '@/hooks/use-requests';
import { collectionService } from '@/services/collection';
import type {
  CollectionListParams,
  CreateCollectionRequest,
  ProjectCollectionTreeNode,
  UpdateCollectionRequest,
} from '@/types/collection';

// Collections 域的 React Query key。
// 作用：统一 collection 树、详情和写入后的缓存命名，供工作台读写共用。
export const collectionKeys = {
  all: ['collections'] as const,
  project: (projectId: number | string) => [...collectionKeys.all, 'project', projectId] as const,
  list: (projectId: number | string) => [...collectionKeys.project(projectId), 'list'] as const,
  tree: (projectId: number | string) => [...collectionKeys.project(projectId), 'tree'] as const,
  workbenchTree: (projectId: number | string) =>
    [...collectionKeys.project(projectId), 'workbench-tree'] as const,
  detail: (projectId: number | string, collectionId: number | string) =>
    [...collectionKeys.project(projectId), 'detail', collectionId] as const,
};

const removeCollectionNodeFromTree = (
  nodes: ProjectCollectionTreeNode[],
  collectionId: number
): ProjectCollectionTreeNode[] =>
  nodes.reduce<ProjectCollectionTreeNode[]>((accumulator, node) => {
    if (node.id === collectionId) {
      return accumulator;
    }

    const nextChildren = node.children
      ? removeCollectionNodeFromTree(node.children, collectionId)
      : node.children;

    accumulator.push(
      nextChildren === node.children
        ? node
        : {
            ...node,
            children: nextChildren,
          }
    );

    return accumulator;
  }, []);

const isWorkbenchRequestsQueryForCollection = (
  queryKey: readonly unknown[],
  projectId: number | string,
  collectionId: number
) =>
  queryKey[0] === 'collections' &&
  queryKey[1] === 'project' &&
  queryKey[2] === projectId &&
  queryKey[3] === 'workbench-requests' &&
  Array.isArray(queryKey[4]) &&
  queryKey[4].includes(collectionId);

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
    onSuccess: async (_, collectionId) => {
      const numericCollectionId = Number(collectionId);

      if (Number.isInteger(numericCollectionId) && numericCollectionId > 0) {
        queryClient.setQueryData<ProjectCollectionTreeNode[] | undefined>(
          collectionKeys.tree(projectId),
          (current) =>
            current
              ? removeCollectionNodeFromTree(current, numericCollectionId)
              : current
        );
        queryClient.setQueryData<ProjectCollectionTreeNode[] | undefined>(
          collectionKeys.workbenchTree(projectId),
          (current) =>
            current
              ? removeCollectionNodeFromTree(current, numericCollectionId)
              : current
        );
        queryClient.removeQueries({
          queryKey: requestKeys.collection(projectId, collectionId),
        });
        queryClient.removeQueries({
          predicate: (query) =>
            isWorkbenchRequestsQueryForCollection(
              query.queryKey,
              projectId,
              numericCollectionId
            ),
        });
      }

      queryClient.invalidateQueries({ queryKey: collectionKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.tree(projectId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.workbenchTree(projectId) });
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
