export type FlowRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'canceled';

export interface FlowVariableMappingRule {
  source: string;
  target: string;
}

export interface ProjectFlow {
  id: number;
  project_id: number;
  name: string;
  description: string;
  created_by: number;
  step_count?: number;
  created_at: string;
  updated_at: string;
}

export interface FlowStep {
  id: number;
  flow_id: number;
  client_key: string;
  name: string;
  sort_order: number;
  method: string;
  url: string;
  headers: string;
  body: string;
  captures: string;
  asserts: string;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
}

export interface FlowEdge {
  id: number;
  flow_id: number;
  source_step_id: number;
  target_step_id: number;
  variable_mapping: string;
  variable_mapping_rules?: FlowVariableMappingRule[];
  created_at: string;
  updated_at: string;
}

export interface FlowDetail extends ProjectFlow {
  steps: FlowStep[];
  edges: FlowEdge[];
}

export interface FlowListResponse {
  items: ProjectFlow[];
  total: number;
}

export interface CreateFlowRequest {
  name: string;
  description?: string;
}

export interface UpdateFlowRequest {
  name?: string;
  description?: string;
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
  id: number;
  run_id: number;
  step_id: number;
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
  id: number;
  flow_id: number;
  status: FlowRunStatus;
  triggered_by: number;
  execution_mode?: 'server' | 'local';
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

export interface FlowStreamStepEvent {
  run_id: number;
  step_id: number;
  step_name: string;
  status: FlowRunStatus;
  data?: FlowStepResult;
}

export interface StreamFlowRunOptions {
  signal?: AbortSignal;
  onStep?: (event: FlowStreamStepEvent) => void;
  onDone?: () => void;
}
