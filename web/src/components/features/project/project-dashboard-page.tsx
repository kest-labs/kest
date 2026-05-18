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
import { ActionMenu } from '@/components/features/project/action-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DeleteProjectDialog,
  ProjectFormDialog,
  resolvePlatformLabel,
  type ProjectFormMode,
} from '@/components/features/project/project-shared';
import { buildProjectApiSpecsRoute, buildProjectInviteRoute } from '@/constants/routes';
import { useCreateDemoProject } from '@/hooks/use-create-demo-project';
import { useApiSpecs } from '@/hooks/use-api-specs';
import {
  useAcceptProjectInvitation,
  useMyProjectInvitations,
  useRejectProjectInvitation,
} from '@/hooks/use-project-invitations';
import {
  useCreateProject,
  useDeleteProject,
  useProjectStats,
  useProjects,
  useUpdateProject,
} from '@/hooks/use-projects';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import { useOnboardingStore } from '@/store/onboarding-store';
import type { ApiProject, CreateProjectRequest, UpdateProjectRequest } from '@/types/project';
import type { ReceivedProjectInvitation } from '@/types/project-invitation';
import { cn, formatDate } from '@/utils';

const PROJECTS_PAGE_SIZE = 1000;
const MAX_PREVIEW_SPECS = 5;
const EMPTY_PROJECTS: ApiProject[] = [];
const COMPACT_BADGE_CLASS_NAME = 'px-2 py-0.5 text-xs font-medium leading-5';
type ProjectViewMode = 'grid' | 'list';
type ProjectSortMode = 'newest' | 'oldest';
type ProjectT = ScopedTranslations<'project'>;

const getProjectCreatedAt = (project: ApiProject) => project.created_at || '';

const sortProjectsByCreatedAtDesc = (left: ApiProject, right: ApiProject) =>
  getProjectCreatedAt(right).localeCompare(getProjectCreatedAt(left));

const formatProjectTimestamp = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : formatDate(value, 'YYYY-MM-DD HH:mm');
};

