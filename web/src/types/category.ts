// Categories 模块类型定义。
// 作用：统一约束项目分类的层级结构、查询参数和增删改排序请求。

export interface CategoryPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// 分类核心实体。
// 作用：统一描述项目分类的树形节点和详情结构。
export interface ProjectCategory {
  id: number | string;
  project_id: number | string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent_id?: number | string | null;
  parent_name?: string | null;
  sort_order: number;
  test_cases_count?: number;
  children?: ProjectCategory[];
  created_at: string;
  updated_at: string;
}

// 分类列表查询参数。
// 作用：约束项目级分类查询时的分页、搜索和树形返回选项。
export interface CategoryListParams {
  projectId: number | string;
  page?: number;
  perPage?: number;
  search?: string;
  includeCount?: boolean;
  tree?: boolean;
}

// 分类列表响应。
// 作用：兼容文档中的分页结构和当前后端返回的基础 items/total 结构。
export interface ProjectCategoryListResponse {
  items: ProjectCategory[];
  total: number;
  pagination?: CategoryPagination;
}

// 创建分类请求体。
// 作用：承载创建分类时允许提交的字段。
export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parent_id?: number | string | null;
  sort_order?: number;
}

// 更新分类请求体。
// 作用：允许前端以部分更新方式提交修改字段。
export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  parent_id?: number | string | null;
  sort_order?: number;
}

// 分类排序请求体。
// 作用：把当前展示顺序转换成后端需要的 ID 数组。
export interface SortCategoriesRequest {
  category_ids: Array<number | string>;
}
