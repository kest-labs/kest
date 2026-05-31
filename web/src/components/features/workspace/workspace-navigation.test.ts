import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_WORKSPACE_MODULES,
  canAccessWorkspaceWorkspaceModule,
  getAccessibleWorkspaceWorkspaceModules,
} from '@/components/features/workspace/workspace-navigation';

describe('workspace module access helpers', () => {
  it('keeps members and keys limited to admin and owner roles', () => {
    expect(canAccessWorkspaceWorkspaceModule('members', 'read')).toBe(false);
    expect(canAccessWorkspaceWorkspaceModule('keys', 'write')).toBe(false);
    expect(canAccessWorkspaceWorkspaceModule('members', 'admin')).toBe(true);
    expect(canAccessWorkspaceWorkspaceModule('keys', 'owner')).toBe(true);
  });

  it('hides managed modules when the current role cannot manage workspace access', () => {
    const readModules = getAccessibleWorkspaceWorkspaceModules('read').map(item => item.value);
    const adminModules = getAccessibleWorkspaceWorkspaceModules('admin').map(item => item.value);

    expect(readModules).not.toContain('members');
    expect(readModules).not.toContain('keys');
    expect(adminModules).toContain('members');
    expect(adminModules).toContain('keys');
    expect(adminModules.length).toBe(WORKSPACE_WORKSPACE_MODULES.length);
  });
});
