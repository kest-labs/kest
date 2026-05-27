'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { requestKeys } from '@/hooks/use-requests';
import { useT } from '@/i18n/client';
import { collectionService } from '@/services/collection';
import type {
  CollectionListParams,
  CreateCollectionRequest,
  WorkspaceCollectionTreeNode,
  UpdateCollectionRequest,
} from '@/types/collection';

// Collections 域的 React Query key。
// 作用：统一 collection 树、详情和写入后的缓存命名，供工作台读写共用。
export const collectionKeys = {
  all: ['collections'] as const,
  workspace: (workspaceId: number | string) => [...collectionKeys.all, 'workspace', workspaceId] as const,
  list: (workspaceId: number | string) => [...collectionKeys.workspace(workspaceId), 'list'] as const,
  tree: (workspaceId: number | string) => [...collectionKeys.workspace(workspaceId), 'tree'] as const,
  workbenchTree: (workspaceId: number | string) =>
    [...collectionKeys.workspace(workspaceId), 'workbench-tree'] as const,
  detail: (workspaceId: number | string, collectionId: number | string) =>
    [...collectionKeys.workspace(workspaceId), 'detail', collectionId] as const,
};

const removeCollectionNodeFromTree = (
  nodes: WorkspaceCollectionTreeNode[],
  collectionId: number | string
): WorkspaceCollectionTreeNode[] =>
  nodes.reduce<WorkspaceCollectionTreeNode[]>((accumulator, node) => {
    if (String(node.id) === String(collectionId)) {
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
  workspaceId: number | string,
  collectionId: number | string
) =>
  queryKey[0] === 'collections' &&
  queryKey[1] === 'workspace' &&
  queryKey[2] === workspaceId &&
  queryKey[3] === 'workbench-requests' &&
  Array.isArray(queryKey[4]) &&
  queryKey[4].map((item) => String(item)).includes(String(collectionId));

export function useWorkspaceCollectionTree(workspaceId?: number | string) {
  return useQuery({
    queryKey: collectionKeys.tree(workspaceId ?? 'unknown'),
    queryFn: () => collectionService.tree(workspaceId as number | string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useWorkspaceCollections(params?: CollectionListParams) {
  return useQuery({
    queryKey: collectionKeys.list(params?.workspaceId ?? 'unknown'),
    queryFn: () => collectionService.list(params as CollectionListParams),
    enabled: Boolean(params?.workspaceId),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateCollection(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateCollectionRequest) => collectionService.create(workspaceId, data),
    onSuccess: (collection) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.workspace(workspaceId) });
      queryClient.setQueryData(collectionKeys.detail(workspaceId, collection.id), collection);
      toast.success(t.workspace('toasts.collectionCreated', { name: collection.name }));
    },
  });
}

// 删除 collection mutation。
// 作用：调用后端删除接口，并清理当前工作区下 collection 相关缓存。
export function useDeleteCollection(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (collectionId: number | string) =>
      collectionService.delete(workspaceId, collectionId),
    onSuccess: async (_, collectionId) => {
      queryClient.setQueryData<WorkspaceCollectionTreeNode[] | undefined>(
        collectionKeys.tree(workspaceId),
        (current) =>
          current
            ? removeCollectionNodeFromTree(current, collectionId)
            : current
      );
      queryClient.setQueryData<WorkspaceCollectionTreeNode[] | undefined>(
        collectionKeys.workbenchTree(workspaceId),
        (current) =>
          current
            ? removeCollectionNodeFromTree(current, collectionId)
            : current
      );
      queryClient.removeQueries({
        queryKey: requestKeys.collection(workspaceId, collectionId),
      });
      queryClient.removeQueries({
        predicate: (query) =>
          isWorkbenchRequestsQueryForCollection(
            query.queryKey,
            workspaceId,
            collectionId
          ),
      });

      queryClient.invalidateQueries({ queryKey: collectionKeys.list(workspaceId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.tree(workspaceId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.workbenchTree(workspaceId) });
      queryClient.removeQueries({
        queryKey: collectionKeys.detail(workspaceId, collectionId),
      });
      toast.success(t.workspace('toasts.collectionDeleted'));
    },
  });
}

// 更新 collection mutation。
// 作用：提交名称等字段的更新，并刷新当前工作区下的 collection 缓存。
export function useUpdateCollection(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      collectionId,
      data,
    }: {
      collectionId: number | string;
      data: UpdateCollectionRequest;
    }) => collectionService.update(workspaceId, collectionId, data),
    onSuccess: (collection) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.workspace(workspaceId) });
      queryClient.setQueryData(collectionKeys.detail(workspaceId, collection.id), collection);
      toast.success(t.workspace('toasts.collectionUpdated', { name: collection.name }));
    },
  });
}
