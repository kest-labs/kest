import request from '@/http';
import type {
  AcceptWorkspaceInvitationResponse,
  CreateWorkspaceInvitationRequest,
  WorkspaceInvitation,
  PublicWorkspaceInvitation,
  ReceivedWorkspaceInvitation,
  RejectWorkspaceInvitationResponse,
} from '@/types/workspace-invitation';

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

export const workspaceInvitationService = {
  list: (workspaceId: number | string) =>
    request.get<WorkspaceInvitation[]>(`/workspaces/${workspaceId}/invitations`),

  create: (workspaceId: number | string, data: CreateWorkspaceInvitationRequest) =>
    request.post<WorkspaceInvitation>(`/workspaces/${workspaceId}/invitations`, normalizePayload(data)),

  revoke: (workspaceId: number | string, invitationId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/invitations/${invitationId}`),

  listReceived: () =>
    request.get<ReceivedWorkspaceInvitation[]>('/workspace-invitations/received', {
      skipErrorHandler: true,
    }),

  getDetail: (slug: string) =>
    request.get<PublicWorkspaceInvitation>(`/workspace-invitations/${slug}`, {
      skipErrorHandler: true,
    }),

  accept: (slug: string) =>
    request.post<AcceptWorkspaceInvitationResponse>(`/workspace-invitations/${slug}/accept`),

  reject: (slug: string) =>
    request.post<RejectWorkspaceInvitationResponse>(`/workspace-invitations/${slug}/reject`),
};

export type WorkspaceInvitationService = typeof workspaceInvitationService;
