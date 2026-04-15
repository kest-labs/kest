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
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string
  ) =>
    request.get<RequestExample[]>(
      `/projects/${projectId}/collections/${collectionId}/requests/${requestId}/examples`
    ),

  getById: (
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string
  ) =>
    request.get<RequestExample>(
      `/projects/${projectId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}`
    ),

  create: (
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string,
    data: CreateExampleRequest
  ) =>
    request.post<RequestExample>(
      `/projects/${projectId}/collections/${collectionId}/requests/${requestId}/examples`,
      normalizePayload(data)
    ),

  update: (
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string,
    data: UpdateExampleRequest
  ) =>
    request.put<RequestExample>(
      `/projects/${projectId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}`,
      normalizePayload(data)
    ),

  delete: (
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string
  ) =>
    request.delete<void>(
      `/projects/${projectId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}`
    ),

  saveResponse: (
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string,
    data: SaveExampleResponseRequest
  ) =>
    request.post<RequestExample>(
      `/projects/${projectId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}/response`,
      normalizePayload(data)
    ),

  setDefault: (
    projectId: number | string,
    collectionId: number | string,
    requestId: number | string,
    exampleId: number | string
  ) =>
    request.post<RequestExample>(
      `/projects/${projectId}/collections/${collectionId}/requests/${requestId}/examples/${exampleId}/default`
    ),
};

export type ExampleService = typeof exampleService;
