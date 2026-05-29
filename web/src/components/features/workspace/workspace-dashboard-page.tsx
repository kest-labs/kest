'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownAZ,
  Boxes,
  FolderKanban,
  Grid2X2,
  Import,
  List,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ActionMenu } from '@/components/features/workspace/action-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DeleteWorkspaceDialog,
  WorkspaceFormDialog,
  resolvePlatformLabel,
  type WorkspaceFormMode,
} from '@/components/features/workspace/workspace-shared';
import { buildWorkspaceApiSpecsRoute, buildWorkspaceInviteRoute } from '@/constants/routes';
import { useCreateDemoWorkspace } from '@/hooks/use-create-demo-workspace';
import { useApiSpecs } from '@/hooks/use-api-specs';
import {
  useAcceptWorkspaceInvitation,
  useMyWorkspaceInvitations,
  useRejectWorkspaceInvitation,
} from '@/hooks/use-workspace-invitations';
import {
  useCreateWorkspace,
  useDeleteWorkspace,
  useWorkspaceStats,
  useWorkspaces,
  useUpdateWorkspace,
} from '@/hooks/use-workspaces';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import { useOnboardingStore } from '@/store/onboarding-store';
import type { ApiWorkspace, CreateWorkspaceRequest, UpdateWorkspaceRequest } from '@/types/workspace';
import type { ReceivedWorkspaceInvitation } from '@/types/workspace-invitation';
import { cn, formatDate } from '@/utils';

const WORKSPACES_PAGE_SIZE = 1000;
const MAX_PREVIEW_SPECS = 5;
const EMPTY_WORKSPACES: ApiWorkspace[] = [];
const COMPACT_BADGE_CLASS_NAME = 'px-2 py-0.5 text-xs font-medium leading-5';
type WorkspaceViewMode = 'grid' | 'list';
type WorkspaceSortMode = 'newest' | 'oldest';
type WorkspaceT = ScopedTranslations<'workspace'>;

const getWorkspaceCreatedAt = (workspace: ApiWorkspace) => workspace.created_at || '';

const sortWorkspacesByCreatedAtDesc = (left: ApiWorkspace, right: ApiWorkspace) =>
  getWorkspaceCreatedAt(right).localeCompare(getWorkspaceCreatedAt(left));

const formatWorkspaceTimestamp = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : formatDate(value, 'YYYY-MM-DD HH:mm');
};

const getReceivedInvitationRoleLabel = (t: WorkspaceT, role: ReceivedWorkspaceInvitation['role']) => {
  switch (role) {
    case 'admin':
      return t('roles.admin');
    case 'write':
      return t('roles.write');
    case 'read':
      return t('roles.read');
    default:
      return t('roles.unknown');
  }
};

const getWorkspaceRoleLabel = (t: WorkspaceT, role: ApiWorkspace['role']) => {
  switch (role) {
    case 'owner':
      return t('roles.owner');
    case 'admin':
      return t('roles.admin');
    case 'write':
      return t('roles.write');
    case 'read':
      return t('roles.read');
    default:
      return t('roles.unknown');
  }
};

