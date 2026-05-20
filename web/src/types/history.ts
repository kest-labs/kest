// History 模块类型定义。
// 作用：统一约束项目历史记录列表、详情和查询参数的数据结构。

export interface ProjectHistory {
  id: string;
  entity_type: string;
  entity_id: string;
  workspace_id: string;
  user_id: string;
  source?: string;
  source_event_id?: string;
  action: string;
  data?: Record<string, unknown> | null;
  diff?: Record<string, unknown> | null;
  message: string;
  created_at: string;
}

export interface CreateHistoryRequest {
  entity_type: string;
  entity_id: string;
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
  projectId: string;
  page?: number;
  pageSize?: number;
  entityType?: string;
  entityId?: string;
}

export interface HistoryListResponse {
  items: ProjectHistory[];
  meta: HistoryListMeta;
}
