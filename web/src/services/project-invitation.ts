import request from '@/http';
import type {
  AcceptProjectInvitationResponse,
  CreateProjectInvitationRequest,
  ProjectInvitation,
  PublicProjectInvitation,
  ReceivedProjectInvitation,
  RejectProjectInvitationResponse,
} from '@/types/project-invitation';

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

export const projectInvitationService = {
  list: (workspaceId: number | string) =>
    request.get<ProjectInvitation[]>(`/workspaces/${workspaceId}/invitations`),

  create: (workspaceId: number | string, data: CreateProjectInvitationRequest) =>
    request.post<ProjectInvitation>(
      `/workspaces/${workspaceId}/invitations`,
      normalizePayload(data)
    ),

  revoke: (workspaceId: number | string, invitationId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/invitations/${invitationId}`),

  listReceived: () =>
    request.get<ReceivedProjectInvitation[]>('/workspace-invitations/received', {
      skipErrorHandler: true,
    }),

  getDetail: (slug: string) =>
    request.get<PublicProjectInvitation>(`/workspace-invitations/${slug}`, {
      skipErrorHandler: true,
    }),

  accept: (slug: string) =>
    request.post<AcceptProjectInvitationResponse>(`/workspace-invitations/${slug}/accept`),

  reject: (slug: string) =>
    request.post<RejectProjectInvitationResponse>(`/workspace-invitations/${slug}/reject`),
};

export type ProjectInvitationService = typeof projectInvitationService;
