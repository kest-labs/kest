// History 模块类型定义。
// 作用：统一约束项目历史记录列表、详情和查询参数的数据结构。

export interface ProjectHistory {
  id: number;
  entity_type: string;
  entity_id: number;
  project_id: number;
  user_id: number;
  action: string;
  data?: Record<string, unknown> | null;
  diff?: Record<string, unknown> | null;
  message: string;
  created_at: string;
}

export interface CreateHistoryRequest {
  entity_type: string;
  entity_id: number;
  action: string;
  data: Record<string, unknown>;
  diff?: Record<string, unknown>;
  message?: string;
}

export interface HistoryListMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface HistoryListParams {
  projectId: number | string;
  page?: number;
  pageSize?: number;
  entityType?: string;
  entityId?: number;
}

export interface HistoryListResponse {
  items: ProjectHistory[];
  meta: HistoryListMeta;
}
