import { buildApiUrl } from '@/config/api';
import { ApiError } from '@/http/request';
import request from '@/http';
import { getAuthTokens } from '@/store/auth-store';
import type {
  ApiSpecAIDraftStreamOptions,
  AcceptApiSpecAIDraftRequest,
  AcceptApiSpecAIDraftResponse,
  ApiSpec,
  ApiSpecAIDraft,
  ApiSpecExample,
  ApiSpecExamplesResponse,
  ApiSpecExportFormat,
  ApiSpecExportPayload,
  ApiSpecLanguage,
  ApiSpecListParams,
  ApiSpecListResponse,
  ApiSpecShare,
  BatchGenDocRequest,
  BatchGenDocResponse,
  CreateApiSpecAIDraftRequest,
  CreateApiExampleRequest,
  CreateApiSpecRequest,
  GenApiTestResponse,
  ImportApiSpecMarkdownDraftRequest,
  ImportApiSpecMarkdownDraftResponse,
  ImportApiSpecsRequest,
  ImportApiSpecsResponse,
  PublicApiSpecShare,
  RefineApiSpecAIDraftRequest,
  WorkspaceCategoryListResponse,
  UpdateApiSpecRequest,
} from '@/types/api-spec';

// API Specifications 服务层。
// 作用：集中封装工作区级 API 规格、示例、导入导出、AI 生成和分类查询请求。
// 额外约束：请求体会先清理 `undefined` 字段，避免把无意义空字段发给后端。
const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

const normalizeApiSpec = (spec: ApiSpec): ApiSpec => ({
  ...spec,
  tags: Array.isArray(spec.tags) ? spec.tags : [],
  parameters: Array.isArray(spec.parameters) ? spec.parameters : [],
  examples: Array.isArray(spec.examples) ? spec.examples : [],
  responses:
    spec.responses && typeof spec.responses === 'object' && !Array.isArray(spec.responses)
      ? spec.responses
      : {},
});

const normalizeApiSpecListResponse = (response: ApiSpecListResponse): ApiSpecListResponse => ({
  ...response,
  items: response.items.map(normalizeApiSpec),
});

const normalizePublicApiSpecShare = (share: PublicApiSpecShare): PublicApiSpecShare => ({
  ...share,
  tags: Array.isArray(share.tags) ? share.tags : [],
  parameters: Array.isArray(share.parameters) ? share.parameters : [],
  responses:
    share.responses && typeof share.responses === 'object' && !Array.isArray(share.responses)
      ? share.responses
      : {},
});

const readAIDraftStreamEvent = (
  chunk: string,
  handlers: {
    onStatus: (status: string) => void;
    onToken: (token: string) => void;
    onResult: (draft: ApiSpecAIDraft) => void;
    onError: (message: string) => void;
  }
) => {
  const lines = chunk
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  let eventName = 'message';
  const dataParts: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataParts.push(line.slice(5).trim());
    }
  }

  if (dataParts.length === 0 || eventName === 'done') {
    return;
  }

  try {
    const payload = JSON.parse(dataParts.join('\n')) as
      | { message?: string }
      | { content?: string }
      | ApiSpecAIDraft;

    if (eventName === 'status') {
      handlers.onStatus((payload as { message?: string }).message ?? '');
      return;
    }

    if (eventName === 'token') {
      handlers.onToken((payload as { content?: string }).content ?? '');
      return;
    }

    if (eventName === 'result') {
      handlers.onResult(payload as ApiSpecAIDraft);
      return;
    }

    if (eventName === 'error') {
      handlers.onError((payload as { message?: string }).message ?? 'Failed to generate AI draft');
    }
  } catch {
    // Ignore malformed stream events and keep the stream alive.
  }
};

const parseFetchError = async (response: Response) => {
  let payload: { code?: string | number; message?: string; error?: string } | null = null;
  try {
    payload = (await response.json()) as {
      code?: string | number;
      message?: string;
      error?: string;
    };
  } catch {
    payload = null;
  }

  throw new ApiError(
    payload?.error || payload?.message || `Failed to generate AI draft: ${response.status}`,
    payload?.code || 'FETCH_ERROR',
    response.status
  );
};

