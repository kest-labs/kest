'use client';

import type { LucideIcon } from 'lucide-react';
import {
  FileJson2,
  FlaskConical,
  FolderGit2,
  FolderOpen,
  Globe,
  History,
  Tags,
  Users,
} from 'lucide-react';
import {
  buildProjectApiSpecsRoute,
  buildProjectCategoriesRoute,
  buildProjectCollectionsRoute,
  buildProjectEnvironmentsRoute,
  buildProjectFlowsRoute,
  buildProjectHistoriesRoute,
  buildProjectMembersRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';

export type ProjectWorkspaceModule =
  | 'api-specs'
  | 'test-cases'
  | 'environments'
  | 'collections'
  | 'categories'
  | 'members'
  | 'histories'
  | 'flows';

export type ProjectWorkspaceModuleI18nKey =
  | 'apiSpecs'
  | 'testCases'
  | 'environments'
  | 'collections'
  | 'categories'
  | 'members'
  | 'histories'
  | 'flows';

export interface ProjectWorkspaceModuleMeta {
  value: ProjectWorkspaceModule;
  i18nKey: ProjectWorkspaceModuleI18nKey;
  icon: LucideIcon;
  status?: 'ready' | 'planned';
}

export const PROJECT_WORKSPACE_MODULES: ProjectWorkspaceModuleMeta[] = [
  {
    value: 'categories',
    i18nKey: 'categories',
    icon: Tags,
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
    value: 'collections',
    i18nKey: 'collections',
    icon: FolderOpen,
    status: 'ready',
  },
  {
    value: 'members',
    i18nKey: 'members',
    icon: Users,
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
];

export const getProjectWorkspaceModuleMeta = (module: ProjectWorkspaceModule) =>
  PROJECT_WORKSPACE_MODULES.find(item => item.value === module) ?? PROJECT_WORKSPACE_MODULES[0];

export const buildProjectWorkspaceRoute = (
  projectId: string | number,
  module: ProjectWorkspaceModule
) => {
  switch (module) {
    case 'api-specs':
      return buildProjectApiSpecsRoute(projectId);
    case 'test-cases':
      return buildProjectTestCasesRoute(projectId);
    case 'environments':
      return buildProjectEnvironmentsRoute(projectId);
    case 'collections':
      return buildProjectCollectionsRoute(projectId);
    case 'categories':
      return buildProjectCategoriesRoute(projectId);
    case 'members':
      return buildProjectMembersRoute(projectId);
    case 'histories':
      return buildProjectHistoriesRoute(projectId);
    case 'flows':
      return buildProjectFlowsRoute(projectId);
    default:
      return buildProjectCategoriesRoute(projectId);
  }
};
