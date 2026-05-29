import request from '@/http';
import type {
  CreateRequestRequest,
  GenRequestDocRequest,
  WorkspaceRequest,
  RequestListParams,
  RequestListResponse,
  RunRequestRequest,
  RunRequestResponse,
  UpdateRequestRequest,
} from '@/types/request';

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

export const requestService = {
  list: ({
    workspaceId,
    collectionId,
    page,
    perPage,
  }: RequestListParams) =>
    request.get<RequestListResponse>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests`,
      {
        params: normalizePayload({
          page,
          per_page: perPage,
        }),
      }
    ),

  getById: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string
  ) =>
    request.get<WorkspaceRequest>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}`
    ),

  create: (
    workspaceId: number | string,
    collectionId: number | string,
    data: CreateRequestRequest
  ) =>
    request.post<WorkspaceRequest>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests`,
      normalizePayload(data)
    ),

  update: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    data: UpdateRequestRequest
  ) =>
    request.put<WorkspaceRequest>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}`,
      normalizePayload(data)
    ),

  genDoc: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    data: GenRequestDocRequest
  ) =>
    request.post<WorkspaceRequest>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/gen-doc`,
      undefined,
      {
        params: normalizePayload(data),
      }
    ),

  delete: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string
  ) =>
    request.delete<void>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}`
    ),

  run: (
    workspaceId: number | string,
    collectionId: number | string,
    requestId: number | string,
    data: RunRequestRequest
  ) =>
    request.post<RunRequestResponse>(
      `/workspaces/${workspaceId}/collections/${collectionId}/requests/${requestId}/run`,
      normalizePayload(data)
    ),
};

export type RequestService = typeof requestService;
