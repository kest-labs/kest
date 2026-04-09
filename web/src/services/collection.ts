import request from '@/http';
import type {
  CollectionListParams,
  CreateCollectionRequest,
  ProjectCollection,
  ProjectCollectionListResponse,
  ProjectCollectionTreeNode,
  UpdateCollectionRequest,
} from '@/types/collection';

// 请求体清理器。
// 作用：过滤 `undefined` 字段，避免把无意义空值提交给后端。
const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

// Collections 服务层。
// 作用：集中封装项目 collections 的查询和写入请求，供工作台复用。
export const collectionService = {
  list: ({
    projectId,
    page,
    perPage,
  }: CollectionListParams) =>
    request.get<ProjectCollectionListResponse>(`/projects/${projectId}/collections`, {
      params: normalizePayload({
        page,
        per_page: perPage,
      }),
    }),

  create: (projectId: number | string, data: CreateCollectionRequest) =>
    request.post<ProjectCollection>(`/projects/${projectId}/collections`, normalizePayload(data)),

  tree: (projectId: number | string) =>
    request.get<ProjectCollectionTreeNode[]>(`/projects/${projectId}/collections/tree`, {
      skipErrorHandler: true,
    }),

  update: (
    projectId: number | string,
    collectionId: number | string,
    data: UpdateCollectionRequest
  ) =>
    request.put<ProjectCollection>(
      `/projects/${projectId}/collections/${collectionId}`,
      normalizePayload(data)
    ),

  delete: (projectId: number | string, collectionId: number | string) =>
    request.delete<void>(`/projects/${projectId}/collections/${collectionId}`),
};

export type CollectionService = typeof collectionService;
