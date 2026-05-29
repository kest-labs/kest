export interface WorkspaceCollection {
  id: number | string;
  name: string;
  description: string;
  workspace_id?: number | string;
  parent_id?: number | string | null;
  is_folder: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionListMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface CollectionListParams {
  workspaceId: number | string;
  page?: number;
  perPage?: number;
}

export interface WorkspaceCollectionListResponse {
  items: WorkspaceCollection[];
  meta: CollectionListMeta;
}

export interface WorkspaceCollectionTreeNode {
  id: number | string;
  name: string;
  description: string;
  workspace_id?: number | string;
  parent_id?: number | string | null;
  is_folder: boolean;
  sort_order: number;
  children?: WorkspaceCollectionTreeNode[];
  request_count?: number;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  parent_id?: number | string | null;
  is_folder?: boolean;
  sort_order?: number;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  parent_id?: number | string | null;
  sort_order?: number;
}
