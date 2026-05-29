'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { apiSpecService } from '@/services/api-spec';
import type {
  AcceptApiSpecAIDraftRequest,
  ApiSpecAIDraft,
  ApiSpecAIDraftStreamOptions,
  ApiSpecLanguage,
  ApiSpecListParams,
  BatchGenDocRequest,
  CreateApiSpecAIDraftRequest,
  CreateApiExampleRequest,
  CreateApiSpecRequest,
  ImportApiSpecMarkdownDraftRequest,
  ImportApiSpecsRequest,
  RefineApiSpecAIDraftRequest,
  UpdateApiSpecRequest,
} from '@/types/api-spec';

// API Specifications 域的 React Query key。
// 作用：统一管理规格列表、详情、示例、分类和 AI 结果缓存。
export const apiSpecKeys = {
  all: ['api-specs'] as const,
  workspace: (workspaceId: number | string) => [...apiSpecKeys.all, 'workspace', workspaceId] as const,
  lists: (workspaceId: number | string) => [...apiSpecKeys.workspace(workspaceId), 'lists'] as const,
  list: (params: ApiSpecListParams) => [...apiSpecKeys.lists(params.workspaceId), params] as const,
  spec: (workspaceId: number | string, specId: number | string) =>
    [...apiSpecKeys.workspace(workspaceId), 'spec', specId] as const,
  detail: (workspaceId: number | string, specId: number | string) =>
    [...apiSpecKeys.spec(workspaceId, specId), 'detail'] as const,
  full: (workspaceId: number | string, specId: number | string) =>
    [...apiSpecKeys.spec(workspaceId, specId), 'full'] as const,
  examples: (workspaceId: number | string, specId: number | string) =>
    [...apiSpecKeys.spec(workspaceId, specId), 'examples'] as const,
  generatedTests: (workspaceId: number | string, specId: number | string) =>
    [...apiSpecKeys.spec(workspaceId, specId), 'generated-tests'] as const,
  generatedTest: (workspaceId: number | string, specId: number | string, lang: ApiSpecLanguage) =>
    [...apiSpecKeys.generatedTests(workspaceId, specId), lang] as const,
  categories: (workspaceId: number | string) =>
    [...apiSpecKeys.workspace(workspaceId), 'categories'] as const,
  share: (workspaceId: number | string, specId: number | string) =>
    [...apiSpecKeys.spec(workspaceId, specId), 'share'] as const,
  aiDraft: (workspaceId: number | string, draftId: number | string) =>
    [...apiSpecKeys.workspace(workspaceId), 'ai-draft', draftId] as const,
};

// 规格列表查询。
// 作用：按工作区维度拉取带筛选和分页参数的 API 规格列表。
export function useApiSpecs(params: ApiSpecListParams) {
  return useQuery({
    queryKey: apiSpecKeys.list(params),
    queryFn: () => apiSpecService.list(params),
    enabled: Boolean(params.workspaceId),
    placeholderData: previousData => previousData,
  });
}

// 规格轻量详情查询。
// 作用：获取单条规格基础详情，适合编辑前预取或局部刷新。
export function useApiSpec(workspaceId?: number | string, specId?: number | string) {
  return useQuery({
    queryKey: apiSpecKeys.detail(workspaceId ?? 'unknown', specId ?? 'unknown'),
    queryFn: () => apiSpecService.getById(workspaceId as number | string, specId as number | string),
    enabled: Boolean(workspaceId) && Boolean(specId),
  });
}

// 含 examples 的完整规格详情查询。
// 作用：驱动右侧详情面板，统一承载 overview、docs 和 examples 主内容。
export function useApiSpecFull(workspaceId?: number | string, specId?: number | string) {
  return useQuery({
    queryKey: apiSpecKeys.full(workspaceId ?? 'unknown', specId ?? 'unknown'),
    queryFn: () =>
      apiSpecService.getFullById(workspaceId as number | string, specId as number | string),
    enabled: Boolean(workspaceId) && Boolean(specId),
  });
}

