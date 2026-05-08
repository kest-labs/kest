import type { AssignableProjectMemberRole } from './member';

export type ProjectInvitationRole = AssignableProjectMemberRole;
export type ProjectInvitationStatus = 'active' | 'expired' | 'rejected' | 'revoked' | 'used_up';

export interface ProjectInvitationUserSummary {
  id: string;
  username: string;
  email: string;
}

export interface ProjectInvitation {
  id: string;
  project_id: string;
  token_prefix: string;
  slug: string;
  role: ProjectInvitationRole;
  status: ProjectInvitationStatus;
  invite_url: string;
  invited_user?: ProjectInvitationUserSummary | null;
  max_uses: number;
  used_count: number;
  remaining_uses: number | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInvitationRequest {
  role: ProjectInvitationRole;
  expires_at?: string;
  max_uses?: number;
  invited_user_id?: string;
}

export interface PublicProjectInvitation {
  project_id: string;
  project_name: string;
  project_slug: string;
  role: ProjectInvitationRole;
  status: ProjectInvitationStatus;
  expires_at: string | null;
  remaining_uses: number | null;
  requires_auth: boolean;
}

export interface AcceptProjectInvitationResponse {
  project_id: string;
  member: {
    user_id: string;
    role: ProjectInvitationRole;
  };
  redirect_to: string;
}

export interface RejectProjectInvitationResponse {
  status: 'rejected';
}

export interface ReceivedProjectInvitation {
  id: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  slug: string;
  role: ProjectInvitationRole;
  status: ProjectInvitationStatus;
  invite_url: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PROJECT_INVITATION_ASSIGNABLE_ROLES: ProjectInvitationRole[] = [
  'admin',
  'write',
  'read',
];

export const getProjectInvitationStatusLabel = (status?: ProjectInvitationStatus) => {
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

export const getProjectInvitationRemainingUsesLabel = (
  invitation: Pick<ProjectInvitation, 'remaining_uses' | 'max_uses'>
) => {
  if (invitation.max_uses === 0 || invitation.remaining_uses === null) {
    return 'Unlimited';
  }

  return String(invitation.remaining_uses);
};

export const isProjectInvitationActive = (
  invitation:
    | Pick<ProjectInvitation, 'status'>
    | Pick<PublicProjectInvitation, 'status'>
    | null
    | undefined
) => invitation?.status === 'active';
