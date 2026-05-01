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
  ImportApiSpecsRequest,
  ImportApiSpecsResponse,
  PublicApiSpecShare,
  RefineApiSpecAIDraftRequest,
  ProjectCategoryListResponse,
  UpdateApiSpecRequest,
} from '@/types/api-spec';

// API Specifications 服务层。
// 作用：集中封装项目级 API 规格、示例、导入导出、AI 生成和分类查询请求。
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
    projectId,
    page = 1,
    pageSize = 20,
    version,
    method,
    tag,
    keyword,
  }: ApiSpecListParams) =>
    request
      .get<ApiSpecListResponse>(`/projects/${projectId}/api-specs`, {
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

  getById: (projectId: number | string, specId: number | string) =>
    request.get<ApiSpec>(`/projects/${projectId}/api-specs/${specId}`).then(normalizeApiSpec),

  getFullById: (projectId: number | string, specId: number | string) =>
    request.get<ApiSpec>(`/projects/${projectId}/api-specs/${specId}/full`).then(normalizeApiSpec),

  create: (projectId: number | string, data: CreateApiSpecRequest) =>
    request
      .post<ApiSpec>(`/projects/${projectId}/api-specs`, normalizePayload(data))
      .then(normalizeApiSpec),

  createAIDraft: (projectId: number | string, data: CreateApiSpecAIDraftRequest) =>
    request.post<ApiSpecAIDraft>(
      `/projects/${projectId}/api-specs/ai-drafts`,
      normalizePayload(data)
    ),

  createAIDraftStream: async (
    projectId: number | string,
    data: CreateApiSpecAIDraftRequest,
    options: ApiSpecAIDraftStreamOptions = {}
  ): Promise<ApiSpecAIDraft> => {
    const { accessToken } = getAuthTokens();
    const response = await fetch(buildApiUrl(`/projects/${projectId}/api-specs/ai-drafts/stream`), {
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
    });

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

  getAIDraft: (projectId: number | string, draftId: number | string) =>
    request.get<ApiSpecAIDraft>(`/projects/${projectId}/api-specs/ai-drafts/${draftId}`),

  refineAIDraft: (
    projectId: number | string,
    draftId: number | string,
    data: RefineApiSpecAIDraftRequest
  ) =>
    request.post<ApiSpecAIDraft>(
      `/projects/${projectId}/api-specs/ai-drafts/${draftId}/refine`,
      normalizePayload(data)
    ),

  acceptAIDraft: (
    projectId: number | string,
    draftId: number | string,
    data: AcceptApiSpecAIDraftRequest
  ) =>
    request.post<AcceptApiSpecAIDraftResponse>(
      `/projects/${projectId}/api-specs/ai-drafts/${draftId}/accept`,
      normalizePayload(data)
    ),

  update: (projectId: number | string, specId: number | string, data: UpdateApiSpecRequest) =>
    request
      .patch<ApiSpec>(`/projects/${projectId}/api-specs/${specId}`, normalizePayload(data))
      .then(normalizeApiSpec),

  delete: (projectId: number | string, specId: number | string) =>
    request.delete<void>(`/projects/${projectId}/api-specs/${specId}`),

  import: (projectId: number | string, data: ImportApiSpecsRequest) =>
    request.post<ImportApiSpecsResponse>(`/projects/${projectId}/api-specs/import`, data),

  export: (projectId: number | string, format: ApiSpecExportFormat) =>
    request.get<ApiSpecExportPayload>(`/projects/${projectId}/api-specs/export`, {
      params: { format },
    }),

  genDoc: (projectId: number | string, specId: number | string, lang: ApiSpecLanguage) =>
    request.post<ApiSpec>(`/projects/${projectId}/api-specs/${specId}/gen-doc`, undefined, {
      params: { lang },
    }),

  genTest: (projectId: number | string, specId: number | string, lang: ApiSpecLanguage) =>
    request.post<GenApiTestResponse>(
      `/projects/${projectId}/api-specs/${specId}/gen-test`,
      undefined,
      {
        params: { lang },
      }
    ),

  batchGenDoc: (projectId: number | string, data: BatchGenDocRequest) =>
    request.post<BatchGenDocResponse>(
      `/projects/${projectId}/api-specs/batch-gen-doc`,
      normalizePayload(data)
    ),

  listExamples: (projectId: number | string, specId: number | string) =>
    request.get<ApiSpecExamplesResponse>(`/projects/${projectId}/api-specs/${specId}/examples`),

  createExample: (
    projectId: number | string,
    specId: number | string,
    data: CreateApiExampleRequest
  ) =>
    request.post<ApiSpecExample>(
      `/projects/${projectId}/api-specs/${specId}/examples`,
      normalizePayload(data)
    ),

  getShare: (projectId: number | string, specId: number | string) =>
    request.get<ApiSpecShare>(`/projects/${projectId}/api-specs/${specId}/share`),

  publishShare: (projectId: number | string, specId: number | string) =>
    request.post<ApiSpecShare>(`/projects/${projectId}/api-specs/${specId}/share`),

  deleteShare: (projectId: number | string, specId: number | string) =>
    request.delete<void>(`/projects/${projectId}/api-specs/${specId}/share`),

  getPublicShare: (slug: string) =>
    request
      .get<PublicApiSpecShare>(`/public/api-spec-shares/${slug}`, {
        skipAuth: true,
      })
      .then(normalizePublicApiSpecShare),

  listCategories: (projectId: number | string) =>
    request.get<ProjectCategoryListResponse>(`/projects/${projectId}/categories`, {
      params: { tree: true },
    }),
};

export type ApiSpecService = typeof apiSpecService;
