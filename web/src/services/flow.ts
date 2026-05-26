import { buildApiUrl } from '@/config/api';
import request from '@/http';
import { getAuthTokens } from '@/store/auth-store';
import type {
  CreateFlowRequest,
  FlowDetail,
  FlowListResponse,
  FlowRun,
  FlowRunListResponse,
  FlowRunListFilters,
  FlowStreamStepEvent,
  ImportFlowMarkdownRequest,
  WorkspaceFlow,
  SaveFlowRequest,
  StreamFlowRunOptions,
  UpdateFlowRequest,
  UpdateFlowMarkdownRequest,
} from '@/types/flow';

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

const buildRunQuery = (filters?: FlowRunListFilters) => {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

const readSSEEvent = (
  chunk: string,
  handlers: Required<Pick<StreamFlowRunOptions, 'onDone' | 'onStep'>>
) => {
  const lines = chunk
    .split('\n')
    .map((line) => line.trim())
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

  if (eventName === 'done') {
    handlers.onDone();
    return;
  }

  if (eventName !== 'step' || dataParts.length === 0) {
    return;
  }

  try {
    handlers.onStep(JSON.parse(dataParts.join('\n')) as FlowStreamStepEvent);
  } catch {
    // Ignore malformed SSE payloads and keep the stream alive.
  }
};

export const flowService = {
  list: (workspaceId: number | string) =>
    request.get<FlowListResponse>(`/workspaces/${workspaceId}/flows`),

  getById: (workspaceId: number | string, flowId: number | string) =>
    request.get<FlowDetail>(`/workspaces/${workspaceId}/flows/${flowId}`),

  create: (workspaceId: number | string, data: CreateFlowRequest) =>
    request.post<WorkspaceFlow>(`/workspaces/${workspaceId}/flows`, normalizePayload(data)),

  importMarkdown: (workspaceId: number | string, data: ImportFlowMarkdownRequest) =>
    request.post<FlowDetail>(`/workspaces/${workspaceId}/flows/import-markdown`, normalizePayload(data)),

  update: (workspaceId: number | string, flowId: number | string, data: UpdateFlowRequest) =>
    request.patch<WorkspaceFlow>(`/workspaces/${workspaceId}/flows/${flowId}`, normalizePayload(data)),

  updateMarkdown: (
    workspaceId: number | string,
    flowId: number | string,
    data: UpdateFlowMarkdownRequest
  ) => request.put<FlowDetail>(`/workspaces/${workspaceId}/flows/${flowId}/markdown`, normalizePayload(data)),

  delete: (workspaceId: number | string, flowId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/flows/${flowId}`),

  save: (workspaceId: number | string, flowId: number | string, data: SaveFlowRequest) =>
    request.put<FlowDetail>(`/workspaces/${workspaceId}/flows/${flowId}`, normalizePayload(data)),

  run: (workspaceId: number | string, flowId: number | string) =>
    request.post<FlowRun>(`/workspaces/${workspaceId}/flows/${flowId}/run`),

  listRuns: (workspaceId: number | string, flowId: number | string, filters?: FlowRunListFilters) =>
    request.get<FlowRunListResponse>(`/workspaces/${workspaceId}/flows/${flowId}/runs${buildRunQuery(filters)}`),

  getRun: (workspaceId: number | string, flowId: number | string, runId: number | string) =>
    request.get<FlowRun>(`/workspaces/${workspaceId}/flows/${flowId}/runs/${runId}`),

  streamRun: async (
    workspaceId: number | string,
    flowId: number | string,
    runId: number | string,
    options: StreamFlowRunOptions = {}
  ) => {
    const { accessToken } = getAuthTokens();
    let streamUrl = buildApiUrl(`/workspaces/${workspaceId}/flows/${flowId}/runs/${runId}/events`);
    const selectedBaseUrl = options.baseUrl?.trim();
    if (selectedBaseUrl) {
      const separator = streamUrl.includes('?') ? '&' : '?';
      streamUrl = `${streamUrl}${separator}base_url=${encodeURIComponent(selectedBaseUrl)}`;
    }

    const response = await fetch(streamUrl, {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to stream flow run: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Flow run stream is not available');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const handlers = {
      onDone: options.onDone ?? (() => {}),
      onStep: options.onStep ?? (() => {}),
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        readSSEEvent(chunk, handlers);
      }
    }

    if (buffer.trim()) {
      readSSEEvent(buffer, handlers);
    }
  },
};

export type FlowService = typeof flowService;
