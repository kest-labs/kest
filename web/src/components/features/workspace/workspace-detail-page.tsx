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
import { ActionMenu, type ActionMenuItem } from '@/components/features/workspace/action-menu';
import {
  getWorkspaceHomeStatusAccentClassName,
  WorkspaceHomeStatusBadge,
  type WorkspaceHomeStatusTone,
} from '@/components/features/workspace/workspace-home-status';
import {
  DeleteWorkspaceDialog,
  type WorkspaceFormMode,
  WorkspaceFormDialog,
  resolvePlatformLabel,
} from '@/components/features/workspace/workspace-shared';
import { apiExternalBaseUrl, buildApiPath } from '@/config/api';
import {
  buildWorkspaceApiSpecsRoute,
  buildWorkspaceCategoriesRoute,
  buildWorkspaceCollectionsRoute,
  buildWorkspaceEnvironmentsRoute,
  buildWorkspaceFlowsRoute,
  buildWorkspaceMembersRoute,
  buildWorkspaceTestCasesRoute,
  ROUTES,
} from '@/constants/routes';
import {
  useDeleteWorkspace,
  useGenerateWorkspaceCliToken,
  useWorkspace,
  useWorkspaceStats,
  useUpdateWorkspace,
} from '@/hooks/use-workspaces';
import { useWorkspaceCollections } from '@/hooks/use-collections';
import { useTestCases } from '@/hooks/use-test-cases';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import type {
  ApiWorkspace,
  GenerateWorkspaceCliTokenResponse,
  WorkspaceStats,
  UpdateWorkspaceRequest,
} from '@/types/workspace';
import { canManageWorkspaceMembers } from '@/types/member';
import { formatDate } from '@/utils';
import { buildKestConnectionKey } from '@/utils/kest-connection-key';

interface WorkflowStep {
  key: string;
  title: string;
  detail: string;
  status: WorkspaceHomeStatusTone;
  href: string;
  icon: LucideIcon;
}

