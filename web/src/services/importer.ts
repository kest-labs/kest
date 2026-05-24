import request from '@/http';
import type {
  ImportMarkdownCollectionRequest,
  ImportMarkdownCollectionResponse,
  ImportPostmanCollectionRequest,
  ImportPostmanCollectionResponse,
} from '@/types/importer';

export const importerService = {
  importPostman: (
    workspaceId: number | string,
    data: ImportPostmanCollectionRequest
  ) => {
    const formData = new FormData();
    formData.append('file', data.file);

    return request.post<ImportPostmanCollectionResponse>(
      `/workspaces/${workspaceId}/collections/import/postman`,
      formData,
      {
        params: data.parent_id ? { parent_id: data.parent_id } : undefined,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },

  importMarkdown: (
    workspaceId: number | string,
    data: ImportMarkdownCollectionRequest
  ) => {
    const formData = new FormData();
    formData.append('file', data.file);

    return request.post<ImportMarkdownCollectionResponse>(
      `/workspaces/${workspaceId}/collections/import/markdown`,
      formData,
      {
        params:
          data.parent_id || data.base_url_override
            ? {
                ...(data.parent_id ? { parent_id: data.parent_id } : {}),
                ...(data.base_url_override
                  ? { base_url_override: data.base_url_override }
                  : {}),
              }
            : undefined,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },
};

export type ImporterService = typeof importerService;
