import request from '@/http';
import type {
  ImportPostmanCollectionRequest,
  ImportPostmanCollectionResponse,
} from '@/types/importer';

export const importerService = {
  importPostman: (
    projectId: number | string,
    data: ImportPostmanCollectionRequest
  ) => {
    const formData = new FormData();
    formData.append('file', data.file);

    return request.post<ImportPostmanCollectionResponse>(
      `/projects/${projectId}/collections/import/postman`,
      formData,
      {
        params: data.parent_id ? { parent_id: data.parent_id } : undefined,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },
};

export type ImporterService = typeof importerService;
