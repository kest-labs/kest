'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  FileJson2,
  FlaskConical,
  FolderKanban,
  FolderOpen,
  Globe,
  Key,
  Layers3,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tags,
  Terminal,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionMenu, type ActionMenuItem } from '@/components/features/project/action-menu';
import {
  getProjectHomeStatusAccentClassName,
  ProjectHomeStatusBadge,
  type ProjectHomeStatusTone,
} from '@/components/features/project/project-home-status';
import {
  DeleteProjectDialog,
  type ProjectFormMode,
  ProjectFormDialog,
  resolvePlatformLabel,
} from '@/components/features/project/project-shared';
import { apiExternalBaseUrl, buildApiPath } from '@/config/api';
import {
  buildProjectApiSpecsRoute,
  buildProjectCategoriesRoute,
  buildProjectCollectionsRoute,
  buildProjectEnvironmentsRoute,
  buildProjectFlowsRoute,
  buildProjectMembersRoute,
  buildProjectTestCasesRoute,
  ROUTES,
} from '@/constants/routes';
import {
  useDeleteProject,
  useGenerateProjectCliToken,
  useProject,
  useProjectStats,
  useUpdateProject,
} from '@/hooks/use-projects';
import { useProjectCollections } from '@/hooks/use-collections';
import { useTestCases } from '@/hooks/use-test-cases';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import type {
  ApiProject,
  GenerateProjectCliTokenResponse,
  ProjectStats,
  UpdateProjectRequest,
} from '@/types/project';
import { formatDate } from '@/utils';

interface WorkflowStep {
  key: string;
  title: string;
  detail: string;
  status: ProjectHomeStatusTone;
  href: string;
  icon: LucideIcon;
}

interface ProjectNextAction {
  title: string;
  description: string;
  reason: string;
  primaryLabel: string;
  primaryHref: string;
  primaryIcon: LucideIcon;
  secondaryLabel: string;
  secondaryHref: string;
  secondaryIcon: LucideIcon;
}

