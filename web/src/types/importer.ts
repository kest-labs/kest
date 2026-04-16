export interface ImportPostmanCollectionRequest {
  file: File;
  parent_id?: number;
}

export interface ImportPostmanCollectionResponse {
  message?: string;
}
