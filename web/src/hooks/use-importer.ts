'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { collectionKeys } from '@/hooks/use-collections';
import { requestKeys } from '@/hooks/use-requests';
import { useT } from '@/i18n/client';
import { importerService } from '@/services/importer';
import type {
  ImportMarkdownCollectionRequest,
  ImportPostmanCollectionRequest,
} from '@/types/importer';

export function useImportPostmanCollection(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: ImportPostmanCollectionRequest) =>
      importerService.importPostman(projectId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: requestKeys.project(projectId) });
      toast.success(result.message || t.project('toasts.postmanImported'));
    },
  });
}

export function useImportMarkdownCollection(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: ImportMarkdownCollectionRequest) =>
      importerService.importMarkdown(projectId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: requestKeys.project(projectId) });
      toast.success(t.project('toasts.markdownImported', { count: result.requests_created }), {
        description: t.project('toasts.markdownImportedDetail', {
          name: result.root_folder_name,
          modules: result.collections_created,
          requests: result.requests_created,
        }),
      });
    },
  });
}
