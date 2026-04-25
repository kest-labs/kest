'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
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
  DeleteProjectDialog,
  type ProjectFormMode,
  ProjectFormDialog,
  ProjectStatusBadge,
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
import type {
  ApiProject,
  GenerateProjectCliTokenResponse,
  ProjectStats,
  UpdateProjectRequest,
} from '@/types/project';
import { formatDate } from '@/utils';

type StepTone = 'ready' | 'pending' | 'available';

interface WorkflowStep {
  key: string;
  title: string;
  detail: string;
  state: string;
  tone: StepTone;
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
  projectId: number,
  stats?: ProjectStats | null
): ProjectNextAction => {
  if (!stats) {
    return {
      title: 'Open the workspace',
      description: 'Project signals are still loading, so the safest entry is the API workspace.',
      reason: 'The workspace keeps the core project resources in one place while stats finish loading.',
      primaryLabel: 'Open API Specs',
      primaryHref: buildProjectApiSpecsRoute(projectId),
      primaryIcon: FileJson2,
      secondaryLabel: 'Quick Request',
      secondaryHref: `${buildProjectCollectionsRoute(projectId)}?quickRequest=1`,
      secondaryIcon: FolderOpen,
    };
  }

  if (stats.api_spec_count === 0) {
    return {
      title: 'Define the first API surface',
      description: 'Start with one endpoint and turn it into a structured source of truth.',
      reason: 'Docs, examples, and tests all depend on at least one API spec.',
      primaryLabel: 'AI Draft API',
      primaryHref: `${buildProjectApiSpecsRoute(projectId)}?ai=create`,
      primaryIcon: Sparkles,
      secondaryLabel: 'Quick Request',
      secondaryHref: `${buildProjectCollectionsRoute(projectId)}?quickRequest=1`,
      secondaryIcon: FolderOpen,
    };
  }

  if (stats.environment_count === 0) {
    return {
      title: 'Add the first runtime target',
      description: 'Configure a base URL, variables, and headers before execution starts.',
      reason: 'The API surface exists. One environment unlocks request runs and generated validation.',
      primaryLabel: 'Configure Environment',
      primaryHref: buildProjectEnvironmentsRoute(projectId),
      primaryIcon: Globe,
      secondaryLabel: 'Review API Specs',
      secondaryHref: buildProjectApiSpecsRoute(projectId),
      secondaryIcon: FileJson2,
    };
  }

  return {
    title: 'Generate validation coverage',
    description: 'Use the existing specs and environment baseline to create runnable tests.',
    reason: 'The project has both a source of truth and runtime context. The next value is repeatable validation.',
    primaryLabel: 'Open Test Cases',
    primaryHref: buildProjectTestCasesRoute(projectId),
    primaryIcon: FlaskConical,
    secondaryLabel: 'Quick Request',
    secondaryHref: `${buildProjectCollectionsRoute(projectId)}?quickRequest=1`,
    secondaryIcon: FolderOpen,
  };
};

const getProjectWorkflowSteps = (projectId: number, stats?: ProjectStats | null): WorkflowStep[] => {
  const apiSpecCount = stats?.api_spec_count ?? 0;
  const environmentCount = stats?.environment_count ?? 0;
  const categoryCount = stats?.category_count ?? 0;
  const flowCount = stats?.flow_count ?? 0;
  const hasSpecs = apiSpecCount > 0;
  const hasEnvironment = environmentCount > 0;

  return [
    {
      key: 'api-specs',
      title: 'API Specs',
      detail: hasSpecs
        ? `${apiSpecCount} spec${apiSpecCount === 1 ? '' : 's'} available`
        : 'Create the first structured endpoint',
      state: hasSpecs ? 'Ready' : 'Missing',
      tone: hasSpecs ? 'ready' : 'pending',
      href: hasSpecs ? buildProjectApiSpecsRoute(projectId) : `${buildProjectApiSpecsRoute(projectId)}?ai=create`,
      icon: FileJson2,
    },
    {
      key: 'environments',
      title: 'Environments',
      detail: hasEnvironment
        ? `${environmentCount} target${environmentCount === 1 ? '' : 's'} configured`
        : 'Add a base URL and runtime variables',
      state: hasEnvironment ? 'Ready' : 'Missing',
      tone: hasEnvironment ? 'ready' : 'pending',
      href: buildProjectEnvironmentsRoute(projectId),
      icon: Globe,
    },
    {
      key: 'test-cases',
      title: 'Test Cases',
      detail: hasSpecs ? 'Generate coverage from API specs' : 'Waiting for API specs',
      state: hasSpecs ? 'Available' : 'Blocked',
      tone: hasSpecs ? 'available' : 'pending',
      href: buildProjectTestCasesRoute(projectId),
      icon: FlaskConical,
    },
    {
      key: 'organize',
      title: 'Organize',
      detail:
        categoryCount > 0 || flowCount > 0
          ? `${categoryCount} categories, ${flowCount} flows`
          : 'Optional taxonomy and flows',
      state: categoryCount > 0 || flowCount > 0 ? 'Active' : 'Optional',
      tone: categoryCount > 0 || flowCount > 0 ? 'available' : 'pending',
      href: buildProjectCategoriesRoute(projectId),
      icon: Layers3,
    },
  ];
};

