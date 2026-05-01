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

// 项目域的 React Query key。
// 作用：统一项目列表、详情、统计的缓存命名，方便后续失效与刷新。
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: ProjectListParams) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...projectKeys.details(), id] as const,
  stats: () => [...projectKeys.all, 'stats'] as const,
  projectStats: (id: number | string) => [...projectKeys.stats(), id] as const,
};

// 项目列表查询。
// 作用：拉取当前登录用户可见的项目分页列表，并在翻页时保留上一页数据减少闪烁。
export function useProjects(params: ProjectListParams = {}) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectService.list(params),
    placeholderData: (previousData) => previousData,
  });
}

// 项目详情查询。
// 作用：按项目 ID 获取详情数据，供右侧详情面板或其他页面复用。
export function useProject(id?: number | string, options: ProjectQueryOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery({
    queryKey: projectKeys.detail(id ?? 'unknown'),
    queryFn: ({ signal }) =>
      projectService.getById(id as number | string, { signal }),
    enabled: isEnabled && id !== undefined && id !== null && id !== '',
  });
}

// 项目统计查询。
// 作用：读取 `/projects/:id/stats`，展示 API specs、flows、members 等聚合信息。
export function useProjectStats(id?: number | string, options: ProjectQueryOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery<ProjectStats>({
    queryKey: projectKeys.projectStats(id ?? 'unknown'),
    queryFn: ({ signal }) =>
      projectService.getStats(id as number | string, { signal }),
    enabled: isEnabled && id !== undefined && id !== null && id !== '',
  });
}

// 创建项目 mutation。
// 作用：调用创建接口后刷新列表，并把新项目详情提前写入缓存。
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

// 更新项目 mutation。
// 作用：提交项目编辑后同步刷新列表、详情和统计缓存。
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

// 删除项目 mutation。
// 作用：项目删除成功后移除对应详情/统计缓存，并触发列表刷新。
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

// 生成 CLI token mutation。
// 作用：为当前项目签发一次性展示的 project-scoped CLI token，供 `kest sync` 上传使用。
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
