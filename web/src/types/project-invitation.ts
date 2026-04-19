import type { AssignableProjectMemberRole } from './member';

export type ProjectInvitationRole = AssignableProjectMemberRole;
export type ProjectInvitationStatus = 'active' | 'expired' | 'revoked' | 'used_up';

export interface ProjectInvitation {
  id: number;
  project_id: number;
  token_prefix: string;
  slug: string;
  role: ProjectInvitationRole;
  status: ProjectInvitationStatus;
  invite_url: string;
  max_uses: number;
  used_count: number;
  remaining_uses: number | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInvitationRequest {
  role: ProjectInvitationRole;
  expires_at?: string;
  max_uses?: number;
}

export interface PublicProjectInvitation {
  project_id: number;
  project_name: string;
  project_slug: string;
  role: ProjectInvitationRole;
  status: ProjectInvitationStatus;
  expires_at: string | null;
  remaining_uses: number | null;
  requires_auth: boolean;
}

export interface AcceptProjectInvitationResponse {
  project_id: number;
  member: {
    user_id: number;
    role: ProjectInvitationRole;
  };
  redirect_to: string;
}

export interface RejectProjectInvitationResponse {
  status: 'rejected';
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
