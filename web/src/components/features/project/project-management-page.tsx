'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  BarChart3,
  Boxes,
  FileJson2,
  FlaskConical,
  FolderKanban,
  Globe,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionMenu, type ActionMenuItem } from '@/components/features/project/action-menu';
import { Input } from '@/components/ui/input';
import {
  DeleteProjectDialog,
  type ProjectFormMode,
  ProjectFormDialog,
  ProjectStatusBadge,
  resolvePlatformLabel,
} from '@/components/features/project/project-shared';
import { StatCard, StatCardSkeleton } from '@/components/features/console/dashboard-stats';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buildApiPath } from '@/config/api';
import {
  buildProjectApiSpecsRoute,
  buildProjectCategoriesRoute,
  buildProjectDetailRoute,
  buildProjectEnvironmentsRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '@/hooks/use-projects';
import type { ApiProject, CreateProjectRequest, UpdateProjectRequest } from '@/types/project';
import { formatDate } from '@/utils';

const PAGE_SIZE = 12;
const EMPTY_PROJECTS: ApiProject[] = [];

/**
 * 项目管理主页面。
 * 作用：
 * 1. 展示当前登录用户可见的项目列表
 * 2. 提供项目的增删改查入口
 * 3. 提供跳转到项目详情页、环境页、API 规格页和测试用例页的入口
 * 4. 复用控制台视觉风格，让 `/project` 与 `/console` 保持一致
 */
export function ProjectManagementPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [formMode, setFormMode] = useState<ProjectFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiProject | null>(null);

  const projectsQuery = useProjects({ page, perPage: PAGE_SIZE });
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const projects = projectsQuery.data?.items ?? EMPTY_PROJECTS;
  // 这里仍然是当前页本地过滤：
  // 后端项目列表接口目前只有分页，没有 search 参数。
  const filteredProjects = projects.filter((project) => {
    if (!searchQuery.trim()) {
      return true;
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    return (
      project.name.toLowerCase().includes(normalizedQuery) ||
      project.slug.toLowerCase().includes(normalizedQuery) ||
      project.platform.toLowerCase().includes(normalizedQuery)
    );
  });

  const canGoPrev = page > 1;
  const canGoNext = page < (projectsQuery.data?.meta.pages || 1);
  const totalProjects = projectsQuery.data?.meta.total || 0;
  const activeOnPage = projects.filter((project) => project.status === 1).length;
  const inactiveOnPage = projects.filter((project) => project.status === 0).length;

  const projectsPath = buildApiPath('/projects');
  const projectDetailPath = buildApiPath('/projects/:id');
  const projectStatsPath = buildApiPath('/projects/:id/stats');
  const headerActionItems: ActionMenuItem[] = [
    {
      key: 'refresh',
      label: projectsQuery.isFetching && !projectsQuery.isLoading ? 'Refreshing...' : 'Refresh',
      icon: RefreshCw,
      disabled: projectsQuery.isFetching && !projectsQuery.isLoading,
      onSelect: () => {
        void projectsQuery.refetch();
      },
    },
  ];

  // 打开创建弹窗时显式清空编辑态，避免沿用上一条记录的数据。
  const openCreateDialog = () => {
    setFormMode('create');
    setEditingProject(null);
    setIsFormOpen(true);
  };

  // 编辑弹窗复用共享表单组件，这里只负责切换到 edit 模式并注入当前项目。
  const openEditDialog = (project: ApiProject) => {
    setFormMode('edit');
    setEditingProject(project);
    setIsFormOpen(true);
  };

  // 创建和更新统一走一个提交入口：
  // 根据当前模式决定调用 create 还是 update。
  const handleProjectSubmit = async (payload: CreateProjectRequest | UpdateProjectRequest) => {
    try {
      if (formMode === 'create') {
        await createProjectMutation.mutateAsync(payload as CreateProjectRequest);
        setPage(1);
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

  // 删除后如果当前页只剩一条记录，则回退一页，避免停留在空分页。
  const handleDeleteProject = async () => {
    if (!deleteTarget) {
      return;
    }

    const shouldStepBackPage = projects.length === 1 && page > 1;

    try {
      await deleteProjectMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);

      if (shouldStepBackPage) {
        setPage((currentPage) => currentPage - 1);
      }
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  return (
    <div className="flex-1 space-y-8 p-6 pt-6">
      <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-linear-to-r from-primary/10 via-cyan-500/5 to-transparent p-6 transition-colors duration-500">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0xOCAxOGgyNHYyNEgxOHoiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Project Workspace</h1>
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <p className="max-w-3xl text-sm text-text-muted">
              Logged-in users can create, inspect, update, and delete projects through
              {' '}
              <code>{projectsPath}</code>
              {' '}
              and jump to dedicated overview, environment, API specification, and test case pages
              for each project.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
            <ActionMenu
              items={headerActionItems}
              ariaLabel="Open project page actions"
              triggerVariant="outline"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {projectsQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Projects"
              value={totalProjects}
              description={`Across ${projectsQuery.data?.meta.pages || 0} pages`}
              icon={FolderKanban}
              variant="primary"
            />
            <StatCard
              title="Active On This Page"
              value={activeOnPage}
              description={`Visible in page ${projectsQuery.data?.meta.page || page}`}
              icon={ShieldCheck}
              variant="success"
            />
            <StatCard
              title="Inactive On This Page"
              value={inactiveOnPage}
              description="Projects currently paused or disabled"
              icon={Layers3}
              variant="warning"
            />
            <StatCard
              title="Filtered Results"
              value={filteredProjects.length}
              description={
                searchQuery.trim() ? `Local filter: "${searchQuery.trim()}"` : 'Showing current page results'
              }
              icon={Boxes}
            />
          </>
        )}
      </div>

      <Card className="overflow-hidden border-border/50 shadow-premium">
        <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              {projectsQuery.data?.meta
                ? `Page ${projectsQuery.data.meta.page} of ${projectsQuery.data.meta.pages}, ${projectsQuery.data.meta.total} total projects`
                : `Connected to GET ${projectsPath}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {projectsQuery.isFetching && !projectsQuery.isLoading ? <span>Refreshing…</span> : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter current page by name, slug, or platform"
              leftIcon={<Search className="size-4" />}
            />
            <div className="text-xs text-muted-foreground">
              项目详情和 stats 已迁移到单独页面，列表页只保留概览入口和 CRUD 操作。
            </div>
          </div>

          {projectsQuery.isLoading ? (
            <div className="space-y-3">
              <div className="h-14 animate-pulse rounded-xl bg-muted" />
              <div className="h-14 animate-pulse rounded-xl bg-muted" />
              <div className="h-14 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow key={project.id} className="transition-colors hover:bg-muted/20">
                        <TableCell className="min-w-[220px]">
                          <Link
                            href={buildProjectDetailRoute(project.id)}
                            className="block rounded-lg px-1 py-1 transition-colors hover:bg-muted/30"
                          >
                            <div className="space-y-1">
                              <div className="font-medium">{project.name}</div>
                              <div className="text-xs text-muted-foreground">ID {project.id}</div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{project.slug}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{resolvePlatformLabel(project.platform)}</Badge>
                        </TableCell>
                        <TableCell>
                          <ProjectStatusBadge status={project.status} />
                        </TableCell>
                        <TableCell>{formatDate(project.created_at, 'YYYY-MM-DD')}</TableCell>
                        <TableCell className="text-right">
                          <ActionMenu
                            items={[
                              {
                                key: `overview-${project.id}`,
                                label: 'Overview',
                                icon: BarChart3,
                                href: buildProjectDetailRoute(project.id),
                              },
                              {
                                key: `api-specs-${project.id}`,
                                label: 'API Specs',
                                icon: FileJson2,
                                href: buildProjectApiSpecsRoute(project.id),
                              },
                              {
                                key: `environments-${project.id}`,
                                label: 'Environments',
                                icon: Globe,
                                href: buildProjectEnvironmentsRoute(project.id),
                              },
                              {
                                key: `categories-${project.id}`,
                                label: 'Categories',
                                icon: Tags,
                                href: buildProjectCategoriesRoute(project.id),
                              },
                              {
                                key: `test-cases-${project.id}`,
                                label: 'Test Cases',
                                icon: FlaskConical,
                                href: buildProjectTestCasesRoute(project.id),
                              },
                              {
                                key: `edit-${project.id}`,
                                label: 'Edit',
                                icon: Pencil,
                                separatorBefore: true,
                                onSelect: () => openEditDialog(project),
                              },
                              {
                                key: `delete-${project.id}`,
                                label: 'Delete',
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => setDeleteTarget(project),
                              },
                            ]}
                            ariaLabel={`Open actions for ${project.name}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          {projects.length === 0
                            ? 'No projects found. Create your first project to get started.'
                            : 'No projects matched the current filter.'}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  Connected API Endpoints
                </div>
                <div className="space-y-2 font-mono text-xs text-muted-foreground">
                  <div>GET {projectsPath}</div>
                  <div>POST {projectsPath}</div>
                  <div>GET {projectDetailPath}</div>
                  <div>PATCH {projectDetailPath}</div>
                  <div>DELETE {projectDetailPath}</div>
                  <div>GET {projectStatsPath}</div>
                  <div>GET {buildApiPath('/projects/:id/environments')}</div>
                  <div>GET {buildApiPath('/projects/:id/categories')}</div>
                  <div>GET {buildApiPath('/projects/:id/api-specs')}</div>
                  <div>GET {buildApiPath('/projects/:id/test-cases')}</div>
                  <div>POST {buildApiPath('/projects/:id/test-cases')}</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  disabled={!canGoPrev}
                >
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {projectsQuery.data?.meta.page || page} of {projectsQuery.data?.meta.pages || 1}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  disabled={!canGoNext}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ProjectFormDialog
        key={`${formMode}-${editingProject?.id ?? 'new'}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        project={editingProject}
        isSubmitting={createProjectMutation.isPending || updateProjectMutation.isPending}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingProject(null);
          }
        }}
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
