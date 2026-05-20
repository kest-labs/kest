export type UnifiedRunSourceType = 'request' | 'collection' | 'test_case' | 'flow';
export type UnifiedRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'canceled';

export interface UnifiedRunStep {
  id: string;
  run_id: string;
  step_index: number;
  source_type: UnifiedRunSourceType;
  source_id: string;
  source_name: string;
  status: UnifiedRunStatus;
  duration_ms: number;
  request_snapshot?: Record<string, unknown>;
  response_snapshot?: Record<string, unknown>;
  error_message?: string;
  metadata?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UnifiedRun {
  id: string;
  workspace_id: string;
  source_type: UnifiedRunSourceType;
  source_id: string;
  source_name: string;
  status: UnifiedRunStatus;
  triggered_by: string;
  environment_id?: string | null;
  execution_mode: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  duration_ms: number;
  request_snapshot?: Record<string, unknown>;
  response_snapshot?: Record<string, unknown>;
  error_message?: string;
  metadata?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
  steps?: UnifiedRunStep[];
}

export interface CreateUnifiedRunStepRequest {
  step_index?: number;
  source_type: UnifiedRunSourceType;
  source_id: string;
  source_name?: string;
  status?: UnifiedRunStatus;
  duration_ms?: number;
  request_snapshot?: Record<string, unknown>;
  response_snapshot?: Record<string, unknown>;
  error_message?: string;
  metadata?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
}

export interface CreateUnifiedRunRequest {
  source_type: UnifiedRunSourceType;
  source_id: string;
  source_name?: string;
  status?: UnifiedRunStatus;
  environment_id?: string | null;
  execution_mode?: string;
  duration_ms?: number;
  request_snapshot?: Record<string, unknown>;
  response_snapshot?: Record<string, unknown>;
  error_message?: string;
  metadata?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
  steps?: CreateUnifiedRunStepRequest[];
}

export interface UnifiedRunListParams {
  workspaceId: number | string;
  page?: number;
  pageSize?: number;
  sourceType?: UnifiedRunSourceType;
  sourceId?: number | string;
}

export interface UnifiedRunListMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface UnifiedRunListResponse {
  items: UnifiedRun[];
  meta: UnifiedRunListMeta;
}