// 规格 examples 列表查询。
// 作用：独立维护 examples 缓存，便于创建示例后精确刷新。
export function useApiSpecExamples(workspaceId?: number | string, specId?: number | string) {
  return useQuery({
    queryKey: apiSpecKeys.examples(workspaceId ?? 'unknown', specId ?? 'unknown'),
    queryFn: () =>
      apiSpecService.listExamples(workspaceId as number | string, specId as number | string),
    enabled: Boolean(workspaceId) && Boolean(specId),
  });
}

// 规格分享元数据查询。
// 作用：读取当前规格是否已经发布分享，404 时返回 null，方便页面直接分支渲染。
export function useApiSpecShare(workspaceId?: number | string, specId?: number | string) {
  return useQuery({
    queryKey: apiSpecKeys.share(workspaceId ?? 'unknown', specId ?? 'unknown'),
    queryFn: async () => {
      try {
        return await apiSpecService.getShare(
          workspaceId as number | string,
          specId as number | string
        );
      } catch (error) {
        if ((error as { status?: number })?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(workspaceId) && Boolean(specId),
  });
}

// AI draft 查询。
// 作用：在弹窗刷新或接受创建后，支持按 draftId 重新拉取最新草稿。
export function useApiSpecAIDraft(workspaceId?: number | string, draftId?: number | string) {
  return useQuery({
    queryKey: apiSpecKeys.aiDraft(workspaceId ?? 'unknown', draftId ?? 'unknown'),
    queryFn: () =>
      apiSpecService.getAIDraft(workspaceId as number | string, draftId as number | string),
    enabled: Boolean(workspaceId) && Boolean(draftId),
  });
}

// 工作区分类查询。
// 作用：为 category_id 选择器提供树形分类列表。
export function useWorkspaceApiCategories(workspaceId?: number | string) {
  return useQuery({
    queryKey: apiSpecKeys.categories(workspaceId ?? 'unknown'),
    queryFn: () => apiSpecService.listCategories(workspaceId as number | string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

// AI 生成测试内容缓存查询。
// 作用：不触发网络请求，只订阅 mutation 写入的 flow_content 缓存。
export function useGeneratedApiTest(
  workspaceId?: number | string,
  specId?: number | string,
  lang: ApiSpecLanguage = 'en'
) {
  return useQuery<string | null>({
    queryKey: apiSpecKeys.generatedTest(workspaceId ?? 'unknown', specId ?? 'unknown', lang),
    queryFn: async () => null,
    enabled: false,
    initialData: null,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// 创建规格 mutation。
// 作用：创建成功后刷新列表，并预写入新规格详情缓存。
export function useCreateApiSpec(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateApiSpecRequest) => apiSpecService.create(workspaceId, data),
    onSuccess: spec => {
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.lists(workspaceId) });
      queryClient.setQueryData(apiSpecKeys.detail(workspaceId, spec.id), spec);
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.full(workspaceId, spec.id) });
      toast.success(t.workspace('toasts.apiSpecCreated', { method: spec.method, path: spec.path }));
    },
  });
}

const emitDraftWarnings = (warnings?: string[]) => {
  warnings?.forEach(warning => toast.warning(warning));
};

// AI 创建 draft mutation。
// 作用：生成结构化草稿后直接写入 draft 缓存，供弹窗编辑与 refine 复用。
export function useCreateApiSpecAIDraft(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateApiSpecAIDraftRequest) =>
      apiSpecService.createAIDraft(workspaceId, data),
    onSuccess: draft => {
      queryClient.setQueryData<ApiSpecAIDraft>(apiSpecKeys.aiDraft(workspaceId, draft.id), draft);
      toast.success(t.workspace('toasts.aiDraftGenerated'));
    },
  });
}

