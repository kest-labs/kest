// 工作区成员模块类型定义。
// 作用：统一约束成员实体、角色能力和成员管理请求数据结构。

export type WorkspaceMemberRole = 'owner' | 'admin' | 'write' | 'read';
export type AssignableWorkspaceMemberRole = 'admin' | 'write' | 'read';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  username: string;
  email: string;
  role: WorkspaceMemberRole;
  created_at: string;
  updated_at: string;
}

export interface UpdateWorkspaceMemberRequest {
  role: AssignableWorkspaceMemberRole;
}

export const WORKSPACE_MEMBER_ASSIGNABLE_ROLES: AssignableWorkspaceMemberRole[] = [
  'admin',
  'write',
  'read',
];
export const WORKSPACE_MEMBER_WRITE_ROLES: WorkspaceMemberRole[] = ['write', 'admin', 'owner'];
export const WORKSPACE_MEMBER_MANAGE_ROLES: WorkspaceMemberRole[] = ['admin', 'owner'];

export const WORKSPACE_MEMBER_ROLE_LEVELS: Record<WorkspaceMemberRole, number> = {
  owner: 40,
  admin: 30,
  write: 20,
  read: 10,
};

export const getWorkspaceMemberRoleLabel = (role?: WorkspaceMemberRole) => {
  if (!role) {
    return 'Unknown';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

export const canWriteWorkspaceResources = (role?: WorkspaceMemberRole) =>
  role ? WORKSPACE_MEMBER_WRITE_ROLES.includes(role) : false;

export const canManageWorkspaceMembers = (role?: WorkspaceMemberRole) =>
  role ? WORKSPACE_MEMBER_MANAGE_ROLES.includes(role) : false;

export const isProtectedWorkspaceMember = (
  member: Pick<WorkspaceMember, 'role' | 'user_id'>,
  currentUserId?: string
) => member.role === 'owner' || (currentUserId !== undefined && member.user_id === currentUserId);

export const canEditWorkspaceMember = (
  member: Pick<WorkspaceMember, 'role' | 'user_id'>,
  currentUserRole?: WorkspaceMemberRole,
  currentUserId?: string
) => canManageWorkspaceMembers(currentUserRole) && !isProtectedWorkspaceMember(member, currentUserId);

export const canRemoveWorkspaceMember = canEditWorkspaceMember;

export const sortWorkspaceMembers = <T extends Pick<WorkspaceMember, 'role' | 'username' | 'user_id'>>(
  members: T[]
) =>
  [...members].sort((left, right) => {
    const roleDiff = WORKSPACE_MEMBER_ROLE_LEVELS[right.role] - WORKSPACE_MEMBER_ROLE_LEVELS[left.role];

    if (roleDiff !== 0) {
      return roleDiff;
    }

    const leftUsername = left.username?.trim() || left.user_id;
    const rightUsername = right.username?.trim() || right.user_id;
    const usernameDiff = leftUsername.localeCompare(rightUsername, undefined, {
      sensitivity: 'base',
    });

    if (usernameDiff !== 0) {
      return usernameDiff;
    }

    return left.user_id.localeCompare(right.user_id);
  });
