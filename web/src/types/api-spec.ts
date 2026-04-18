// API Specifications 模块类型定义。
// 作用：统一约束 API 规格、示例、分类、成员角色以及相关请求参数的数据结构。

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type ApiSpecDocSource = 'manual' | 'ai';
export type ApiSpecLanguage = 'en' | 'zh';
export type ApiSpecExportFormat = 'json' | 'openapi' | 'swagger' | 'markdown';
export type ApiSpecParameterLocation = 'query' | 'header' | 'path' | 'cookie';

// 请求体 schema 描述。
// 作用：映射后端 `request_body` 结构，供表单和详情展示复用。
export interface RequestBodySpec {
  description?: string;
  required: boolean;
  content_type: string;
  schema: Record<string, unknown>;
}

// 参数 schema 描述。
// 作用：覆盖 query/header/path/cookie 四类参数定义。
export interface ParameterSpec {
  name: string;
  in: ApiSpecParameterLocation;
  description?: string;
  required: boolean;
  schema: Record<string, unknown>;
  example?: unknown;
}

// 响应 schema 描述。
// 作用：按状态码组织 API 的响应结构。
export interface ResponseSpec {
  description: string;
  content_type: string;
  schema: Record<string, unknown>;
}

// 单个 request/response 示例。
// 作用：承载 examples 接口返回和示例创建后的回显数据。
export interface ApiSpecExample {
  id: number;
  api_spec_id: number;
  name: string;
  request_headers?: Record<string, string>;
  request_body?: unknown;
  response_status: number;
  response_body?: unknown;
  duration_ms: number;
  created_at: string;
}

// API 规格核心实体。
// 作用：统一描述列表、详情、full 接口共用的数据主体。
export interface ApiSpec {
  id: number;
  project_id: number;
  category_id?: number | null;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  doc_markdown?: string;
  doc_markdown_zh?: string;
  doc_markdown_en?: string;
  doc_source?: ApiSpecDocSource;
  doc_updated_at?: string | null;
  doc_updated_at_zh?: string | null;
  doc_updated_at_en?: string | null;
  test_content?: string;
  test_source?: string;
  test_updated_at?: string | null;
  tags: string[];
  request_body?: RequestBodySpec;
  parameters?: ParameterSpec[];
  responses?: Record<string, ResponseSpec>;
  examples?: ApiSpecExample[];
  version: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// 列表分页元信息。
// 作用：对齐后端 `meta`，供分页按钮和统计卡片使用。
export interface ApiSpecListMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// API 规格列表查询参数。
// 作用：约束 page、pageSize、keyword、method、version、tag 这些筛选项。
export interface ApiSpecListParams {
  projectId: number;
  page?: number;
  pageSize?: number;
  version?: string;
  method?: HttpMethod;
  tag?: string;
  keyword?: string;
}

export interface ApiSpecListResponse {
  items: ApiSpec[];
  meta: ApiSpecListMeta;
}

export interface CreateApiSpecRequest {
  category_id?: number;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  doc_markdown?: string;
  doc_markdown_zh?: string;
  doc_markdown_en?: string;
  doc_source?: ApiSpecDocSource;
  tags?: string[];
  request_body?: RequestBodySpec;
  parameters?: ParameterSpec[];
  responses?: Record<string, ResponseSpec>;
  version: string;
  is_public?: boolean;
}

export interface UpdateApiSpecRequest {
  category_id?: number;
  path?: string;
  summary?: string;
  description?: string;
  doc_markdown?: string;
  doc_markdown_zh?: string;
  doc_markdown_en?: string;
  doc_source?: ApiSpecDocSource;
  tags?: string[];
  request_body?: RequestBodySpec;
  parameters?: ParameterSpec[];
  responses?: Record<string, ResponseSpec>;
  is_public?: boolean;
}

export interface ImportApiSpecsRequest {
  specs: CreateApiSpecRequest[];
}

export interface ImportApiSpecsResponse {
  message: string;
}

export interface BatchGenDocRequest {
  category_id?: number;
  lang?: ApiSpecLanguage;
  force?: boolean;
}

export interface BatchGenDocResponse {
  total: number;
  queued: number;
  skipped: number;
}

export interface GenApiTestResponse {
  flow_content: string;
}

export interface CreateApiExampleRequest {
  name: string;
  request_headers?: Record<string, string>;
  request_body?: unknown;
  response_status: number;
  response_body?: unknown;
  duration_ms?: number;
}

export interface ApiSpecExamplesResponse {
  items: ApiSpecExample[];
  total: number;
}

export interface ApiSpecShare {
  id: number;
  project_id: number;
  api_spec_id: number;
  slug: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface PublicApiSpecShare {
  slug: string;
  shared_at: string;
  updated_at: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  doc_markdown?: string;
  doc_markdown_zh?: string;
  doc_markdown_en?: string;
  doc_source?: ApiSpecDocSource;
  doc_updated_at?: string | null;
  doc_updated_at_zh?: string | null;
  doc_updated_at_en?: string | null;
  tags: string[];
  request_body?: RequestBodySpec;
  parameters?: ParameterSpec[];
  responses?: Record<string, ResponseSpec>;
  version: string;
}

export interface ApiSpecAIDraftFieldInsight {
  source: string;
  confidence: number;
}

export interface ApiSpecAIDraftReference {
  id: number;
  method: HttpMethod;
  path: string;
  summary: string;
  version: string;
  tags?: string[];
  explicit: boolean;
  score: number;
}

export interface ApiSpecAIDraftConventions {
  auth_style?: string;
  default_version?: string;
  common_versions?: string[];
  common_tags?: string[];
  success_envelope_keys?: string[];
  error_envelope_keys?: string[];
  method_success_statuses?: Record<string, string[]>;
}

export interface ApiSpecAIDraftSpec {
  category_id?: number | null;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tags?: string[];
  request_body?: RequestBodySpec;
  parameters?: ParameterSpec[];
  responses?: Record<string, ResponseSpec>;
  version: string;
  is_public: boolean;
}

export interface CreateApiSpecAIDraftRequest {
  intent: string;
  method?: HttpMethod;
  path?: string;
  category_id?: number;
  use_project_conventions?: boolean;
  reference_spec_ids?: number[];
  lang?: ApiSpecLanguage;
}

export interface RefineApiSpecAIDraftRequest {
  instruction: string;
  fields?: string[];
  current_draft?: ApiSpecAIDraftSpec;
  lang?: ApiSpecLanguage;
}

export interface AcceptApiSpecAIDraftRequest {
  overrides?: ApiSpecAIDraftSpec;
  generate_doc?: boolean;
  generate_test?: boolean;
  lang?: ApiSpecLanguage;
}

export interface ApiSpecAIDraft {
  id: number;
  project_id: number;
  created_by: number;
  accepted_spec_id?: number | null;
  status: string;
  intent: string;
  seed_input: CreateApiSpecAIDraftRequest;
  draft: ApiSpecAIDraftSpec;
  references?: ApiSpecAIDraftReference[];
  assumptions?: string[];
  questions?: string[];
  field_insights?: Record<string, ApiSpecAIDraftFieldInsight>;
  conventions?: ApiSpecAIDraftConventions | null;
  created_at: string;
  updated_at: string;
}

export interface AcceptApiSpecAIDraftResponse {
  draft_id: number;
  spec: ApiSpec;
  generated_test?: string;
  warnings?: string[];
}

export type ApiSpecExportPayload = ApiSpec[] | Record<string, unknown> | string;
export type { ProjectCategory, ProjectCategoryListResponse } from './category';
