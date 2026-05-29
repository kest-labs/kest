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

export function useImportPostmanCollection(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: ImportPostmanCollectionRequest) =>
      importerService.importPostman(workspaceId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.workspace(workspaceId) });
      queryClient.invalidateQueries({ queryKey: requestKeys.workspace(workspaceId) });
      toast.success(result.message || t.workspace('toasts.postmanImported'));
    },
  });
}

export function useImportMarkdownCollection(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: ImportMarkdownCollectionRequest) =>
      importerService.importMarkdown(workspaceId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.workspace(workspaceId) });
      queryClient.invalidateQueries({ queryKey: requestKeys.workspace(workspaceId) });
      toast.success(t.workspace('toasts.markdownImported', { count: result.requests_created }), {
        description: t.workspace('toasts.markdownImportedDetail', {
          name: result.root_folder_name,
          modules: result.collections_created,
          requests: result.requests_created,
        }),
      });
    },
  });
}
