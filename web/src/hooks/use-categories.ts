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
// 作用：分类变更后同时刷新项目统计和 API Specs 中复用的分类下拉缓存。
const projectStatsKey = (projectId: number | string) => ['workspaces', 'stats', projectId] as const;
const apiSpecCategoriesKey = (projectId: number | string) =>
  ['api-specs', 'workspace', projectId, 'categories'] as const;

// Categories 域的 React Query key。
// 作用：统一管理分类列表、详情和项目级缓存命名。
export const categoryKeys = {
  all: ['categories'] as const,
  project: (projectId: number | string) => [...categoryKeys.all, 'workspace', projectId] as const,
  lists: (projectId: number | string) => [...categoryKeys.project(projectId), 'lists'] as const,
  list: (params: CategoryListParams) => [...categoryKeys.lists(params.projectId), params] as const,
  detail: (projectId: number | string, categoryId: number | string) =>
    [...categoryKeys.project(projectId), 'detail', categoryId] as const,
};

// 分类列表查询。
// 作用：拉取项目下的树形或平铺分类结构，并为本地搜索/分页提供数据源。
export function useProjectCategories(params?: CategoryListParams) {
  return useQuery({
    queryKey: categoryKeys.list(params ?? { projectId: 'unknown', tree: true }),
    queryFn: () => categoryService.list(params as CategoryListParams),
    enabled: Boolean(params?.projectId),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

// 分类详情查询。
// 作用：按分类 ID 获取更完整的单条分类详情。
export function useProjectCategory(projectId?: number | string, categoryId?: number | string) {
  return useQuery({
    queryKey: categoryKeys.detail(projectId ?? 'unknown', categoryId ?? 'unknown'),
    queryFn: () => categoryService.getById(projectId as number | string, categoryId as number | string),
    enabled:
      projectId !== undefined &&
      projectId !== null &&
      categoryId !== undefined &&
      categoryId !== null,
  });
}

// 创建分类 mutation。
// 作用：创建成功后统一刷新分类域和依赖分类的上层缓存。
export function useCreateCategory(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) => categoryService.create(projectId, data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: projectStatsKey(projectId) });
      queryClient.invalidateQueries({ queryKey: apiSpecCategoriesKey(projectId) });
      queryClient.setQueryData(categoryKeys.detail(projectId, category.id), category);
      toast.success(t.project('toasts.categoryCreated', { name: category.name }));
    },
  });
}

// 更新分类 mutation。
// 作用：更新成功后保持列表、详情、项目统计和分类下拉同步。
export function useUpdateCategory(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: number | string;
      data: UpdateCategoryRequest;
    }) => categoryService.update(projectId, categoryId, data),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: projectStatsKey(projectId) });
      queryClient.invalidateQueries({ queryKey: apiSpecCategoriesKey(projectId) });
      queryClient.setQueryData(categoryKeys.detail(projectId, category.id), category);
      toast.success(t.project('toasts.categoryUpdated', { name: category.name }));
    },
  });
}

// 删除分类 mutation。
// 作用：删除成功后清理详情缓存，并触发列表和关联模块刷新。
export function useDeleteCategory(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (categoryId: number | string) => categoryService.delete(projectId, categoryId),
    onSuccess: (_, categoryId) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: projectStatsKey(projectId) });
      queryClient.invalidateQueries({ queryKey: apiSpecCategoriesKey(projectId) });
      queryClient.removeQueries({ queryKey: categoryKeys.detail(projectId, categoryId) });
      toast.success(t.project('toasts.categoryDeleted'));
    },
  });
}

// 排序分类 mutation。
// 作用：保存同级分类顺序，并刷新分类列表和 API Specs 里的分类选项。
export function useSortCategories(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: SortCategoriesRequest) => categoryService.sort(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: apiSpecCategoriesKey(projectId) });
      toast.success(t.project('toasts.categoryOrderSaved'));
    },
  });
}
