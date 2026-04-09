export interface ProjectCollection {
  id: number;
  name: string;
  description: string;
  project_id: number;
  parent_id?: number | null;
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
  projectId: number | string;
  page?: number;
  perPage?: number;
}

export interface ProjectCollectionListResponse {
  items: ProjectCollection[];
  meta: CollectionListMeta;
}

export interface ProjectCollectionTreeNode {
  id: number;
  name: string;
  description: string;
  project_id: number;
  parent_id?: number | null;
  is_folder: boolean;
  sort_order: number;
  children?: ProjectCollectionTreeNode[];
  request_count?: number;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  parent_id?: number | null;
  is_folder?: boolean;
  sort_order?: number;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  parent_id?: number | null;
  sort_order?: number;
}
