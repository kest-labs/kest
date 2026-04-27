// Environments 模块类型定义。
// 作用：统一约束环境列表、详情、表单请求和复制环境请求的数据结构。

export interface ProjectEnvironment {
  id: number | string;
  project_id: number | string;
  name: string;
  display_name?: string;
  base_url?: string;
  variables?: Record<string, unknown>;
  headers?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// 环境列表响应。
// 作用：对齐后端 `GET /projects/:id/environments` 返回的 `{ items, total }` 结构。
export interface EnvironmentListResponse {
  items: ProjectEnvironment[];
  total: number;
}

// 创建环境请求。
// 作用：承载 POST /projects/:id/environments 允许提交的字段集合。
export interface CreateEnvironmentRequest {
  name: string;
  display_name?: string;
  base_url?: string;
  variables?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// 更新环境请求。
// 作用：承载 PATCH /projects/:id/environments/:eid 的可选更新字段。
export interface UpdateEnvironmentRequest {
  name?: string;
  display_name?: string;
  base_url?: string;
  variables?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// 复制环境请求。
// 作用：承载 duplicate 接口要求的新环境名称和可选变量覆盖项。
export interface DuplicateEnvironmentRequest {
  name: string;
  override_vars?: Record<string, unknown>;
}
