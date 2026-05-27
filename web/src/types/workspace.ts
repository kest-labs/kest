export type WorkspaceType = 'personal' | 'team' | 'public';
export type WorkspaceVisibility = 'private' | 'team' | 'public';

export interface ApiWorkspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: WorkspaceType;
  owner_id: string;
  visibility: WorkspaceVisibility;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  slug: string;
  description?: string;
  type: WorkspaceType;
  visibility?: WorkspaceVisibility;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  visibility?: WorkspaceVisibility;
}
