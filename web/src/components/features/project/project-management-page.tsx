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
  Users,
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
  buildProjectEnvironmentsRoute,
  buildProjectMembersRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '@/hooks/use-projects';
import { useT } from '@/i18n/client';
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
  const i18n = useT();
  const t = i18n.project;
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
  const filteredProjects = projects.filter(project => {
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
  const activeOnPage = projects.filter(project => project.status === 1).length;
  const inactiveOnPage = projects.filter(project => project.status === 0).length;

  const projectsPath = buildApiPath('/projects');
  const projectDetailPath = buildApiPath('/projects/:id');
  const projectStatsPath = buildApiPath('/projects/:id/stats');
  const headerActionItems: ActionMenuItem[] = [
    {
      key: 'refresh',
      label:
        projectsQuery.isFetching && !projectsQuery.isLoading
          ? i18n.common('refreshing')
          : i18n.common('refresh'),
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
        setPage(currentPage => currentPage - 1);
      }
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  return (
    <div className="flex-1 space-y-8 p-4 pt-5 md:p-6">
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-medium tracking-normal">{t('projectsPage.title')}</h1>
              <FolderKanban className="h-6 w-6 text-text-main" />
            </div>
            <p className="max-w-3xl text-sm text-text-muted">
              {t('projectsPage.description', { projectsPath })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t('projectsPage.createProject')}
            </Button>
            <ActionMenu
              items={headerActionItems}
              ariaLabel={t('projectsPage.openPageActions')}
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
              title={t('projectsPage.totalProjects')}
              value={totalProjects}
              description={t('projectsPage.totalProjectsDescription', {
                pages: projectsQuery.data?.meta.pages || 0,
              })}
              icon={FolderKanban}
              variant="primary"
            />
            <StatCard
              title={t('projectsPage.activeOnPage')}
              value={activeOnPage}
              description={t('projectsPage.activeOnPageDescription', {
                page: projectsQuery.data?.meta.page || page,
              })}
              icon={ShieldCheck}
              variant="success"
            />
            <StatCard
              title={t('projectsPage.inactiveOnPage')}
              value={inactiveOnPage}
              description={t('projectsPage.inactiveOnPageDescription')}
              icon={Layers3}
              variant="warning"
            />
            <StatCard
              title={t('projectsPage.filteredResults')}
              value={filteredProjects.length}
              description={
                searchQuery.trim()
                  ? t('projectsPage.filteredResultsDescriptionWithQuery', {
                      query: searchQuery.trim(),
                    })
                  : t('projectsPage.filteredResultsDescription')
              }
              icon={Boxes}
            />
          </>
        )}
      </div>

      <Card className="overflow-hidden rounded-xl border-border-subtle bg-bg-canvas">
        <CardHeader className="flex flex-col gap-3 border-b border-border-subtle bg-bg-soft md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{t('projectsPage.cardTitle')}</CardTitle>
            <CardDescription>
              {projectsQuery.data?.meta
                ? t('projectsPage.cardDescription', {
                    page: projectsQuery.data.meta.page,
                    pages: projectsQuery.data.meta.pages,
                    total: projectsQuery.data.meta.total,
                  })
                : t('projectsPage.cardDescriptionFallback', { path: projectsPath })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {projectsQuery.isFetching && !projectsQuery.isLoading ? (
              <span>{t('projectsPage.localRefresh')}</span>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={t('projectsPage.filterPlaceholder')}
              leftIcon={<Search className="size-4" />}
            />
            <div className="text-xs text-muted-foreground">{t('projectsPage.localFilterNote')}</div>
          </div>

          {projectsQuery.isLoading ? (
            <div className="space-y-3">
              <div className="h-14 animate-pulse rounded-xl bg-muted" />
              <div className="h-14 animate-pulse rounded-xl bg-muted" />
              <div className="h-14 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border-subtle">
                <Table>
                  <TableHeader className="bg-bg-soft">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t('projectsPage.tableName')}</TableHead>
                      <TableHead>{t('projectsPage.tableSlug')}</TableHead>
                      <TableHead>{t('projectsPage.tablePlatform')}</TableHead>
                      <TableHead>{t('projectsPage.tableStatus')}</TableHead>
                      <TableHead>{t('projectsPage.tableCreated')}</TableHead>
                      <TableHead className="text-right">{t('projectsPage.tableActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map(project => (
                      <TableRow key={project.id} className="transition-colors hover:bg-bg-subtle">
                        <TableCell className="min-w-[220px]">
                          <Link
                            href={buildProjectCategoriesRoute(project.id)}
                            className="block rounded-xl px-2 py-1 transition-colors hover:bg-bg-subtle"
                          >
                            <div className="space-y-1">
                              <div className="font-medium">{project.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {t('projectsPage.projectId', { id: project.id })}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {project.slug}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {resolvePlatformLabel(project.platform) || t('projectForm.notSet')}
                          </Badge>
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
                                label: t('projectsPage.overview'),
                                icon: BarChart3,
                                href: buildProjectCategoriesRoute(project.id),
                              },
                              {
                                key: `api-specs-${project.id}`,
                                label: t('modules.apiSpecs.label'),
                                icon: FileJson2,
                                href: buildProjectApiSpecsRoute(project.id),
                              },
                              {
                                key: `environments-${project.id}`,
                                label: t('modules.environments.label'),
                                icon: Globe,
                                href: buildProjectEnvironmentsRoute(project.id),
                              },
                              {
                                key: `categories-${project.id}`,
                                label: t('modules.categories.label'),
                                icon: Tags,
                                href: buildProjectCategoriesRoute(project.id),
                              },
                              {
                                key: `members-${project.id}`,
                                label: t('modules.members.label'),
                                icon: Users,
                                href: buildProjectMembersRoute(project.id),
                              },
                              {
                                key: `test-cases-${project.id}`,
                                label: t('modules.testCases.label'),
                                icon: FlaskConical,
                                href: buildProjectTestCasesRoute(project.id),
                              },
                              {
                                key: `edit-${project.id}`,
                                label: i18n.common('edit'),
                                icon: Pencil,
                                separatorBefore: true,
                                onSelect: () => openEditDialog(project),
                              },
                              {
                                key: `delete-${project.id}`,
                                label: i18n.common('delete'),
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => setDeleteTarget(project),
                              },
                            ]}
                            ariaLabel={i18n.common('openActions')}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          {projects.length === 0
                            ? t('projectsPage.noProjectsFound')
                            : t('projectsPage.noProjectsMatched')}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-xl border border-border-subtle bg-bg-soft p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  {t('projectsPage.connectedEndpoints')}
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
                  onClick={() => setPage(currentPage => currentPage - 1)}
                  disabled={!canGoPrev}
                >
                  {i18n.common('previous')}
                </Button>
                <div className="text-sm text-muted-foreground">
                  {t('projectsPage.pageSummary', {
                    page: projectsQuery.data?.meta.page || page,
                    pages: projectsQuery.data?.meta.pages || 1,
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage(currentPage => currentPage + 1)}
                  disabled={!canGoNext}
                >
                  {i18n.common('next')}
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
        onOpenChange={open => {
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
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}
