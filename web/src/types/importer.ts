export interface ImportPostmanCollectionRequest {
  file: File;
  parent_id?: number | string;
}

export interface ImportPostmanCollectionResponse {
  message?: string;
}

export interface ImportMarkdownCollectionRequest {
  file: File;
  parent_id?: number | string;
}

export interface ImportMarkdownCollectionModuleResult {
  name: string;
  collection_id: number | string;
  request_count: number;
}

export interface ImportMarkdownCollectionResponse {
  root_folder_id: number | string;
  root_folder_name: string;
  collections_created: number;
  requests_created: number;
  modules: ImportMarkdownCollectionModuleResult[];
}