const getReceivedInvitationRoleLabel = (t: ProjectT, role: ReceivedProjectInvitation['role']) => {
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

const getProjectRoleLabel = (t: ProjectT, role: ApiProject['role']) => {
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

export function ProjectDashboardPage() {
  const i18n = useT();
  const t = i18n.project;
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ProjectViewMode>('grid');
  const [sortMode, setSortMode] = useState<ProjectSortMode>('newest');
  const [formMode, setFormMode] = useState<ProjectFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiProject | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);

  const projectsQuery = useProjects({ page: 1, perPage: PROJECTS_PAGE_SIZE });
  const createProjectMutation = useCreateProject();
  const createDemoProjectMutation = useCreateDemoProject();
  const deleteProjectMutation = useDeleteProject();
  const receivedInvitationsQuery = useMyProjectInvitations();
  const updateProjectMutation = useUpdateProject();
  const markFirstProjectCreated = useOnboardingStore.use.markFirstProjectCreated();

  const projects = projectsQuery.data?.items ?? EMPTY_PROJECTS;
  const sortedProjects = useMemo(() => {
    const orderedProjects = [...projects].sort(sortProjectsByCreatedAtDesc);
    return sortMode === 'newest' ? orderedProjects : orderedProjects.reverse();
  }, [projects, sortMode]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return sortedProjects;
    }

    return sortedProjects.filter(project =>
      [project.name, project.slug, project.platform]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSearch, sortedProjects]);
  const activeProjectCount = projects.filter(project => project.status === 1).length;

  const openCreateDialog = () => {
    setFormMode('create');
    setEditingProject(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (project: ApiProject) => {
    setFormMode('edit');
    setEditingProject(project);
    setIsFormOpen(true);
  };

  const handleProjectSubmit = async (payload: CreateProjectRequest | UpdateProjectRequest) => {
    try {
      if (formMode === 'create') {
        const project = await createProjectMutation.mutateAsync(payload as CreateProjectRequest);
        markFirstProjectCreated();
        router.push(buildProjectApiSpecsRoute(project.id));
      } else if (editingProject) {
        await updateProjectMutation.mutateAsync({
          id: editingProject.id,
          data: payload as UpdateProjectRequest,
        });
      }

      setIsFormOpen(false);
      setEditingProject(null);
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
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-bg-soft">
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
                    {t('dashboardPage.projectCount', { count: projects.length })}
                  </Badge>
                  <Badge variant="outline" className={cn('bg-bg-soft', COMPACT_BADGE_CLASS_NAME)}>
                    {t('dashboardPage.activeProjectCount', { count: activeProjectCount })}
                  </Badge>
                </div>
              </div>

              <div className="border-b border-border-subtle">
                <nav className="flex min-w-0 items-center gap-5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    className="relative shrink-0 px-0 pb-3 text-sm font-semibold tracking-normal text-text-main transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-sm after:bg-[var(--miro-brand-yellow)]"
                  >
                    {t('dashboardPage.tabs.settings')}
                  </button>
                </nav>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-border-subtle bg-bg-canvas p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    isIcon
                    noScale
                    aria-label={t('dashboardPage.gridView')}
                    className={cn(
                      'h-8 w-8 rounded-md border-0 bg-transparent',
                      viewMode === 'grid' && 'bg-primary text-primary-foreground'
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
                      viewMode === 'list' && 'bg-primary text-primary-foreground'
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
                  {t('dashboardPage.importProject')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={openCreateDialog}
                  data-onboarding="create-project"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('projectForm.createButton')}
                </Button>
              </div>
            </div>

            <div data-onboarding="project-list">
              {projectsQuery.isLoading ? (
                <ProjectCardGridSkeleton viewMode={viewMode} />
              ) : projectsQuery.error ? (
                <Alert>
                  <AlertTitle>{t('dashboardPage.loadFailedTitle')}</AlertTitle>
                  <AlertDescription>{t('dashboardPage.loadFailedDescription')}</AlertDescription>
                </Alert>
              ) : filteredProjects.length === 0 ? (
                <ProjectDashboardEmptyState
                  hasProjects={projects.length > 0}
                  onCreateProject={openCreateDialog}
                  onCreateDemoProject={async () => {
                    const result = await createDemoProjectMutation.mutateAsync();
                    markFirstProjectCreated();
                    router.push(buildProjectApiSpecsRoute(result.project.id));
                  }}
                  isCreatingDemoProject={createDemoProjectMutation.isPending}
                />
              ) : (
                <div
                  className={cn(
                    viewMode === 'grid'
                      ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                      : 'grid gap-2'
                  )}
                >
                  {filteredProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      viewMode={viewMode}
                      onEdit={() => openEditDialog(project)}
                      onDelete={() => setDeleteTarget(project)}
                      isDeleting={deleteProjectMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {projects.length === 0 && !projectsQuery.isLoading && !projectsQuery.error ? (
            <ProjectDashboardDemoPanel
              onCreateProject={openCreateDialog}
              onCreateDemoProject={async () => {
                const result = await createDemoProjectMutation.mutateAsync();
                markFirstProjectCreated();
                router.push(buildProjectApiSpecsRoute(result.project.id));
              }}
              isCreatingDemoProject={createDemoProjectMutation.isPending}
            />
          ) : null}
        </div>
      </div>

      <ProjectFormDialog
        open={isFormOpen}
        mode={formMode}
        project={editingProject}
        isSubmitting={
          createProjectMutation.isPending ||
          createDemoProjectMutation.isPending ||
          updateProjectMutation.isPending ||
          deleteProjectMutation.isPending
        }
        onOpenChange={setIsFormOpen}
        onSubmit={handleProjectSubmit}
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
    </main>
  );
}

function PendingInvitationsPanel({
  invitations,
  isLoading,
  isError,
}: {
  invitations: ReceivedProjectInvitation[];
  isLoading: boolean;
  isError: boolean;
}) {
  const t = useT('project');
  const router = useRouter();
  const acceptInvitationMutation = useAcceptProjectInvitation();
  const rejectInvitationMutation = useRejectProjectInvitation();
  const [actingOn, setActingOn] = useState<{
    action: 'accept' | 'reject';
    slug: string;
  } | null>(null);

  if (!isLoading && !isError && invitations.length === 0) {
    return null;
  }

  const handleAccept = async (invitation: ReceivedProjectInvitation) => {
    setActingOn({ action: 'accept', slug: invitation.slug });
    try {
      const result = await acceptInvitationMutation.mutateAsync(invitation.slug);
      router.push(result.redirect_to || buildProjectApiSpecsRoute(result.project_id));
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    } finally {
      setActingOn(null);
    }
  };

  const handleReject = async (invitation: ReceivedProjectInvitation) => {
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
                        {invitation.project_slug}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium tracking-normal">
                        {invitation.project_name}
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
                      <Link href={buildProjectInviteRoute(invitation.slug)}>
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

function ProjectCard({
  project,
  viewMode,
  onEdit,
  onDelete,
  isDeleting,
}: {
  project: ApiProject;
  viewMode: ProjectViewMode;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const t = useT('project');
  const statsQuery = useProjectStats(project.id);
  const apiSpecsQuery = useApiSpecs({
    projectId: project.id,
    page: 1,
    pageSize: MAX_PREVIEW_SPECS,
  });
  const stats = statsQuery.data;
  const apiSpecCount = stats?.api_spec_count ?? apiSpecsQuery.data?.items?.length ?? 0;
  const environmentCount = stats?.environment_count ?? 0;
  const memberCount = stats?.member_count ?? null;
  const createdAtLabel = formatProjectTimestamp(project.created_at);
  const isLoadingStats = statsQuery.isLoading || apiSpecsQuery.isLoading;
  const isInactive = project.status !== 1;
  const menuItems = [
    {
      key: `project-edit-${project.id}`,
      label: t('projectForm.editTitle'),
      icon: Pencil,
      onSelect: onEdit,
    },
    {
      key: `project-delete-${project.id}`,
      label: t('projectForm.deleteButton'),
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
          href={buildProjectApiSpecsRoute(project.id)}
          className="grid gap-3 p-3 pr-20 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center"
        >
          <div className="flex min-w-0 items-center gap-3">
            <ProjectAvatar name={project.name} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-text-main">{project.name}</p>
                {isInactive ? (
                  <Badge variant="outline" className={COMPACT_BADGE_CLASS_NAME}>
                    {t('projectForm.inactive')}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-text-muted">{project.slug}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <ProjectMetric
              label={t('modules.apiSpecs.shortLabel')}
              value={apiSpecCount}
              loading={isLoadingStats}
            />
            <ProjectMetric
              label={t('modules.environments.shortLabel')}
              value={environmentCount}
              loading={isLoadingStats}
            />
            <ProjectMetric
              label={t('modules.members.shortLabel')}
              value={memberCount}
              loading={isLoadingStats}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {project.role ? (
              <Badge
                variant="outline"
                className={cn('bg-bg-canvas text-text-main', COMPACT_BADGE_CLASS_NAME)}
              >
                {getProjectRoleLabel(t, project.role)}
              </Badge>
            ) : null}
            <Badge variant="outline" className={cn('bg-bg-canvas', COMPACT_BADGE_CLASS_NAME)}>
              {resolvePlatformLabel(project.platform)}
            </Badge>
          </div>
        </Link>

        <ActionMenu
          items={menuItems}
          ariaLabel={t('dashboardPage.openProjectActions', { name: project.name })}
          stopPropagation
          triggerClassName="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-md bg-bg-canvas text-text-muted hover:bg-bg-subtle hover:text-text-main [&>svg]:h-3.5 [&>svg]:w-3.5"
        />
      </div>
    );
  }

  return (
    <div className="group relative min-h-[180px] rounded-lg border border-border-subtle bg-bg-canvas transition-colors hover:border-border-strong hover:bg-bg-soft">
      <Link href={buildProjectApiSpecsRoute(project.id)} className="flex h-full flex-col p-4">
        <div className="flex min-w-0 items-start gap-3 pr-6">
          <ProjectAvatar name={project.name} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-medium tracking-normal text-text-main">
                {project.name}
              </h2>
              {isInactive ? (
                <Badge variant="outline" className={COMPACT_BADGE_CLASS_NAME}>
                  {t('projectForm.inactive')}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-muted">{project.slug}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <ProjectMetric
            label={t('modules.apiSpecs.shortLabel')}
            value={apiSpecCount}
            loading={isLoadingStats}
          />
          <ProjectMetric
            label={t('modules.environments.shortLabel')}
            value={environmentCount}
            loading={isLoadingStats}
          />
          <ProjectMetric
            label={t('modules.members.shortLabel')}
            value={memberCount}
            loading={isLoadingStats}
          />
        </div>

        <div className="mt-auto flex flex-wrap items-end gap-2 pt-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {project.role ? (
                <Badge
                  variant="outline"
                  className={cn('bg-bg-canvas text-text-main', COMPACT_BADGE_CLASS_NAME)}
                >
                  {getProjectRoleLabel(t, project.role)}
                </Badge>
              ) : null}
              <Badge variant="outline" className={cn('bg-bg-canvas', COMPACT_BADGE_CLASS_NAME)}>
                {resolvePlatformLabel(project.platform)}
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
        ariaLabel={t('dashboardPage.openProjectActions', { name: project.name })}
        stopPropagation
          triggerClassName="absolute right-3 top-3 h-7 w-7 rounded-md bg-bg-canvas text-text-muted opacity-0 transition-opacity hover:bg-bg-subtle hover:text-text-main group-hover:opacity-100 data-[state=open]:opacity-100 [&>svg]:h-3.5 [&>svg]:w-3.5"
      />
    </div>
  );
}

function ProjectAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-main bg-primary text-primary-foreground">
      {initials ? (
        <span className="text-xs font-semibold tracking-normal">{initials}</span>
      ) : (
        <FolderKanban className="h-4 w-4" />
      )}
    </div>
  );
}

function ProjectMetric({
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

function ProjectCardGridSkeleton({ viewMode }: { viewMode: ProjectViewMode }) {
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

function ProjectDashboardEmptyState({
  hasProjects,
  onCreateProject,
  onCreateDemoProject,
  isCreatingDemoProject,
}: {
  hasProjects: boolean;
  onCreateProject: () => void;
  onCreateDemoProject: () => Promise<void>;
  isCreatingDemoProject: boolean;
}) {
  const t = useT('project');

  return (
    <div className="rounded-lg border border-dashed border-border-subtle bg-bg-soft p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-border-main bg-bg-canvas text-text-main">
        <FolderKanban className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-medium tracking-normal text-text-main">
        {hasProjects
          ? t('dashboardPage.noProjectsMatchedTitle')
          : t('dashboardPage.noProjectsYetTitle')}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-text-muted">
        {hasProjects
          ? t('dashboardPage.noProjectsMatched')
          : t('dashboardPage.noProjectsYetDescription')}
      </p>
      {!hasProjects ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" onClick={onCreateProject}>
            <Plus className="h-3.5 w-3.5" />
            {t('projectForm.createButton')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onCreateDemoProject()}
            loading={isCreatingDemoProject}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('dashboardPage.demoCardAction')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ProjectDashboardDemoPanel({
  onCreateProject,
  onCreateDemoProject,
  isCreatingDemoProject,
}: {
  onCreateProject: () => void;
  onCreateDemoProject: () => Promise<void>;
  isCreatingDemoProject: boolean;
}) {
  const t = useT('project');

  return (
    <div
      className="rounded-lg border border-border-subtle bg-bg-surface p-4"
      data-onboarding="demo-project-card"
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
            onClick={() => void onCreateDemoProject()}
            loading={isCreatingDemoProject}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('dashboardPage.demoCardAction')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCreateProject}>
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
