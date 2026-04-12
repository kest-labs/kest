'use client';

import Link from 'next/link';
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ActionMenu,
  type ActionMenuItem,
} from '@/components/features/project/action-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatCard, StatCardSkeleton } from '@/components/features/console/dashboard-stats';
import {
  buildCategoryOptions,
  collectCategoryDescendantIds,
  findProjectCategory,
  flattenProjectCategories,
  reorderCategoryIdsWithinSiblings,
} from '@/components/features/project/category-helpers';
import {
  type CategoryFormMode,
  CategoryFormDialog,
  DeleteCategoryDialog,
} from '@/components/features/project/category-shared';
import { buildApiPath } from '@/config/api';
import {
  buildProjectApiSpecsRoute,
  buildProjectDetailRoute,
  buildProjectEnvironmentsRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';
import {
  useCreateCategory,
  useDeleteCategory,
  useProjectCategories,
  useProjectCategory,
  useSortCategories,
  useUpdateCategory,
} from '@/hooks/use-categories';
import { useProjectMemberRole } from '@/hooks/use-api-specs';
import { useProject, useProjectStats } from '@/hooks/use-projects';
import type { ProjectMemberRole } from '@/types/api-spec';
import type {
  CreateCategoryRequest,
  ProjectCategory,
  UpdateCategoryRequest,
} from '@/types/category';
import { formatDate } from '@/utils';

// 列表本地分页大小。
// 作用：控制分类工作区表格单页显示数量。
const PAGE_SIZE = 8;
const EMPTY_CATEGORIES: ProjectCategory[] = [];
// 拥有写权限的角色集合。
// 作用：统一控制分类页的创建、编辑、删除和排序按钮可见性。
const WRITE_ROLES: ProjectMemberRole[] = ['write', 'admin', 'owner'];

// 成员角色文案解析器。
// 作用：把 owner/admin/write/read 转成首字母大写标签。
const getRoleLabel = (role?: ProjectMemberRole) => {
  if (!role) {
    return 'Unknown';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

// 角色徽章。
// 作用：在页面头部直观展示当前用户在项目中的权限级别。
function RoleBadge({ role }: { role?: ProjectMemberRole }) {
  return (
    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
      Role: {getRoleLabel(role)}
    </Badge>
  );
}

// 查询错误状态提取器。
// 作用：从统一错误对象中提取 HTTP 状态码，用于展示权限态等边界信息。
const getQueryErrorStatus = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
};

/**
 * 分类管理主页面。
 * 作用：
 * 1. 承载项目分类的列表、详情、创建、编辑、删除和排序能力
 * 2. 为 API Specs 等模块提供统一的分类工作区入口
 * 3. 覆盖加载态、空态、错误态、无权限态和只读态
 */
export function CategoryManagementPage({
  projectId,
}: {
  projectId: number;
}) {
  // 页面本地状态。
  // 作用：管理搜索词、分页、选中项和各类弹窗目标。
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<CategoryFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);

  // 远程数据查询与 mutation。
  // 作用：汇总项目信息、权限、分类列表和所有分类写操作。
  const projectQuery = useProject(projectId);
  const projectStatsQuery = useProjectStats(projectId);
  const memberRoleQuery = useProjectMemberRole(projectId);
  const categoriesQuery = useProjectCategories({ projectId, tree: true });
  const createCategoryMutation = useCreateCategory(projectId);
  const updateCategoryMutation = useUpdateCategory(projectId);
  const deleteCategoryMutation = useDeleteCategory(projectId);
  const sortCategoriesMutation = useSortCategories(projectId);

  // 分类树与扁平结构。
  // 作用：同时满足“层级详情展示”和“表格扫描/排序”两类视图需求。
  const categoryTree = categoriesQuery.data?.items ?? EMPTY_CATEGORIES;
  const flatCategories = useMemo(
    () => flattenProjectCategories(categoriesQuery.data?.items),
    [categoriesQuery.data?.items]
  );
  const categoryNameMap = useMemo(
    () => new Map(flatCategories.map((category) => [category.id, category.name])),
    [flatCategories]
  );

  // 本地搜索过滤。
  // 作用：兼容当前后端未提供服务端搜索时的前端筛选体验。
  const filteredCategories = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();

    if (!keyword) {
      return flatCategories;
    }

    return flatCategories.filter((category) => {
      const parentName = category.parent_name || categoryNameMap.get(category.parent_id ?? -1) || '';

      return [category.name, category.description || '', parentName].some((value) =>
        value.toLowerCase().includes(keyword)
      );
    });
  }, [categoryNameMap, deferredSearch, flatCategories]);

  // 搜索词变化时回到第一页。
  // 作用：避免在高页码下因为过滤结果变少而看到空白页。
  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [deferredSearch]);

  // 派生状态。
  // 作用：统一计算当前有效页码、当前选中分类、统计卡片所需数字和权限信息。
  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const activeCategoryId =
    selectedCategoryId !== null && flatCategories.some((category) => category.id === selectedCategoryId)
      ? selectedCategoryId
      : flatCategories[0]?.id ?? null;
  const visibleCategories = filteredCategories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedCategoryQuery = useProjectCategory(projectId, activeCategoryId ?? undefined);
  const selectedCategoryFromTree = findProjectCategory(categoryTree, activeCategoryId);
  const selectedCategory = selectedCategoryQuery.data ?? selectedCategoryFromTree;
  const selectedParent = findProjectCategory(categoryTree, selectedCategory?.parent_id ?? null);
  const selectedChildren =
    selectedCategoryFromTree?.children ??
    flatCategories.filter((category) => category.parent_id === selectedCategory?.id);

  const editingCategory = findProjectCategory(categoryTree, editingCategoryId);
  const deleteTarget = findProjectCategory(categoryTree, deleteTargetId);
  const invalidParentIds = editingCategory
    ? [editingCategory.id, ...collectCategoryDescendantIds(categoryTree, editingCategory.id)]
    : [];

  const currentRole = memberRoleQuery.data?.role;
  const canWrite = currentRole ? WRITE_ROLES.includes(currentRole) : false;
  const queryErrorStatus = getQueryErrorStatus(categoriesQuery.error);
  const isForbidden = queryErrorStatus === 403;
  const totalCategories = flatCategories.length;
  const rootCategories = categoryTree.length;
  const nestedCategories = Math.max(0, totalCategories - rootCategories);
  const describedCategories = flatCategories.filter((category) => Boolean(category.description?.trim())).length;

  const projectName = projectQuery.data?.name || `Project #${projectId}`;
  const projectSlug = projectQuery.data?.slug || `project-${projectId}`;

  // 打开创建弹窗。
  // 作用：支持可选父级预填，快速创建子分类。
  const openCreateDialog = (parentId?: number | null) => {
    setFormMode('create');
    setEditingCategoryId(null);
    setDefaultParentId(parentId ?? null);
    setIsFormOpen(true);
  };

  // 打开编辑弹窗。
  // 作用：切换到 edit 模式并绑定当前分类。
  const openEditDialog = (categoryId: number) => {
    setFormMode('edit');
    setEditingCategoryId(categoryId);
    setDefaultParentId(null);
    setIsFormOpen(true);
  };

  // 刷新页面依赖数据。
  // 作用：同步刷新项目信息、统计、权限、分类列表和当前详情。
  const handleRefresh = async () => {
    await Promise.all([
      projectQuery.refetch(),
      projectStatsQuery.refetch(),
      memberRoleQuery.refetch(),
      categoriesQuery.refetch(),
      activeCategoryId ? selectedCategoryQuery.refetch() : Promise.resolve(),
    ]);
  };

  // 分类创建/编辑统一提交入口。
  // 作用：根据弹窗模式决定调用 create 还是 update。
  const handleCategorySubmit = async (
    payload: CreateCategoryRequest | UpdateCategoryRequest
  ) => {
    try {
      if (formMode === 'create') {
        const category = await createCategoryMutation.mutateAsync(payload as CreateCategoryRequest);
        setSelectedCategoryId(category.id);
      } else if (editingCategoryId !== null) {
        const category = await updateCategoryMutation.mutateAsync({
          categoryId: editingCategoryId,
          data: payload as UpdateCategoryRequest,
        });
        setSelectedCategoryId(category.id);
      }

      setIsFormOpen(false);
      setEditingCategoryId(null);
      setDefaultParentId(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  // 删除分类处理器。
  // 作用：删除后自动选择一个可用的后续分类，避免详情区停留在失效 ID。
  const handleDeleteCategory = async () => {
    if (!deleteTarget) {
      return;
    }

    const nextCandidates = flatCategories.filter((category) => category.id !== deleteTarget.id);
    const fallbackCategoryId = nextCandidates.find((category) => category.parent_id === deleteTarget.parent_id)?.id
      ?? nextCandidates[0]?.id
      ?? null;

    try {
      await deleteCategoryMutation.mutateAsync(deleteTarget.id);
      setDeleteTargetId(null);
      setSelectedCategoryId(fallbackCategoryId);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  // 同级排序处理器。
  // 作用：根据上移/下移方向生成新的 ID 顺序并提交给后端。
  const handleMoveCategory = async (categoryId: number, direction: 'up' | 'down') => {
    const nextOrder = reorderCategoryIdsWithinSiblings(flatCategories, categoryId, direction);

    if (!nextOrder) {
      return;
    }

    try {
      await sortCategoriesMutation.mutateAsync({ category_ids: nextOrder });
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  // 父分类选项统计。
  // 作用：用于头部摘要展示“当前可选父级数量”。
  const parentOptions = buildCategoryOptions(categoryTree);
  const isHeaderRefreshing =
    categoriesQuery.isFetching ||
    projectQuery.isFetching ||
    projectStatsQuery.isFetching ||
    memberRoleQuery.isFetching ||
    selectedCategoryQuery.isFetching;
  const selectedCategoryCanMoveUp = selectedCategory
    ? reorderCategoryIdsWithinSiblings(flatCategories, selectedCategory.id, 'up') !== null
    : false;
  const selectedCategoryCanMoveDown = selectedCategory
    ? reorderCategoryIdsWithinSiblings(flatCategories, selectedCategory.id, 'down') !== null
    : false;
  const headerActionItems: ActionMenuItem[] = [
    {
      key: 'category-refresh',
      label: isHeaderRefreshing ? 'Refreshing...' : 'Refresh',
      icon: RefreshCw,
      disabled: isHeaderRefreshing,
      onSelect: () => {
        void handleRefresh();
      },
    },
    {
      key: 'category-api-specs',
      label: 'API Specs',
      icon: FileJson2,
      href: buildProjectApiSpecsRoute(projectId),
      separatorBefore: true,
    },
    {
      key: 'category-environments',
      label: 'Environments',
      icon: Globe,
      href: buildProjectEnvironmentsRoute(projectId),
    },
    {
      key: 'category-test-cases',
      label: 'Test Cases',
      icon: FlaskConical,
      href: buildProjectTestCasesRoute(projectId),
    },
  ];
  const detailActionItems: ActionMenuItem[] = selectedCategory
    ? [
        {
          key: 'category-create-child',
          label: 'Create Child',
          icon: Plus,
          disabled: !canWrite,
          onSelect: () => openCreateDialog(selectedCategory.id),
        },
        {
          key: 'category-move-up',
          label: 'Move Up',
          icon: ArrowUp,
          disabled: !canWrite || Boolean(deferredSearch.trim()) || !selectedCategoryCanMoveUp || sortCategoriesMutation.isPending,
          onSelect: () => {
            void handleMoveCategory(selectedCategory.id, 'up');
          },
        },
        {
          key: 'category-move-down',
          label: 'Move Down',
          icon: ArrowDown,
          disabled: !canWrite || Boolean(deferredSearch.trim()) || !selectedCategoryCanMoveDown || sortCategoriesMutation.isPending,
          onSelect: () => {
            void handleMoveCategory(selectedCategory.id, 'down');
          },
        },
        {
          key: 'category-delete',
          label: 'Delete',
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          disabled: !canWrite,
          onSelect: () => setDeleteTargetId(selectedCategory.id),
        },
      ]
    : [];

  return (
    <>
      <main className="h-full min-h-0 overflow-y-auto">
        <div className="space-y-8 p-6 pt-6">
          <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-linear-to-r from-primary/10 via-cyan-500/5 to-transparent p-6 transition-colors duration-500">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0xOCAxOGgyNHYyNEgxOHoiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <Button asChild variant="link" className="h-auto px-0 text-sm text-muted-foreground">
              <Link href={buildProjectDetailRoute(projectId)}>
                <ArrowLeft className="h-4 w-4" />
                Back to Project Overview
              </Link>
            </Button>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
                <Tags className="h-6 w-6 text-primary" />
                <RoleBadge role={currentRole} />
              </div>
              <p className="max-w-4xl text-sm text-text-muted">
                管理项目
                {' '}
                <span className="font-semibold text-foreground">{projectName}</span>
                {' '}
                的分类层级，并将其复用到 API Specs 等模块中，对应后端入口为
                {' '}
                <code>{buildApiPath('/projects/:id/categories')}</code>
                。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {projectSlug}
              </Badge>
              <Badge variant="outline">{projectStatsQuery.data?.category_count ?? totalCategories} categories</Badge>
              <Badge variant="outline">{projectStatsQuery.data?.api_spec_count ?? 0} specs</Badge>
              <Badge variant="outline">{parentOptions.length} selectable parents</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => openCreateDialog()} disabled={!canWrite}>
              <Plus className="h-4 w-4" />
              Create Category
            </Button>
            <ActionMenu
              items={headerActionItems}
              ariaLabel="Open category management actions"
              triggerVariant="outline"
            />
          </div>
        </div>
      </div>

      {!canWrite && memberRoleQuery.isSuccess ? (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            当前角色是
            {' '}
            <strong>{getRoleLabel(currentRole)}</strong>
            ，可以查看分类层级，但不能执行创建、编辑、排序和删除。
          </AlertDescription>
        </Alert>
      ) : null}

      {isForbidden ? (
        <Alert variant="destructive">
          <AlertTitle>No project access</AlertTitle>
          <AlertDescription>
            You do not have permission to view categories for this project.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categoriesQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Categories"
              value={totalCategories}
              description="Flattened hierarchy size in this project"
              icon={Tags}
              variant="primary"
            />
            <StatCard
              title="Root Categories"
              value={rootCategories}
              description="Top-level grouping nodes"
              icon={FolderKanban}
              variant="success"
            />
            <StatCard
              title="Nested Categories"
              value={nestedCategories}
              description="Child categories attached under parents"
              icon={Layers3}
              variant="warning"
            />
            <StatCard
              title="With Description"
              value={describedCategories}
              description={
                deferredSearch.trim()
                  ? `Filtered results: ${filteredCategories.length}`
                  : 'Documented categories ready for reuse'
              }
              icon={Boxes}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-border/50 shadow-premium">
          <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Category Registry</CardTitle>
              <CardDescription>
                Hierarchy sourced from <code>{buildApiPath('/projects/:id/categories')}</code> and
                paginated locally for faster scanning.
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredCategories.length} visible of {totalCategories}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by category name, description, or parent"
                leftIcon={<Search className="size-4" />}
              />
              <div className="text-xs text-muted-foreground">
                {deferredSearch.trim()
                  ? 'Sorting is disabled while a local search filter is active.'
                  : 'Move up/down keeps the backend sort order aligned within each sibling group.'}
              </div>
            </div>

            {categoriesQuery.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Failed to load categories</AlertTitle>
                <AlertDescription>
                  The category list could not be loaded. Retry the request or confirm your project access.
                </AlertDescription>
              </Alert>
            ) : categoriesQuery.isLoading ? (
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
                        <TableHead>Parent</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleCategories.map((category) => {
                        const parentName =
                          category.parent_name || categoryNameMap.get(category.parent_id ?? -1) || 'Root';

                        return (
                          <TableRow
                            key={category.id}
                            className="transition-colors hover:bg-muted/20"
                            data-state={activeCategoryId === category.id ? 'selected' : undefined}
                          >
                            <TableCell className="min-w-[260px]">
                              <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => setSelectedCategoryId(category.id)}
                              >
                                <div
                                  className="space-y-1"
                                  style={{ paddingLeft: `${category.depth * 18}px` }}
                                >
                                  <div className="flex items-center gap-2">
                                    {category.depth > 0 ? (
                                      <span className="text-xs text-muted-foreground">↳</span>
                                    ) : (
                                      <Tags className="h-3.5 w-3.5 text-primary" />
                                    )}
                                    <span className="font-medium">{category.name}</span>
                                    <Badge variant="outline">
                                      {category.depth === 0 ? 'Root' : `Level ${category.depth + 1}`}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {category.description?.trim() || 'No description provided.'}
                                  </div>
                                </div>
                              </button>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{parentName}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {category.sort_order}
                            </TableCell>
                            <TableCell>{formatDate(category.updated_at, 'YYYY-MM-DD')}</TableCell>
                            <TableCell className="text-right">
                              <ActionMenu
                                items={[
                                  {
                                    key: `category-view-${category.id}`,
                                    label: 'View',
                                    onSelect: () => setSelectedCategoryId(category.id),
                                  },
                                  {
                                    key: `category-create-child-${category.id}`,
                                    label: 'Create Child',
                                    icon: Plus,
                                    disabled: !canWrite,
                                    onSelect: () => openCreateDialog(category.id),
                                  },
                                  {
                                    key: `category-edit-${category.id}`,
                                    label: 'Edit',
                                    icon: Pencil,
                                    disabled: !canWrite,
                                    onSelect: () => openEditDialog(category.id),
                                  },
                                  {
                                    key: `category-up-${category.id}`,
                                    label: 'Move Up',
                                    icon: ArrowUp,
                                    disabled:
                                      !canWrite ||
                                      Boolean(deferredSearch.trim()) ||
                                      sortCategoriesMutation.isPending ||
                                      reorderCategoryIdsWithinSiblings(flatCategories, category.id, 'up') === null,
                                    onSelect: () => {
                                      void handleMoveCategory(category.id, 'up');
                                    },
                                  },
                                  {
                                    key: `category-down-${category.id}`,
                                    label: 'Move Down',
                                    icon: ArrowDown,
                                    disabled:
                                      !canWrite ||
                                      Boolean(deferredSearch.trim()) ||
                                      sortCategoriesMutation.isPending ||
                                      reorderCategoryIdsWithinSiblings(flatCategories, category.id, 'down') === null,
                                    onSelect: () => {
                                      void handleMoveCategory(category.id, 'down');
                                    },
                                  },
                                  {
                                    key: `category-delete-${category.id}`,
                                    label: 'Delete',
                                    icon: Trash2,
                                    destructive: true,
                                    disabled: !canWrite,
                                    onSelect: () => setDeleteTargetId(category.id),
                                  },
                                ]}
                                ariaLabel={`Open actions for ${category.name}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {visibleCategories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                            {totalCategories === 0
                              ? 'No categories found. Create the first category to organize your project assets.'
                              : 'No categories matched the current filter.'}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-premium">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>Category Detail</CardTitle>
            <CardDescription>
              Details from <code>{buildApiPath('/projects/:id/categories/:cid')}</code>, enriched with the
              loaded tree so parent/child relationships remain visible.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-6">
            {categoriesQuery.isLoading ? (
              <div className="space-y-3">
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
              </div>
            ) : totalCategories === 0 ? (
              <Alert>
                <AlertTitle>No categories yet</AlertTitle>
                <AlertDescription>
                  Create a root category or a child category to start organizing API assets.
                </AlertDescription>
              </Alert>
            ) : selectedCategoryQuery.isError && !selectedCategory ? (
              <Alert variant="destructive">
                <AlertTitle>Failed to load category details</AlertTitle>
                <AlertDescription>
                  The selected category details could not be loaded. Choose another record or retry refresh.
                </AlertDescription>
              </Alert>
            ) : !selectedCategory ? (
              <Alert>
                <AlertTitle>Select a category</AlertTitle>
                <AlertDescription>
                  Pick a row from the registry to inspect its hierarchy and edit actions.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-2xl border border-primary/10 bg-linear-to-br from-primary/10 via-transparent to-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold">{selectedCategory.name}</h2>
                        <Badge variant="outline">
                          {selectedCategory.parent_id ? 'Child Category' : 'Root Category'}
                        </Badge>
                        <Badge variant="outline">Order {selectedCategory.sort_order}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedCategory.description?.trim() || 'No description provided for this category.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(selectedCategory.id)}
                        disabled={!canWrite}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <ActionMenu
                        items={detailActionItems}
                        ariaLabel="Open selected category actions"
                        triggerVariant="outline"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Category ID</div>
                    <div className="mt-2 font-mono text-sm">{selectedCategory.id}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Parent</div>
                    <div className="mt-2 text-sm">{selectedParent?.name || 'No parent category'}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated At</div>
                    <div className="mt-2 text-sm">{formatDate(selectedCategory.updated_at, 'YYYY-MM-DD HH:mm')}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Test Case Count</div>
                    <div className="mt-2 text-sm">
                      {selectedCategory.test_cases_count ?? 'Not exposed by current backend'}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Children</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedChildren.length} direct children under this category
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={buildProjectApiSpecsRoute(projectId)}>
                        <FileJson2 className="h-3.5 w-3.5" />
                        API Specs
                      </Link>
                    </Button>
                  </div>

                  {selectedChildren.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedChildren.map((child) => (
                        <Button
                          key={child.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedCategoryId(child.id)}
                        >
                          {child.name}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No child categories under the selected node.
                    </div>
                  )}
                </div>

                <Alert>
                  <AlertTitle>Current backend behavior</AlertTitle>
                  <AlertDescription>
                    Server-side search, pagination, and delete reassignment are not exposed by the current
                    category module, so this page handles search/pagination locally and keeps delete actions
                    conservative.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-premium">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Connected API Endpoints</CardTitle>
          <CardDescription>
            Categories mounted in the current frontend workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-6 font-mono text-xs text-muted-foreground">
          <div>GET {buildApiPath('/projects/:id/categories')}</div>
          <div>POST {buildApiPath('/projects/:id/categories')}</div>
          <div>GET {buildApiPath('/projects/:id/categories/:cid')}</div>
          <div>PATCH {buildApiPath('/projects/:id/categories/:cid')}</div>
          <div>DELETE {buildApiPath('/projects/:id/categories/:cid')}</div>
          <div>PUT {buildApiPath('/projects/:id/categories/sort')}</div>
        </CardContent>
      </Card>
        </div>
      </main>

      <CategoryFormDialog
        key={`${formMode}-${editingCategoryId ?? 'new'}-${defaultParentId ?? 'root'}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        category={editingCategory}
        categories={categoryTree}
        defaultParentId={defaultParentId}
        invalidParentIds={invalidParentIds}
        isSubmitting={createCategoryMutation.isPending || updateCategoryMutation.isPending}
        onOpenChange={(open) => {
          setIsFormOpen(open);

          if (!open) {
            setEditingCategoryId(null);
            setDefaultParentId(null);
          }
        }}
        onSubmit={handleCategorySubmit}
      />

      <DeleteCategoryDialog
        open={Boolean(deleteTarget)}
        category={deleteTarget}
        isDeleting={deleteCategoryMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetId(null);
          }
        }}
        onConfirm={handleDeleteCategory}
      />
    </>
  );
}

export default CategoryManagementPage;