export const apiSpecService = {
  list: ({
    workspaceId,
    page = 1,
    pageSize = 20,
    version,
    method,
    tag,
    keyword,
  }: ApiSpecListParams) =>
    request
      .get<ApiSpecListResponse>(`/workspaces/${workspaceId}/api-specs`, {
        params: normalizePayload({
          page,
          page_size: pageSize,
          version,
          method,
          tag,
          keyword,
        }),
      })
      .then(normalizeApiSpecListResponse),

  getById: (workspaceId: number | string, specId: number | string) =>
    request.get<ApiSpec>(`/workspaces/${workspaceId}/api-specs/${specId}`).then(normalizeApiSpec),

  getFullById: (workspaceId: number | string, specId: number | string) =>
    request
      .get<ApiSpec>(`/workspaces/${workspaceId}/api-specs/${specId}/full`)
      .then(normalizeApiSpec),

  create: (workspaceId: number | string, data: CreateApiSpecRequest) =>
    request
      .post<ApiSpec>(`/workspaces/${workspaceId}/api-specs`, normalizePayload(data))
      .then(normalizeApiSpec),

  createAIDraft: (workspaceId: number | string, data: CreateApiSpecAIDraftRequest) =>
    request.post<ApiSpecAIDraft>(
      `/workspaces/${workspaceId}/api-specs/ai-drafts`,
      normalizePayload(data)
    ),

  createAIDraftStream: async (
    workspaceId: number | string,
    data: CreateApiSpecAIDraftRequest,
    options: ApiSpecAIDraftStreamOptions = {}
  ): Promise<ApiSpecAIDraft> => {
    const { accessToken } = getAuthTokens();
    const response = await fetch(
      buildApiUrl(`/workspaces/${workspaceId}/api-specs/ai-drafts/stream`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken
            ? {
                Authorization: `Bearer ${accessToken}`,
              }
            : {}),
        },
        body: JSON.stringify(normalizePayload(data)),
        signal: options.signal,
      }
    );

    if (!response.ok) {
      await parseFetchError(response);
    }

    if (!response.body) {
      throw new Error('AI draft stream is not available');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalDraft: ApiSpecAIDraft | null = null;
    let streamError: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        readAIDraftStreamEvent(chunk, {
          onStatus: status => options.onStatus?.(status),
          onToken: token => options.onToken?.(token),
          onResult: draft => {
            finalDraft = draft;
          },
          onError: message => {
            streamError = message;
          },
        });
      }
    }

    if (buffer.trim()) {
      readAIDraftStreamEvent(buffer, {
        onStatus: status => options.onStatus?.(status),
        onToken: token => options.onToken?.(token),
        onResult: draft => {
          finalDraft = draft;
        },
        onError: message => {
          streamError = message;
        },
      });
    }

    if (streamError) {
      throw new ApiError(streamError, 'STREAM_ERROR');
    }

    if (!finalDraft) {
      throw new Error('AI draft generation finished without returning a draft');
    }

    return finalDraft;
  },

  getAIDraft: (workspaceId: number | string, draftId: number | string) =>
    request.get<ApiSpecAIDraft>(`/workspaces/${workspaceId}/api-specs/ai-drafts/${draftId}`),

  refineAIDraft: (
    workspaceId: number | string,
    draftId: number | string,
    data: RefineApiSpecAIDraftRequest
  ) =>
    request.post<ApiSpecAIDraft>(
      `/workspaces/${workspaceId}/api-specs/ai-drafts/${draftId}/refine`,
      normalizePayload(data)
    ),

  acceptAIDraft: (
    workspaceId: number | string,
    draftId: number | string,
    data: AcceptApiSpecAIDraftRequest
  ) =>
    request.post<AcceptApiSpecAIDraftResponse>(
      `/workspaces/${workspaceId}/api-specs/ai-drafts/${draftId}/accept`,
      normalizePayload(data)
    ),

  update: (workspaceId: number | string, specId: number | string, data: UpdateApiSpecRequest) =>
    request
      .patch<ApiSpec>(`/workspaces/${workspaceId}/api-specs/${specId}`, normalizePayload(data))
      .then(normalizeApiSpec),

  delete: (workspaceId: number | string, specId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/api-specs/${specId}`),

  import: (workspaceId: number | string, data: ImportApiSpecsRequest) =>
    request.post<ImportApiSpecsResponse>(`/workspaces/${workspaceId}/api-specs/import`, data),

  importMarkdownDraftPreview: (
    workspaceId: number | string,
    data: ImportApiSpecMarkdownDraftRequest
  ) => {
    const formData = new FormData();
    formData.append('file', data.file);

    return request.post<ImportApiSpecMarkdownDraftResponse>(
      `/workspaces/${workspaceId}/api-specs/import/markdown-ai`,
      formData,
      {
        params: data.base_url_override
          ? {
              base_url_override: data.base_url_override,
            }
          : undefined,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },

  export: (workspaceId: number | string, format: ApiSpecExportFormat) =>
    request.get<ApiSpecExportPayload>(`/workspaces/${workspaceId}/api-specs/export`, {
      params: { format },
    }),

  genDoc: (workspaceId: number | string, specId: number | string, lang: ApiSpecLanguage) =>
    request.post<ApiSpec>(`/workspaces/${workspaceId}/api-specs/${specId}/gen-doc`, undefined, {
      params: { lang },
    }),

  genTest: (workspaceId: number | string, specId: number | string, lang: ApiSpecLanguage) =>
    request.post<GenApiTestResponse>(
      `/workspaces/${workspaceId}/api-specs/${specId}/gen-test`,
      undefined,
      {
        params: { lang },
      }
    ),

  batchGenDoc: (workspaceId: number | string, data: BatchGenDocRequest) =>
    request.post<BatchGenDocResponse>(
      `/workspaces/${workspaceId}/api-specs/batch-gen-doc`,
      normalizePayload(data)
    ),

  listExamples: (workspaceId: number | string, specId: number | string) =>
    request.get<ApiSpecExamplesResponse>(`/workspaces/${workspaceId}/api-specs/${specId}/examples`),

  createExample: (
    workspaceId: number | string,
    specId: number | string,
    data: CreateApiExampleRequest
  ) =>
    request.post<ApiSpecExample>(
      `/workspaces/${workspaceId}/api-specs/${specId}/examples`,
      normalizePayload(data)
    ),

  getShare: (workspaceId: number | string, specId: number | string) =>
    request.get<ApiSpecShare>(`/workspaces/${workspaceId}/api-specs/${specId}/share`),

  publishShare: (workspaceId: number | string, specId: number | string) =>
    request.post<ApiSpecShare>(`/workspaces/${workspaceId}/api-specs/${specId}/share`),

  deleteShare: (workspaceId: number | string, specId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/api-specs/${specId}/share`),

  getPublicShare: (slug: string) =>
    request
      .get<PublicApiSpecShare>(`/public/api-spec-shares/${slug}`, {
        skipAuth: true,
      })
      .then(normalizePublicApiSpecShare),

  listCategories: (workspaceId: number | string) =>
    request.get<WorkspaceCategoryListResponse>(`/workspaces/${workspaceId}/categories`, {
      params: { tree: true },
    }),
};

export type ApiSpecService = typeof apiSpecService;
