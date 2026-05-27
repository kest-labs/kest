'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { environmentService } from '@/services/environment';
import type {
  CreateEnvironmentRequest,
  DuplicateEnvironmentRequest,
  UpdateEnvironmentRequest,
} from '@/types/environment';

// Environments 域的 React Query key。
// 作用：统一管理环境列表、详情缓存，方便页面刷新和 mutation 失效。
export const environmentKeys = {
  all: ['environments'] as const,
  project: (projectId: number | string) => [...environmentKeys.all, 'workspace', projectId] as const,
  list: (projectId: number | string) => [...environmentKeys.project(projectId), 'list'] as const,
  // 单条环境详情 key。
  // 作用：让右侧详情面板、编辑弹窗和 duplicate 后的选中逻辑共享同一份缓存。
  detail: (projectId: number | string, environmentId: number | string) =>
    [...environmentKeys.project(projectId), 'detail', environmentId] as const,
};

// 环境列表查询。
// 作用：拉取指定项目下全部环境记录。
export function useEnvironments(projectId?: number | string) {
  return useQuery({
    queryKey: environmentKeys.list(projectId ?? 'unknown'),
    queryFn: () => environmentService.list(projectId as number | string),
    enabled: projectId !== undefined && projectId !== null,
  });
}

// 环境详情查询。
// 作用：按环境 ID 拉取完整详情，供右侧详情面板和编辑弹窗复用。
export function useEnvironment(projectId?: number | string, environmentId?: number | string) {
  return useQuery({
    queryKey: environmentKeys.detail(projectId ?? 'unknown', environmentId ?? 'unknown'),
    queryFn: () =>
      environmentService.getById(projectId as number | string, environmentId as number | string),
    enabled:
      projectId !== undefined &&
      projectId !== null &&
      environmentId !== undefined &&
      environmentId !== null,
  });
}

// 创建环境 mutation。
// 作用：创建成功后刷新列表并把新环境详情提前写入缓存。
export function useCreateEnvironment(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateEnvironmentRequest) => environmentService.create(projectId, data),
    onSuccess: (environment) => {
      queryClient.invalidateQueries({ queryKey: environmentKeys.list(projectId) });
      queryClient.setQueryData(
        environmentKeys.detail(projectId, environment.id),
        environment
      );
      toast.success(t.project('toasts.environmentCreated', { name: environment.name }));
    },
  });
}

// 更新环境 mutation。
// 作用：更新成功后同步刷新列表和详情缓存。
export function useUpdateEnvironment(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      environmentId,
      data,
    }: {
      environmentId: number | string;
      data: UpdateEnvironmentRequest;
    }) => environmentService.update(projectId, environmentId, data),
    onSuccess: (environment) => {
      queryClient.invalidateQueries({ queryKey: environmentKeys.list(projectId) });
      queryClient.setQueryData(
        environmentKeys.detail(projectId, environment.id),
        environment
      );
      toast.success(t.project('toasts.environmentUpdated', { name: environment.name }));
    },
  });
}

// 删除环境 mutation。
// 作用：删除成功后清理详情缓存并刷新列表。
export function useDeleteEnvironment(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (environmentId: number | string) =>
      environmentService.delete(projectId, environmentId),
    onSuccess: (_, environmentId) => {
      queryClient.invalidateQueries({ queryKey: environmentKeys.list(projectId) });
      queryClient.removeQueries({
        queryKey: environmentKeys.detail(projectId, environmentId),
      });
      toast.success(t.project('toasts.environmentDeleted'));
    },
  });
}

// 复制环境 mutation。
// 作用：复制成功后刷新列表，并把新环境详情写入缓存以便页面立即选中。
export function useDuplicateEnvironment(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      environmentId,
      data,
    }: {
      environmentId: number | string;
      data: DuplicateEnvironmentRequest;
    }) => environmentService.duplicate(projectId, environmentId, data),
    onSuccess: (environment) => {
      queryClient.invalidateQueries({ queryKey: environmentKeys.list(projectId) });
      queryClient.setQueryData(
        environmentKeys.detail(projectId, environment.id),
        environment
      );
      toast.success(t.project('toasts.environmentDuplicated', { name: environment.name }));
    },
  });
}