interface ProjectModuleCard {
  key: string;
  title: string;
  description: string;
  status: ProjectHomeStatusTone;
  primaryHref: string;
  icon: LucideIcon;
  metricLabel: string;
  metricValue: number | null;
  primaryLabel: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

const getProjectNextAction = (
  t: ScopedTranslations<'project'>,
  projectId: number | string,
  stats?: ProjectStats | null
): ProjectNextAction => {
  if (!stats) {
    return {
      title: t('projectDetail.openWorkspace'),
      description: t('projectDetail.loadingProject'),
      reason: t('projectDetail.loadingReason'),
      primaryLabel: t('modules.apiSpecs.label'),
      primaryHref: buildProjectApiSpecsRoute(projectId),
      primaryIcon: FileJson2,
      secondaryLabel: t('projectDetail.quickRequest'),
      secondaryHref: `${buildProjectCollectionsRoute(projectId)}?quickRequest=1`,
      secondaryIcon: FolderOpen,
    };
  }

  if (stats.api_spec_count === 0) {
    return {
      title: t('projectDetail.defineFirstApi'),
      description: t('projectDetail.defineFirstApiDescription'),
      reason: t('projectDetail.defineFirstApiReason'),
      primaryLabel: t('projectDetail.aiDraftApi'),
      primaryHref: `${buildProjectApiSpecsRoute(projectId)}?ai=create`,
      primaryIcon: Sparkles,
      secondaryLabel: t('projectDetail.quickRequest'),
      secondaryHref: `${buildProjectCollectionsRoute(projectId)}?quickRequest=1`,
      secondaryIcon: FolderOpen,
    };
  }

  if (stats.environment_count === 0) {
    return {
      title: t('projectDetail.addRuntime'),
      description: t('projectDetail.addRuntimeDescription'),
      reason: t('projectDetail.addRuntimeReason'),
      primaryLabel: t('projectDetail.configureEnvironment'),
      primaryHref: buildProjectEnvironmentsRoute(projectId),
      primaryIcon: Globe,
      secondaryLabel: t('projectDetail.reviewApiSpecs'),
      secondaryHref: buildProjectApiSpecsRoute(projectId),
      secondaryIcon: FileJson2,
    };
  }

  return {
    title: t('projectDetail.generateCoverage'),
    description: t('projectDetail.generateCoverageDescription'),
    reason: t('projectDetail.generateCoverageReason'),
    primaryLabel: t('modules.testCases.label'),
    primaryHref: buildProjectTestCasesRoute(projectId),
    primaryIcon: FlaskConical,
    secondaryLabel: t('projectDetail.quickRequest'),
    secondaryHref: `${buildProjectCollectionsRoute(projectId)}?quickRequest=1`,
    secondaryIcon: FolderOpen,
  };
};

const getProjectWorkflowSteps = (
  t: ScopedTranslations<'project'>,
  projectId: number | string,
  stats?: ProjectStats | null
): WorkflowStep[] => {
  const apiSpecCount = stats?.api_spec_count ?? 0;
  const environmentCount = stats?.environment_count ?? 0;
  const categoryCount = stats?.category_count ?? 0;
  const flowCount = stats?.flow_count ?? 0;
  const hasSpecs = apiSpecCount > 0;
  const hasEnvironment = environmentCount > 0;

  return [
    {
      key: 'api-specs',
      title: t('modules.apiSpecs.label'),
      detail: hasSpecs
        ? t('projectDetail.workflowApiSpecsDetailReady', { count: apiSpecCount })
        : t('projectDetail.workflowApiSpecsDetailMissing'),
      status: hasSpecs ? 'ready' : 'setup',
      href: hasSpecs
        ? buildProjectApiSpecsRoute(projectId)
        : `${buildProjectApiSpecsRoute(projectId)}?ai=create`,
      icon: FileJson2,
    },
    {
      key: 'environments',
      title: t('modules.environments.label'),
      detail: hasEnvironment
        ? t('projectDetail.workflowEnvironmentsDetailReady', { count: environmentCount })
        : t('projectDetail.workflowEnvironmentsDetailMissing'),
      status: hasEnvironment ? 'ready' : 'setup',
      href: buildProjectEnvironmentsRoute(projectId),
      icon: Globe,
    },
    {
      key: 'test-cases',
      title: t('modules.testCases.label'),
      detail: hasSpecs
        ? hasEnvironment
          ? t('projectDetail.workflowTestCasesDetailReady')
          : t('projectDetail.workflowTestCasesDetailNeedsRuntime')
        : t('projectDetail.workflowTestCasesDetailMissing'),
      status: hasSpecs && hasEnvironment ? 'available' : 'setup',
      href: buildProjectTestCasesRoute(projectId),
      icon: FlaskConical,
    },
    {
      key: 'organize',
      title: t('projectDetail.organize'),
      detail:
        categoryCount > 0 || flowCount > 0
          ? t('projectDetail.workflowOrganizeDetailReady', {
              categories: categoryCount,
              flows: flowCount,
            })
          : t('projectDetail.workflowOrganizeDetailMissing'),
      status: categoryCount > 0 || flowCount > 0 ? 'ready' : 'optional',
      href: buildProjectCategoriesRoute(projectId),
      icon: Layers3,
    },
  ];
};

const formatModuleMetricValue = (value: number | null, isLoading: boolean) => {
  if (typeof value === 'number') {
    return String(value);
  }

  return isLoading ? '...' : '--';
};

const getProjectModuleCards = ({
  t,
  projectId,
  stats,
  collectionCount,
  testCaseCount,
}: {
  t: ScopedTranslations<'project'>;
  projectId: number | string;
  stats?: ProjectStats | null;
  collectionCount: number | null;
  testCaseCount: number | null;
}): ProjectModuleCard[] => {
  const apiSpecCount = stats?.api_spec_count ?? 0;
  const environmentCount = stats?.environment_count ?? 0;
  const categoryCount = stats?.category_count ?? 0;
  const flowCount = stats?.flow_count ?? 0;
  const memberCount = stats?.member_count ?? 0;
  const hasStats = Boolean(stats);
  const hasSpecs = apiSpecCount > 0;
  const hasEnvironment = environmentCount > 0;
  const hasTestCases = typeof testCaseCount === 'number' && testCaseCount > 0;
  const hasCollections = typeof collectionCount === 'number' && collectionCount > 0;

  return [
    {
      key: 'api-specs',
      title: t('modules.apiSpecs.label'),
      description: hasStats
        ? hasSpecs
          ? t('projectDetail.workflowApiSpecsDetailReady', { count: apiSpecCount })
          : t('projectDetail.workflowApiSpecsDetailMissing')
        : t('modules.apiSpecs.description'),
      status: hasStats ? (hasSpecs ? 'ready' : 'setup') : 'setup',
      primaryHref: hasSpecs
        ? buildProjectApiSpecsRoute(projectId)
        : `${buildProjectApiSpecsRoute(projectId)}?ai=create`,
      icon: FileJson2,
      metricLabel: t('modules.apiSpecs.shortLabel'),
      metricValue: hasStats ? apiSpecCount : null,
      primaryLabel: hasSpecs ? t('projectDetail.openSpecs') : t('projectDetail.aiDraftApi'),
      secondaryLabel: hasSpecs ? t('projectDetail.aiDraftApi') : t('projectDetail.openSpecs'),
      secondaryHref: hasSpecs
        ? `${buildProjectApiSpecsRoute(projectId)}?ai=create`
        : buildProjectApiSpecsRoute(projectId),
    },
    {
      key: 'environments',
      title: t('modules.environments.label'),
      description: hasStats
        ? hasEnvironment
          ? t('projectDetail.workflowEnvironmentsDetailReady', { count: environmentCount })
          : t('projectDetail.workflowEnvironmentsDetailMissing')
        : t('modules.environments.description'),
      status: hasStats ? (hasEnvironment ? 'ready' : 'setup') : 'setup',
      primaryHref: buildProjectEnvironmentsRoute(projectId),
      icon: Globe,
      metricLabel: t('modules.environments.shortLabel'),
      metricValue: hasStats ? environmentCount : null,
      primaryLabel: t('projectDetail.configureEnvironment'),
    },
    {
      key: 'test-cases',
      title: t('modules.testCases.label'),
      description: hasStats
        ? hasTestCases
          ? t('projectDetail.workflowTestCasesDetailReady')
          : hasSpecs && hasEnvironment
            ? t('projectDetail.workflowTestCasesDetailReadyToCreate')
            : hasEnvironment
              ? t('projectDetail.workflowTestCasesDetailMissing')
              : t('projectDetail.workflowTestCasesDetailNeedsRuntime')
        : t('modules.testCases.description'),
      status: hasTestCases ? 'ready' : hasSpecs && hasEnvironment ? 'available' : 'setup',
      primaryHref: buildProjectTestCasesRoute(projectId),
      icon: FlaskConical,
      metricLabel: t('modules.testCases.shortLabel'),
      metricValue: testCaseCount,
      primaryLabel: t('projectDetail.openTests'),
    },
    {
      key: 'collections',
      title: t('modules.collections.label'),
      description: t('projectDetail.shortcutCollectionsDescription'),
      status: hasCollections ? 'ready' : 'available',
      primaryHref: `${buildProjectCollectionsRoute(projectId)}?quickRequest=1`,
      icon: FolderOpen,
      metricLabel: t('modules.collections.shortLabel'),
      metricValue: collectionCount,
      primaryLabel: t('projectDetail.quickRequest'),
      secondaryLabel: t('projectDetail.shortcutCollectionsAction'),
      secondaryHref: buildProjectCollectionsRoute(projectId),
    },
    {
      key: 'categories',
      title: t('modules.categories.label'),
      description: t('modules.categories.description'),
      status: hasStats ? (categoryCount > 0 ? 'ready' : 'optional') : 'optional',
      primaryHref: buildProjectCategoriesRoute(projectId),
      icon: Tags,
      metricLabel: t('modules.categories.shortLabel'),
      metricValue: hasStats ? categoryCount : null,
      primaryLabel: t('common.manage'),
    },
    {
      key: 'members',
      title: t('modules.members.label'),
      description: t('modules.members.description'),
      status: hasStats ? (memberCount > 1 ? 'ready' : 'optional') : 'optional',
      primaryHref: buildProjectMembersRoute(projectId),
      icon: Users,
      metricLabel: t('modules.members.shortLabel'),
      metricValue: hasStats ? memberCount : null,
      primaryLabel: t('common.manage'),
    },
    {
      key: 'flows',
      title: t('modules.flows.label'),
      description: t('modules.flows.description'),
      status: hasStats ? (flowCount > 0 ? 'ready' : 'optional') : 'optional',
      primaryHref: buildProjectFlowsRoute(projectId),
      icon: Layers3,
      metricLabel: t('modules.flows.shortLabel'),
      metricValue: hasStats ? flowCount : null,
      primaryLabel: t('common.manage'),
    },
  ];
};

function ProjectModuleCardTile({
  module,
  isMetricLoading,
}: {
  module: ProjectModuleCard;
  isMetricLoading: boolean;
}) {
  const Icon = module.icon;

  return (
    <Card className="border-border/60 shadow-none transition-colors hover:border-primary/30 hover:bg-primary/[0.03]">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${getProjectHomeStatusAccentClassName(module.status)}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <ProjectHomeStatusBadge tone={module.status} className="shrink-0" />
        </div>

        <div className="mt-5">
          <p className="text-3xl font-semibold tracking-tight text-text-main">
            {formatModuleMetricValue(module.metricValue, isMetricLoading)}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
            {module.metricLabel}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="text-base font-semibold tracking-tight text-text-main">{module.title}</h3>
          <p className="text-sm leading-6 text-text-muted">{module.description}</p>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <Button asChild size="sm" variant="outline">
            <Link href={module.primaryHref}>{module.primaryLabel}</Link>
          </Button>
          {module.secondaryLabel && module.secondaryHref ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={module.secondaryHref}>{module.secondaryLabel}</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Project workspace home.
 * It turns the project detail route into a task-oriented launch surface:
 * API Specs -> Environments -> Test Cases -> operational modules.
 */
export function ProjectDetailPage({ projectId }: { projectId: number | string }) {
  const i18n = useT();
  const t = i18n.project;
  const router = useRouter();
  const [formMode, setFormMode] = useState<ProjectFormMode>('edit');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiProject | null>(null);
  const [isDeletingCurrentProject, setIsDeletingCurrentProject] = useState(false);
  const [generatedCliToken, setGeneratedCliToken] =
    useState<GenerateProjectCliTokenResponse | null>(null);

  const projectQuery = useProject(projectId, { enabled: !isDeletingCurrentProject });
  const projectStatsQuery = useProjectStats(projectId, { enabled: !isDeletingCurrentProject });
  const collectionsQuery = useProjectCollections({
    projectId,
    page: 1,
    perPage: 1,
  });
  const testCasesQuery = useTestCases({
    projectId,
    page: 1,
    pageSize: 1,
  });
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const generateCliTokenMutation = useGenerateProjectCliToken();

  const project = projectQuery.data;
  const projectStats = projectStatsQuery.data;
  const nextAction = getProjectNextAction(t, projectId, projectStats);
  const workflowSteps = getProjectWorkflowSteps(t, projectId, projectStats);
  const collectionCount = collectionsQuery.data?.meta.total ?? null;
  const testCaseCount = testCasesQuery.data?.meta.total ?? null;
  const moduleCards = getProjectModuleCards({
    t,
    projectId,
    stats: projectStats,
    collectionCount,
    testCaseCount,
  });
  const totalWorkflowSteps = workflowSteps.length;
  const completedWorkflowSteps = workflowSteps.filter(step => step.status === 'ready').length;
  const workflowCompletionPercent =
    totalWorkflowSteps > 0 ? Math.round((completedWorkflowSteps / totalWorkflowSteps) * 100) : 0;
  const shouldShowWorkflowProgress = Boolean(projectStats);
  const PrimaryIcon = nextAction.primaryIcon;
  const SecondaryIcon = nextAction.secondaryIcon;
  const cliPlatformUrl = (apiExternalBaseUrl || buildApiPath('/')).replace(/\/$/, '');
  const cliConfigCommand =
    generatedCliToken && project
      ? [
          'kest sync config \\',
          `  --platform-url '${cliPlatformUrl}' \\`,
          `  --platform-token '${generatedCliToken.token}' \\`,
          `  --project-id '${project.id}' \\`,
          '  --auto-sync-history',
        ].join('\n')
      : '';
  const isProjectLoading = projectQuery.isLoading || projectStatsQuery.isLoading;
  const isModuleMetricsLoading =
    projectStatsQuery.isLoading || collectionsQuery.isLoading || testCasesQuery.isLoading;
  const shouldShowOverview = Boolean(project) || isProjectLoading;

  const openEditDialog = () => {
    if (!project) {
      return;
    }

    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleProjectSubmit = async (payload: UpdateProjectRequest) => {
    if (!project) {
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        id: project.id,
        data: payload,
      });
      setIsFormOpen(false);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setIsDeletingCurrentProject(true);
      await deleteProjectMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      router.replace(ROUTES.CONSOLE.PROJECTS);
    } catch {
      setIsDeletingCurrentProject(false);
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleCopyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error(t('toasts.copyFailed'));
    }
  };

  const handleGenerateCliToken = async () => {
    if (!project) {
      return;
    }

    try {
      const token = await generateCliTokenMutation.mutateAsync({
        id: project.id,
        data: {
          name: `${project.name} CLI sync`,
          scopes: ['spec:write', 'run:write'],
        },
      });
      setGeneratedCliToken(token);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const pageActionItems: ActionMenuItem[] = [
    {
      key: 'members',
      label: t('projectDetail.members'),
      icon: Users,
      href: buildProjectMembersRoute(projectId),
    },
    {
      key: 'refresh',
      label:
        projectQuery.isFetching || projectStatsQuery.isFetching
          ? i18n.common('refreshing')
          : i18n.common('refresh'),
      icon: RefreshCw,
      disabled: projectQuery.isFetching || projectStatsQuery.isFetching,
      onSelect: () => {
        void projectQuery.refetch();
        void projectStatsQuery.refetch();
        void collectionsQuery.refetch();
        void testCasesQuery.refetch();
      },
    },
    {
      key: 'delete',
      label: t('projectForm.deleteButton'),
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      disabled: !project,
      onSelect: () => setDeleteTarget(project || null),
    },
  ];

  return (
    <>
      <main className="h-full min-h-0 overflow-y-auto">
        <div className="space-y-6 p-4 md:p-6">
          <section className="rounded-xl border border-border/60 bg-bg-surface p-5 md:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-4">
                <Button asChild variant="link" className="h-auto px-0 text-sm text-text-muted">
                  <Link href={ROUTES.CONSOLE.PROJECTS}>
                    <ArrowLeft className="h-4 w-4" />
                    {t('projectDetail.projects')}
                  </Link>
                </Button>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                      {project?.name || `Project #${projectId}`}
                    </h1>
                    <FolderKanban className="h-6 w-6 text-primary" />
                  </div>

                  {project ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {project.status !== 1 ? (
                        <Badge variant="outline">{t('projectForm.inactive')}</Badge>
                      ) : null}
                      {project.platform ? (
                        <Badge variant="outline">{resolvePlatformLabel(project.platform)}</Badge>
                      ) : null}
                      <Badge variant="outline" className="font-mono">
                        {project.slug}
                      </Badge>
                    </div>
                  ) : null}
                </div>
              </div>

              {shouldShowOverview ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="lg">
                    <Link href={`${buildProjectApiSpecsRoute(projectId)}?ai=create`}>
                      <Sparkles className="h-4 w-4" />
                      {t('projectDetail.aiDraftApi')}
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link href={`${buildProjectCollectionsRoute(projectId)}?quickRequest=1`}>
                      <FolderOpen className="h-4 w-4" />
                      {t('projectDetail.quickRequest')}
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    isIcon
                    aria-label={t('projectForm.editTitle')}
                    className="h-10 w-10 rounded-lg"
                    onClick={openEditDialog}
                    disabled={!project}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ActionMenu
                    items={pageActionItems}
                    ariaLabel={t('projectDetail.openProjectActions')}
                    triggerVariant="ghost"
                    triggerSize="default"
                    triggerClassName="h-10 w-10 rounded-lg border border-border/60 bg-background"
                  />
                </div>
              ) : null}
            </div>
          </section>

          {!project && !projectQuery.isLoading ? (
            <Alert>
              <AlertTitle>{t('projectDetail.projectNotFoundTitle')}</AlertTitle>
              <AlertDescription>{t('projectDetail.projectNotFoundDescription')}</AlertDescription>
            </Alert>
          ) : null}

          {shouldShowOverview ? (
            <>
              <section className="rounded-xl border border-border/60 bg-linear-to-br from-background via-background to-primary/5 p-5 md:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <Badge
                      variant="outline"
                      className="border-primary/20 bg-primary/10 text-primary"
                    >
                      {t('projectDetail.nextStep')}
                    </Badge>
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">{nextAction.title}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
                        {nextAction.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild>
                      <Link href={nextAction.primaryHref}>
                        <PrimaryIcon className="h-4 w-4" />
                        {nextAction.primaryLabel}
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={nextAction.secondaryHref}>
                        <SecondaryIcon className="h-4 w-4" />
                        {nextAction.secondaryLabel}
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-border/60 bg-background/80 p-4">
                  <p className="text-sm font-medium text-text-main">
                    {t('projectDetail.whyThisAction')}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{nextAction.reason}</p>
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-background p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      {t('projectDetail.workspaceModules')}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm text-text-muted">
                      {t('projectDetail.workspaceModulesDescription')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {shouldShowWorkflowProgress ? (
                      <div className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-sm font-medium text-primary">
                        {t('projectDetail.projectFlowProgress', {
                          percent: workflowCompletionPercent,
                          completed: completedWorkflowSteps,
                          total: totalWorkflowSteps,
                        })}
                      </div>
                    ) : null}
                    {isModuleMetricsLoading ? (
                      <Badge variant="outline">{t('projectDetail.loading')}</Badge>
                    ) : null}
                  </div>
                </div>

                {projectStatsQuery.isError ? (
                  <Alert className="mt-4">
                    <AlertTitle>{t('projectDetail.statsUnavailableTitle')}</AlertTitle>
                    <AlertDescription>
                      {t('projectDetail.statsUnavailableDescription')}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {shouldShowWorkflowProgress ? (
                  <div className="mt-4">
                    <div
                      role="progressbar"
                      aria-label={t('projectDetail.projectFlow')}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={workflowCompletionPercent}
                      className="h-2 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                        style={{ width: `${workflowCompletionPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {moduleCards.map(module => (
                    <ProjectModuleCardTile
                      key={module.key}
                      module={module}
                      isMetricLoading={isModuleMetricsLoading}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-border/60 shadow-none">
              <CardHeader>
                <CardTitle>{t('projectDetail.projectDetails')}</CardTitle>
                <CardDescription>{t('projectDetail.projectDetailsDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                    {t('common.projectId')}
                  </p>
                  <p className="mt-2 font-mono text-sm text-text-main">
                    {project?.id ?? projectId}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                    {t('projectDetail.platform')}
                  </p>
                  <p className="mt-2 text-sm text-text-main">
                    {project
                      ? resolvePlatformLabel(project.platform) || t('projectForm.notSet')
                      : i18n.common('loading')}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                    {t('common.created')}
                  </p>
                  <p className="mt-2 text-sm text-text-main">
                    {project
                      ? formatDate(project.created_at, 'YYYY-MM-DD HH:mm')
                      : i18n.common('loading')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card id="cli-sync" className="border-border/60 shadow-none">
              <CardHeader>
                <CardTitle>{t('projectDetail.cliSync')}</CardTitle>
                <CardDescription>{t('projectDetail.cliSyncDescription')}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                      {t('projectDetail.platformUrl')}
                    </p>
                    <p className="mt-2 break-all font-mono text-xs text-text-main">
                      {cliPlatformUrl}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                      {t('projectDetail.projectScope')}
                    </p>
                    <p className="mt-2 font-mono text-sm text-text-main">
                      {project?.id ?? projectId}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleGenerateCliToken()}
                    disabled={!project || generateCliTokenMutation.isPending}
                  >
                    <Key className="h-4 w-4" />
                    {generateCliTokenMutation.isPending
                      ? t('projectDetail.generating')
                      : t('projectDetail.generateToken')}
                  </Button>
                  {generatedCliToken ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void handleCopyText(cliConfigCommand, t('projectDetail.copiedSyncCommand'))
                      }
                    >
                      <Terminal className="h-4 w-4" />
                      {t('projectDetail.copyCommand')}
                    </Button>
                  ) : null}
                </div>

                {generatedCliToken ? (
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>{t('projectDetail.copyTokenTitle')}</AlertTitle>
                    <AlertDescription className="space-y-4">
                      <div className="rounded-xl border bg-background p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                            {t('projectDetail.cliToken')}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void handleCopyText(
                                generatedCliToken.token,
                                t('projectDetail.copiedCliToken')
                              )
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {i18n.common('copy')}
                          </Button>
                        </div>
                        <code className="block break-all text-xs">{generatedCliToken.token}</code>
                      </div>

                      <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border bg-background p-4 text-xs">
                        {cliConfigCommand}
                      </pre>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </div>

        </div>
      </main>

      <ProjectFormDialog
        key={`${formMode}-${project?.id ?? projectId}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        project={project}
        isSubmitting={updateProjectMutation.isPending}
        onOpenChange={setIsFormOpen}
        onSubmit={payload => handleProjectSubmit(payload as UpdateProjectRequest)}
      />

      <DeleteProjectDialog
        open={Boolean(deleteTarget)}
        project={deleteTarget}
        isDeleting={deleteProjectMutation.isPending}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDeleteProject}
      />
    </>
  );
}

export default ProjectDetailPage;
