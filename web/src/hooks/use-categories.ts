'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { categoryService } from '@/services/category';
import type {
  CategoryListParams,
  CreateCategoryRequest,
  SortCategoriesRequest,
  UpdateCategoryRequest,
} from '@/types/category';

// 关联缓存 key。
// 作用：分类变更后同时刷新工作区统计和 API Specs 中复用的分类下拉缓存。
const workspaceStatsKey = (workspaceId: number | string) => ['workspaces', 'stats', workspaceId] as const;
const apiSpecCategoriesKey = (workspaceId: number | string) =>
  ['api-specs', 'workspace', workspaceId, 'categories'] as const;

// Categories 域的 React Query key。
// 作用：统一管理分类列表、详情和工作区级缓存命名。
export const categoryKeys = {
  all: ['categories'] as const,
  workspace: (workspaceId: number | string) => [...categoryKeys.all, 'workspace', workspaceId] as const,
  lists: (workspaceId: number | string) => [...categoryKeys.workspace(workspaceId), 'lists'] as const,
  list: (params: CategoryListParams) => [...categoryKeys.lists(params.workspaceId), params] as const,
  detail: (workspaceId: number | string, categoryId: number | string) =>
    [...categoryKeys.workspace(workspaceId), 'detail', categoryId] as const,
};

// 分类列表查询。
// 作用：拉取工作区下的树形或平铺分类结构，并为本地搜索/分页提供数据源。
export function useWorkspaceCategories(params?: CategoryListParams) {
  return useQuery({
    queryKey: categoryKeys.list(params ?? { workspaceId: 'unknown', tree: true }),
    queryFn: () => categoryService.list(params as CategoryListParams),
    enabled: Boolean(params?.workspaceId),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

// 分类详情查询。
// 作用：按分类 ID 获取更完整的单条分类详情。
export function useWorkspaceCategory(workspaceId?: number | string, categoryId?: number | string) {
  return useQuery({
    queryKey: categoryKeys.detail(workspaceId ?? 'unknown', categoryId ?? 'unknown'),
    queryFn: () => categoryService.getById(workspaceId as number | string, categoryId as number | string),
    enabled: Boolean(workspaceId) && Boolean(categoryId),
  });
}

// 创建分类 mutation。
// 作用：创建成功后统一刷新分类域和依赖分类的上层缓存。
export function useCreateCategory(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) => categoryService.create(workspaceId, data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.workspace(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceStatsKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: apiSpecCategoriesKey(workspaceId) });
      queryClient.setQueryData(categoryKeys.detail(workspaceId, category.id), category);
      toast.success(t.workspace('toasts.categoryCreated', { name: category.name }));
    },
  });
}

// 更新分类 mutation。
// 作用：更新成功后保持列表、详情、工作区统计和分类下拉同步。
export function useUpdateCategory(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: number | string;
      data: UpdateCategoryRequest;
    }) => categoryService.update(workspaceId, categoryId, data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.workspace(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceStatsKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: apiSpecCategoriesKey(workspaceId) });
      queryClient.setQueryData(categoryKeys.detail(workspaceId, category.id), category);
      toast.success(t.workspace('toasts.categoryUpdated', { name: category.name }));
    },
  });
}

// 删除分类 mutation。
// 作用：删除成功后清理详情缓存，并触发列表和关联模块刷新。
export function useDeleteCategory(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (categoryId: number | string) => categoryService.delete(workspaceId, categoryId),
    onSuccess: (_, categoryId) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.workspace(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceStatsKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: apiSpecCategoriesKey(workspaceId) });
      queryClient.removeQueries({ queryKey: categoryKeys.detail(workspaceId, categoryId) });
      toast.success(t.workspace('toasts.categoryDeleted'));
    },
  });
}

// 排序分类 mutation。
// 作用：保存同级分类顺序，并刷新分类列表和 API Specs 里的分类选项。
export function useSortCategories(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: SortCategoriesRequest) => categoryService.sort(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.workspace(workspaceId) });
      queryClient.invalidateQueries({ queryKey: apiSpecCategoriesKey(workspaceId) });
      toast.success(t.workspace('toasts.categoryOrderSaved'));
    },
  });
}
