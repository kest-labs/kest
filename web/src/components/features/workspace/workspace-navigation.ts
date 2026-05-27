'use client';

import {
  PROJECT_WORKSPACE_MODULES,
  getProjectWorkspaceModuleMeta,
  type ProjectWorkspaceModule,
  type ProjectWorkspaceModuleI18nKey,
  type ProjectWorkspaceModuleMeta,
} from '@/components/features/project/project-navigation';
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

export type WorkspaceModule = ProjectWorkspaceModule;
export type WorkspaceModuleI18nKey = ProjectWorkspaceModuleI18nKey;
export type WorkspaceModuleMeta = ProjectWorkspaceModuleMeta;

export const WORKSPACE_MODULES = PROJECT_WORKSPACE_MODULES;
export const getWorkspaceModuleMeta = getProjectWorkspaceModuleMeta;

export const buildWorkspaceRoute = (
  workspaceId: string | number,
  module: WorkspaceModule
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
