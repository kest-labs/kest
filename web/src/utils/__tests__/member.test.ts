import { describe, expect, it } from 'vitest';
import { buildWorkspaceMembersRoute } from '@/constants/routes';
import {
  canEditWorkspaceMember,
  canManageWorkspaceMembers,
  canRemoveWorkspaceMember,
  canWriteWorkspaceResources,
  sortWorkspaceMembers,
  type WorkspaceMember,
} from '@/types/member';

describe('workspace member helpers', () => {
  it('builds the workspace members route', () => {
    expect(buildWorkspaceMembersRoute(42)).toBe('/workspace/42/members');
  });

  it('resolves write and manage permissions by role', () => {
    expect(canWriteWorkspaceResources('read')).toBe(false);
    expect(canWriteWorkspaceResources('write')).toBe(true);
    expect(canWriteWorkspaceResources('admin')).toBe(true);
    expect(canManageWorkspaceMembers('write')).toBe(false);
    expect(canManageWorkspaceMembers('admin')).toBe(true);
    expect(canManageWorkspaceMembers('owner')).toBe(true);
  });

  it('protects owner rows and the current user from member mutations', () => {
    const ownerMember = { role: 'owner', user_id: '7' } as Pick<WorkspaceMember, 'role' | 'user_id'>;
    const selfMember = { role: 'admin', user_id: '9' } as Pick<WorkspaceMember, 'role' | 'user_id'>;
    const otherMember = { role: 'write', user_id: '11' } as Pick<WorkspaceMember, 'role' | 'user_id'>;

    expect(canEditWorkspaceMember(ownerMember, 'owner', '1')).toBe(false);
    expect(canRemoveWorkspaceMember(ownerMember, 'owner', '1')).toBe(false);
    expect(canEditWorkspaceMember(selfMember, 'admin', '9')).toBe(false);
    expect(canRemoveWorkspaceMember(selfMember, 'admin', '9')).toBe(false);
    expect(canEditWorkspaceMember(otherMember, 'admin', '9')).toBe(true);
    expect(canRemoveWorkspaceMember(otherMember, 'owner', '9')).toBe(true);
  });

  it('sorts members by role priority before username', () => {
    const members: WorkspaceMember[] = [
      {
        id: '1',
        workspace_id: '10',
        user_id: '101',
        username: 'zoe',
        email: 'zoe@example.com',
        role: 'read',
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        workspace_id: '10',
        user_id: '102',
        username: 'amy',
        email: 'amy@example.com',
        role: 'admin',
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        workspace_id: '10',
        user_id: '103',
        username: 'ben',
        email: 'ben@example.com',
        role: 'owner',
        created_at: '',
        updated_at: '',
      },
      {
        id: '4',
        workspace_id: '10',
        user_id: '104',
        username: 'anna',
        email: 'anna@example.com',
        role: 'admin',
        created_at: '',
        updated_at: '',
      },
    ];

    expect(sortWorkspaceMembers(members).map(member => member.username)).toEqual([
      'ben',
      'amy',
      'anna',
      'zoe',
    ]);
  });
});
