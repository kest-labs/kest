import request from '@/http';
import type {
  CollectionListParams,
  CreateCollectionRequest,
  WorkspaceCollection,
  WorkspaceCollectionListResponse,
  WorkspaceCollectionTreeNode,
  UpdateCollectionRequest,
} from '@/types/collection';

// 请求体清理器。
// 作用：过滤 `undefined` 字段，避免把无意义空值提交给后端。
const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

// Collections 服务层。
// 作用：集中封装工作区 collections 的查询和写入请求，供工作台复用。
export const collectionService = {
  list: ({
    workspaceId,
    page,
    perPage,
  }: CollectionListParams) =>
    request.get<WorkspaceCollectionListResponse>(`/workspaces/${workspaceId}/collections`, {
      params: normalizePayload({
        page,
        per_page: perPage,
      }),
    }),

  create: (workspaceId: number | string, data: CreateCollectionRequest) =>
    request.post<WorkspaceCollection>(`/workspaces/${workspaceId}/collections`, normalizePayload(data)),

  tree: (workspaceId: number | string) =>
    request.get<WorkspaceCollectionTreeNode[]>(`/workspaces/${workspaceId}/collections/tree`, {
      skipErrorHandler: true,
    }),

  update: (
    workspaceId: number | string,
    collectionId: number | string,
    data: UpdateCollectionRequest
  ) =>
    request.put<WorkspaceCollection>(
      `/workspaces/${workspaceId}/collections/${collectionId}`,
      normalizePayload(data)
    ),

  delete: (workspaceId: number | string, collectionId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/collections/${collectionId}`),
};

export type CollectionService = typeof collectionService;