// AI 创建 draft 流式 helper。
// 作用：把流式生成结果写入缓存，同时把实时状态回传给对话框 UI。
export function useCreateApiSpecAIDraftStream(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return {
    create: async (
      data: CreateApiSpecAIDraftRequest,
      options?: ApiSpecAIDraftStreamOptions
    ): Promise<ApiSpecAIDraft> => {
      const draft = await apiSpecService.createAIDraftStream(workspaceId, data, options);
      queryClient.setQueryData<ApiSpecAIDraft>(apiSpecKeys.aiDraft(workspaceId, draft.id), draft);
      toast.success(t.workspace('toasts.aiDraftGenerated'));
      return draft;
    },
  };
}

// AI refine mutation。
// 作用：更新已有 draft，并保持 query cache 与服务端同步。
export function useRefineApiSpecAIDraft(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      draftId,
      data,
    }: {
      draftId: number | string;
      data: RefineApiSpecAIDraftRequest;
    }) => apiSpecService.refineAIDraft(workspaceId, draftId, data),
    onSuccess: draft => {
      queryClient.setQueryData<ApiSpecAIDraft>(apiSpecKeys.aiDraft(workspaceId, draft.id), draft);
      toast.success(t.workspace('toasts.aiDraftRefined'));
    },
  });
}

// AI draft accept mutation。
// 作用：把 draft 落成正式 spec，并刷新列表/详情缓存。
export function useAcceptApiSpecAIDraft(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      draftId,
      data,
    }: {
      draftId: number | string;
      data: AcceptApiSpecAIDraftRequest;
    }) => apiSpecService.acceptAIDraft(workspaceId, draftId, data),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.lists(workspaceId) });
      queryClient.setQueryData(apiSpecKeys.detail(workspaceId, result.spec.id), result.spec);
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.full(workspaceId, result.spec.id) });
      queryClient.setQueryData(apiSpecKeys.aiDraft(workspaceId, result.draft_id), {
        ...(queryClient.getQueryData<ApiSpecAIDraft>(
          apiSpecKeys.aiDraft(workspaceId, result.draft_id)
        ) ?? {
          id: result.draft_id,
        }),
        accepted_spec_id: result.spec.id,
        status: 'accepted',
      });
      emitDraftWarnings(result.warnings);
      toast.success(
        t.workspace('toasts.apiSpecCreated', {
          method: result.spec.method,
          path: result.spec.path,
        })
      );
    },
  });
}

// 更新规格 mutation。
// 作用：更新成功后同步刷新列表、详情和完整详情缓存。
export function useUpdateApiSpec(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      specId,
      data,
    }: {
      specId: number | string;
      data: UpdateApiSpecRequest;
      suppressToast?: boolean;
    }) =>
      apiSpecService.update(workspaceId, specId, data),
    onSuccess: (spec, variables) => {
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.lists(workspaceId) });
      queryClient.setQueryData(apiSpecKeys.detail(workspaceId, spec.id), spec);
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.full(workspaceId, spec.id) });
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.examples(workspaceId, spec.id) });
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.share(workspaceId, spec.id) });
      if (!variables.suppressToast) {
        toast.success(t.workspace('toasts.apiSpecUpdated', { method: spec.method, path: spec.path }));
      }
    },
  });
}

// 删除规格 mutation。
// 作用：删除成功后清理该规格相关缓存并刷新列表。
export function useDeleteApiSpec(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (specId: number | string) => apiSpecService.delete(workspaceId, specId),
    onSuccess: (_, specId) => {
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.lists(workspaceId) });
      queryClient.removeQueries({ queryKey: apiSpecKeys.spec(workspaceId, specId) });
      toast.success(t.workspace('toasts.apiSpecDeleted'));
    },
  });
}

// 批量导入 mutation。
// 作用：导入成功后刷新列表并提示 upsert 已完成。
export function useImportApiSpecs(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: ImportApiSpecsRequest) => apiSpecService.import(workspaceId, data),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.lists(workspaceId) });
      toast.success(result.message || t.workspace('toasts.specsImported'));
    },
  });
}

