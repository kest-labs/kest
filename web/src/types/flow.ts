export type FlowRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'canceled';

export interface FlowVariableMappingRule {
  source: string;
  target: string;
}

export interface WorkspaceFlow {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  created_by: string;
  step_count?: number;
  source?: 'web' | 'cli' | string;
  source_id?: string;
  source_path?: string;
  source_hash?: string;
  source_read_only?: boolean;
  definition?: string;
  revision?: number;
  enabled?: boolean;
  metadata?: string;
  parse_status?: 'unparsed' | 'parsed' | 'failed' | string;
  parse_error?: string;
  parsed_at?: string | null;
  latest_run_status?: FlowRunStatus;
  latest_run_mode?: 'server' | 'local' | 'cli' | string;
  created_at: string;
  updated_at: string;
}

export interface FlowStep {
  id: string;
  flow_id: string;
  client_key: string;
  name: string;
  sort_order: number;
  method: string;
  url: string;
  headers: string;
  body: string;
  captures: string;
  asserts: string;
  step_type?: 'http' | 'exec' | string;
  source_id?: string;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
}

export interface FlowEdge {
  id: string;
  flow_id: string;
  source_step_id: string;
  target_step_id: string;
  variable_mapping: string;
  variable_mapping_rules?: FlowVariableMappingRule[];
  created_at: string;
  updated_at: string;
}

export interface FlowDetail extends WorkspaceFlow {
  steps: FlowStep[];
  edges: FlowEdge[];
}

export interface FlowListResponse {
  items: WorkspaceFlow[];
  total: number;
}

export interface CreateFlowRequest {
  name: string;
  description?: string;
}

export interface UpdateFlowRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
}

export interface ImportFlowMarkdownRequest {
  name?: string;
  description?: string;
  source_path?: string;
  definition: string;
  enabled?: boolean;
}

export interface UpdateFlowMarkdownRequest {
  name?: string;
  description?: string;
  source_path?: string;
  definition: string;
  enabled?: boolean;
}

export interface SaveFlowStepRequest {
  client_key: string;
  name: string;
  sort_order: number;
  method: string;
  url: string;
  headers?: string;
  body?: string;
  captures?: string;
  asserts?: string;
  position_x: number;
  position_y: number;
}

export interface SaveFlowEdgeRequest {
  source_client_key: string;
  target_client_key: string;
  variable_mapping: string;
}

export interface SaveFlowRequest {
  name?: string;
  description?: string;
  steps: SaveFlowStepRequest[];
  edges: SaveFlowEdgeRequest[];
}

export interface FlowStepResult {
  id: string;
  run_id: string;
  step_id: string;
  status: FlowRunStatus;
  request: string;
  response: string;
  assert_results: string;
  duration_ms: number;
  variables_captured: string;
  error_message: string;
  created_at: string;
}

export interface FlowRun {
  id: string;
  flow_id: string;
  status: FlowRunStatus;
  triggered_by: string;
  execution_mode?: 'server' | 'local' | 'cli' | string;
  source?: string;
  source_event_id?: string;
  runner_type?: 'test_machine' | 'server_ci' | string;
  profile?: string;
  environment?: string;
  base_url?: string;
  total_steps?: number;
  passed_steps?: number;
  failed_steps?: number;
  duration_ms?: number;
  error_message?: string;
  log_content?: string;
  log_path?: string;
  log_excerpt?: string;
  log_truncated?: boolean;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
  step_results?: FlowStepResult[];
}

export interface FlowRunListResponse {
  items: FlowRun[];
  total: number;
}

export interface FlowRunListFilters {
  runner_type?: 'test_machine' | 'server_ci' | string;
  status?: FlowRunStatus;
  source?: string;
  profile?: string;
  from?: string;
  to?: string;
}

export interface FlowStreamStepEvent {
  run_id: string;
  step_id: string;
  step_name: string;
  status: FlowRunStatus;
  data?: FlowStepResult;
}

export interface StreamFlowRunOptions {
  signal?: AbortSignal;
  onStep?: (event: FlowStreamStepEvent) => void;
  onDone?: () => void;
  baseUrl?: string;
}
