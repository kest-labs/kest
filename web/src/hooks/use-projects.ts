'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { projectService } from '@/services/project';
import type {
  CreateProjectRequest,
  GenerateProjectCliTokenRequest,
  ProjectListParams,
  ProjectListResponse,
  ProjectStats,
  UpdateProjectRequest,
} from '@/types/project';

interface ProjectQueryOptions {
  enabled?: boolean;
}

interface DeleteProjectMutationContext {
  previousProjectLists: Array<readonly [ReadonlyArray<unknown>, ProjectListResponse | undefined]>;
}

const removeProjectFromListCache = (
  projectList: ProjectListResponse | undefined,
  projectId: number | string
) => {
  if (!projectList) {
    return projectList;
  }

  const normalizedProjectId = String(projectId);
  const nextItems = projectList.items.filter((project) => String(project.id) !== normalizedProjectId);
  const nextTotal = Math.max(0, projectList.meta.total - 1);
  const perPage = Math.max(1, projectList.meta.per_page || nextItems.length || 1);
  const nextPages = Math.max(1, Math.ceil(nextTotal / perPage));
  const nextPage = Math.min(projectList.meta.page, nextPages);

  if (
    nextItems.length === projectList.items.length &&
    nextTotal === projectList.meta.total &&
    nextPages === projectList.meta.pages &&
    nextPage === projectList.meta.page
  ) {
    return projectList;
  }

  return {
    ...projectList,
    items: nextItems,
    meta: {
      ...projectList.meta,
      total: nextTotal,
      pages: nextPages,
      page: nextPage,
    },
  };
};

// Workspace-domain React Query keys for list, detail, and stats cache invalidation.
export const projectKeys = {
  all: ['workspaces'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: ProjectListParams) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...projectKeys.details(), id] as const,
  stats: () => [...projectKeys.all, 'stats'] as const,
  projectStats: (id: number | string) => [...projectKeys.stats(), id] as const,
};

// Fetches the paginated workspace list visible to the current user.
export function useProjects(params: ProjectListParams = {}) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectService.list(params),
    placeholderData: (previousData) => previousData,
  });
}

// Fetches a workspace detail record for panels and workspace pages.
export function useProject(id?: number | string, options: ProjectQueryOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery({
    queryKey: projectKeys.detail(id ?? 'unknown'),
    queryFn: ({ signal }) =>
      projectService.getById(id as number | string, { signal }),
    enabled: isEnabled && id !== undefined && id !== null && id !== '',
  });
}

// Fetches workspace aggregate stats from `/workspaces/:id/stats`.
export function useProjectStats(id?: number | string, options: ProjectQueryOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery<ProjectStats>({
    queryKey: projectKeys.projectStats(id ?? 'unknown'),
    queryFn: ({ signal }) =>
      projectService.getStats(id as number | string, { signal }),
    enabled: isEnabled && id !== undefined && id !== null && id !== '',
  });
}

// Creates a Workspace and refreshes cached list/detail data.
export function useCreateProject() {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateProjectRequest) => projectService.create(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      toast.success(t.project('toasts.projectCreated', { name: project.name }));
    },
  });
}

// Updates a workspace and refreshes list, detail, and stats caches.
export function useUpdateProject() {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: UpdateProjectRequest }) =>
      projectService.update(id, data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: projectKeys.projectStats(project.id) });
      toast.success(t.project('toasts.projectUpdated', { name: project.name }));
    },
  });
}

// Deletes a workspace and removes related detail/stats cache entries.
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    onMutate: async (id): Promise<DeleteProjectMutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: projectKeys.lists() }),
        queryClient.cancelQueries({ queryKey: projectKeys.detail(id) }),
        queryClient.cancelQueries({ queryKey: projectKeys.projectStats(id) }),
      ]);

      const previousProjectLists =
        queryClient.getQueriesData<ProjectListResponse>({ queryKey: projectKeys.lists() });

      queryClient.setQueriesData<ProjectListResponse>(
        { queryKey: projectKeys.lists() },
        (projectList) => removeProjectFromListCache(projectList, id)
      );

      return {
        previousProjectLists,
      };
    },
    mutationFn: (id: number | string) => projectService.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      queryClient.removeQueries({ queryKey: projectKeys.projectStats(id) });
      toast.success(t.project('toasts.projectDeleted'));
    },
    onError: (_error, _id, context) => {
      context?.previousProjectLists.forEach(([queryKey, projectList]) => {
        if (projectList === undefined) {
          queryClient.removeQueries({ queryKey, exact: true });
          return;
        }

        queryClient.setQueryData(queryKey, projectList);
      });
    },
  });
}

// Generates a one-time CLI token for `kest sync` uploads.
export function useGenerateProjectCliToken() {
  const t = useT();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number | string;
      data?: GenerateProjectCliTokenRequest;
    }) => projectService.generateCliToken(id, data),
    onSuccess: () => {
      toast.success(t.project('toasts.cliTokenGenerated'));
    },
  });
}
