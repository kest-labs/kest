import request from '@/http';
import type {
  CreateExampleRequest,
  RequestExample,
  SaveExampleResponseRequest,
  UpdateExampleRequest,
} from '@/types/example';

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

export const exampleService = {
  list: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string
  ) =>
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
