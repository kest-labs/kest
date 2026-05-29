import request from '@/http';
import type {
  CreateExampleRequest,
  GenerateAIExamplesRequest,
  GenerateAIExamplesResponse,
  RequestExample,
  SaveExampleResponseRequest,
  UpdateExampleRequest,
} from '@/types/example';

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

const AI_EXAMPLE_GENERATION_TIMEOUT_MS = 90000;

export const exampleService = {
  list: (workspaceId: number | string, collectionId: number | string, requestId: number | string) =>
    request.get<RequestExample[]>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/examples`
    ),

  getById: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string
  ) =>
    request.get<RequestExample>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}`
    ),

  create: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    data: CreateExampleRequest
  ) =>
    request.post<RequestExample>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/examples`,
      normalizePayload(data)
    ),

  generateAI: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    data: GenerateAIExamplesRequest = {}
  ) =>
    request.post<GenerateAIExamplesResponse>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/examples/ai-generate`,
      normalizePayload(data),
      { timeout: AI_EXAMPLE_GENERATION_TIMEOUT_MS }
    ),

  update: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string,
    data: UpdateExampleRequest
  ) =>
    request.put<RequestExample>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}`,
      normalizePayload(data)
    ),

  delete: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string
  ) =>
    request.delete<void>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}`
    ),

  saveResponse: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string,
    data: SaveExampleResponseRequest
  ) =>
    request.post<RequestExample>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}/response`,
      normalizePayload(data)
    ),

  setDefault: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string
  ) =>
    request.post<RequestExample>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}/default`
    ),
};

export type ExampleService = typeof exampleService;