export function WorkspaceDashboardPage() {
  const i18n = useT();
  const t = i18n.workspace;
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('grid');
  const [sortMode, setSortMode] = useState<WorkspaceSortMode>('newest');
  const [formMode, setFormMode] = useState<WorkspaceFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<ApiWorkspace | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiWorkspace | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);

  const workspacesQuery = useWorkspaces({ page: 1, perPage: WORKSPACES_PAGE_SIZE });
  const createWorkspaceMutation = useCreateWorkspace();
  const createDemoWorkspaceMutation = useCreateDemoWorkspace();
  const deleteWorkspaceMutation = useDeleteWorkspace();
  const receivedInvitationsQuery = useMyWorkspaceInvitations();
  const updateWorkspaceMutation = useUpdateWorkspace();
  const markFirstWorkspaceCreated = useOnboardingStore.use.markFirstWorkspaceCreated();

  const workspaces = workspacesQuery.data?.items ?? EMPTY_WORKSPACES;
  const sortedWorkspaces = useMemo(() => {
    const orderedWorkspaces = [...workspaces].sort(sortWorkspacesByCreatedAtDesc);
    return sortMode === 'newest' ? orderedWorkspaces : orderedWorkspaces.reverse();
  }, [workspaces, sortMode]);

  const filteredWorkspaces = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return sortedWorkspaces;
    }

    return sortedWorkspaces.filter(workspace =>
      [workspace.name, workspace.slug, workspace.platform]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSearch, sortedWorkspaces]);
  const activeWorkspaceCount = workspaces.filter(workspace => workspace.status === 1).length;

  const openCreateDialog = () => {
    setFormMode('create');
    setEditingWorkspace(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (workspace: ApiWorkspace) => {
    setFormMode('edit');
    setEditingWorkspace(workspace);
    setIsFormOpen(true);
  };

  const handleWorkspaceSubmit = async (payload: CreateWorkspaceRequest | UpdateWorkspaceRequest) => {
    try {
      if (formMode === 'create') {
        const workspace = await createWorkspaceMutation.mutateAsync(payload as CreateWorkspaceRequest);
        markFirstWorkspaceCreated();
        router.push(buildWorkspaceApiSpecsRoute(workspace.id));
      } else if (editingWorkspace) {
        await updateWorkspaceMutation.mutateAsync({
          id: editingWorkspace.id,
          data: payload as UpdateWorkspaceRequest,
        });
      }

      setIsFormOpen(false);
      setEditingWorkspace(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteWorkspaceMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-bg-canvas">
      <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col px-4 py-5 md:px-6 lg:px-10">
        <div className="space-y-6">
          <PendingInvitationsPanel
            invitations={receivedInvitationsQuery.data ?? []}
            isLoading={receivedInvitationsQuery.isLoading}
            isError={Boolean(receivedInvitationsQuery.error)}
          />

          <section className="space-y-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="text-xl font-medium tracking-normal text-text-main">
                  {t('dashboardPage.teamTitle')}
                </h1>

                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <Badge variant="outline" className={cn('bg-bg-soft', COMPACT_BADGE_CLASS_NAME)}>
                    {t('dashboardPage.workspaceCount', { count: workspaces.length })}
                  </Badge>
                  <Badge variant="outline" className={cn('bg-bg-soft', COMPACT_BADGE_CLASS_NAME)}>
                    {t('dashboardPage.activeWorkspaceCount', { count: activeWorkspaceCount })}
                  </Badge>
                </div>
              </div>

              <div className="border-b border-border-subtle">
                <nav className="flex min-w-0 items-center gap-5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    className="relative shrink-0 px-0 pb-3 text-sm font-medium tracking-normal text-[var(--miro-brand-blue)] transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--miro-brand-blue)]"
                  >
                    {t('dashboardPage.tabs.settings')}
                  </button>
                </nav>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg bg-bg-surface p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    isIcon
                    noScale
                    aria-label={t('dashboardPage.gridView')}
                    className={cn(
                      'h-8 w-8 rounded-md border-0 bg-transparent',
                      viewMode === 'grid' && 'bg-bg-canvas shadow-sm'
                    )}
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid2X2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    isIcon
                    noScale
                    aria-label={t('dashboardPage.listView')}
                    className={cn(
                      'h-8 w-8 rounded-md border-0 bg-transparent',
                      viewMode === 'list' && 'bg-bg-canvas shadow-sm'
                    )}
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  isIcon
                  noScale
                  aria-label={
                    sortMode === 'newest'
                      ? t('dashboardPage.sortNewest')
                      : t('dashboardPage.sortOldest')
                  }
                  className="h-8 w-8 rounded-md border-0 bg-transparent text-text-main hover:bg-bg-subtle"
                  onClick={() =>
                    setSortMode(current => (current === 'newest' ? 'oldest' : 'newest'))
                  }
                >
                  <ArrowDownAZ
                    className={cn('h-3.5 w-3.5', sortMode === 'oldest' && 'rotate-180')}
                  />
                </Button>

                <div className="relative w-full min-w-[220px] sm:w-[300px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder={t('dashboardPage.searchPlaceholder')}
                    className="h-9 rounded-md border-border-subtle bg-bg-canvas pl-8 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled>
                  <Import className="h-3.5 w-3.5" />
                  {t('dashboardPage.importWorkspace')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={openCreateDialog}
                  data-onboarding="create-workspace"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('workspaceForm.createButton')}
                </Button>
              </div>
            </div>

            <div data-onboarding="workspace-list">
              {workspacesQuery.isLoading ? (
                <WorkspaceCardGridSkeleton viewMode={viewMode} />
              ) : workspacesQuery.error ? (
                <Alert>
                  <AlertTitle>{t('dashboardPage.loadFailedTitle')}</AlertTitle>
                  <AlertDescription>{t('dashboardPage.loadFailedDescription')}</AlertDescription>
                </Alert>
              ) : filteredWorkspaces.length === 0 ? (
                <WorkspaceDashboardEmptyState
                  hasWorkspaces={workspaces.length > 0}
                  onCreateWorkspace={openCreateDialog}
                  onCreateDemoWorkspace={async () => {
                    const result = await createDemoWorkspaceMutation.mutateAsync();
                    markFirstWorkspaceCreated();
                    router.push(buildWorkspaceApiSpecsRoute(result.workspace.id));
                  }}
                  isCreatingDemoWorkspace={createDemoWorkspaceMutation.isPending}
                />
              ) : (
                <div
                  className={cn(
                    viewMode === 'grid'
                      ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                      : 'grid gap-2'
                  )}
                >
                  {filteredWorkspaces.map(workspace => (
                    <WorkspaceCard
                      key={workspace.id}
                      workspace={workspace}
                      viewMode={viewMode}
                      onEdit={() => openEditDialog(workspace)}
                      onDelete={() => setDeleteTarget(workspace)}
                      isDeleting={deleteWorkspaceMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {workspaces.length === 0 && !workspacesQuery.isLoading && !workspacesQuery.error ? (
            <WorkspaceDashboardDemoPanel
              onCreateWorkspace={openCreateDialog}
              onCreateDemoWorkspace={async () => {
                const result = await createDemoWorkspaceMutation.mutateAsync();
                markFirstWorkspaceCreated();
                router.push(buildWorkspaceApiSpecsRoute(result.workspace.id));
              }}
              isCreatingDemoWorkspace={createDemoWorkspaceMutation.isPending}
            />
          ) : null}
        </div>
      </div>

      <WorkspaceFormDialog
        open={isFormOpen}
        mode={formMode}
        workspace={editingWorkspace}
        isSubmitting={
          createWorkspaceMutation.isPending ||
          createDemoWorkspaceMutation.isPending ||
          updateWorkspaceMutation.isPending ||
          deleteWorkspaceMutation.isPending
        }
        onOpenChange={setIsFormOpen}
        onSubmit={handleWorkspaceSubmit}
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
    </main>
  );
}

function PendingInvitationsPanel({
  invitations,
  isLoading,
  isError,
}: {
  invitations: ReceivedWorkspaceInvitation[];
  isLoading: boolean;
  isError: boolean;
}) {
  const t = useT('workspace');
  const router = useRouter();
  const acceptInvitationMutation = useAcceptWorkspaceInvitation();
  const rejectInvitationMutation = useRejectWorkspaceInvitation();
  const [actingOn, setActingOn] = useState<{
    action: 'accept' | 'reject';
    slug: string;
  } | null>(null);

  if (!isLoading && !isError && invitations.length === 0) {
    return null;
  }

  const handleAccept = async (invitation: ReceivedWorkspaceInvitation) => {
    setActingOn({ action: 'accept', slug: invitation.slug });
    try {
      const result = await acceptInvitationMutation.mutateAsync(invitation.slug);
      router.push(result.redirect_to || buildWorkspaceApiSpecsRoute(result.workspace_id));
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    } finally {
      setActingOn(null);
    }
  };

  const handleReject = async (invitation: ReceivedWorkspaceInvitation) => {
    setActingOn({ action: 'reject', slug: invitation.slug });
    try {
      await rejectInvitationMutation.mutateAsync(invitation.slug);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    } finally {
      setActingOn(null);
    }
  };

  return (
    <Card className="gap-4 rounded-lg border-border-subtle bg-bg-canvas py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">{t('dashboardPage.pendingInvitationsTitle')}</CardTitle>
        <CardDescription className="text-xs">
          {t('dashboardPage.pendingInvitationsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-md border border-border-subtle bg-bg-soft"
              />
            ))}
          </div>
        ) : isError ? (
          <Alert>
            <AlertTitle>{t('dashboardPage.pendingInvitationsLoadFailedTitle')}</AlertTitle>
            <AlertDescription>
              {t('dashboardPage.pendingInvitationsLoadFailedDescription')}
            </AlertDescription>
          </Alert>
        ) : (
          invitations.map(invitation => {
            const isAccepting = actingOn?.action === 'accept' && actingOn.slug === invitation.slug;
            const isRejecting = actingOn?.action === 'reject' && actingOn.slug === invitation.slug;

            return (
              <div
                key={invitation.id}
                className="rounded-md border border-border-subtle bg-bg-canvas p-3"
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-border-subtle bg-bg-subtle text-text-main',
                          COMPACT_BADGE_CLASS_NAME
                        )}
                      >
                        {t('roles.badge', {
                          role: getReceivedInvitationRoleLabel(t, invitation.role),
                        })}
                      </Badge>
                      <Badge variant="outline" className={COMPACT_BADGE_CLASS_NAME}>
                        {invitation.workspace_slug}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium tracking-normal">
                        {invitation.workspace_name}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {t('invitation.expiresLabel')}:{' '}
                        {invitation.expires_at
                          ? formatDate(invitation.expires_at, 'YYYY-MM-DD HH:mm')
                          : t('invitation.never')}
                      </p>
                      <p className="text-xs text-text-muted">
                        {t('membersPage.inviteCreated')}:{' '}
                        {formatDate(invitation.created_at, 'YYYY-MM-DD HH:mm')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="xs" asChild>
                      <Link href={buildWorkspaceInviteRoute(invitation.slug)}>
                        {t('dashboardPage.reviewInvitation')}
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      loading={isRejecting}
                      disabled={Boolean(actingOn) && !isRejecting}
                      onClick={() => {
                        void handleReject(invitation);
                      }}
                    >
                      {t('invitation.reject')}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      loading={isAccepting}
                      disabled={Boolean(actingOn) && !isAccepting}
                      onClick={() => {
                        void handleAccept(invitation);
                      }}
                    >
                      {t('invitation.accept')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function WorkspaceCard({
  workspace,
  viewMode,
  onEdit,
  onDelete,
  isDeleting,
}: {
  workspace: ApiWorkspace;
  viewMode: WorkspaceViewMode;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const t = useT('workspace');
  const workspaceId = workspace.workspace_id;
  const statsQuery = useWorkspaceStats(workspace.id);
  const apiSpecsQuery = useApiSpecs({
    workspaceId: workspaceId ?? '',
    page: 1,
    pageSize: MAX_PREVIEW_SPECS,
  });
  const stats = statsQuery.data;
  const apiSpecCount = stats?.api_spec_count ?? apiSpecsQuery.data?.items?.length ?? 0;
  const environmentCount = stats?.environment_count ?? 0;
  const memberCount = stats?.member_count ?? null;
  const createdAtLabel = formatWorkspaceTimestamp(workspace.created_at);
  const isLoadingStats = statsQuery.isLoading || apiSpecsQuery.isLoading;
  const isInactive = workspace.status !== 1;
  const menuItems = [
    {
      key: `workspace-edit-${workspace.id}`,
      label: t('workspaceForm.editTitle'),
      icon: Pencil,
      onSelect: onEdit,
    },
    {
      key: `workspace-delete-${workspace.id}`,
      label: t('workspaceForm.deleteButton'),
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      disabled: isDeleting,
      onSelect: onDelete,
    },
  ];

  if (viewMode === 'list') {
    return (
      <div className="group relative rounded-lg border border-border-subtle bg-bg-canvas transition-colors hover:border-border-strong hover:bg-bg-soft">
        <Link
          href={buildWorkspaceApiSpecsRoute(workspace.id)}
          className="grid gap-3 p-3 pr-20 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center"
        >
          <div className="flex min-w-0 items-center gap-3">
            <WorkspaceAvatar name={workspace.name} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-text-main">{workspace.name}</p>
                {isInactive ? (
                  <Badge variant="outline" className={COMPACT_BADGE_CLASS_NAME}>
                    {t('workspaceForm.inactive')}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-text-muted">{workspace.slug}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <WorkspaceMetric
              label={t('modules.apiSpecs.shortLabel')}
              value={apiSpecCount}
              loading={isLoadingStats}
            />
            <WorkspaceMetric
              label={t('modules.environments.shortLabel')}
              value={environmentCount}
              loading={isLoadingStats}
            />
            <WorkspaceMetric
              label={t('modules.members.shortLabel')}
              value={memberCount}
              loading={isLoadingStats}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {workspace.role ? (
              <Badge
                variant="outline"
                className={cn('bg-bg-canvas text-text-main', COMPACT_BADGE_CLASS_NAME)}
              >
                {getWorkspaceRoleLabel(t, workspace.role)}
              </Badge>
            ) : null}
            <Badge variant="outline" className={cn('bg-bg-canvas', COMPACT_BADGE_CLASS_NAME)}>
              {resolvePlatformLabel(workspace.platform)}
            </Badge>
          </div>
        </Link>

        <ActionMenu
          items={menuItems}
          ariaLabel={t('dashboardPage.openWorkspaceActions', { name: workspace.name })}
          stopPropagation
          triggerClassName="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-bg-canvas text-text-muted hover:bg-bg-subtle hover:text-text-main [&>svg]:h-3.5 [&>svg]:w-3.5"
        />
      </div>
    );
  }

  return (
    <div className="group relative min-h-[180px] rounded-lg border border-border-subtle bg-bg-canvas transition-colors hover:border-border-strong hover:bg-bg-soft">
      <Link href={buildWorkspaceApiSpecsRoute(workspace.id)} className="flex h-full flex-col p-4">
        <div className="flex min-w-0 items-start gap-3 pr-6">
          <WorkspaceAvatar name={workspace.name} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-medium tracking-normal text-text-main">
                {workspace.name}
              </h2>
              {isInactive ? (
                <Badge variant="outline" className={COMPACT_BADGE_CLASS_NAME}>
                  {t('workspaceForm.inactive')}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-muted">{workspace.slug}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <WorkspaceMetric
            label={t('modules.apiSpecs.shortLabel')}
            value={apiSpecCount}
            loading={isLoadingStats}
          />
          <WorkspaceMetric
            label={t('modules.environments.shortLabel')}
            value={environmentCount}
            loading={isLoadingStats}
          />
          <WorkspaceMetric
            label={t('modules.members.shortLabel')}
            value={memberCount}
            loading={isLoadingStats}
          />
        </div>

        <div className="mt-auto flex flex-wrap items-end gap-2 pt-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {workspace.role ? (
                <Badge
                  variant="outline"
                  className={cn('bg-bg-canvas text-text-main', COMPACT_BADGE_CLASS_NAME)}
                >
                  {getWorkspaceRoleLabel(t, workspace.role)}
                </Badge>
              ) : null}
              <Badge variant="outline" className={cn('bg-bg-canvas', COMPACT_BADGE_CLASS_NAME)}>
                {resolvePlatformLabel(workspace.platform)}
              </Badge>
            </div>
            {createdAtLabel ? (
              <p className="text-xs text-text-muted">
                {t('dashboardPage.createdAt', { value: createdAtLabel })}
              </p>
            ) : null}
          </div>
        </div>
      </Link>

      <ActionMenu
        items={menuItems}
        ariaLabel={t('dashboardPage.openWorkspaceActions', { name: workspace.name })}
        stopPropagation
        triggerClassName="absolute right-3 top-3 h-7 w-7 rounded-full bg-bg-canvas text-text-muted opacity-0 transition-opacity hover:bg-bg-subtle hover:text-text-main group-hover:opacity-100 data-[state=open]:opacity-100 [&>svg]:h-3.5 [&>svg]:w-3.5"
      />
    </div>
  );
}

function WorkspaceAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--miro-rose-light)] text-[var(--miro-brand-blue)]">
      {initials ? (
        <span className="text-xs font-semibold tracking-normal">{initials}</span>
      ) : (
        <FolderKanban className="h-4 w-4" />
      )}
    </div>
  );
}

function WorkspaceMetric({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | null;
  loading: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md bg-bg-soft px-2 py-1.5">
      {loading ? (
        <div className="h-3.5 w-6 animate-pulse rounded bg-muted" />
      ) : (
        <p className="text-xs font-medium text-text-main">{value ?? '--'}</p>
      )}
      <p className="mt-0.5 truncate text-[10px] leading-3 text-text-muted">{label}</p>
    </div>
  );
}

function WorkspaceCardGridSkeleton({ viewMode }: { viewMode: WorkspaceViewMode }) {
  const itemClassName =
    viewMode === 'grid'
      ? 'min-h-[180px] rounded-lg border border-border-subtle bg-bg-canvas p-4'
      : 'h-[4rem] rounded-lg border border-border-subtle bg-bg-canvas p-3';

  return (
    <div
      className={cn(
        viewMode === 'grid'
          ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
          : 'grid gap-2'
      )}
    >
      {Array.from({ length: viewMode === 'grid' ? 8 : 5 }).map((_, index) => (
        <div key={index} className={itemClassName}>
          <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
          <div className="mt-4 h-3.5 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
          {viewMode === 'grid' ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="h-9 animate-pulse rounded-md bg-muted" />
              <div className="h-9 animate-pulse rounded-md bg-muted" />
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WorkspaceDashboardEmptyState({
  hasWorkspaces,
  onCreateWorkspace,
  onCreateDemoWorkspace,
  isCreatingDemoWorkspace,
}: {
  hasWorkspaces: boolean;
  onCreateWorkspace: () => void;
  onCreateDemoWorkspace: () => Promise<void>;
  isCreatingDemoWorkspace: boolean;
}) {
  const t = useT('workspace');

  return (
    <div className="rounded-lg border border-dashed border-border-subtle bg-bg-soft p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--miro-surface-yellow)] text-[var(--miro-yellow-dark)]">
        <FolderKanban className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-medium tracking-normal text-text-main">
        {hasWorkspaces
          ? t('dashboardPage.noWorkspacesMatchedTitle')
          : t('dashboardPage.noWorkspacesYetTitle')}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-text-muted">
        {hasWorkspaces
          ? t('dashboardPage.noWorkspacesMatched')
          : t('dashboardPage.noWorkspacesYetDescription')}
      </p>
      {!hasWorkspaces ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" onClick={onCreateWorkspace}>
            <Plus className="h-3.5 w-3.5" />
            {t('workspaceForm.createButton')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onCreateDemoWorkspace()}
            loading={isCreatingDemoWorkspace}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('dashboardPage.demoCardAction')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceDashboardDemoPanel({
  onCreateWorkspace,
  onCreateDemoWorkspace,
  isCreatingDemoWorkspace,
}: {
  onCreateWorkspace: () => void;
  onCreateDemoWorkspace: () => Promise<void>;
  isCreatingDemoWorkspace: boolean;
}) {
  const t = useT('workspace');

  return (
    <div
      className="rounded-lg border border-border-subtle bg-bg-surface p-4"
      data-onboarding="demo-workspace-card"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Boxes className="h-4 w-4 text-text-main" />
            <h2 className="text-base font-medium tracking-normal text-text-main">
              {t('dashboardPage.demoCardTitle')}
            </h2>
            <Badge variant="outline" className={cn('bg-bg-canvas', COMPACT_BADGE_CLASS_NAME)}>
              {t('dashboardPage.demoCardBadge')}
            </Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-text-muted">
            {t('dashboardPage.demoCardDescription')}
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <DemoFeature
              title={t('dashboardPage.demoCardApiSpecsTitle')}
              description={t('dashboardPage.demoCardApiSpecsDescription')}
            />
            <DemoFeature
              title={t('dashboardPage.demoCardRequestsTitle')}
              description={t('dashboardPage.demoCardRequestsDescription')}
            />
            <DemoFeature
              title={t('dashboardPage.demoCardRuntimeTitle')}
              description={t('dashboardPage.demoCardRuntimeDescription')}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void onCreateDemoWorkspace()}
            loading={isCreatingDemoWorkspace}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('dashboardPage.demoCardAction')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCreateWorkspace}>
            {t('dashboardPage.demoCardSecondaryAction')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DemoFeature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-canvas p-3">
      <p className="text-xs font-medium text-text-main">{title}</p>
      <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
    </div>
  );
}
