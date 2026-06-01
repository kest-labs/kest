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
  Trash2,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionMenu, type ActionMenuItem } from '@/components/features/workspace/action-menu';
import { Input } from '@/components/ui/input';
import {
  DeleteWorkspaceDialog,
  type WorkspaceFormMode,
  WorkspaceFormDialog,
  WorkspaceStatusBadge,
  resolvePlatformLabel,
} from '@/components/features/workspace/workspace-shared';
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
  buildWorkspaceApiSpecsRoute,
  buildWorkspaceEnvironmentsRoute,
  buildWorkspaceMembersRoute,
  buildWorkspaceTestCasesRoute,
} from '@/constants/routes';
import {
  useCreateWorkspace,
  useDeleteWorkspace,
  useWorkspaces,
  useUpdateWorkspace,
} from '@/hooks/use-workspaces';
import { useT } from '@/i18n/client';
import { canManageWorkspaceMembers } from '@/types/member';
import type {
  ApiWorkspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
} from '@/types/workspace';
import { formatDate } from '@/utils';

const PAGE_SIZE = 12;
const EMPTY_WORKSPACES: ApiWorkspace[] = [];

/**
 * 工作区管理主页面。
 * 作用：
 * 1. 展示当前登录用户可见的工作区列表
 * 2. 提供工作区的增删改查入口
 * 3. 提供跳转到工作区详情页、环境页、API 规格页和测试用例页的入口
 * 4. 复用控制台视觉风格，让 `/workspace` 与 `/console` 保持一致
 */
