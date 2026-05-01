'use client';

import Link from 'next/link';
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { ActionMenu } from '@/components/features/project/action-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ActionMenu } from '@/components/features/project/action-menu';
import {
  DeleteProjectDialog,
  ProjectFormDialog,
  type ProjectFormMode,
  ProjectStatusBadge,
} from '@/components/features/project/project-shared';
import {
  buildProjectApiSpecsRoute,
  buildProjectCollectionsRoute,
  buildProjectDetailRoute,
  buildProjectEnvironmentsRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';
import { apiSpecKeys, useApiSpecs } from '@/hooks/use-api-specs';
import {
  projectKeys,
  useCreateProject,
  useDeleteProject,
  useProjectStats,
  useProjects,
  useUpdateProject,
} from '@/hooks/use-projects';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import { apiSpecService } from '@/services/api-spec';
import { projectService } from '@/services/project';
import type { ApiProject, CreateProjectRequest, UpdateProjectRequest } from '@/types/project';
import { formatDate } from '@/utils';

const PROJECTS_PAGE_SIZE = 1000;
const MAX_PREVIEW_SPECS = 5;
const EMPTY_PROJECTS: ApiProject[] = [];
type ProjectT = ScopedTranslations<'project'>;

const getProjectCreatedAt = (project: ApiProject) => project.created_at || '';

const sortProjectsByCreatedAtDesc = (left: ApiProject, right: ApiProject) =>
  getProjectCreatedAt(right).localeCompare(getProjectCreatedAt(left));

const normalizeProjectId = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const formatProjectTimestamp = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : formatDate(value, 'YYYY-MM-DD HH:mm');
};

const buildDashboardHref = (
  pathname: string,
  searchParams: URLSearchParams,
  previewProjectId?: string | number | null
) => {
  const nextParams = new URLSearchParams(searchParams.toString());

  if (previewProjectId) {
    nextParams.set('preview', String(previewProjectId));
  } else {
    nextParams.delete('preview');
  }

  const queryString = nextParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
};

const buildQuickRequestHref = (projectId: number | string) =>
  `${buildProjectCollectionsRoute(projectId)}?quickRequest=1`;

