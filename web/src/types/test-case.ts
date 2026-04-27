// Test Cases 模块类型定义。
// 作用：统一约束测试用例、运行历史、执行结果和相关请求参数的数据结构。

export type TestRunStatus = 'pass' | 'fail' | 'error' | 'passed' | 'failed' | 'running';
export type ExtractVarSource = 'body' | 'header' | 'cookie';

export interface TestCaseAssertion {
  type: string;
  path?: string;
  operator?: string;
  expect?: unknown;
  message?: string;
}

export interface ExtractVariable {
  name: string;
  source: ExtractVarSource;
  path: string;
}

export interface ProjectTestCase {
  id: number | string;
  api_spec_id: number | string;
  method?: string;
  path?: string;
  name: string;
  description?: string;
  env?: string;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  path_params?: Record<string, string>;
  request_body?: unknown;
  pre_script?: string;
  post_script?: string;
  assertions?: TestCaseAssertion[];
  extract_vars?: ExtractVariable[];
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface TestCaseListMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface TestCaseListParams {
  projectId: number | string;
  page?: number;
  pageSize?: number;
  apiSpecId?: number | string;
  env?: string;
  keyword?: string;
}

export interface TestCaseListResponse {
  items: ProjectTestCase[];
  meta: TestCaseListMeta;
}

export interface CreateTestCaseRequest {
  api_spec_id: number | string;
  name: string;
  description?: string;
  env?: string;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  path_params?: Record<string, string>;
  request_body?: unknown;
  pre_script?: string;
  post_script?: string;
  assertions?: TestCaseAssertion[];
  extract_vars?: ExtractVariable[];
}

export interface UpdateTestCaseRequest {
  name?: string;
  description?: string;
  env?: string;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  path_params?: Record<string, string>;
  request_body?: unknown;
  pre_script?: string;
  post_script?: string;
  assertions?: TestCaseAssertion[];
  extract_vars?: ExtractVariable[];
}

export interface DuplicateTestCaseRequest {
  name: string;
}

export interface CreateTestCaseFromSpecRequest {
  api_spec_id: number | string;
  name: string;
  env?: string;
  use_example?: boolean;
  example_id?: number | string;
}

export interface RunRequestInfo {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface RunResponseInfo {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface AssertionResult {
  type: string;
  operator?: string;
  path?: string;
  expect?: unknown;
  actual?: unknown;
  passed: boolean;
  message?: string;
}

export interface RunTestCaseRequest {
  env_id?: number | string;
  global_vars?: Record<string, unknown>;
  variable_keys?: Record<string, string>;
}

export interface RunTestCaseResponse {
  test_case_id: number | string;
  status: TestRunStatus;
  message?: string;
  duration_ms: number;
  request?: RunRequestInfo;
  response?: RunResponseInfo;
  assertions?: AssertionResult[];
  variables?: Record<string, unknown>;
}

export interface TestCaseRun {
  id: number | string;
  test_case_id: number | string;
  status: TestRunStatus;
  duration_ms: number;
  request?: RunRequestInfo;
  response?: RunResponseInfo;
  assertions?: AssertionResult[];
  variables?: Record<string, unknown>;
  message?: string;
  created_at: string;
}

export interface TestCaseRunListParams {
  projectId: number | string;
  testCaseId: number | string;
  page?: number;
  pageSize?: number;
  status?: Exclude<TestRunStatus, 'running'>;
}

export interface TestCaseRunListResponse {
  items: TestCaseRun[];
  meta: TestCaseListMeta;
}
