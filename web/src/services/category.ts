import request from '@/http';
import type {
  CategoryListParams,
  CreateCategoryRequest,
  ProjectCategory,
  ProjectCategoryListResponse,
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
// 作用：集中封装项目分类相关的 HTTP 请求，供 hooks 和页面复用。
export const categoryService = {
  // 分类列表查询。
  // 作用：支持树形数据、分页参数和兼容文档中的扩展查询字段。
  list: ({
    projectId,
    page,
    perPage,
    search,
    includeCount,
    tree = true,
  }: CategoryListParams) =>
    request.get<ProjectCategoryListResponse>(`/workspaces/${projectId}/categories`, {
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
  getById: (projectId: number | string, categoryId: number | string) =>
    request.get<ProjectCategory>(`/workspaces/${projectId}/categories/${categoryId}`),

  // 创建分类。
  // 作用：提交新建分类或子分类表单。
  create: (projectId: number | string, data: CreateCategoryRequest) =>
    request.post<ProjectCategory>(`/workspaces/${projectId}/categories`, normalizePayload(data)),

  // 更新分类。
  // 作用：以 PATCH 方式更新已存在分类。
  update: (projectId: number | string, categoryId: number | string, data: UpdateCategoryRequest) =>
    request.patch<ProjectCategory>(
      `/workspaces/${projectId}/categories/${categoryId}`,
      normalizePayload(data)
    ),

  // 删除分类。
  // 作用：删除选中的分类节点。
  delete: (projectId: number | string, categoryId: number | string) =>
    request.delete<void>(`/workspaces/${projectId}/categories/${categoryId}`),

  // 分类排序。
  // 作用：把前端整理后的顺序持久化到后端。
  sort: (projectId: number | string, data: SortCategoriesRequest) =>
    request.put<void>(`/workspaces/${projectId}/categories/sort`, data),
};

export type CategoryService = typeof categoryService;
