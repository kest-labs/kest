import type { AssignableWorkspaceMemberRole } from './member';

export type WorkspaceInvitationRole = AssignableWorkspaceMemberRole;
export type WorkspaceInvitationStatus = 'active' | 'expired' | 'rejected' | 'revoked' | 'used_up';

export interface WorkspaceInvitationUserSummary {
  id: string;
  username: string;
  email: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  token_prefix: string;
  slug: string;
  role: WorkspaceInvitationRole;
  status: WorkspaceInvitationStatus;
  invite_url: string;
  invited_user?: WorkspaceInvitationUserSummary | null;
  max_uses: number;
  used_count: number;
  remaining_uses: number | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceInvitationRequest {
  role: WorkspaceInvitationRole;
  expires_at?: string;
  max_uses?: number;
  invited_user_id?: string;
}

export interface PublicWorkspaceInvitation {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  role: WorkspaceInvitationRole;
  status: WorkspaceInvitationStatus;
  expires_at: string | null;
  remaining_uses: number | null;
  requires_auth: boolean;
}

export interface AcceptWorkspaceInvitationResponse {
  workspace_id: string;
  member: {
    user_id: string;
    role: WorkspaceInvitationRole;
  };
  redirect_to: string;
}

export interface RejectWorkspaceInvitationResponse {
  status: 'rejected';
}

export interface ReceivedWorkspaceInvitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  slug: string;
  role: WorkspaceInvitationRole;
  status: WorkspaceInvitationStatus;
  invite_url: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const WORKSPACE_INVITATION_ASSIGNABLE_ROLES: WorkspaceInvitationRole[] = [
  'admin',
  'write',
  'read',
];

export const getWorkspaceInvitationStatusLabel = (status?: WorkspaceInvitationStatus) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'rejected':
      return 'Rejected';
    case 'revoked':
      return 'Revoked';
    case 'used_up':
      return 'Used up';
    default:
      return 'Unknown';
  }
};

export const getWorkspaceInvitationRemainingUsesLabel = (
  invitation: Pick<WorkspaceInvitation, 'remaining_uses' | 'max_uses'>
) => {
  if (invitation.max_uses === 0 || invitation.remaining_uses === null) {
    return 'Unlimited';
  }

  return String(invitation.remaining_uses);
};

export const isWorkspaceInvitationActive = (
  invitation:
    | Pick<WorkspaceInvitation, 'status'>
    | Pick<PublicWorkspaceInvitation, 'status'>
    | null
    | undefined
) => invitation?.status === 'active';
