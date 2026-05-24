import type { WorkspaceMemberRole } from '@/types/member';

// 工作区模块类型定义。
// 作用：统一约束工作区列表、详情、统计和表单请求的数据结构。
export type WorkspacePlatform = 'go' | 'javascript' | 'python' | 'java' | 'ruby' | 'php' | 'csharp';
export type WorkspaceStatus = 0 | 1;

export interface ApiWorkspace {
  id: number | string;
  workspace_id?: number | string;
  name: string;
  slug: string;
  platform: WorkspacePlatform | '';
  role?: WorkspaceMemberRole;
  status: WorkspaceStatus;
  created_at: string;
}

export interface WorkspaceStats {
  api_spec_count: number;
  flow_count: number;
  environment_count: number;
  member_count: number;
  category_count: number;
}

export interface WorkspaceCliTokenInfo {
  id: number | string;
  workspace_id?: number | string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface GenerateWorkspaceCliTokenRequest {
  name?: string;
  scopes?: string[];
  expires_at?: string | null;
}

export interface GenerateWorkspaceCliTokenResponse {
  token: string;
  token_type: string;
  workspace_id?: number | string;
  token_info: WorkspaceCliTokenInfo;
}

export interface WorkspaceListMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface WorkspaceListParams {
  page?: number;
  perPage?: number;
}

export interface WorkspaceListResponse {
  items: ApiWorkspace[];
  meta: WorkspaceListMeta;
}

export interface CreateWorkspaceRequest {
  name: string;
  slug?: string;
  platform?: WorkspacePlatform;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  platform?: WorkspacePlatform;
  status?: WorkspaceStatus;
}

export interface DeleteWorkspaceResponse {
  message: string;
}
