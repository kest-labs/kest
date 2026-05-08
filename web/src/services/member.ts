import request from '@/http';
import type {
  ProjectMember,
  UpdateProjectMemberRequest,
} from '@/types/member';

// 请求体清理器。
// 作用：过滤掉 `undefined` 字段，避免把无意义空值提交给后端。
const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

// Members 服务层。
// 作用：集中封装项目成员列表、当前角色和成员管理相关 HTTP 请求。
export const memberService = {
  list: (projectId: number | string) =>
    request.get<ProjectMember[]>(`/projects/${projectId}/members`),

  getMyRole: (projectId: number | string) =>
    request.get<ProjectMember>(`/projects/${projectId}/members/me`),

  update: (
    projectId: number | string,
    userId: number | string,
    data: UpdateProjectMemberRequest
  ) =>
    request.patch<ProjectMember>(
      `/projects/${projectId}/members/${userId}`,
      normalizePayload(data)
    ),

  delete: (projectId: number | string, userId: number | string) =>
    request.delete<void>(`/projects/${projectId}/members/${userId}`),
};

export type MemberService = typeof memberService;
