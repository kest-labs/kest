import request from '@/http';
import type {
  CategoryListParams,
  CreateCategoryRequest,
  WorkspaceCategory,
  WorkspaceCategoryListResponse,
  SortCategoriesRequest,
  UpdateCategoryRequest,
} from '@/types/category';

// 请求体清理器。
// 作用：过滤掉 `undefined` 字段，避免把无意义空值提交给后端。
const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

// Categories 服务层。
// 作用：集中封装工作区分类相关的 HTTP 请求，供 hooks 和页面复用。
export const categoryService = {
  // 分类列表查询。
  // 作用：支持树形数据、分页参数和兼容文档中的扩展查询字段。
  list: ({
    workspaceId,
    page,
    perPage,
    search,
    includeCount,
    tree = true,
  }: CategoryListParams) =>
    request.get<WorkspaceCategoryListResponse>(`/workspaces/${workspaceId}/categories`, {
      params: normalizePayload({
        page,
        per_page: perPage,
        search,
        include_count: includeCount,
        tree,
      }),
    }),

  // 单个分类详情查询。
  // 作用：为右侧详情面板或编辑流程拉取最新分类数据。
  getById: (workspaceId: number | string, categoryId: number | string) =>
    request.get<WorkspaceCategory>(`/workspaces/${workspaceId}/categories/${categoryId}`),

  // 创建分类。
  // 作用：提交新建分类或子分类表单。
  create: (workspaceId: number | string, data: CreateCategoryRequest) =>
    request.post<WorkspaceCategory>(`/workspaces/${workspaceId}/categories`, normalizePayload(data)),

  // 更新分类。
  // 作用：以 PATCH 方式更新已存在分类。
  update: (workspaceId: number | string, categoryId: number | string, data: UpdateCategoryRequest) =>
    request.patch<WorkspaceCategory>(
      `/workspaces/${workspaceId}/categories/${categoryId}`,
      normalizePayload(data)
    ),

  // 删除分类。
  // 作用：删除选中的分类节点。
  delete: (workspaceId: number | string, categoryId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/categories/${categoryId}`),

  // 分类排序。
  // 作用：把前端整理后的顺序持久化到后端。
  sort: (workspaceId: number | string, data: SortCategoriesRequest) =>
    request.put<void>(`/workspaces/${workspaceId}/categories/sort`, data),
};

export type CategoryService = typeof categoryService;
