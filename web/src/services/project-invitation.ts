import request from '@/http';
import type {
  AcceptProjectInvitationResponse,
  CreateProjectInvitationRequest,
  ProjectInvitation,
  PublicProjectInvitation,
  RejectProjectInvitationResponse,
} from '@/types/project-invitation';

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

export const projectInvitationService = {
  list: (projectId: number | string) =>
    request.get<ProjectInvitation[]>(`/projects/${projectId}/invitations`),

  create: (projectId: number | string, data: CreateProjectInvitationRequest) =>
    request.post<ProjectInvitation>(`/projects/${projectId}/invitations`, normalizePayload(data)),

  revoke: (projectId: number | string, invitationId: number | string) =>
    request.delete<void>(`/projects/${projectId}/invitations/${invitationId}`),

  getDetail: (slug: string) =>
    request.get<PublicProjectInvitation>(`/project-invitations/${slug}`, {
      skipErrorHandler: true,
    }),

  accept: (slug: string) =>
    request.post<AcceptProjectInvitationResponse>(`/project-invitations/${slug}/accept`),

  reject: (slug: string) =>
    request.post<RejectProjectInvitationResponse>(`/project-invitations/${slug}/reject`),
};

export type ProjectInvitationService = typeof projectInvitationService;
