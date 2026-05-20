// 项目成员模块类型定义。
// 作用：统一约束成员实体、角色能力和成员管理请求数据结构。

export type ProjectMemberRole = 'owner' | 'admin' | 'write' | 'read';
export type AssignableProjectMemberRole = 'admin' | 'write' | 'read';

export interface ProjectMember {
  id: string;
  project_id?: string;
  workspace_id?: string;
  user_id: string;
  username?: string;
  email?: string;
  role: ProjectMemberRole;
  created_at?: string;
  updated_at?: string;
  joined_at?: string;
}

export interface UpdateProjectMemberRequest {
  role: AssignableProjectMemberRole;
}

export const PROJECT_MEMBER_ASSIGNABLE_ROLES: AssignableProjectMemberRole[] = [
  'admin',
  'write',
  'read',
];
export const PROJECT_MEMBER_WRITE_ROLES: ProjectMemberRole[] = ['write', 'admin', 'owner'];
export const PROJECT_MEMBER_MANAGE_ROLES: ProjectMemberRole[] = ['admin', 'owner'];

export const PROJECT_MEMBER_ROLE_LEVELS: Record<ProjectMemberRole, number> = {
  owner: 40,
  admin: 30,
  write: 20,
  read: 10,
};

export const getProjectMemberRoleLabel = (role?: ProjectMemberRole) => {
  if (!role) {
    return 'Unknown';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

export const canWriteProjectResources = (role?: ProjectMemberRole) =>
  role ? PROJECT_MEMBER_WRITE_ROLES.includes(role) : false;

export const canManageProjectMembers = (role?: ProjectMemberRole) =>
  role ? PROJECT_MEMBER_MANAGE_ROLES.includes(role) : false;

export const isProtectedProjectMember = (
  member: Pick<ProjectMember, 'role' | 'user_id'>,
  currentUserId?: string
) => member.role === 'owner' || (currentUserId !== undefined && member.user_id === currentUserId);

export const canEditProjectMember = (
  member: Pick<ProjectMember, 'role' | 'user_id'>,
  currentUserRole?: ProjectMemberRole,
  currentUserId?: string
) => canManageProjectMembers(currentUserRole) && !isProtectedProjectMember(member, currentUserId);

export const canRemoveProjectMember = canEditProjectMember;

export const sortProjectMembers = <T extends Pick<ProjectMember, 'role' | 'username' | 'user_id'>>(
  members: T[]
) =>
  [...members].sort((left, right) => {
    const roleDiff = PROJECT_MEMBER_ROLE_LEVELS[right.role] - PROJECT_MEMBER_ROLE_LEVELS[left.role];

    if (roleDiff !== 0) {
      return roleDiff;
    }

    const usernameDiff = (left.username ?? '').localeCompare(right.username ?? '', undefined, {
      sensitivity: 'base',
    });

    if (usernameDiff !== 0) {
      return usernameDiff;
    }

    return left.user_id.localeCompare(right.user_id);
  });
