// 项目模块类型定义。
// 作用：统一约束项目列表、详情、统计和表单请求的数据结构。
export type ProjectPlatform = 'go' | 'javascript' | 'python' | 'java' | 'ruby' | 'php' | 'csharp';
export type ProjectStatus = 0 | 1;

export interface ApiProject {
  id: number | string;
  name: string;
  slug: string;
  platform: ProjectPlatform | '';
  status: ProjectStatus;
  created_at: string;
}

export interface ProjectStats {
  api_spec_count: number;
  flow_count: number;
  environment_count: number;
  member_count: number;
  category_count: number;
}

export interface ProjectCliTokenInfo {
  id: number | string;
  project_id: number | string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface GenerateProjectCliTokenRequest {
  name?: string;
  scopes?: string[];
  expires_at?: string | null;
}

export interface GenerateProjectCliTokenResponse {
  token: string;
  token_type: string;
  project_id: number | string;
  token_info: ProjectCliTokenInfo;
}

export interface ProjectListMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ProjectListParams {
  page?: number;
  perPage?: number;
}

export interface ProjectListResponse {
  items: ApiProject[];
  meta: ProjectListMeta;
}

export interface CreateProjectRequest {
  name: string;
  slug?: string;
  platform?: ProjectPlatform;
}

export interface UpdateProjectRequest {
  name?: string;
  platform?: ProjectPlatform;
  status?: ProjectStatus;
}

export interface DeleteProjectResponse {
  message: string;
}