interface WorkspaceNextAction {
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

interface WorkspaceModuleCard {
  key: string;
  title: string;
  description: string;
  status: WorkspaceHomeStatusTone;
  primaryHref: string;
  icon: LucideIcon;
  metricLabel: string;
  metricValue: number | null;
  primaryLabel: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

const getWorkspaceNextAction = (
  t: ScopedTranslations<'workspace'>,
  workspaceId: number | string,
  stats?: WorkspaceStats | null
): WorkspaceNextAction => {
  if (!stats) {
    return {
      title: t('workspaceDetail.openWorkspace'),
      description: t('workspaceDetail.loadingWorkspace'),
      reason: t('workspaceDetail.loadingReason'),
      primaryLabel: t('modules.apiSpecs.label'),
      primaryHref: buildWorkspaceApiSpecsRoute(workspaceId),
      primaryIcon: FileJson2,
      secondaryLabel: t('workspaceDetail.quickRequest'),
      secondaryHref: `${buildWorkspaceCollectionsRoute(workspaceId)}?quickRequest=1`,
      secondaryIcon: FolderOpen,
    };
  }

  if (stats.api_spec_count === 0) {
    return {
      title: t('workspaceDetail.defineFirstApi'),
      description: t('workspaceDetail.defineFirstApiDescription'),
      reason: t('workspaceDetail.defineFirstApiReason'),
      primaryLabel: t('workspaceDetail.aiDraftApi'),
      primaryHref: `${buildWorkspaceApiSpecsRoute(workspaceId)}?ai=create`,
      primaryIcon: Sparkles,
      secondaryLabel: t('workspaceDetail.quickRequest'),
      secondaryHref: `${buildWorkspaceCollectionsRoute(workspaceId)}?quickRequest=1`,
      secondaryIcon: FolderOpen,
    };
  }

  if (stats.environment_count === 0) {
    return {
      title: t('workspaceDetail.addRuntime'),
      description: t('workspaceDetail.addRuntimeDescription'),
      reason: t('workspaceDetail.addRuntimeReason'),
      primaryLabel: t('workspaceDetail.configureEnvironment'),
      primaryHref: buildWorkspaceEnvironmentsRoute(workspaceId),
      primaryIcon: Globe,
      secondaryLabel: t('workspaceDetail.reviewApiSpecs'),
      secondaryHref: buildWorkspaceApiSpecsRoute(workspaceId),
      secondaryIcon: FileJson2,
    };
  }

  return {
    title: t('workspaceDetail.generateCoverage'),
    description: t('workspaceDetail.generateCoverageDescription'),
    reason: t('workspaceDetail.generateCoverageReason'),
    primaryLabel: t('modules.testCases.label'),
    primaryHref: buildWorkspaceTestCasesRoute(workspaceId),
    primaryIcon: FlaskConical,
    secondaryLabel: t('workspaceDetail.quickRequest'),
    secondaryHref: `${buildWorkspaceCollectionsRoute(workspaceId)}?quickRequest=1`,
    secondaryIcon: FolderOpen,
  };
};

const getWorkspaceWorkflowSteps = (
  t: ScopedTranslations<'workspace'>,
  workspaceId: number | string,
  stats?: WorkspaceStats | null
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
        ? t('workspaceDetail.workflowApiSpecsDetailReady', { count: apiSpecCount })
        : t('workspaceDetail.workflowApiSpecsDetailMissing'),
      status: hasSpecs ? 'ready' : 'setup',
      href: hasSpecs
        ? buildWorkspaceApiSpecsRoute(workspaceId)
        : `${buildWorkspaceApiSpecsRoute(workspaceId)}?ai=create`,
      icon: FileJson2,
    },
    {
      key: 'environments',
      title: t('modules.environments.label'),
      detail: hasEnvironment
        ? t('workspaceDetail.workflowEnvironmentsDetailReady', { count: environmentCount })
        : t('workspaceDetail.workflowEnvironmentsDetailMissing'),
      status: hasEnvironment ? 'ready' : 'setup',
      href: buildWorkspaceEnvironmentsRoute(workspaceId),
      icon: Globe,
    },
    {
      key: 'test-cases',
      title: t('modules.testCases.label'),
      detail: hasSpecs
        ? hasEnvironment
          ? t('workspaceDetail.workflowTestCasesDetailReady')
          : t('workspaceDetail.workflowTestCasesDetailNeedsRuntime')
        : t('workspaceDetail.workflowTestCasesDetailMissing'),
      status: hasSpecs && hasEnvironment ? 'available' : 'setup',
      href: buildWorkspaceTestCasesRoute(workspaceId),
      icon: FlaskConical,
    },
    {
      key: 'organize',
      title: t('workspaceDetail.organize'),
      detail:
        categoryCount > 0 || flowCount > 0
          ? t('workspaceDetail.workflowOrganizeDetailReady', {
              categories: categoryCount,
              flows: flowCount,
            })
          : t('workspaceDetail.workflowOrganizeDetailMissing'),
      status: categoryCount > 0 || flowCount > 0 ? 'ready' : 'optional',
      href: buildWorkspaceCategoriesRoute(workspaceId),
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

const getWorkspaceModuleCards = ({
  t,
  workspaceId,
  stats,
  collectionCount,
  testCaseCount,
  canManageWorkspaceAccess,
}: {
  t: ScopedTranslations<'workspace'>;
  workspaceId: number | string;
  stats?: WorkspaceStats | null;
  collectionCount: number | null;
  testCaseCount: number | null;
  canManageWorkspaceAccess: boolean;
}): WorkspaceModuleCard[] => {
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

  const moduleCards: WorkspaceModuleCard[] = [
    {
      key: 'api-specs',
      title: t('modules.apiSpecs.label'),
      description: hasStats
        ? hasSpecs
          ? t('workspaceDetail.workflowApiSpecsDetailReady', { count: apiSpecCount })
          : t('workspaceDetail.workflowApiSpecsDetailMissing')
        : t('modules.apiSpecs.description'),
      status: hasStats ? (hasSpecs ? 'ready' : 'setup') : 'setup',
      primaryHref: hasSpecs
        ? buildWorkspaceApiSpecsRoute(workspaceId)
        : `${buildWorkspaceApiSpecsRoute(workspaceId)}?ai=create`,
      icon: FileJson2,
      metricLabel: t('modules.apiSpecs.shortLabel'),
      metricValue: hasStats ? apiSpecCount : null,
      primaryLabel: hasSpecs ? t('workspaceDetail.openSpecs') : t('workspaceDetail.aiDraftApi'),
      secondaryLabel: hasSpecs ? t('workspaceDetail.aiDraftApi') : t('workspaceDetail.openSpecs'),
      secondaryHref: hasSpecs
        ? `${buildWorkspaceApiSpecsRoute(workspaceId)}?ai=create`
        : buildWorkspaceApiSpecsRoute(workspaceId),
    },
    {
      key: 'environments',
      title: t('modules.environments.label'),
      description: hasStats
        ? hasEnvironment
          ? t('workspaceDetail.workflowEnvironmentsDetailReady', { count: environmentCount })
          : t('workspaceDetail.workflowEnvironmentsDetailMissing')
        : t('modules.environments.description'),
      status: hasStats ? (hasEnvironment ? 'ready' : 'setup') : 'setup',
      primaryHref: buildWorkspaceEnvironmentsRoute(workspaceId),
      icon: Globe,
      metricLabel: t('modules.environments.shortLabel'),
      metricValue: hasStats ? environmentCount : null,
      primaryLabel: t('workspaceDetail.configureEnvironment'),
    },
    {
      key: 'test-cases',
      title: t('modules.testCases.label'),
      description: hasStats
        ? hasTestCases
          ? t('workspaceDetail.workflowTestCasesDetailReady')
          : hasSpecs && hasEnvironment
            ? t('workspaceDetail.workflowTestCasesDetailReadyToCreate')
            : hasEnvironment
              ? t('workspaceDetail.workflowTestCasesDetailMissing')
              : t('workspaceDetail.workflowTestCasesDetailNeedsRuntime')
        : t('modules.testCases.description'),
      status: hasTestCases ? 'ready' : hasSpecs && hasEnvironment ? 'available' : 'setup',
      primaryHref: buildWorkspaceTestCasesRoute(workspaceId),
      icon: FlaskConical,
      metricLabel: t('modules.testCases.shortLabel'),
      metricValue: testCaseCount,
      primaryLabel: t('workspaceDetail.openTests'),
    },
    {
      key: 'collections',
      title: t('modules.collections.label'),
      description: t('workspaceDetail.shortcutCollectionsDescription'),
      status: hasCollections ? 'ready' : 'available',
      primaryHref: `${buildWorkspaceCollectionsRoute(workspaceId)}?quickRequest=1`,
      icon: FolderOpen,
      metricLabel: t('modules.collections.shortLabel'),
      metricValue: collectionCount,
      primaryLabel: t('workspaceDetail.quickRequest'),
      secondaryLabel: t('workspaceDetail.shortcutCollectionsAction'),
      secondaryHref: buildWorkspaceCollectionsRoute(workspaceId),
    },
    {
      key: 'categories',
      title: t('modules.categories.label'),
      description: t('modules.categories.description'),
      status: hasStats ? (categoryCount > 0 ? 'ready' : 'optional') : 'optional',
      primaryHref: buildWorkspaceCategoriesRoute(workspaceId),
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
      primaryHref: buildWorkspaceMembersRoute(workspaceId),
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
      primaryHref: buildWorkspaceFlowsRoute(workspaceId),
      icon: Layers3,
      metricLabel: t('modules.flows.shortLabel'),
      metricValue: hasStats ? flowCount : null,
      primaryLabel: t('common.manage'),
    },
  ];

  return canManageWorkspaceAccess
    ? moduleCards
    : moduleCards.filter(module => module.key !== 'members');
};

function WorkspaceModuleCardTile({
  module,
  isMetricLoading,
}: {
  module: WorkspaceModuleCard;
  isMetricLoading: boolean;
}) {
  const Icon = module.icon;

  return (
    <Card className="rounded-xl border-border-subtle bg-bg-canvas transition-colors hover:bg-bg-subtle">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${getWorkspaceHomeStatusAccentClassName(module.status)}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <WorkspaceHomeStatusBadge tone={module.status} className="shrink-0" />
        </div>

        <div className="mt-5">
          <p className="text-3xl font-medium tracking-normal text-text-main">
            {formatModuleMetricValue(module.metricValue, isMetricLoading)}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
            {module.metricLabel}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="text-base font-medium tracking-normal text-text-main">{module.title}</h3>
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
 * Workspace workspace home.
 * It turns the workspace detail route into a task-oriented launch surface:
 * API Specs -> Environments -> Test Cases -> operational modules.
 */
export function WorkspaceDetailPage({ workspaceId }: { workspaceId: number | string }) {
  const i18n = useT();
  const t = i18n.workspace;
  const router = useRouter();
  const [formMode, setFormMode] = useState<WorkspaceFormMode>('edit');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiWorkspace | null>(null);
  const [isDeletingCurrentWorkspace, setIsDeletingCurrentWorkspace] = useState(false);
  const [generatedCliToken, setGeneratedCliToken] =
    useState<GenerateWorkspaceCliTokenResponse | null>(null);

  const workspaceQuery = useWorkspace(workspaceId, { enabled: !isDeletingCurrentWorkspace });
  const workspaceStatsQuery = useWorkspaceStats(workspaceId, {
    enabled: !isDeletingCurrentWorkspace,
  });
  const collectionsQuery = useWorkspaceCollections({
    workspaceId,
    page: 1,
    perPage: 1,
  });
  const testCasesQuery = useTestCases({
    workspaceId,
    page: 1,
    pageSize: 1,
  });
  const updateWorkspaceMutation = useUpdateWorkspace();
  const deleteWorkspaceMutation = useDeleteWorkspace();
  const generateCliTokenMutation = useGenerateWorkspaceCliToken();

  const workspace = workspaceQuery.data;
  const canManageWorkspaceAccess = canManageWorkspaceMembers(workspace?.role);
  const canDeleteCurrentWorkspace = workspace?.role === 'owner';
  const workspaceStats = workspaceStatsQuery.data;
  const nextAction = getWorkspaceNextAction(t, workspaceId, workspaceStats);
  const workflowSteps = getWorkspaceWorkflowSteps(t, workspaceId, workspaceStats);
  const collectionCount = collectionsQuery.data?.meta.total ?? null;
  const testCaseCount = testCasesQuery.data?.meta.total ?? null;
  const moduleCards = getWorkspaceModuleCards({
    t,
    workspaceId,
    stats: workspaceStats,
    collectionCount,
    testCaseCount,
    canManageWorkspaceAccess,
  });
  const totalWorkflowSteps = workflowSteps.length;
  const completedWorkflowSteps = workflowSteps.filter(step => step.status === 'ready').length;
  const workflowCompletionPercent =
    totalWorkflowSteps > 0 ? Math.round((completedWorkflowSteps / totalWorkflowSteps) * 100) : 0;
  const shouldShowWorkflowProgress = Boolean(workspaceStats);
  const PrimaryIcon = nextAction.primaryIcon;
  const SecondaryIcon = nextAction.secondaryIcon;
  const cliPlatformUrl = (apiExternalBaseUrl || buildApiPath('/')).replace(/\/$/, '');
  const cliConnectionKey =
    generatedCliToken && workspace
      ? buildKestConnectionKey({
          version: 1,
          platform_url: cliPlatformUrl,
          platform_token: generatedCliToken.token,
          platform_workspace_id: String(workspace.id),
          platform_auto_sync_history: true,
        })
      : '';
  const cliConfigCommand = cliConnectionKey ? `kest key '${cliConnectionKey}'` : '';
  const isWorkspaceLoading = workspaceQuery.isLoading || workspaceStatsQuery.isLoading;
  const isModuleMetricsLoading =
    workspaceStatsQuery.isLoading || collectionsQuery.isLoading || testCasesQuery.isLoading;
  const shouldShowOverview = Boolean(workspace) || isWorkspaceLoading;

  const openEditDialog = () => {
    if (!workspace || !canManageWorkspaceAccess) {
      return;
    }

    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleWorkspaceSubmit = async (payload: UpdateWorkspaceRequest) => {
    if (!workspace || !canManageWorkspaceAccess) {
      return;
    }

    try {
      await updateWorkspaceMutation.mutateAsync({
        id: workspace.id,
        data: payload,
      });
      setIsFormOpen(false);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!deleteTarget || deleteTarget.role !== 'owner') {
      return;
    }

    try {
      setIsDeletingCurrentWorkspace(true);
      await deleteWorkspaceMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      router.replace(ROUTES.CONSOLE.WORKSPACES);
    } catch {
      setIsDeletingCurrentWorkspace(false);
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
    if (!workspace || !workspaceId || !canManageWorkspaceAccess) {
      return;
    }

    try {
      const token = await generateCliTokenMutation.mutateAsync({
        id: workspaceId,
        data: {
          name: `${workspace.name} CLI sync`,
          scopes: ['collection:read', 'collection:run', 'flow:run', 'flow:write'],
        },
      });
      setGeneratedCliToken(token);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const pageActionItems: ActionMenuItem[] = [
    ...(canManageWorkspaceAccess
      ? [
          {
            key: 'members',
            label: t('workspaceDetail.members'),
            icon: Users,
            href: buildWorkspaceMembersRoute(workspaceId),
          },
        ]
      : []),
    {
      key: 'refresh',
      label:
        workspaceQuery.isFetching || workspaceStatsQuery.isFetching
          ? i18n.common('refreshing')
          : i18n.common('refresh'),
      icon: RefreshCw,
      disabled: workspaceQuery.isFetching || workspaceStatsQuery.isFetching,
      onSelect: () => {
        void workspaceQuery.refetch();
        void workspaceStatsQuery.refetch();
        void collectionsQuery.refetch();
        void testCasesQuery.refetch();
      },
    },
    ...(canDeleteCurrentWorkspace
      ? [
          {
            key: 'delete',
            label: t('workspaceForm.deleteButton'),
            icon: Trash2,
            destructive: true,
            separatorBefore: true,
            disabled: !workspace,
            onSelect: () => setDeleteTarget(workspace || null),
          },
        ]
      : []),
  ];

  return (
    <>
      <main className="h-full min-h-0 overflow-y-auto">
        <div className="space-y-6 p-4 md:p-6">
          <section className="rounded-xl border border-border-subtle bg-bg-surface p-5 md:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-4">
                <Button asChild variant="link" className="h-auto px-0 text-sm text-text-muted">
                  <Link href={ROUTES.CONSOLE.WORKSPACES}>
                    <ArrowLeft className="h-4 w-4" />
                    {t('workspaceDetail.workspaces')}
                  </Link>
                </Button>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-medium tracking-normal md:text-3xl">
                      {workspace?.name || `Workspace #${workspaceId}`}
                    </h1>
                    <FolderKanban className="h-6 w-6 text-text-main" />
                  </div>

                  {workspace ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {workspace.status !== 1 ? (
                        <Badge variant="outline">{t('workspaceForm.inactive')}</Badge>
                      ) : null}
                      {workspace.platform ? (
                        <Badge variant="outline">{resolvePlatformLabel(workspace.platform)}</Badge>
                      ) : null}
                      <Badge variant="outline" className="font-mono">
                        {workspace.slug}
                      </Badge>
                    </div>
                  ) : null}
                </div>
              </div>

              {shouldShowOverview ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="lg">
                    <Link href={`${buildWorkspaceApiSpecsRoute(workspaceId)}?ai=create`}>
                      <Sparkles className="h-4 w-4" />
                      {t('workspaceDetail.aiDraftApi')}
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link href={`${buildWorkspaceCollectionsRoute(workspaceId)}?quickRequest=1`}>
                      <FolderOpen className="h-4 w-4" />
                      {t('workspaceDetail.quickRequest')}
                    </Link>
                  </Button>
                  {canManageWorkspaceAccess ? (
                    <Button
                      type="button"
                      variant="outline"
                      isIcon
                      aria-label={t('workspaceForm.editTitle')}
                      className="h-10 w-10 rounded-full"
                      onClick={openEditDialog}
                      disabled={!workspace}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <ActionMenu
                    items={pageActionItems}
                    ariaLabel={t('workspaceDetail.openWorkspaceActions')}
                    triggerVariant="ghost"
                    triggerSize="default"
                    triggerClassName="h-10 w-10 rounded-full border border-border-strong bg-bg-canvas"
                  />
                </div>
              ) : null}
            </div>
          </section>

          {!workspace && !workspaceQuery.isLoading ? (
            <Alert>
              <AlertTitle>{t('workspaceDetail.workspaceNotFoundTitle')}</AlertTitle>
              <AlertDescription>
                {t('workspaceDetail.workspaceNotFoundDescription')}
              </AlertDescription>
            </Alert>
          ) : null}

          {shouldShowOverview ? (
            <>
              <section className="rounded-xl border border-border-subtle bg-bg-surface p-5 md:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <Badge
                      variant="outline"
                      className="border-border-subtle bg-bg-canvas text-text-main"
                    >
                      {t('workspaceDetail.nextStep')}
                    </Badge>
                    <div>
                      <h2 className="text-xl font-medium tracking-normal">{nextAction.title}</h2>
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

                <div className="mt-5 rounded-xl border border-border-subtle bg-bg-canvas p-4">
                  <p className="text-sm font-medium text-text-main">
                    {t('workspaceDetail.whyThisAction')}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{nextAction.reason}</p>
                </div>
              </section>

              <section className="rounded-xl border border-border-subtle bg-bg-canvas p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-medium tracking-normal">
                      {t('workspaceDetail.workspaceModules')}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm text-text-muted">
                      {t('workspaceDetail.workspaceModulesDescription')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {shouldShowWorkflowProgress ? (
                      <div className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-sm font-medium text-text-main">
                        {t('workspaceDetail.workspaceFlowProgress', {
                          percent: workflowCompletionPercent,
                          completed: completedWorkflowSteps,
                          total: totalWorkflowSteps,
                        })}
                      </div>
                    ) : null}
                    {isModuleMetricsLoading ? (
                      <Badge variant="outline">{t('workspaceDetail.loading')}</Badge>
                    ) : null}
                  </div>
                </div>

                {workspaceStatsQuery.isError ? (
                  <Alert className="mt-4">
                    <AlertTitle>{t('workspaceDetail.statsUnavailableTitle')}</AlertTitle>
                    <AlertDescription>
                      {t('workspaceDetail.statsUnavailableDescription')}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {shouldShowWorkflowProgress ? (
                  <div className="mt-4">
                    <div
                      role="progressbar"
                      aria-label={t('workspaceDetail.workspaceFlow')}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={workflowCompletionPercent}
                      className="h-2 overflow-hidden rounded-full bg-bg-subtle"
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
                    <WorkspaceModuleCardTile
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
            <Card className="rounded-xl border-border-subtle bg-bg-canvas">
              <CardHeader>
                <CardTitle>{t('workspaceDetail.workspaceDetails')}</CardTitle>
                <CardDescription>
                  {t('workspaceDetail.workspaceDetailsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border-subtle bg-bg-soft p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                    {t('common.workspaceId')}
                  </p>
                  <p className="mt-2 font-mono text-sm text-text-main">
                    {workspace?.id ?? workspaceId}
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-bg-soft p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                    {t('workspaceDetail.platform')}
                  </p>
                  <p className="mt-2 text-sm text-text-main">
                    {workspace
                      ? resolvePlatformLabel(workspace.platform) || t('workspaceForm.notSet')
                      : i18n.common('loading')}
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-bg-soft p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                    {t('common.created')}
                  </p>
                  <p className="mt-2 text-sm text-text-main">
                    {workspace
                      ? formatDate(workspace.created_at, 'YYYY-MM-DD HH:mm')
                      : i18n.common('loading')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {canManageWorkspaceAccess ? (
              <Card id="cli-sync" className="rounded-xl border-border-subtle bg-bg-canvas">
                <CardHeader>
                  <CardTitle>{t('workspaceDetail.cliSync')}</CardTitle>
                  <CardDescription>{t('workspaceDetail.cliSyncDescription')}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border-subtle bg-bg-soft p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                        {t('workspaceDetail.platformUrl')}
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-text-main">
                        {cliPlatformUrl}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-bg-soft p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                        {t('workspaceDetail.workspaceScope')}
                      </p>
                      <p className="mt-2 font-mono text-sm text-text-main">
                        {workspace?.id ?? workspaceId}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleGenerateCliToken()}
                      disabled={!workspace || !workspaceId || generateCliTokenMutation.isPending}
                    >
                      <Key className="h-4 w-4" />
                      {generateCliTokenMutation.isPending
                        ? t('workspaceDetail.generating')
                        : t('workspaceDetail.generateToken')}
                    </Button>
                    {generatedCliToken ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void handleCopyText(
                            cliConfigCommand,
                            t('workspaceDetail.copiedSyncCommand')
                          )
                        }
                      >
                        <Terminal className="h-4 w-4" />
                        {t('workspaceDetail.copyCommand')}
                      </Button>
                    ) : null}
                  </div>

                  {generatedCliToken ? (
                    <Alert>
                      <ShieldCheck className="h-4 w-4" />
                      <AlertTitle>{t('workspaceDetail.copyTokenTitle')}</AlertTitle>
                      <AlertDescription className="space-y-4">
                        <div className="rounded-xl border border-border-subtle bg-bg-canvas p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                              {t('workspaceDetail.cliToken')}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void handleCopyText(
                                  generatedCliToken.token,
                                  t('workspaceDetail.copiedCliToken')
                                )
                              }
                            >
                              <Copy className="h-3.5 w-3.5" />
                              {i18n.common('copy')}
                            </Button>
                          </div>
                          <code className="block break-all text-xs">{generatedCliToken.token}</code>
                        </div>

                        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-border-subtle bg-bg-canvas p-4 text-xs">
                          {cliConfigCommand}
                        </pre>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </main>

      <WorkspaceFormDialog
        key={`${formMode}-${workspace?.id ?? workspaceId}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        workspace={workspace}
        isSubmitting={updateWorkspaceMutation.isPending}
        onOpenChange={setIsFormOpen}
        onSubmit={payload => handleWorkspaceSubmit(payload as UpdateWorkspaceRequest)}
      />

      <DeleteWorkspaceDialog
        open={Boolean(deleteTarget)}
        workspace={deleteTarget}
        isDeleting={deleteWorkspaceMutation.isPending}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDeleteWorkspace}
      />
    </>
  );
}

export default WorkspaceDetailPage;
