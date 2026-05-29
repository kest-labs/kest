'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { workspaceService } from '@/services/workspace';
import type {
  CreateWorkspaceRequest,
  GenerateWorkspaceCliTokenRequest,
  WorkspaceListParams,
  WorkspaceListResponse,
  WorkspaceStats,
  UpdateWorkspaceRequest,
} from '@/types/workspace';

interface WorkspaceQueryOptions {
  enabled?: boolean;
}

interface DeleteWorkspaceMutationContext {
  previousWorkspaceLists: Array<readonly [ReadonlyArray<unknown>, WorkspaceListResponse | undefined]>;
}

const removeWorkspaceFromListCache = (
  workspaceList: WorkspaceListResponse | undefined,
  workspaceId: number | string
) => {
  if (!workspaceList) {
    return workspaceList;
  }

  const normalizedWorkspaceId = String(workspaceId);
  const nextItems = workspaceList.items.filter((workspace) => String(workspace.id) !== normalizedWorkspaceId);
  const nextTotal = Math.max(0, workspaceList.meta.total - 1);
  const perPage = Math.max(1, workspaceList.meta.per_page || nextItems.length || 1);
  const nextPages = Math.max(1, Math.ceil(nextTotal / perPage));
  const nextPage = Math.min(workspaceList.meta.page, nextPages);

  if (
    nextItems.length === workspaceList.items.length &&
    nextTotal === workspaceList.meta.total &&
    nextPages === workspaceList.meta.pages &&
    nextPage === workspaceList.meta.page
  ) {
    return workspaceList;
  }

  return {
    ...workspaceList,
    items: nextItems,
    meta: {
      ...workspaceList.meta,
      total: nextTotal,
      pages: nextPages,
      page: nextPage,
    },
  };
};

// 工作区域的 React Query key。
// 作用：统一工作区列表、详情、统计的缓存命名，方便后续失效与刷新。
export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: (params: WorkspaceListParams) => [...workspaceKeys.lists(), params] as const,
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...workspaceKeys.details(), id] as const,
  stats: () => [...workspaceKeys.all, 'stats'] as const,
  workspaceStats: (id: number | string) => [...workspaceKeys.stats(), id] as const,
};

// 工作区列表查询。
// 作用：拉取当前登录用户可见的工作区分页列表，并在翻页时保留上一页数据减少闪烁。
export function useWorkspaces(params: WorkspaceListParams = {}) {
  return useQuery({
    queryKey: workspaceKeys.list(params),
    queryFn: () => workspaceService.list(params),
    placeholderData: (previousData) => previousData,
  });
}

// 工作区详情查询。
// 作用：按工作区 ID 获取详情数据，供右侧详情面板或其他页面复用。
export function useWorkspace(id?: number | string, options: WorkspaceQueryOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery({
    queryKey: workspaceKeys.detail(id ?? 'unknown'),
    queryFn: ({ signal }) =>
      workspaceService.getById(id as number | string, { signal }),
    enabled: isEnabled && id !== undefined && id !== null && id !== '',
  });
}

// 工作区统计查询。
// 作用：读取 `/workspaces/:id/stats`，展示 API specs、flows、members 等聚合信息。
export function useWorkspaceStats(id?: number | string, options: WorkspaceQueryOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery<WorkspaceStats>({
    queryKey: workspaceKeys.workspaceStats(id ?? 'unknown'),
    queryFn: ({ signal }) =>
      workspaceService.getStats(id as number | string, { signal }),
    enabled: isEnabled && id !== undefined && id !== null && id !== '',
  });
}

// 创建工作区 mutation。
// 作用：调用创建接口后刷新列表，并把新工作区详情提前写入缓存。
export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateWorkspaceRequest) => workspaceService.create(data),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
      queryClient.setQueryData(workspaceKeys.detail(workspace.id), workspace);
      toast.success(t.workspace('toasts.workspaceCreated', { name: workspace.name }));
    },
  });
}

// 更新工作区 mutation。
// 作用：提交工作区编辑后同步刷新列表、详情和统计缓存。
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: UpdateWorkspaceRequest }) =>
      workspaceService.update(id, data),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
      queryClient.setQueryData(workspaceKeys.detail(workspace.id), workspace);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.workspaceStats(workspace.id) });
      toast.success(t.workspace('toasts.workspaceUpdated', { name: workspace.name }));
    },
  });
}

// 删除工作区 mutation。
// 作用：工作区删除成功后移除对应详情/统计缓存，并触发列表刷新。
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    onMutate: async (id): Promise<DeleteWorkspaceMutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: workspaceKeys.lists() }),
        queryClient.cancelQueries({ queryKey: workspaceKeys.detail(id) }),
        queryClient.cancelQueries({ queryKey: workspaceKeys.workspaceStats(id) }),
      ]);

      const previousWorkspaceLists =
        queryClient.getQueriesData<WorkspaceListResponse>({ queryKey: workspaceKeys.lists() });

      queryClient.setQueriesData<WorkspaceListResponse>(
        { queryKey: workspaceKeys.lists() },
        (workspaceList) => removeWorkspaceFromListCache(workspaceList, id)
      );

      return {
        previousWorkspaceLists,
      };
    },
    mutationFn: (id: number | string) => workspaceService.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
      queryClient.removeQueries({ queryKey: workspaceKeys.detail(id) });
      queryClient.removeQueries({ queryKey: workspaceKeys.workspaceStats(id) });
      toast.success(t.workspace('toasts.workspaceDeleted'));
    },
    onError: (_error, _id, context) => {
      context?.previousWorkspaceLists.forEach(([queryKey, workspaceList]) => {
        if (workspaceList === undefined) {
          queryClient.removeQueries({ queryKey, exact: true });
          return;
        }

        queryClient.setQueryData(queryKey, workspaceList);
      });
    },
  });
}

// 生成 CLI token mutation。
// 作用：为当前工作区签发一次性展示的 workspace-scoped CLI token，供 `kest sync` 上传使用。
export function useGenerateWorkspaceCliToken() {
  const t = useT();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number | string;
      data?: GenerateWorkspaceCliTokenRequest;
    }) => workspaceService.generateCliToken(id, data),
    onSuccess: () => {
      toast.success(t.workspace('toasts.cliTokenGenerated'));
    },
  });
}
