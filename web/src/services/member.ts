import request from '@/http';
import type {
  WorkspaceMember,
  UpdateWorkspaceMemberRequest,
} from '@/types/member';

// 请求体清理器。
// 作用：过滤掉 `undefined` 字段，避免把无意义空值提交给后端。
const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

// Members 服务层。
// 作用：集中封装工作区成员列表、当前角色和成员管理相关 HTTP 请求。
export const memberService = {
  list: (workspaceId: number | string) =>
    request.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),

  getMyRole: (workspaceId: number | string) =>
    request.get<WorkspaceMember>(`/workspaces/${workspaceId}/members/me`),

  update: (
    workspaceId: number | string,
    userId: number | string,
    data: UpdateWorkspaceMemberRequest
  ) =>
    request.patch<WorkspaceMember>(
      `/workspaces/${workspaceId}/members/${userId}`,
      normalizePayload(data)
    ),

  delete: (workspaceId: number | string, userId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/members/${userId}`),
};

export type MemberService = typeof memberService;