export function WorkspaceManagementPage() {
  const i18n = useT();
  const t = i18n.workspace;
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [formMode, setFormMode] = useState<WorkspaceFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<ApiWorkspace | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiWorkspace | null>(null);

  const workspacesQuery = useWorkspaces({ page, perPage: PAGE_SIZE });
  const createWorkspaceMutation = useCreateWorkspace();
  const updateWorkspaceMutation = useUpdateWorkspace();
  const deleteWorkspaceMutation = useDeleteWorkspace();

  const workspaces = workspacesQuery.data?.items ?? EMPTY_WORKSPACES;
  // 这里仍然是当前页本地过滤：
  // 后端工作区列表接口目前只有分页，没有 search 参数。
  const filteredWorkspaces = workspaces.filter(workspace => {
    if (!searchQuery.trim()) {
      return true;
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    return (
      workspace.name.toLowerCase().includes(normalizedQuery) ||
      workspace.slug.toLowerCase().includes(normalizedQuery) ||
      workspace.platform.toLowerCase().includes(normalizedQuery)
    );
  });

  const canGoPrev = page > 1;
  const canGoNext = page < (workspacesQuery.data?.meta.pages || 1);
  const totalWorkspaces = workspacesQuery.data?.meta.total || 0;
  const activeOnPage = workspaces.filter(workspace => workspace.status === 1).length;
  const inactiveOnPage = workspaces.filter(workspace => workspace.status === 0).length;

  const workspacesPath = buildApiPath('/workspaces');
  const workspaceDetailPath = buildApiPath('/workspaces/:id');
  const workspaceStatsPath = buildApiPath('/workspaces/:id/stats');
  const headerActionItems: ActionMenuItem[] = [
    {
      key: 'refresh',
      label:
        workspacesQuery.isFetching && !workspacesQuery.isLoading
          ? i18n.common('refreshing')
          : i18n.common('refresh'),
      icon: RefreshCw,
      disabled: workspacesQuery.isFetching && !workspacesQuery.isLoading,
      onSelect: () => {
        void workspacesQuery.refetch();
      },
    },
  ];

  // 打开创建弹窗时显式清空编辑态，避免沿用上一条记录的数据。
  const openCreateDialog = () => {
    setFormMode('create');
    setEditingWorkspace(null);
    setIsFormOpen(true);
  };

  // 编辑弹窗复用共享表单组件，这里只负责切换到 edit 模式并注入当前工作区。
  const openEditDialog = (workspace: ApiWorkspace) => {
    if (!canManageWorkspaceMembers(workspace.role)) {
      return;
    }

    setFormMode('edit');
    setEditingWorkspace(workspace);
    setIsFormOpen(true);
  };

  // 创建和更新统一走一个提交入口：
  // 根据当前模式决定调用 create 还是 update。
  const handleWorkspaceSubmit = async (
    payload: CreateWorkspaceRequest | UpdateWorkspaceRequest
  ) => {
    try {
      if (formMode === 'create') {
        await createWorkspaceMutation.mutateAsync(payload as CreateWorkspaceRequest);
        setPage(1);
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

  // 删除后如果当前页只剩一条记录，则回退一页，避免停留在空分页。
  const handleDeleteWorkspace = async () => {
    if (!deleteTarget || deleteTarget.role !== 'owner') {
      return;
    }

    const shouldStepBackPage = workspaces.length === 1 && page > 1;

    try {
      await deleteWorkspaceMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);

      if (shouldStepBackPage) {
        setPage(currentPage => currentPage - 1);
      }
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const getWorkspaceRowActionItems = (workspace: ApiWorkspace): ActionMenuItem[] => [
    {
      key: `overview-${workspace.id}`,
      label: t('workspacesPage.overview'),
      icon: BarChart3,
      href: buildWorkspaceApiSpecsRoute(workspace.id),
    },
    {
      key: `api-specs-${workspace.id}`,
      label: t('modules.apiSpecs.label'),
      icon: FileJson2,
      href: buildWorkspaceApiSpecsRoute(workspace.id),
    },
    {
      key: `environments-${workspace.id}`,
      label: t('modules.environments.label'),
      icon: Globe,
      href: buildWorkspaceEnvironmentsRoute(workspace.id),
    },
    ...(canManageWorkspaceMembers(workspace.role)
      ? [
          {
            key: `members-${workspace.id}`,
            label: t('modules.members.label'),
            icon: Users,
            href: buildWorkspaceMembersRoute(workspace.id),
          },
        ]
      : []),
    {
      key: `test-cases-${workspace.id}`,
      label: t('modules.testCases.label'),
      icon: FlaskConical,
      href: buildWorkspaceTestCasesRoute(workspace.id),
    },
    ...(canManageWorkspaceMembers(workspace.role)
      ? [
          {
            key: `edit-${workspace.id}`,
            label: i18n.common('edit'),
            icon: Pencil,
            separatorBefore: true,
            onSelect: () => openEditDialog(workspace),
          },
        ]
      : []),
    ...(workspace.role === 'owner'
      ? [
          {
            key: `delete-${workspace.id}`,
            label: i18n.common('delete'),
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleteTarget(workspace),
          },
        ]
      : []),
  ];

  return (
    <div className="flex-1 space-y-8 p-4 pt-5 md:p-6">
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-medium tracking-normal">{t('workspacesPage.title')}</h1>
              <FolderKanban className="h-6 w-6 text-text-main" />
            </div>
            <p className="max-w-3xl text-sm text-text-muted">
              {t('workspacesPage.description', { workspacesPath })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t('workspacesPage.createWorkspace')}
            </Button>
            <ActionMenu
              items={headerActionItems}
              ariaLabel={t('workspacesPage.openPageActions')}
              triggerVariant="outline"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workspacesQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title={t('workspacesPage.totalWorkspaces')}
              value={totalWorkspaces}
              description={t('workspacesPage.totalWorkspacesDescription', {
                pages: workspacesQuery.data?.meta.pages || 0,
              })}
              icon={FolderKanban}
              variant="primary"
            />
            <StatCard
              title={t('workspacesPage.activeOnPage')}
              value={activeOnPage}
              description={t('workspacesPage.activeOnPageDescription', {
                page: workspacesQuery.data?.meta.page || page,
              })}
              icon={ShieldCheck}
              variant="success"
            />
            <StatCard
              title={t('workspacesPage.inactiveOnPage')}
              value={inactiveOnPage}
              description={t('workspacesPage.inactiveOnPageDescription')}
              icon={Layers3}
              variant="warning"
            />
            <StatCard
              title={t('workspacesPage.filteredResults')}
              value={filteredWorkspaces.length}
              description={
                searchQuery.trim()
                  ? t('workspacesPage.filteredResultsDescriptionWithQuery', {
                      query: searchQuery.trim(),
                    })
                  : t('workspacesPage.filteredResultsDescription')
              }
              icon={Boxes}
            />
          </>
        )}
      </div>

      <Card className="overflow-hidden rounded-xl border-border-subtle bg-bg-canvas">
        <CardHeader className="flex flex-col gap-3 border-b border-border-subtle bg-bg-soft md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{t('workspacesPage.cardTitle')}</CardTitle>
            <CardDescription>
              {workspacesQuery.data?.meta
                ? t('workspacesPage.cardDescription', {
                    page: workspacesQuery.data.meta.page,
                    pages: workspacesQuery.data.meta.pages,
                    total: workspacesQuery.data.meta.total,
                  })
                : t('workspacesPage.cardDescriptionFallback', { path: workspacesPath })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {workspacesQuery.isFetching && !workspacesQuery.isLoading ? (
              <span>{t('workspacesPage.localRefresh')}</span>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={t('workspacesPage.filterPlaceholder')}
              leftIcon={<Search className="size-4" />}
            />
            <div className="text-xs text-muted-foreground">
              {t('workspacesPage.localFilterNote')}
            </div>
          </div>

          {workspacesQuery.isLoading ? (
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
                      <TableHead>{t('workspacesPage.tableName')}</TableHead>
                      <TableHead>{t('workspacesPage.tableSlug')}</TableHead>
                      <TableHead>{t('workspacesPage.tablePlatform')}</TableHead>
                      <TableHead>{t('workspacesPage.tableStatus')}</TableHead>
                      <TableHead>{t('workspacesPage.tableCreated')}</TableHead>
                      <TableHead className="text-right">
                        {t('workspacesPage.tableActions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkspaces.map(workspace => (
                      <TableRow key={workspace.id} className="transition-colors hover:bg-bg-subtle">
                        <TableCell className="min-w-[220px]">
                          <Link
                            href={buildWorkspaceApiSpecsRoute(workspace.id)}
                            className="block rounded-xl px-2 py-1 transition-colors hover:bg-bg-subtle"
                          >
                            <div className="space-y-1">
                              <div className="font-medium">{workspace.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {t('workspacesPage.workspaceId', { id: workspace.id })}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {workspace.slug}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {resolvePlatformLabel(workspace.platform) || t('workspaceForm.notSet')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <WorkspaceStatusBadge status={workspace.status} />
                        </TableCell>
                        <TableCell>{formatDate(workspace.created_at, 'YYYY-MM-DD')}</TableCell>
                        <TableCell className="text-right">
                          <ActionMenu
                            items={getWorkspaceRowActionItems(workspace)}
                            ariaLabel={i18n.common('openActions')}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredWorkspaces.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          {workspaces.length === 0
                            ? t('workspacesPage.noWorkspacesFound')
                            : t('workspacesPage.noWorkspacesMatched')}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-xl border border-border-subtle bg-bg-soft p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  {t('workspacesPage.connectedEndpoints')}
                </div>
                <div className="space-y-2 font-mono text-xs text-muted-foreground">
                  <div>GET {workspacesPath}</div>
                  <div>POST {workspacesPath}</div>
                  <div>GET {workspaceDetailPath}</div>
                  <div>PATCH {workspaceDetailPath}</div>
                  <div>DELETE {workspaceDetailPath}</div>
                  <div>GET {workspaceStatsPath}</div>
                  <div>GET {buildApiPath('/workspaces/:id/environments')}</div>
                  <div>GET {buildApiPath('/workspaces/:id/categories')}</div>
                  <div>GET {buildApiPath('/workspaces/:id/api-specs')}</div>
                  <div>GET {buildApiPath('/workspaces/:id/test-cases')}</div>
                  <div>POST {buildApiPath('/workspaces/:id/test-cases')}</div>
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
                  {t('workspacesPage.pageSummary', {
                    page: workspacesQuery.data?.meta.page || page,
                    pages: workspacesQuery.data?.meta.pages || 1,
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

      <WorkspaceFormDialog
        key={`${formMode}-${editingWorkspace?.id ?? 'new'}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        workspace={editingWorkspace}
        isSubmitting={createWorkspaceMutation.isPending || updateWorkspaceMutation.isPending}
        onOpenChange={open => {
          setIsFormOpen(open);
          if (!open) {
            setEditingWorkspace(null);
          }
        }}
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
    </div>
  );
}