const getStepBadgeClassName = (tone: StepTone) => {
  switch (tone) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-500/10 text-emerald-700';
    case 'available':
      return 'border-sky-200 bg-sky-500/10 text-sky-700';
    default:
      return 'border-amber-200 bg-amber-500/10 text-amber-700';
  }
};

const getStepIconClassName = (tone: StepTone) => {
  switch (tone) {
    case 'ready':
      return 'bg-emerald-500/10 text-emerald-700';
    case 'available':
      return 'bg-sky-500/10 text-sky-700';
    default:
      return 'bg-amber-500/10 text-amber-700';
  }
};

function MetricTile({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-muted">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-text-main">{value}</p>
          <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-text-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function WorkflowStepRow({ step }: { step: WorkflowStep }) {
  const Icon = step.icon;
  const StatusIcon = step.tone === 'ready' ? CheckCircle2 : Clock3;

  return (
    <Link
      href={step.href}
      className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${getStepIconClassName(step.tone)}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-text-main">{step.title}</p>
          <Badge variant="outline" className={getStepBadgeClassName(step.tone)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {step.state}
          </Badge>
        </div>
        <p className="mt-1 text-sm leading-6 text-text-muted">{step.detail}</p>
      </div>
    </Link>
  );
}

function ModuleShortcut({
  title,
  description,
  href,
  icon: Icon,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  actionLabel: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[150px] flex-col justify-between rounded-xl border border-border/60 bg-background p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="space-y-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-text-muted group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-main">{title}</p>
          <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
        {actionLabel}
      </div>
    </Link>
  );
}

/**
 * Project workspace home.
 * It turns the project detail route into a task-oriented launch surface:
 * API Specs -> Environments -> Test Cases -> operational modules.
 */
export function ProjectDetailPage({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [formMode, setFormMode] = useState<ProjectFormMode>('edit');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiProject | null>(null);
  const [generatedCliToken, setGeneratedCliToken] =
    useState<GenerateProjectCliTokenResponse | null>(null);

  const projectQuery = useProject(projectId);
  const projectStatsQuery = useProjectStats(projectId);
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const generateCliTokenMutation = useGenerateProjectCliToken();

  const project = projectQuery.data;
  const projectStats = projectStatsQuery.data;
  const nextAction = getProjectNextAction(projectId, projectStats);
  const workflowSteps = getProjectWorkflowSteps(projectId, projectStats);
  const PrimaryIcon = nextAction.primaryIcon;
  const SecondaryIcon = nextAction.secondaryIcon;
  const cliPlatformUrl = (apiExternalBaseUrl || buildApiPath('/')).replace(/\/$/, '');
  const cliConfigCommand =
    generatedCliToken && project
      ? [
          'kest sync config \\',
          `  --platform-url '${cliPlatformUrl}' \\`,
          `  --platform-token '${generatedCliToken.token}' \\`,
          `  --project-id '${project.id}'`,
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
      await deleteProjectMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      router.replace(ROUTES.CONSOLE.PROJECTS);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleCopyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Failed to copy to clipboard');
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
          scopes: ['spec:write'],
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
      label: projectQuery.isFetching || projectStatsQuery.isFetching ? 'Refreshing...' : 'Refresh',
      icon: RefreshCw,
      disabled: projectQuery.isFetching || projectStatsQuery.isFetching,
      onSelect: () => {
        void projectQuery.refetch();
        void projectStatsQuery.refetch();
      },
    },
    {
      key: 'edit',
      label: 'Edit Project',
      icon: Pencil,
      disabled: !project,
      onSelect: openEditDialog,
    },
    {
      key: 'members',
      label: 'Members',
      icon: Users,
      href: buildProjectMembersRoute(projectId),
    },
    {
      key: 'delete',
      label: 'Delete Project',
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
                <Button
                  asChild
                  variant="link"
                  className="h-auto px-0 text-sm text-text-muted"
                >
                  <Link href={ROUTES.CONSOLE.PROJECTS}>
                    <ArrowLeft className="h-4 w-4" />
                    Projects
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
                      <ProjectStatusBadge status={project.status} />
                      <Badge variant="outline">{resolvePlatformLabel(project.platform)}</Badge>
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
                  ariaLabel="Open project actions"
                  triggerVariant="outline"
                />
              </div>
            </div>
          </section>

          {!project && !projectQuery.isLoading ? (
            <Alert>
              <AlertTitle>Project not found</AlertTitle>
              <AlertDescription>
                The selected project could not be loaded. Check the project ID or your access.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <section className="rounded-xl border border-border/60 bg-background p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                    Next step
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
                <p className="text-sm font-medium text-text-main">Why this action</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">{nextAction.reason}</p>
              </div>
            </section>

            <section className="rounded-xl border border-border/60 bg-background p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Project flow</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    Follow the sequence, or jump directly from any row.
                  </p>
                </div>
                {isProjectLoading ? <Badge variant="outline">Loading</Badge> : null}
              </div>

              <div className="mt-4 space-y-3">
                {workflowSteps.map((step) => (
                  <WorkflowStepRow key={step.key} step={step} />
                ))}
              </div>
            </section>
          </div>

          {projectStatsQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-xl border bg-muted/30" />
              ))}
            </div>
          ) : projectStats ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                title="API Specs"
                value={projectStats.api_spec_count}
                description="Structured source of truth"
                icon={FileJson2}
              />
              <MetricTile
                title="Environments"
                value={projectStats.environment_count}
                description="Runnable targets and variables"
                icon={Globe}
              />
              <MetricTile
                title="Categories"
                value={projectStats.category_count}
                description="Resource organization"
                icon={Tags}
              />
              <MetricTile
                title="Members"
                value={projectStats.member_count}
                description="People with project access"
                icon={Users}
              />
            </div>
          ) : (
            <Alert>
              <AlertTitle>Stats unavailable</AlertTitle>
              <AlertDescription>
                Project stats could not be loaded. The workspace actions are still available.
              </AlertDescription>
            </Alert>
          )}

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Workspace modules</h2>
              <p className="mt-1 text-sm text-text-muted">
                Primary modules stay close to the workflow. Supporting modules are still one click away.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ModuleShortcut
                title="API Specs"
                description="Design endpoints, review AI drafts, and keep docs tied to the source of truth."
                href={buildProjectApiSpecsRoute(projectId)}
                icon={FileJson2}
                actionLabel="Open specs"
              />
              <ModuleShortcut
                title="Environments"
                description="Set base URLs, headers, and variables before running requests or tests."
                href={buildProjectEnvironmentsRoute(projectId)}
                icon={Globe}
                actionLabel="Configure"
              />
              <ModuleShortcut
                title="Test Cases"
                description="Generate and run validation coverage from the API specs already in this project."
                href={buildProjectTestCasesRoute(projectId)}
                icon={FlaskConical}
                actionLabel="Open tests"
              />
              <ModuleShortcut
                title="Collections"
                description="Send quick requests and keep reusable request groups for manual debugging."
                href={buildProjectCollectionsRoute(projectId)}
                icon={FolderOpen}
                actionLabel="Debug"
              />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-border/60 shadow-none">
              <CardHeader>
                <CardTitle>Project details</CardTitle>
                <CardDescription>Identity and lifecycle metadata.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                    Project ID
                  </p>
                  <p className="mt-2 font-mono text-sm text-text-main">{project?.id ?? projectId}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                    Platform
                  </p>
                  <p className="mt-2 text-sm text-text-main">
                    {project ? resolvePlatformLabel(project.platform) : 'Loading'}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                    Created
                  </p>
                  <p className="mt-2 text-sm text-text-main">
                    {project ? formatDate(project.created_at, 'YYYY-MM-DD HH:mm') : 'Loading'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card id="cli-sync" className="border-border/60 shadow-none">
              <CardHeader>
                <CardTitle>CLI Sync</CardTitle>
                <CardDescription>Project-scoped token setup for `kest sync`.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                      Platform URL
                    </p>
                    <p className="mt-2 break-all font-mono text-xs text-text-main">
                      {cliPlatformUrl}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                      Project Scope
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
                    {generateCliTokenMutation.isPending ? 'Generating...' : 'Generate Token'}
                  </Button>
                  {generatedCliToken ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleCopyText(cliConfigCommand, 'Copied sync command')}
                    >
                      <Terminal className="h-4 w-4" />
                      Copy Command
                    </Button>
                  ) : null}
                </div>

                {generatedCliToken ? (
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Copy this token now</AlertTitle>
                    <AlertDescription className="space-y-4">
                      <div className="rounded-xl border bg-background p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                            CLI Token
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void handleCopyText(generatedCliToken.token, 'Copied CLI token')
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
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
                <h2 className="text-lg font-semibold tracking-tight">Supporting areas</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Use these after the core workflow needs team access, taxonomy, or orchestration.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={buildProjectMembersRoute(projectId)}>
                    <Users className="h-4 w-4" />
                    Members
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={buildProjectCategoriesRoute(projectId)}>
                    <Tags className="h-4 w-4" />
                    Categories
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={buildProjectFlowsRoute(projectId)}>
                    <Layers3 className="h-4 w-4" />
                    Flows
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
        onSubmit={(payload) => handleProjectSubmit(payload as UpdateProjectRequest)}
      />

      <DeleteProjectDialog
        open={Boolean(deleteTarget)}
        project={deleteTarget}
        isDeleting={deleteProjectMutation.isPending}
        onOpenChange={(open) => {
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
