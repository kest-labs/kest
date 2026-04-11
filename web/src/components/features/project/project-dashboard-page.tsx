'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  FileJson2,
  FolderKanban,
  Globe,
  Plus,
  Search,
  Tags,
  Trash2,
  Users,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { StatCard, StatCardSkeleton } from '@/components/features/console/dashboard-stats';
import { flattenProjectCategories } from '@/components/features/project/category-helpers';
import {
  DeleteProjectDialog,
  ProjectFormDialog,
  type ProjectFormMode,
  ProjectStatusBadge,
  resolvePlatformLabel,
} from '@/components/features/project/project-shared';
import {
  buildProjectApiSpecsRoute,
  buildProjectCategoriesRoute,
  buildProjectDetailRoute,
  buildProjectEnvironmentsRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';
import { useApiSpecs } from '@/hooks/use-api-specs';
import { useProjectCategories } from '@/hooks/use-categories';
import { useEnvironments } from '@/hooks/use-environments';
import {
  useCreateProject,
  useDeleteProject,
  useProject,
  useProjectStats,
  useProjects,
  useUpdateProject,
} from '@/hooks/use-projects';
import type { ApiProject, CreateProjectRequest, UpdateProjectRequest } from '@/types/project';
import { formatDate } from '@/utils';

const PROJECTS_PAGE_SIZE = 1000;
const MAX_PREVIEW_SPECS = 5;
const EMPTY_PROJECTS: ApiProject[] = [];

const getProjectCreatedAt = (project: ApiProject) => project.created_at || '';

const sortProjectsByCreatedAtDesc = (left: ApiProject, right: ApiProject) =>
  getProjectCreatedAt(right).localeCompare(getProjectCreatedAt(left));

const formatProjectCreatedAt = (project: ApiProject) =>
  project.created_at ? formatDate(project.created_at, 'YYYY-MM-DD') : 'Unknown';

const parseProjectId = (value: string | null) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

const buildDashboardHref = (
  pathname: string,
  searchParams: URLSearchParams,
  previewProjectId?: number | null
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

export function ProjectDashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [formMode, setFormMode] = useState<ProjectFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiProject | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);

  const projectsQuery = useProjects({ page: 1, perPage: PROJECTS_PAGE_SIZE });
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const projects = projectsQuery.data?.items ?? EMPTY_PROJECTS;
  const previewProjectId = parseProjectId(searchParams.get('preview'));

  const filteredProjects = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) =>
      [project.name, project.slug, project.platform]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSearch, projects]);

  const selectedProject =
    previewProjectId !== null
      ? projects.find((project) => project.id === previewProjectId) ?? null
      : null;

  const navigateToPreview = (projectId?: number | null) => {
    router.replace(buildDashboardHref(pathname, new URLSearchParams(searchParams.toString()), projectId));
  };

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

      if (previewProjectId === deleteTarget.id) {
        navigateToPreview(null);
      }

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
            <div className="rounded-2xl border border-primary/10 bg-linear-to-br from-primary/10 via-primary/5 to-transparent p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                    Project Dashboard
                  </p>
                  <h1 className="mt-2 text-xl font-semibold tracking-tight">All projects</h1>
                  <p className="mt-1 text-sm text-text-muted">
                    Preview projects here, then enter the scoped workspace when you are ready to work.
                  </p>
                </div>
                <div className="rounded-2xl bg-background/70 p-3 text-primary shadow-sm">
                  <FolderKanban className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search projects"
                className="pl-9"
              />
            </div>

            <Button type="button" onClick={openCreateDialog} className="w-full">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>

          <Separator />

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-3 flex items-center justify-between px-2 text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
              <span>Projects</span>
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
                <AlertTitle>Unable to load projects</AlertTitle>
                <AlertDescription>
                  The dashboard could not load the project list from the current API.
                </AlertDescription>
              </Alert>
            ) : filteredProjects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-6 text-sm text-text-muted">
                  {projects.length === 0
                    ? 'No projects are available yet. Create the first project to populate the dashboard.'
                    : 'No projects match the current search keyword.'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map((project) => {
                  const isActive = project.id === selectedProject?.id;

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => navigateToPreview(project.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                        isActive
                          ? 'border-primary/30 bg-primary/10 shadow-sm'
                          : 'border-transparent bg-background/60 hover:border-border/60 hover:bg-background'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-main">{project.name}</p>
                          <p className="truncate text-xs text-text-muted">{project.slug}</p>
                        </div>
                        <ProjectStatusBadge status={project.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
                        <Badge variant="outline">{resolvePlatformLabel(project.platform)}</Badge>
                        <span>Created {formatProjectCreatedAt(project)}</span>
                      </div>
                    </button>
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
              onDelete={() => setDeleteTarget(selectedProject)}
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
        isSubmitting={createProjectMutation.isPending || updateProjectMutation.isPending}
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
  onOpenProject: (projectId?: number | null) => void;
  onCreateProject: () => void;
}) {
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
                Dashboard overview
              </Badge>
              <CardTitle className="text-2xl tracking-tight">
                Choose a project and continue where work happens
              </CardTitle>
              <CardDescription className="max-w-3xl">
                The left sidebar is your project inventory. The right panel is a launchpad:
                inspect the project, then jump into AI-assisted API Specs, Environments, or Test Cases.
              </CardDescription>
            </div>

            <Button type="button" onClick={onCreateProject}>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Recent projects</CardTitle>
            <CardDescription>
              Start by previewing one of the projects below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentProjects.length === 0 ? (
              <Alert>
                <AlertTitle>No projects yet</AlertTitle>
                <AlertDescription>
                  Use the create action to seed the dashboard with your first project.
                </AlertDescription>
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
                      {project.slug} · {resolvePlatformLabel(project.platform)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-muted" />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed border-border/70">
          <CardHeader>
            <CardTitle>Recommended workflow</CardTitle>
            <CardDescription>
              Keep the user journey simple: define interfaces, set runtime context, then validate behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-muted">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="font-medium text-text-main">1. Define interfaces</p>
              <p className="mt-1">Start in API Specs and use AI draft to turn product intent into a structured endpoint.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="font-medium text-text-main">2. Configure runtime context</p>
              <p className="mt-1">Add Environments and Collections once requests need real endpoints and reusable drafts.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="font-medium text-text-main">3. Validate and iterate</p>
              <p className="mt-1">Move to Test Cases after the spec and environment baseline is clear.</p>
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
  onDelete,
}: {
  project: ApiProject;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const projectQuery = useProject(project.id);
  const statsQuery = useProjectStats(project.id);
  const environmentsQuery = useEnvironments(project.id);
  const apiSpecsQuery = useApiSpecs({
    projectId: project.id,
    page: 1,
    pageSize: MAX_PREVIEW_SPECS,
  });
  const categoriesQuery = useProjectCategories({
    projectId: project.id,
    tree: true,
  });

  const projectDetail = projectQuery.data ?? project;
  const environments = environmentsQuery.data?.items ?? [];
  const apiSpecs = apiSpecsQuery.data?.items ?? [];
  const flatCategories = flattenProjectCategories(categoriesQuery.data?.items);
  const categoryCount = categoriesQuery.data?.total ?? flatCategories.length;
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/60 bg-linear-to-r from-background via-background to-primary/5">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  Dashboard preview
                </Badge>
                <ProjectStatusBadge status={projectDetail.status} />
                <Badge variant="outline">{resolvePlatformLabel(projectDetail.platform)}</Badge>
                <Badge variant="outline" className="font-mono">
                  {projectDetail.slug}
                </Badge>
              </div>
              <div>
                <CardTitle className="text-2xl tracking-tight">{projectDetail.name}</CardTitle>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={buildProjectDetailRoute(project.id)}>
                  Project Overview
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${buildProjectApiSpecsRoute(project.id)}?ai=create`}>
                  AI Draft API
                </Link>
              </Button>
              <Button type="button" variant="outline" onClick={onEdit}>
                Edit Project
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="API Specs"
              value={stats?.api_spec_count ?? apiSpecs.length}
              description="Saved API definitions"
              icon={FileJson2}
              variant="primary"
            />
            <StatCard
              title="Environments"
              value={stats?.environment_count ?? environments.length}
              description="Configured runtime targets"
              icon={Globe}
            />
            <StatCard
              title="Categories"
              value={stats?.category_count ?? categoryCount}
              description="Tree groups available in this project"
              icon={Tags}
              variant="success"
            />
            <StatCard
              title="Members"
              value={stats?.member_count ?? '0'}
              description="People who can work in this project"
              icon={Users}
              variant="warning"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Environments summary</CardTitle>
            <CardDescription>
              Preview available environments before entering the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {environmentsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : environments.length === 0 ? (
              <EmptyPreviewState
                title="No environments yet"
                description="Add at least one base URL and shared variables before running requests against real targets."
                actionHref={`${buildProjectEnvironmentsRoute(project.id)}?mode=manage`}
                actionLabel="Manage environments"
              />
            ) : (
              <>
                {environments.slice(0, 4).map((environment) => (
                  <div
                    key={environment.id}
                    className="rounded-2xl border border-border/60 bg-background/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {environment.display_name || environment.name}
                        </p>
                        <p className="truncate text-xs text-text-muted">{environment.base_url || 'Base URL not set'}</p>
                      </div>
                      <Badge variant="outline">
                        {Object.keys(environment.variables || {}).length} vars
                      </Badge>
                    </div>
                  </div>
                ))}
                <Button asChild variant="ghost" className="px-0">
                  <Link href={buildProjectEnvironmentsRoute(project.id)}>
                    Open environments workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>API specs summary</CardTitle>
            <CardDescription>
              Preview specs here. Enter the project to inspect individual records in the content area.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {apiSpecsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : apiSpecs.length === 0 ? (
              <EmptyPreviewState
                title="No API specs yet"
                description="Import or define the project's APIs first so documentation and tests have a stable source of truth."
                actionHref={`${buildProjectApiSpecsRoute(project.id)}?mode=manage`}
                actionLabel="Manage API specs"
              />
            ) : (
              <>
                {apiSpecs.map((spec) => (
                  <div
                    key={spec.id}
                    className="rounded-2xl border border-border/60 bg-background/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {spec.method} {spec.path}
                        </p>
                        <p className="truncate text-xs text-text-muted">
                          {spec.summary || spec.description || 'No summary provided'}
                        </p>
                      </div>
                      <Badge variant="outline">{spec.version}</Badge>
                    </div>
                  </div>
                ))}
                <Button asChild variant="ghost" className="px-0">
                  <Link href={buildProjectApiSpecsRoute(project.id)}>
                    Open API specs workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Categories summary</CardTitle>
            <CardDescription>
              Nested categories remain previewable here and become itemized in the workspace sidebar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoriesQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : flatCategories.length === 0 ? (
              <EmptyPreviewState
                title="No categories yet"
                description="Create categories only when the surface area is large enough to need taxonomy and ownership grouping."
                actionHref={`${buildProjectCategoriesRoute(project.id)}?mode=manage`}
                actionLabel="Manage categories"
              />
            ) : (
              <>
                {flatCategories.slice(0, 5).map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {category.depth > 0 ? `${'· '.repeat(category.depth)}${category.name}` : category.name}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {category.description || 'No description provided'}
                      </p>
                    </div>
                    <Badge variant="outline">#{category.sort_order}</Badge>
                  </div>
                ))}
                <Button asChild variant="ghost" className="px-0">
                  <Link href={buildProjectCategoriesRoute(project.id)}>
                    Open categories workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Recommended next steps</CardTitle>
              <CardDescription>
                Use the current project state to decide what the next operator action should be.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm font-medium text-text-main">Build the source of truth</p>
                <p className="mt-1 text-sm text-text-muted">
                  {apiSpecs.length === 0
                    ? 'The project should start in API Specs with AI draft. There is no interface inventory yet.'
                    : 'The project already has API Specs. Expand or refine them before generating test coverage.'}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm font-medium text-text-main">Prepare runtime configuration</p>
                <p className="mt-1 text-sm text-text-muted">
                  {environments.length === 0
                    ? 'No environments are configured. Add development or staging targets before execution starts.'
                    : 'Environment setup exists. Keep headers and variables current so test runs stay reproducible.'}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm font-medium text-text-main">Move into validation</p>
                <p className="mt-1 text-sm text-text-muted">
                  Open Test Cases once the interface and environment baseline are stable enough to automate.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`${buildProjectApiSpecsRoute(project.id)}?ai=create`}>
                    AI Draft API
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={buildProjectEnvironmentsRoute(project.id)}>
                    Environments
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={buildProjectTestCasesRoute(project.id)}>
                    Test Cases
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmptyPreviewState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5">
      <p className="text-sm font-medium text-text-main">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
