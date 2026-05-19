import { describe, expect, it } from 'vitest';
import { buildProjectMembersRoute } from '@/constants/routes';
import {
  canEditProjectMember,
  canManageProjectMembers,
  canRemoveProjectMember,
  canWriteProjectResources,
  sortProjectMembers,
  type ProjectMember,
} from '@/types/member';

describe('project member helpers', () => {
  it('builds the project members route', () => {
    expect(buildProjectMembersRoute(42)).toBe('/workspace/42/members');
  });

  it('resolves write and manage permissions by role', () => {
    expect(canWriteProjectResources('read')).toBe(false);
    expect(canWriteProjectResources('write')).toBe(true);
    expect(canWriteProjectResources('admin')).toBe(true);
    expect(canManageProjectMembers('write')).toBe(false);
    expect(canManageProjectMembers('admin')).toBe(true);
    expect(canManageProjectMembers('owner')).toBe(true);
  });

  it('protects owner rows and the current user from member mutations', () => {
    const ownerMember = { role: 'owner', user_id: '7' } as Pick<ProjectMember, 'role' | 'user_id'>;
    const selfMember = { role: 'admin', user_id: '9' } as Pick<ProjectMember, 'role' | 'user_id'>;
    const otherMember = { role: 'write', user_id: '11' } as Pick<ProjectMember, 'role' | 'user_id'>;

    expect(canEditProjectMember(ownerMember, 'owner', '1')).toBe(false);
    expect(canRemoveProjectMember(ownerMember, 'owner', '1')).toBe(false);
    expect(canEditProjectMember(selfMember, 'admin', '9')).toBe(false);
    expect(canRemoveProjectMember(selfMember, 'admin', '9')).toBe(false);
    expect(canEditProjectMember(otherMember, 'admin', '9')).toBe(true);
    expect(canRemoveProjectMember(otherMember, 'owner', '9')).toBe(true);
  });

  it('sorts members by role priority before username', () => {
    const members: ProjectMember[] = [
      {
        id: '1',
        project_id: '10',
        user_id: '101',
        username: 'zoe',
        email: 'zoe@example.com',
        role: 'read',
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        project_id: '10',
        user_id: '102',
        username: 'amy',
        email: 'amy@example.com',
        role: 'admin',
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        project_id: '10',
        user_id: '103',
        username: 'ben',
        email: 'ben@example.com',
        role: 'owner',
        created_at: '',
        updated_at: '',
      },
      {
        id: '4',
        project_id: '10',
        user_id: '104',
        username: 'anna',
        email: 'anna@example.com',
        role: 'admin',
        created_at: '',
        updated_at: '',
      },
    ];

    expect(sortProjectMembers(members).map(member => member.username)).toEqual([
      'ben',
      'amy',
      'anna',
      'zoe',
    ]);
  });
});