export function ProjectDashboardPage() {
  const i18n = useT();
  const t = i18n.project;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [formMode, setFormMode] = useState<ProjectFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiProject | null>(null);
  const hasAutoSelectedProjectRef = useRef(false);

  const deferredSearch = useDeferredValue(searchQuery);

  const projectsQuery = useProjects({ page: 1, perPage: PROJECTS_PAGE_SIZE });
  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const projects = projectsQuery.data?.items ?? EMPTY_PROJECTS;
  const previewProjectId = normalizeProjectId(searchParams.get('preview'));
  const sortedProjects = useMemo(
    () => [...projects].sort(sortProjectsByCreatedAtDesc),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return sortedProjects;
    }

    return sortedProjects
      .filter((project) =>
        [project.name, project.slug, project.platform]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery))
      );
  }, [deferredSearch, sortedProjects]);

  const selectedProject =
    previewProjectId !== null
      ? projects.find((project) => normalizeProjectId(project.id) === previewProjectId) ?? null
      : null;
  const fallbackProject = sortedProjects[0] ?? null;

  const prefetchProjectPreview = useCallback((projectId: number | string) => {
    void queryClient.prefetchQuery({
      queryKey: projectKeys.projectStats(projectId),
      queryFn: () => projectService.getStats(projectId),
    });

    void queryClient.prefetchQuery({
      queryKey: apiSpecKeys.list({ projectId, page: 1, pageSize: MAX_PREVIEW_SPECS }),
      queryFn: () =>
        apiSpecService.list({
          projectId,
          page: 1,
          pageSize: MAX_PREVIEW_SPECS,
        }),
    });
  }, [queryClient]);

  const navigateToPreview = useCallback((projectId?: string | number | null) => {
    if (projectId) {
      prefetchProjectPreview(projectId);
    }

    startTransition(() => {
      router.replace(
        buildDashboardHref(pathname, new URLSearchParams(searchParams.toString()), projectId)
      );
    });
  }, [pathname, prefetchProjectPreview, router, searchParams]);

  useEffect(() => {
    filteredProjects.slice(0, 3).forEach((project) => {
      prefetchProjectPreview(project.id);
    });
  }, [filteredProjects, prefetchProjectPreview]);

  useEffect(() => {
    if (
      hasAutoSelectedProjectRef.current ||
      projectsQuery.isLoading ||
      previewProjectId !== null ||
      !fallbackProject
    ) {
      return;
    }

    hasAutoSelectedProjectRef.current = true;
    navigateToPreview(fallbackProject.id);
  }, [fallbackProject, navigateToPreview, previewProjectId, projectsQuery.isLoading]);

  useEffect(() => {
    if (projectsQuery.isLoading || previewProjectId === null || selectedProject) {
      return;
    }

    navigateToPreview(fallbackProject?.id ?? null);
  }, [fallbackProject, navigateToPreview, previewProjectId, projectsQuery.isLoading, selectedProject]);

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
        navigateToPreview(project.id);
      } else if (editingProject) {
        await updateProjectMutation.mutateAsync({
          id: editingProject.id,
          data: payload as UpdateProjectRequest,
        });
        navigateToPreview(editingProject.id);
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
      <aside className="w-full shrink-0 border-b border-border/60 bg-bg-surface/70 lg:w-[296px] lg:border-b-0 lg:border-r">
        <div className="flex h-full max-h-[42vh] flex-col overflow-hidden lg:max-h-none">
          <div className="space-y-4 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('dashboardPage.searchPlaceholder')}
                className="pl-9"
              />
            </div>

            <Button type="button" onClick={openCreateDialog} className="w-full">
              <Plus className="h-4 w-4" />
              {t('projectForm.createButton')}
            </Button>
          </div>

          <Separator />

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-3 flex items-center justify-between px-2 text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
              <span>{t('dashboardPage.projectsLabel')}</span>
              <span>{filteredProjects.length}</span>
            </div>

            {projectsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-border/60 bg-background/60 p-3"
                  >
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="mt-2 h-3 w-40 animate-pulse rounded bg-muted" />
                    <div className="mt-3 h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : projectsQuery.error ? (
              <Alert>
                <AlertTitle>{t('dashboardPage.loadFailedTitle')}</AlertTitle>
                <AlertDescription>
                  {t('dashboardPage.loadFailedDescription')}
                </AlertDescription>
              </Alert>
            ) : filteredProjects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-6 text-sm text-text-muted">
                  {projects.length === 0
                    ? t('dashboardPage.noProjectsYet')
                    : t('dashboardPage.noProjectsMatched')}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map((project) => {
                  const isActive = project.id === selectedProject?.id;
                  const menuItems = [
                    {
                      key: `project-edit-${project.id}`,
                      label: t('projectForm.editTitle'),
                      icon: Pencil,
                      onSelect: () => openEditDialog(project),
                    },
                    {
                      key: `project-delete-${project.id}`,
                      label: t('projectForm.deleteButton'),
                      icon: Trash2,
                      destructive: true,
                      separatorBefore: true,
                      disabled: deleteProjectMutation.isPending,
                      onSelect: () => setDeleteTarget(project),
                    },
                  ];

                  return (
                    <div
                      key={project.id}
                      onMouseEnter={() => prefetchProjectPreview(project.id)}
                      onTouchStart={() => prefetchProjectPreview(project.id)}
                      className={`group w-full rounded-2xl border p-3 text-left transition-colors ${
                        isActive
                          ? 'border-primary/30 bg-primary/10 shadow-sm'
                          : 'border-transparent bg-background/60 hover:border-border/60 hover:bg-background'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => navigateToPreview(project.id)}
                          onFocus={() => prefetchProjectPreview(project.id)}
                          aria-pressed={isActive}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-main">{project.name}</p>
                            <p className="truncate text-xs text-text-muted">{project.slug}</p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
                            {isActive ? (
                              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                                {t('dashboardPage.selected')}
                              </Badge>
                            ) : null}
                            {project.created_at ? (
                              <span>
                                {t('dashboardPage.createdAt', {
                                  value: formatDate(project.created_at, 'YYYY-MM-DD'),
                                })}
                              </span>
                            ) : null}
                            {!isActive ? (
                              <span className="transition-opacity group-hover:opacity-100 lg:opacity-0">
                                {t('dashboardPage.preview')}
                              </span>
                            ) : null}
                          </div>
                        </button>
                        <ActionMenu
                          items={menuItems}
                          ariaLabel={t('common.openActions')}
                          stopPropagation
                          triggerClassName={
                            isActive
                              ? 'h-8 w-8 shrink-0 rounded-full text-primary hover:bg-primary/10'
                              : 'h-8 w-8 shrink-0 rounded-full text-text-muted hover:bg-muted'
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="space-y-6 p-4 md:p-6">
          {selectedProject ? (
            <ProjectPreviewPanel
              project={selectedProject}
              onEdit={() => openEditDialog(selectedProject)}
            />
          ) : (
            <ProjectDashboardWelcome
              projects={projects}
              onOpenProject={navigateToPreview}
              onCreateProject={openCreateDialog}
            />
          )}
        </div>
      </main>

      <ProjectFormDialog
        open={isFormOpen}
        mode={formMode}
        project={editingProject}
        isSubmitting={
          createProjectMutation.isPending ||
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
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}

function ProjectDashboardWelcome({
  projects,
  onOpenProject,
  onCreateProject,
}: {
  projects: ApiProject[];
  onOpenProject: (projectId?: string | number | null) => void;
  onCreateProject: () => void;
}) {
  const t = useT('project');
  const recentProjects = [...projects]
    .sort(sortProjectsByCreatedAtDesc)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/10 bg-linear-to-br from-primary/10 via-transparent to-transparent">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                {t('dashboardPage.startHere')}
              </Badge>
              <CardTitle className="text-2xl tracking-tight">
                {t('dashboardPage.heroTitle')}
              </CardTitle>
              <CardDescription className="max-w-3xl">
                {t('dashboardPage.heroDescription')}
              </CardDescription>
            </div>

            <Button type="button" onClick={onCreateProject}>
              <Plus className="h-4 w-4" />
              {t('projectForm.createButton')}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>{t('dashboardPage.createFirstProjectTitle')}</CardTitle>
            <CardDescription>{t('dashboardPage.createFirstProjectDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentProjects.length === 0 ? (
              <Alert>
                <AlertTitle>{t('dashboardPage.noProjectsYetTitle')}</AlertTitle>
                <AlertDescription>{t('dashboardPage.noProjectsYetDescription')}</AlertDescription>
              </Alert>
            ) : (
              recentProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onOpenProject(project.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-left transition-colors hover:border-primary/20 hover:bg-background"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="truncate text-xs text-text-muted">
                      {project.slug}
                    </p>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed border-border/70">
          <CardHeader>
            <CardTitle>{t('dashboardPage.twoWaysTitle')}</CardTitle>
            <CardDescription>{t('dashboardPage.twoWaysDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-muted">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="font-medium text-text-main">{t('dashboardPage.aiStartTitle')}</p>
              <p className="mt-1">{t('dashboardPage.aiStartDescription')}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="font-medium text-text-main">{t('dashboardPage.quickRequestTitle')}</p>
              <p className="mt-1">{t('dashboardPage.quickRequestDescription')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProjectPreviewPanel({
  project,
  onEdit,
}: {
  project: ApiProject;
  onEdit: () => void;
}) {
  const t = useT('project');
  const [slowPreviewKey, setSlowPreviewKey] = useState('');
  const statsQuery = useProjectStats(project.id);
  const apiSpecsQuery = useApiSpecs({
    projectId: project.id,
    page: 1,
    pageSize: MAX_PREVIEW_SPECS,
  });

  const projectDetail = project;
  const apiSpecs = apiSpecsQuery.data?.items ?? [];
  const stats = statsQuery.data;
  const apiSpecCount = stats?.api_spec_count ?? apiSpecs.length;
  const environmentCount = stats?.environment_count ?? 0;
  const memberCount = stats?.member_count ?? 0;
  const createdAtLabel = formatProjectTimestamp(projectDetail.created_at);
  const hasResolvedReadiness = Boolean(stats);
  const hasReadinessError =
    !hasResolvedReadiness &&
    Boolean(statsQuery.error);
  const slowPreviewLoadKey = `${project.id}:${statsQuery.fetchStatus}:${statsQuery.dataUpdatedAt}`;
  const isSlowPreview =
    !hasResolvedReadiness &&
    !hasReadinessError &&
    slowPreviewKey === slowPreviewLoadKey;
  const nextStep = hasResolvedReadiness
    ? resolveDashboardNextStep({
        t,
        projectId: project.id,
        apiSpecCount,
        environmentCount,
      })
    : null;
  const readinessItems = hasResolvedReadiness
    ? ([
        {
          label: t('dashboardPage.sourceOfTruthLabel'),
          value:
            apiSpecCount > 0
              ? t('dashboardPage.sourceOfTruthReadyValue', { count: apiSpecCount })
              : t('projectDetail.missing'),
          tone: apiSpecCount > 0 ? 'ready' : 'pending',
          detail:
            apiSpecCount > 0
              ? t('dashboardPage.sourceOfTruthReadyDetail')
              : t('dashboardPage.sourceOfTruthMissingDetail'),
        },
        {
          label: t('dashboardPage.runtimeContextLabel'),
          value:
            environmentCount > 0
              ? t('dashboardPage.runtimeContextReadyValue', { count: environmentCount })
              : t('projectDetail.missing'),
          tone: environmentCount > 0 ? 'ready' : 'pending',
          detail:
            environmentCount > 0
              ? t('dashboardPage.runtimeContextReadyDetail')
              : t('dashboardPage.runtimeContextMissingDetail'),
        },
        {
          label: t('dashboardPage.validationLabel'),
          value:
            apiSpecCount > 0 && environmentCount > 0
              ? t('dashboardPage.validationReadyValue')
              : t('dashboardPage.validationPendingValue'),
          tone: apiSpecCount > 0 && environmentCount > 0 ? 'ready' : 'pending',
          detail:
            apiSpecCount > 0 && environmentCount > 0
              ? t('dashboardPage.validationReadyDetail')
              : t('dashboardPage.validationPendingDetail'),
        },
      ] as const)
    : [];

  const handleRetryPreview = () => {
    void statsQuery.refetch();
    void apiSpecsQuery.refetch();
  };

  useEffect(() => {
    if (hasResolvedReadiness || hasReadinessError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSlowPreviewKey(slowPreviewLoadKey);
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasReadinessError, hasResolvedReadiness, slowPreviewLoadKey]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/60 bg-linear-to-r from-background via-background to-primary/5">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ProjectStatusBadge status={projectDetail.status} />
              </div>
              <div>
                <CardTitle className="text-2xl tracking-tight">{projectDetail.name}</CardTitle>
                <CardDescription className="mt-2 max-w-3xl text-sm leading-6">
                  {hasReadinessError
                    ? t('dashboardPage.previewSummaryFailed')
                    : isSlowPreview
                      ? t('dashboardPage.previewSummarySlow')
                    : nextStep?.summary ??
                        t('dashboardPage.previewSummaryLoading')}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-sm text-text-muted">
                <span>{t('dashboardPage.slugLabel', { value: projectDetail.slug })}</span>
                {createdAtLabel ? (
                  <span>{t('dashboardPage.createdAt', { value: createdAtLabel })}</span>
                ) : null}
                {typeof stats?.member_count === 'number' ? (
                  <span>
                    {t('dashboardPage.teamMembers', { count: memberCount })}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="h-auto px-0 text-sm text-text-muted hover:bg-transparent hover:text-text-main"
                >
                  {t('dashboardPage.editDetails')}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isSlowPreview && !nextStep && !hasReadinessError ? (
                <Button asChild>
                  <Link href={buildProjectCollectionsRoute(project.id)}>
                    {t('projectDetail.quickRequest')}
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href={buildProjectDetailRoute(project.id)}>
                  {t('projectDetail.openWorkspace')}
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>{t('dashboardPage.progressTitle')}</CardTitle>
            <CardDescription>{t('dashboardPage.progressDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasReadinessError ? (
              <Alert>
                <AlertTitle>{t('dashboardPage.readinessLoadFailedTitle')}</AlertTitle>
                <AlertDescription className="mt-2">
                  {t('dashboardPage.readinessLoadFailedDescription')}
                </AlertDescription>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={handleRetryPreview}>
                  {t('dashboardPage.retryPreview')}
                </Button>
              </Alert>
            ) : !hasResolvedReadiness ? (
              <>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-18 animate-pulse rounded-2xl border border-border/60 bg-muted/40"
                    />
                  ))}
                </div>
                {isSlowPreview ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-text-muted">
                    <span>{t('dashboardPage.stillLoadingReadiness')}</span>
                    <Button type="button" variant="outline" size="sm" onClick={handleRetryPreview}>
                      {t('common.refresh')}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              readinessItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/60 bg-background/70 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-text-main">{item.label}</p>
                      <p className="mt-1 text-sm text-text-muted">{item.detail}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        item.tone === 'ready'
                          ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700'
                          : 'border-amber-200 bg-amber-500/10 text-amber-700'
                      }
                    >
                      {item.value}
                    </Badge>
                  </div>
                </div>
              ))
            )}

            {apiSpecsQuery.isLoading ? (
              <div className="space-y-2 pt-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : apiSpecs.length > 0 ? (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-main">{t('dashboardPage.recentApiSpecsTitle')}</p>
                    <p className="mt-1 text-sm text-text-muted">
                      {t('dashboardPage.recentApiSpecsDescription')}
                    </p>
                  </div>
                  <Button asChild variant="ghost" className="px-0">
                    <Link href={buildProjectApiSpecsRoute(project.id)}>
                      {t('projectDetail.reviewApiSpecs')}
                    </Link>
                  </Button>
                </div>

                <div className="space-y-2">
                  {apiSpecs.slice(0, 3).map((spec) => (
                    <div
                      key={spec.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {spec.method} {spec.path}
                        </p>
                        <p className="truncate text-xs text-text-muted">
                          {spec.summary || spec.description || t('common.noSummaryProvided')}
                        </p>
                      </div>
                      <Badge variant="outline">{spec.version}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-linear-to-br from-primary/5 via-background to-background">
          <CardHeader>
            <CardTitle>
              {hasReadinessError
                ? t('dashboardPage.previewNeedsAttention')
                : isSlowPreview && !nextStep
                  ? t('dashboardPage.moveNowRefineLater')
                  : nextStep?.title ?? t('dashboardPage.loadingNextStep')}
            </CardTitle>
            <CardDescription>
              {hasReadinessError
                ? t('dashboardPage.previewNeedsAttentionDescription')
                : isSlowPreview && !nextStep
                  ? t('dashboardPage.moveNowRefineLaterDescription')
                : nextStep?.description ??
                    t('dashboardPage.recommendationLoadingDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasReadinessError ? (
              <Alert>
                <AlertTitle>{t('dashboardPage.recommendationUnavailableTitle')}</AlertTitle>
                <AlertDescription className="mt-2">
                  {t('dashboardPage.recommendationUnavailableDescription')}
                </AlertDescription>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleRetryPreview}>
                    {t('dashboardPage.retryPreview')}
                  </Button>
                  <Button asChild size="sm">
                    <Link href={buildProjectDetailRoute(project.id)}>
                      {t('projectDetail.openWorkspace')}
                    </Link>
                  </Button>
                </div>
              </Alert>
            ) : !nextStep ? (
              <>
                <div className="space-y-3">
                  <div className="h-28 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
                  <div className="h-40 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
                </div>
                {isSlowPreview ? (
                  <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-background/70 p-4">
                    <p className="text-sm text-text-muted">
                      {t('dashboardPage.recommendationSlowDescription')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={buildProjectCollectionsRoute(project.id)}>
                          {t('projectDetail.quickRequest')}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={buildProjectDetailRoute(project.id)}>
                          {t('projectDetail.openWorkspace')}
                        </Link>
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleRetryPreview}>
                        {t('common.refresh')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                    {t('dashboardPage.whyNow')}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-text-muted">{nextStep.reason}</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                    {t('dashboardPage.unlockTitle')}
                  </p>
                  <div className="mt-3 space-y-3">
                    {nextStep.blockers.map((blocker) => (
                      <div key={blocker.label} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-text-main">{blocker.label}</p>
                          <p className="mt-1 text-sm text-text-muted">{blocker.detail}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            blocker.tone === 'ready'
                              ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700'
                              : 'border-amber-200 bg-amber-500/10 text-amber-700'
                          }
                        >
                          {blocker.state}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={nextStep.primaryHref}>
                      {nextStep.primaryLabel}
                    </Link>
                  </Button>
                  {nextStep.secondaryHref && nextStep.secondaryLabel ? (
                    <Button asChild variant="outline">
                      <Link href={nextStep.secondaryHref}>
                        {nextStep.secondaryLabel}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function resolveDashboardNextStep({
  t,
  projectId,
  apiSpecCount,
  environmentCount,
}: {
  t: ProjectT;
  projectId: number | string;
  apiSpecCount: number;
  environmentCount: number;
}) {
  if (apiSpecCount === 0) {
    return {
      summary: t('dashboardPage.noApiSpecSummary'),
      title: t('dashboardPage.noApiSpecTitle'),
      description: t('dashboardPage.noApiSpecDescription'),
      reason: t('dashboardPage.noApiSpecReason'),
      primaryHref: `${buildProjectApiSpecsRoute(projectId)}?ai=create`,
      primaryLabel: t('projectDetail.aiDraftApi'),
      secondaryHref: buildQuickRequestHref(projectId),
      secondaryLabel: t('projectDetail.quickRequest'),
      blockers: [
        {
          label: t('dashboardPage.apiSourceLabel'),
          detail: t('dashboardPage.apiSourceMissingDetail'),
          state: t('projectDetail.missing'),
          tone: 'pending' as const,
        },
        {
          label: t('dashboardPage.runtimeSetupLabel'),
          detail: t('dashboardPage.runtimeSetupCanWait'),
          state: t('dashboardPage.notStarted'),
          tone: 'pending' as const,
        },
      ],
    };
  }

  if (environmentCount === 0) {
    return {
      summary: t('dashboardPage.firstEnvironmentSummary', { count: apiSpecCount }),
      title: t('dashboardPage.firstEnvironmentTitle'),
      description: t('dashboardPage.firstEnvironmentDescription'),
      reason: t('dashboardPage.firstEnvironmentReason'),
      primaryHref: buildProjectEnvironmentsRoute(projectId),
      primaryLabel: t('projectDetail.configureEnvironment'),
      secondaryHref: buildProjectApiSpecsRoute(projectId),
      secondaryLabel: t('projectDetail.reviewApiSpecs'),
      blockers: [
        {
          label: t('dashboardPage.executionTargetLabel'),
          detail: t('dashboardPage.executionTargetMissingDetail'),
          state: t('projectDetail.missing'),
          tone: 'pending' as const,
        },
        {
          label: t('dashboardPage.apiSourceLabel'),
          detail: t('dashboardPage.specBaselineReadyDetail', { count: apiSpecCount }),
          state: t('projectDetail.ready'),
          tone: 'ready' as const,
        },
      ],
    };
  }

  return {
    summary: t('dashboardPage.coverageSummary', {
      apiSpecCount,
      environmentCount,
    }),
    title: t('dashboardPage.coverageTitle'),
    description: t('dashboardPage.coverageDescription'),
    reason: t('dashboardPage.coverageReason'),
    primaryHref: buildProjectTestCasesRoute(projectId),
    primaryLabel: t('apiSpecs.openTestCases'),
    secondaryHref: buildQuickRequestHref(projectId),
    secondaryLabel: t('projectDetail.quickRequest'),
    blockers: [
      {
        label: t('dashboardPage.apiSourceLabel'),
        detail: t('dashboardPage.apiSourceReadyDetail'),
        state: t('projectDetail.ready'),
        tone: 'ready' as const,
      },
      {
        label: t('dashboardPage.runtimeSetupLabel'),
        detail: t('dashboardPage.runtimeSetupReadyDetail', { count: environmentCount }),
        state: t('projectDetail.ready'),
        tone: 'ready' as const,
      },
    ],
  };
}
