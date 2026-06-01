'use client';

import type { LucideIcon } from 'lucide-react';
import {
  FileJson2,
  FlaskConical,
  FolderGit2,
  FolderOpen,
  Globe,
  History,
  KeyRound,
  Tags,
  Users,
} from 'lucide-react';
import {
  buildWorkspaceApiSpecsRoute,
  buildWorkspaceCategoriesRoute,
  buildWorkspaceCollectionsRoute,
  buildWorkspaceEnvironmentsRoute,
  buildWorkspaceFlowsRoute,
  buildWorkspaceHistoriesRoute,
  buildWorkspaceKeysRoute,
  buildWorkspaceMembersRoute,
  buildWorkspaceTestCasesRoute,
} from '@/constants/routes';
import { canManageWorkspaceMembers, type WorkspaceMemberRole } from '@/types/member';

export type WorkspaceWorkspaceModule =
  | 'api-specs'
  | 'test-cases'
  | 'environments'
  | 'collections'
  | 'categories'
  | 'keys'
  | 'members'
  | 'histories'
  | 'flows';

export type WorkspaceWorkspaceModuleI18nKey =
  | 'apiSpecs'
  | 'testCases'
  | 'environments'
  | 'collections'
  | 'categories'
  | 'keys'
  | 'members'
  | 'histories'
  | 'flows';

export interface WorkspaceWorkspaceModuleMeta {
  value: WorkspaceWorkspaceModule;
  i18nKey: WorkspaceWorkspaceModuleI18nKey;
  icon: LucideIcon;
  status?: 'ready' | 'planned';
}

const WORKSPACE_WORKSPACE_MODULE_META: WorkspaceWorkspaceModuleMeta[] = [
  {
    value: 'collections',
    i18nKey: 'collections',
    icon: FolderOpen,
    status: 'ready',
  },
  {
    value: 'api-specs',
    i18nKey: 'apiSpecs',
    icon: FileJson2,
    status: 'ready',
  },
  {
    value: 'environments',
    i18nKey: 'environments',
    icon: Globe,
    status: 'ready',
  },
  {
    value: 'test-cases',
    i18nKey: 'testCases',
    icon: FlaskConical,
    status: 'ready',
  },
  {
    value: 'members',
    i18nKey: 'members',
    icon: Users,
    status: 'ready',
  },
  {
    value: 'keys',
    i18nKey: 'keys',
    icon: KeyRound,
    status: 'ready',
  },
  {
    value: 'histories',
    i18nKey: 'histories',
    icon: History,
    status: 'ready',
  },
  {
    value: 'flows',
    i18nKey: 'flows',
    icon: FolderGit2,
    status: 'ready',
  },
  {
    value: 'categories',
    i18nKey: 'categories',
    icon: Tags,
    status: 'ready',
  },
];

export const WORKSPACE_WORKSPACE_MODULES = WORKSPACE_WORKSPACE_MODULE_META.filter(
  item => item.value !== 'categories'
);

const MANAGED_WORKSPACE_MODULES = new Set<WorkspaceWorkspaceModule>(['members', 'keys']);

export const canAccessWorkspaceWorkspaceModule = (
  module: WorkspaceWorkspaceModule,
  role?: WorkspaceMemberRole
) => !MANAGED_WORKSPACE_MODULES.has(module) || canManageWorkspaceMembers(role);

export const getAccessibleWorkspaceWorkspaceModules = (
  role?: WorkspaceMemberRole,
  modules: WorkspaceWorkspaceModuleMeta[] = WORKSPACE_WORKSPACE_MODULES
) => modules.filter(item => canAccessWorkspaceWorkspaceModule(item.value, role));

export const getWorkspaceWorkspaceModuleMeta = (module: WorkspaceWorkspaceModule) =>
  WORKSPACE_WORKSPACE_MODULE_META.find(item => item.value === module) ??
  WORKSPACE_WORKSPACE_MODULE_META[0];

export const buildWorkspaceWorkspaceRoute = (
  workspaceId: string | number,
  module: WorkspaceWorkspaceModule
) => {
  switch (module) {
    case 'api-specs':
      return buildWorkspaceApiSpecsRoute(workspaceId);
    case 'test-cases':
      return buildWorkspaceTestCasesRoute(workspaceId);
    case 'environments':
      return buildWorkspaceEnvironmentsRoute(workspaceId);
    case 'collections':
      return buildWorkspaceCollectionsRoute(workspaceId);
    case 'categories':
      return buildWorkspaceCategoriesRoute(workspaceId);
    case 'members':
      return buildWorkspaceMembersRoute(workspaceId);
    case 'keys':
      return buildWorkspaceKeysRoute(workspaceId);
    case 'histories':
      return buildWorkspaceHistoriesRoute(workspaceId);
    case 'flows':
      return buildWorkspaceFlowsRoute(workspaceId);
    default:
      return buildWorkspaceApiSpecsRoute(workspaceId);
  }
};