// Markdown 预览导入 mutation。
// 作用：把 Markdown 文档先转换成 reviewable draft 列表，供页面决定是否继续落库。
export function useImportApiSpecMarkdownDraft(workspaceId: number | string) {
  const t = useT();

  return useMutation({
    mutationFn: (data: ImportApiSpecMarkdownDraftRequest) =>
      apiSpecService.importMarkdownDraftPreview(workspaceId, data),
    onSuccess: result => {
      toast.success(t.workspace('toasts.aiDraftGenerated'), {
        description: `${result.document_title}: ${result.draft_count} drafts`,
      });
    },
  });
}

// 导出 mutation。
// 作用：触发导出接口，页面层拿到结果后负责下载文件。
export function useExportApiSpecs(workspaceId: number | string) {
  return useMutation({
    mutationFn: ({ format }: { format: 'json' | 'openapi' | 'swagger' | 'markdown' }) =>
      apiSpecService.export(workspaceId, format),
  });
}

// AI 生成文档 mutation。
// 作用：单条生成成功后刷新对应规格详情和列表缓存。
export function useGenApiDoc(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({ specId, lang }: { specId: number | string; lang: ApiSpecLanguage }) =>
      apiSpecService.genDoc(workspaceId, specId, lang),
    onSuccess: spec => {
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.lists(workspaceId) });
      queryClient.setQueryData(apiSpecKeys.detail(workspaceId, spec.id), spec);
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.full(workspaceId, spec.id) });
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.share(workspaceId, spec.id) });
      toast.success(t.workspace('toasts.documentationGenerated', { path: spec.path }));
    },
  });
}

// AI 生成测试 mutation。
// 作用：把 flow_content 缓存在 query 中，方便详情页直接展示。
export function useGenApiTest(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({ specId, lang }: { specId: number | string; lang: ApiSpecLanguage }) =>
      apiSpecService.genTest(workspaceId, specId, lang),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(
        apiSpecKeys.generatedTest(workspaceId, variables.specId, variables.lang),
        result.flow_content
      );
      toast.success(t.workspace('toasts.apiTestGenerated'));
    },
  });
}

// 批量生成文档 mutation。
// 作用：批量任务提交成功后统一失效当前工作区下的规格缓存。
export function useBatchGenApiDocs(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: BatchGenDocRequest) => apiSpecService.batchGenDoc(workspaceId, data),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.workspace(workspaceId) });
      toast.success(
        t.workspace('toasts.batchDocsQueued', {
          queued: result.queued,
          skipped: result.skipped,
        })
      );
    },
  });
}

// 创建示例 mutation。
// 作用：创建成功后刷新 examples 列表和完整规格详情。
export function useCreateApiExample(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({ specId, data }: { specId: number | string; data: CreateApiExampleRequest }) =>
      apiSpecService.createExample(workspaceId, specId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: apiSpecKeys.examples(workspaceId, variables.specId),
      });
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.full(workspaceId, variables.specId) });
      queryClient.invalidateQueries({ queryKey: apiSpecKeys.share(workspaceId, variables.specId) });
      toast.success(t.workspace('toasts.apiExampleCreated'));
    },
  });
}

// 发布或刷新分享 mutation。
// 作用：返回当前规格的公开 slug，并同步本地缓存。
export function usePublishApiSpecShare(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (specId: number | string) => apiSpecService.publishShare(workspaceId, specId),
    onSuccess: share => {
      queryClient.setQueryData(apiSpecKeys.share(workspaceId, share.api_spec_id), share);
      toast.success(t.workspace('toasts.publicSharePublished'));
    },
  });
}

// 删除分享 mutation。
// 作用：关闭公开链接，并把分享查询缓存直接置空。
export function useDeleteApiSpecShare(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (specId: number | string) => apiSpecService.deleteShare(workspaceId, specId),
    onSuccess: (_, specId) => {
      queryClient.setQueryData(apiSpecKeys.share(workspaceId, specId), null);
      toast.success(t.workspace('toasts.publicShareDisabled'));
    },
  });
}
