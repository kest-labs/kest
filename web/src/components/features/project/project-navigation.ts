'use client';

import type { LucideIcon } from 'lucide-react';
import { FileJson2, FlaskConical, FolderGit2, FolderOpen, Globe, History, Tags } from 'lucide-react';
import {
  buildProjectApiSpecsRoute,
  buildProjectCategoriesRoute,
  buildProjectCollectionsRoute,
  buildProjectEnvironmentsRoute,
  buildProjectFlowsRoute,
  buildProjectHistoriesRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';

export type ProjectWorkspaceModule =
  | 'api-specs'
  | 'test-cases'
  | 'environments'
  | 'collections'
  | 'categories'
  | 'histories'
  | 'flows';

export interface ProjectWorkspaceModuleMeta {
  value: ProjectWorkspaceModule;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  status?: 'ready' | 'planned';
}

export const PROJECT_WORKSPACE_MODULES: ProjectWorkspaceModuleMeta[] = [
  {
    value: 'api-specs',
    label: 'API Specs',
    shortLabel: 'Specs',
    description: 'Describe and curate the API surface, with AI-assisted drafting as the default entry.',
    icon: FileJson2,
    status: 'ready',
  },
  {
    value: 'environments',
    label: 'Environments',
    shortLabel: 'Envs',
    description: 'Configure base URLs, variables, and shared headers before execution starts.',
    icon: Globe,
    status: 'ready',
  },
  {
    value: 'test-cases',
    label: 'Test Cases',
    shortLabel: 'Tests',
    description: 'Generate and manage validation suites derived from API specs.',
    icon: FlaskConical,
    status: 'ready',
  },
  {
    value: 'collections',
    label: 'Collections',
    shortLabel: 'Collections',
    description: 'Use scratchpads and reusable request groups for manual debugging and local execution.',
    icon: FolderOpen,
    status: 'ready',
  },
  {
    value: 'categories',
    label: 'Categories',
    shortLabel: 'Categories',
    description: 'Group growing resources by domain, owner, or area once the surface becomes large.',
    icon: Tags,
    status: 'ready',
  },
  {
    value: 'histories',
    label: 'History',
    shortLabel: 'History',
    description: 'Review activity and execution records scoped to this project.',
    icon: History,
    status: 'planned',
  },
  {
    value: 'flows',
    label: 'Flows',
    shortLabel: 'Flows',
    description: 'Open reusable workflow assets and orchestration definitions.',
    icon: FolderGit2,
    status: 'planned',
  },
];

export const getProjectWorkspaceModuleMeta = (module: ProjectWorkspaceModule) =>
  PROJECT_WORKSPACE_MODULES.find((item) => item.value === module) ??
  PROJECT_WORKSPACE_MODULES[0];

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
    case 'histories':
      return buildProjectHistoriesRoute(projectId);
    case 'flows':
      return buildProjectFlowsRoute(projectId);
    default:
      return buildProjectApiSpecsRoute(projectId);
  }
};
