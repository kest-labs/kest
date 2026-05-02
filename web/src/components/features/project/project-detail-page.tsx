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

function WorkflowStepRow({ step }: { step: WorkflowStep }) {
  const Icon = step.icon;

  return (
    <Link
      href={step.href}
      className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${getProjectHomeStatusAccentClassName(step.status)}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-text-main">{step.title}</p>
          <ProjectHomeStatusBadge tone={step.status} />
        </div>
        <p className="mt-1 text-sm leading-6 text-text-muted">{step.detail}</p>
      </div>
    </Link>
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
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const generateCliTokenMutation = useGenerateProjectCliToken();

  const project = projectQuery.data;
  const projectStats = projectStatsQuery.data;
  const nextAction = getProjectNextAction(t, projectId, projectStats);
  const workflowSteps = getProjectWorkflowSteps(t, projectId, projectStats);
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
      },
    },
    {
      key: 'edit',
      label: t('projectForm.editTitle'),
      icon: Pencil,
      disabled: !project,
      onSelect: openEditDialog,
    },
    {
      key: 'members',
      label: t('projectDetail.members'),
      icon: Users,
      href: buildProjectMembersRoute(projectId),
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

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" asChild>
                  <Link href={nextAction.primaryHref}>
                    <PrimaryIcon className="h-4 w-4" />
                    {nextAction.primaryLabel}
                  </Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={nextAction.secondaryHref}>
                    <SecondaryIcon className="h-4 w-4" />
                    {nextAction.secondaryLabel}
                  </Link>
                </Button>
                <ActionMenu
                  items={pageActionItems}
                  ariaLabel={t('projectDetail.openProjectActions')}
                  triggerVariant="outline"
                />
              </div>
            </div>
          </section>

          {!project && !projectQuery.isLoading ? (
            <Alert>
              <AlertTitle>{t('projectDetail.projectNotFoundTitle')}</AlertTitle>
              <AlertDescription>{t('projectDetail.projectNotFoundDescription')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <section className="rounded-xl border border-border/60 bg-background p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
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
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-medium text-text-main">
                  {t('projectDetail.whyThisAction')}
                </p>
                <p className="mt-2 text-sm leading-6 text-text-muted">{nextAction.reason}</p>
              </div>
            </section>

            <section className="rounded-xl border border-border/60 bg-background p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {t('projectDetail.projectFlow')}
                  </h2>
                  <p className="mt-1 text-sm text-text-muted">
                    {t('projectDetail.projectFlowDescription')}
                  </p>
                </div>
                {isProjectLoading ? (
                  <Badge variant="outline">{t('projectDetail.loading')}</Badge>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {workflowSteps.map(step => (
                  <WorkflowStepRow key={step.key} step={step} />
                ))}
              </div>
            </section>
          </div>

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

          <section className="rounded-xl border border-border/60 bg-background p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {t('projectDetail.supportingAreas')}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {t('projectDetail.supportingAreasDescription')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={buildProjectMembersRoute(projectId)}>
                    <Users className="h-4 w-4" />
                    {t('projectDetail.members')}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={buildProjectCategoriesRoute(projectId)}>
                    <Tags className="h-4 w-4" />
                    {t('projectDetail.categories')}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={buildProjectFlowsRoute(projectId)}>
                    <Layers3 className="h-4 w-4" />
                    {t('projectDetail.flows')}
                  </Link>
                </Button>
              </div>
            </div>
          </section>
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
