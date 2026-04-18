'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  Eye,
  FileJson2,
  FlaskConical,
  FolderKanban,
  Globe,
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StatCard, StatCardSkeleton } from '@/components/features/console/dashboard-stats';
import { buildApiPath } from '@/config/api';
import {
  buildProjectApiSpecsRoute,
  buildProjectCategoriesRoute,
  buildProjectDetailRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';
import {
  useCreateEnvironment,
  useDeleteEnvironment,
  useDuplicateEnvironment,
  useEnvironment,
  useEnvironments,
  useUpdateEnvironment,
} from '@/hooks/use-environments';
import { useProjectMemberRole } from '@/hooks/use-members';
import { useProject, useProjectStats } from '@/hooks/use-projects';
import type {
  CreateEnvironmentRequest,
  DuplicateEnvironmentRequest,
  ProjectEnvironment,
  UpdateEnvironmentRequest,
} from '@/types/environment';
import {
  PROJECT_MEMBER_WRITE_ROLES,
  type ProjectMemberRole,
} from '@/types/member';
import { cn, formatDate } from '@/utils';

const EMPTY_ENVIRONMENTS: ProjectEnvironment[] = [];
// 具备写权限的角色集合。
// 作用：统一控制环境页面上的创建、编辑、复制和删除动作。
const WRITE_ROLES = PROJECT_MEMBER_WRITE_ROLES;

// 环境表单模式。
// 作用：区分当前弹窗是在创建新环境还是编辑已有环境。
type EnvironmentFormMode = 'create' | 'edit';
// 详情面板 tab。
// 作用：控制右侧详情在 overview、variables、headers 三种内容间切换。
type DetailTab = 'overview' | 'variables' | 'headers';

// 环境创建/编辑弹窗的本地草稿结构。
// 作用：把接口字段转换成更适合表单输入的字符串形态。
interface EnvironmentFormDraft {
  name: string;
  displayName: string;
  baseUrl: string;
  variables: string;
  headers: string;
}

// 复制环境弹窗草稿。
// 作用：承载 duplicate 接口所需的新名称和可选变量覆盖文本。
interface DuplicateEnvironmentDraft {
  name: string;
  overrideVars: string;
}

// 项目角色显示文案解析器。
// 作用：统一把 owner/admin/write/read 映射成首字母大写的角色标签。
const getRoleLabel = (role?: ProjectMemberRole) => {
  if (!role) {
    return 'Unknown';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

// JSON 序列化辅助方法。
// 作用：把对象格式化成带缩进文本，供 textarea 初始值和详情预览复用。
const formatJson = (value: unknown) => {
  if (value === undefined || value === null) {
    return '';
  }

  return JSON.stringify(value, null, 2);
};

// JSON 输入解析器。
// 作用：统一解析对象类型输入，并在格式不合法时抛出中文错误。
const parseObjectJsonInput = <T extends Record<string, unknown> | Record<string, string>>(
  value: string,
  label: string
) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedValue);
  } catch {
    throw new Error(`${label} 必须是合法的 JSON 对象。`);
  }

  if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${label} 必须是 JSON 对象。`);
  }

  return parsed as T;
};

// Headers 标准化器。
// 作用：把 header 对象中的值统一转成字符串，满足后端 `map[string]string` 约束。
const toStringRecord = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)])
  ) as Record<string, string>;

// 环境表单默认值生成器。
// 作用：根据已有环境生成创建/编辑弹窗所需的文本草稿。
const getEnvironmentFormDraft = (environment?: ProjectEnvironment | null): EnvironmentFormDraft => ({
  name: environment?.name ?? '',
  displayName: environment?.display_name ?? '',
  baseUrl: environment?.base_url ?? '',
  variables: formatJson(environment?.variables),
  headers: formatJson(environment?.headers),
});

// 复制环境弹窗默认值。
// 作用：根据源环境推导新名称，并初始化可选的 override variables 文本。
const getDuplicateEnvironmentDraft = (
  environment?: ProjectEnvironment | null
): DuplicateEnvironmentDraft => ({
  name: environment ? `${environment.name} Copy` : '',
  overrideVars: '',
});

// 角色徽章。
// 作用：在页面头部清晰展示当前用户对该项目环境的操作权限。
function RoleBadge({ role }: { role?: ProjectMemberRole }) {
  return (
    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
      Role: {getRoleLabel(role)}
    </Badge>
  );
}

// 长文本代码块渲染器。
// 作用：统一承载 JSON 数据的只读展示。
function CodeBlock({
  value,
  emptyLabel,
}: {
  value?: string;
  emptyLabel: string;
}) {
  if (!value?.trim()) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
      <code>{value}</code>
    </pre>
  );
}

// JSON 预览块。
// 作用：把 variables 和 headers 包装成带标题的只读内容区域。
function JsonPreview({
  title,
  value,
  emptyLabel,
}: {
  title: string;
  value: unknown;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <CodeBlock value={formatJson(value)} emptyLabel={emptyLabel} />
    </div>
  );
}

/**
 * 环境创建/编辑弹窗。
 * 作用：
 * 1. 统一承载 POST 和 PATCH 所需字段
 * 2. 在提交前完成 variables / headers 的 JSON 校验与转换
 */
function EnvironmentFormDialog({
  open,
  mode,
  environment,
  isLoadingEnvironment,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: EnvironmentFormMode;
  environment?: ProjectEnvironment | null;
  isLoadingEnvironment: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateEnvironmentRequest | UpdateEnvironmentRequest) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EnvironmentFormDraft>(() => getEnvironmentFormDraft(environment));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateDraft = <K extends keyof EnvironmentFormDraft>(
    key: K,
    value: EnvironmentFormDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const trimmedName = draft.name.trim();
    let variables: Record<string, unknown> | undefined;
    let headers: Record<string, string> | undefined;

    if (!trimmedName) {
      nextErrors.name = 'Environment name 是必填项。';
    }

    try {
      variables = parseObjectJsonInput<Record<string, unknown>>(draft.variables, 'Variables');
    } catch (error) {
      nextErrors.variables = error instanceof Error ? error.message : 'Variables 无法解析。';
    }

    try {
      const parsedHeaders = parseObjectJsonInput<Record<string, unknown>>(draft.headers, 'Headers');
      headers = parsedHeaders ? toStringRecord(parsedHeaders) : undefined;
    } catch (error) {
      nextErrors.headers = error instanceof Error ? error.message : 'Headers 无法解析。';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      name: trimmedName,
      display_name: draft.displayName.trim() || undefined,
      base_url: draft.baseUrl.trim() || undefined,
      variables,
      headers,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create Environment' : 'Edit Environment'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '通过 POST /v1/projects/:id/environments 创建新的环境配置。'
              : '通过 PATCH /v1/projects/:id/environments/:eid 更新当前环境配置。'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {mode === 'edit' && isLoadingEnvironment ? (
            <div className="space-y-3 py-2">
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : mode === 'edit' && !environment ? (
            <Alert className="mt-2">
              <AlertTitle>Unable to load environment details</AlertTitle>
              <AlertDescription>
                当前环境详情尚未加载完成，请关闭后重试。
              </AlertDescription>
            </Alert>
          ) : (
            <form id="environment-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="environment-name">Name</Label>
                  <Input
                    id="environment-name"
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                    placeholder="production"
                    errorText={errors.name}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment-display-name">Display Name</Label>
                  <Input
                    id="environment-display-name"
                    value={draft.displayName}
                    onChange={(event) => updateDraft('displayName', event.target.value)}
                    placeholder="Production"
                    root
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment-base-url">Base URL</Label>
                <Input
                  id="environment-base-url"
                  value={draft.baseUrl}
                  onChange={(event) => updateDraft('baseUrl', event.target.value)}
                  placeholder="https://api.example.com"
                  root
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="environment-variables">Variables JSON</Label>
                  <Textarea
                    id="environment-variables"
                    value={draft.variables}
                    onChange={(event) => updateDraft('variables', event.target.value)}
                    rows={14}
                    placeholder='{"API_URL": "https://api.example.com", "DEBUG": false}'
                    errorText={errors.variables}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment-headers">Headers JSON</Label>
                  <Textarea
                    id="environment-headers"
                    value={draft.headers}
                    onChange={(event) => updateDraft('headers', event.target.value)}
                    rows={14}
                    placeholder='{"Authorization": "Bearer {{token}}"}'
                    errorText={errors.headers}
                    root
                  />
                </div>
              </div>
            </form>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="environment-form"
            loading={isSubmitting}
            disabled={(mode === 'edit' && (isLoadingEnvironment || !environment)) || isSubmitting}
          >
            {mode === 'create' ? 'Create Environment' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 环境删除确认弹窗。
 * 作用：在真正调用 DELETE 前展示不可逆提醒，避免误删环境配置。
 */
function DeleteEnvironmentDialog({
  open,
  environment,
  isDeleting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  environment?: ProjectEnvironment | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Delete Environment</DialogTitle>
          <DialogDescription>
            这会永久删除 {environment ? `"${environment.name}"` : '当前选中的环境'}。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert variant="destructive">
            <AlertTitle>Irreversible action</AlertTitle>
            <AlertDescription>
              后端会立即执行 `DELETE /projects/:id/environments/:eid`，删除后无法恢复。
            </AlertDescription>
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={isDeleting} onClick={() => void onConfirm()}>
            Delete Environment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 复制环境弹窗。
 * 作用：收集新环境名称和可选 override variables，触发 duplicate 接口。
 */
function DuplicateEnvironmentDialog({
  open,
  environment,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  environment?: ProjectEnvironment | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: DuplicateEnvironmentRequest) => Promise<void>;
}) {
  const [draft, setDraft] = useState<DuplicateEnvironmentDraft>(() =>
    getDuplicateEnvironmentDraft(environment)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const trimmedName = draft.name.trim();
    let overrideVars: Record<string, unknown> | undefined;

    if (!trimmedName) {
      nextErrors.name = 'New environment name 是必填项。';
    }

    try {
      overrideVars = parseObjectJsonInput<Record<string, unknown>>(
        draft.overrideVars,
        'Override Variables'
      );
    } catch (error) {
      nextErrors.overrideVars =
        error instanceof Error ? error.message : 'Override Variables 无法解析。';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      name: trimmedName,
      override_vars: overrideVars,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Duplicate Environment</DialogTitle>
          <DialogDescription>
            通过 POST /v1/projects/:id/environments/:eid/duplicate 复制当前环境。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="environment-duplicate-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="duplicate-environment-name">New Environment Name</Label>
              <Input
                id="duplicate-environment-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="production-copy"
                errorText={errors.name}
                root
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duplicate-environment-override-vars">Override Variables JSON</Label>
              <Textarea
                id="duplicate-environment-override-vars"
                value={draft.overrideVars}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, overrideVars: event.target.value }))
                }
                rows={12}
                placeholder='{"API_URL": "https://staging.example.com"}'
                errorText={errors.overrideVars}
                root
              />
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="environment-duplicate-form" loading={isSubmitting}>
            Duplicate Environment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 环境管理主页面。
 * 作用：
 * 1. 展示指定项目下全部环境配置
 * 2. 提供环境 CRUD 和 duplicate 入口
 * 3. 在右侧面板展示环境详情、variables 和 headers
 */
export function EnvironmentManagementPage({
  projectId,
}: {
  projectId: number;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [formMode, setFormMode] = useState<EnvironmentFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectEnvironment | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectEnvironment | null>(null);

  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const projectQuery = useProject(projectId);
  const projectStatsQuery = useProjectStats(projectId);
  const memberRoleQuery = useProjectMemberRole(projectId);
  const environmentsQuery = useEnvironments(projectId);
  const environmentDetailQuery = useEnvironment(projectId, selectedEnvironmentId ?? undefined);
  const editingEnvironmentQuery = useEnvironment(projectId, editingEnvironmentId ?? undefined);

  const createEnvironmentMutation = useCreateEnvironment(projectId);
  const updateEnvironmentMutation = useUpdateEnvironment(projectId);
  const deleteEnvironmentMutation = useDeleteEnvironment(projectId);
  const duplicateEnvironmentMutation = useDuplicateEnvironment(projectId);

  const environments = environmentsQuery.data?.items ?? EMPTY_ENVIRONMENTS;
  // 环境列表接口没有 search 参数：
  // 页面仅对当前已加载的环境列表做本地过滤。
  const filteredEnvironments = useMemo(
    () =>
      environments.filter((environment) => {
        if (!deferredSearchQuery) {
          return true;
        }

        return (
          environment.name.toLowerCase().includes(deferredSearchQuery) ||
          (environment.display_name || '').toLowerCase().includes(deferredSearchQuery) ||
          (environment.base_url || '').toLowerCase().includes(deferredSearchQuery)
        );
      }),
    [deferredSearchQuery, environments]
  );

  // 当前激活环境的确定逻辑：
  // 如果用户选中的环境还在过滤结果里，继续保留；否则回落到过滤结果中的第一条。
  const activeEnvironmentId =
    selectedEnvironmentId &&
    filteredEnvironments.some((environment) => environment.id === selectedEnvironmentId)
      ? selectedEnvironmentId
      : filteredEnvironments[0]?.id ?? null;

  // 详情优先使用单条详情接口返回的数据；
  // 若详情尚未加载完成，则回退到列表中的摘要数据，避免右侧面板闪空。
  const selectedEnvironmentSummary =
    filteredEnvironments.find((environment) => environment.id === activeEnvironmentId) || null;
  const selectedEnvironment =
    environmentDetailQuery.data || selectedEnvironmentSummary;
  const currentRole = memberRoleQuery.data?.role;
  const canWrite = currentRole ? WRITE_ROLES.includes(currentRole) : false;

  const totalEnvironments =
    environmentsQuery.data?.total ?? projectStatsQuery.data?.environment_count ?? 0;
  const withBaseUrlCount = environments.filter((environment) => Boolean(environment.base_url?.trim())).length;
  const withVariablesCount = environments.filter(
    (environment) => Object.keys(environment.variables || {}).length > 0
  ).length;
  const withHeadersCount = environments.filter(
    (environment) => Object.keys(environment.headers || {}).length > 0
  ).length;

  const environmentsPath = buildApiPath(`/projects/${projectId}/environments`);
  const activeEnvironmentPath = activeEnvironmentId
    ? buildApiPath(`/projects/${projectId}/environments/${activeEnvironmentId}`)
    : buildApiPath(`/projects/${projectId}/environments/:eid`);

  // 打开创建弹窗时清空编辑态，避免沿用上一条环境记录的数据。
  const openCreateDialog = () => {
    setFormMode('create');
    setEditingEnvironmentId(null);
    setIsFormOpen(true);
  };

  // 编辑弹窗复用共享表单逻辑，这里只负责切换到 edit 模式并记录环境 ID。
  const openEditDialog = (environmentId: number) => {
    setFormMode('edit');
    setEditingEnvironmentId(environmentId);
    setIsFormOpen(true);
  };

  // 创建和更新统一走一个提交入口：
  // 根据当前模式决定调用 create 还是 update。
  const handleEnvironmentSubmit = async (
    payload: CreateEnvironmentRequest | UpdateEnvironmentRequest
  ) => {
    try {
      if (formMode === 'create') {
        const createdEnvironment = await createEnvironmentMutation.mutateAsync(
          payload as CreateEnvironmentRequest
        );
        setSelectedEnvironmentId(createdEnvironment.id);
      } else if (editingEnvironmentId) {
        const updatedEnvironment = await updateEnvironmentMutation.mutateAsync({
          environmentId: editingEnvironmentId,
          data: payload as UpdateEnvironmentRequest,
        });
        setSelectedEnvironmentId(updatedEnvironment.id);
      }

      setIsFormOpen(false);
      setEditingEnvironmentId(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDeleteEnvironment = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteEnvironmentMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);

      if (selectedEnvironmentId === deleteTarget.id) {
        setSelectedEnvironmentId(null);
      }
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDuplicateEnvironment = async (payload: DuplicateEnvironmentRequest) => {
    if (!duplicateTarget) {
      return;
    }

    try {
      const duplicatedEnvironment = await duplicateEnvironmentMutation.mutateAsync({
        environmentId: duplicateTarget.id,
        data: payload,
      });
      setSelectedEnvironmentId(duplicatedEnvironment.id);
      setDuplicateTarget(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleRefresh = async () => {
    const tasks: Array<Promise<unknown>> = [
      projectQuery.refetch(),
      projectStatsQuery.refetch(),
      memberRoleQuery.refetch(),
      environmentsQuery.refetch(),
    ];

    if (activeEnvironmentId) {
      tasks.push(environmentDetailQuery.refetch());
    }

    await Promise.all(tasks);
  };

  const isHeaderRefreshing =
    projectQuery.isFetching ||
    projectStatsQuery.isFetching ||
    memberRoleQuery.isFetching ||
    environmentsQuery.isFetching;
  const headerActionItems: ActionMenuItem[] = [
    {
      key: 'environment-refresh',
      label: isHeaderRefreshing ? 'Refreshing...' : 'Refresh',
      icon: RefreshCw,
      disabled: isHeaderRefreshing,
      onSelect: () => {
        void handleRefresh();
      },
    },
    {
      key: 'environment-api-specs',
      label: 'API Specs',
      icon: FileJson2,
      href: buildProjectApiSpecsRoute(projectId),
      separatorBefore: true,
    },
    {
      key: 'environment-categories',
      label: 'Categories',
      icon: Tags,
      href: buildProjectCategoriesRoute(projectId),
    },
    {
      key: 'environment-test-cases',
      label: 'Test Cases',
      icon: FlaskConical,
      href: buildProjectTestCasesRoute(projectId),
    },
  ];
  const detailActionItems: ActionMenuItem[] = selectedEnvironment
    ? [
        {
          key: 'environment-duplicate',
          label: 'Duplicate',
          icon: Boxes,
          disabled: !canWrite,
          onSelect: () => setDuplicateTarget(selectedEnvironment),
        },
        {
          key: 'environment-delete',
          label: 'Delete',
          icon: Trash2,
          destructive: true,
          disabled: !canWrite,
          separatorBefore: true,
          onSelect: () => setDeleteTarget(selectedEnvironment),
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
                <h1 className="text-3xl font-bold tracking-tight">Environments</h1>
                <Globe className="h-6 w-6 text-primary" />
                <RoleBadge role={currentRole} />
              </div>

              <p className="max-w-4xl text-sm text-text-muted">
                管理项目
                {' '}
                <span className="font-semibold text-foreground">
                  {projectQuery.data?.name || `#${projectId}`}
                </span>
                {' '}
                的环境配置，对应后端入口为
                {' '}
                <code>{environmentsPath}</code>
                。
              </p>
            </div>

            {projectQuery.data ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {projectQuery.data.slug}
                </Badge>
                <Badge variant="outline">
                  {projectQuery.data.platform || 'No platform'}
                </Badge>
                <Badge variant="outline">{totalEnvironments} environments</Badge>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={openCreateDialog} disabled={!canWrite}>
              <Plus className="h-4 w-4" />
              Create Environment
            </Button>
            <ActionMenu
              items={headerActionItems}
              ariaLabel="Open environment management actions"
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
            ，可以查看环境配置，但不能执行创建、编辑、复制和删除。
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {environmentsQuery.isLoading || projectQuery.isLoading || projectStatsQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Environments"
              value={totalEnvironments}
              description={`Reported by project stats: ${projectStatsQuery.data?.environment_count ?? totalEnvironments}`}
              icon={Globe}
              variant="primary"
            />
            <StatCard
              title="With Base URL"
              value={withBaseUrlCount}
              description="Environment records that already define base_url"
              icon={ShieldCheck}
              variant="success"
            />
            <StatCard
              title="With Variables"
              value={withVariablesCount}
              description="Environment records containing variables payload"
              icon={Boxes}
              variant="warning"
            />
            <StatCard
              title="With Headers"
              value={withHeadersCount}
              description={deferredSearchQuery ? `Filtered by "${deferredSearchQuery}"` : 'Current project environments'}
              icon={FolderKanban}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="overflow-hidden border-border/50 shadow-premium">
          <CardHeader className="gap-4 border-b bg-muted/20">
            <div>
              <CardTitle>Environment List</CardTitle>
              <CardDescription>
                后端当前返回完整列表，无分页；页面只做本地过滤。
              </CardDescription>
            </div>

            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter by name, display name, or base URL"
              leftIcon={<Search className="size-4" />}
            />
          </CardHeader>

          <CardContent className="space-y-4 pt-6">
            {environmentsQuery.isLoading ? (
              <div className="space-y-3">
                <div className="h-14 animate-pulse rounded-xl bg-muted" />
                <div className="h-14 animate-pulse rounded-xl bg-muted" />
                <div className="h-14 animate-pulse rounded-xl bg-muted" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Base URL</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEnvironments.map((environment) => (
                      <TableRow
                        key={environment.id}
                        data-state={environment.id === activeEnvironmentId ? 'selected' : undefined}
                        className={cn(
                          'cursor-pointer transition-colors',
                          environment.id === activeEnvironmentId ? 'bg-muted/50' : ''
                        )}
                        onClick={() => {
                          setSelectedEnvironmentId(environment.id);
                          setDetailTab('overview');
                        }}
                      >
                        <TableCell className="min-w-[220px]">
                          <div className="space-y-1">
                            <div className="font-medium">{environment.name}</div>
                            <div className="text-xs text-muted-foreground">ID {environment.id}</div>
                          </div>
                        </TableCell>
                        <TableCell>{environment.display_name || 'Not set'}</TableCell>
                        <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                          {environment.base_url || 'Not set'}
                        </TableCell>
                        <TableCell>{formatDate(environment.updated_at, 'YYYY-MM-DD HH:mm')}</TableCell>
                        <TableCell className="text-right">
                          <ActionMenu
                            items={[
                              {
                                key: `environment-view-${environment.id}`,
                                label: 'View',
                                icon: Eye,
                                onSelect: () => {
                                  setSelectedEnvironmentId(environment.id);
                                  setDetailTab('overview');
                                },
                              },
                              {
                                key: `environment-edit-${environment.id}`,
                                label: 'Edit',
                                icon: Pencil,
                                disabled: !canWrite,
                                onSelect: () => openEditDialog(environment.id),
                              },
                              {
                                key: `environment-duplicate-${environment.id}`,
                                label: 'Duplicate',
                                icon: Boxes,
                                disabled: !canWrite,
                                onSelect: () => setDuplicateTarget(environment),
                              },
                              {
                                key: `environment-delete-${environment.id}`,
                                label: 'Delete',
                                icon: Trash2,
                                destructive: true,
                                disabled: !canWrite,
                                onSelect: () => setDeleteTarget(environment),
                              },
                            ]}
                            ariaLabel={`Open actions for ${environment.name}`}
                            stopPropagation
                          />
                        </TableCell>
                      </TableRow>
                    ))}

                    {filteredEnvironments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                          {environments.length === 0
                            ? 'No environments found. Create your first environment to get started.'
                            : 'No environments matched the current filter.'}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-premium">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>Selected Environment</CardTitle>
            <CardDescription>
              Detail from <code>{activeEnvironmentPath}</code>.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            {!selectedEnvironment ? (
              <Alert>
                <AlertTitle>No environment selected</AlertTitle>
                <AlertDescription>
                  从左侧列表中选择一个环境，查看它的详情、variables 和 headers。
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-2xl border border-primary/10 bg-linear-to-br from-primary/10 via-transparent to-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold">{selectedEnvironment.display_name || selectedEnvironment.name}</h2>
                        <Badge variant="outline" className="font-mono">
                          {selectedEnvironment.name}
                        </Badge>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {selectedEnvironment.base_url || 'No base URL configured'}
                      </p>
                    </div>

                    {/* 右侧详情卡片提供常用写操作，避免用户再回到左侧列表寻找按钮。 */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(selectedEnvironment.id)}
                        disabled={!canWrite}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <ActionMenu
                        items={detailActionItems}
                        ariaLabel="Open selected environment actions"
                        triggerVariant="outline"
                      />
                    </div>
                  </div>
                </div>

                <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as DetailTab)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="variables">Variables</TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Environment ID</div>
                        <div className="mt-2 font-mono text-sm">{selectedEnvironment.id}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project ID</div>
                        <div className="mt-2 font-mono text-sm">{selectedEnvironment.project_id}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created At</div>
                        <div className="mt-2 text-sm">{formatDate(selectedEnvironment.created_at, 'YYYY-MM-DD HH:mm')}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated At</div>
                        <div className="mt-2 text-sm">{formatDate(selectedEnvironment.updated_at, 'YYYY-MM-DD HH:mm')}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border p-4">
                      <div className="mb-2 text-sm font-medium">Base URL</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {selectedEnvironment.base_url || 'No base URL configured'}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Globe className="h-4 w-4" />
                        Connected API Endpoints
                      </div>
                      <div className="space-y-2 font-mono text-xs text-muted-foreground">
                        <div>GET {environmentsPath}</div>
                        <div>POST {environmentsPath}</div>
                        <div>GET {activeEnvironmentPath}</div>
                        <div>PATCH {activeEnvironmentPath}</div>
                        <div>DELETE {activeEnvironmentPath}</div>
                        <div>POST {activeEnvironmentPath}/duplicate</div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="variables">
                    <JsonPreview
                      title="Variables"
                      value={selectedEnvironment.variables}
                      emptyLabel="This environment does not define variables yet."
                    />
                  </TabsContent>

                  <TabsContent value="headers">
                    <JsonPreview
                      title="Headers"
                      value={selectedEnvironment.headers}
                      emptyLabel="This environment does not define headers yet."
                    />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </Card>
          </div>
        </div>
      </main>

      <EnvironmentFormDialog
        key={`${formMode}-${editingEnvironmentQuery.data?.id ?? 'new'}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        environment={formMode === 'edit' ? editingEnvironmentQuery.data ?? null : null}
        isLoadingEnvironment={formMode === 'edit' && editingEnvironmentQuery.isLoading}
        isSubmitting={createEnvironmentMutation.isPending || updateEnvironmentMutation.isPending}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingEnvironmentId(null);
          }
        }}
        onSubmit={handleEnvironmentSubmit}
      />

      <DeleteEnvironmentDialog
        open={Boolean(deleteTarget)}
        environment={deleteTarget}
        isDeleting={deleteEnvironmentMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDeleteEnvironment}
      />

      <DuplicateEnvironmentDialog
        key={`${duplicateTarget?.id ?? 'none'}-${duplicateTarget ? 'open' : 'closed'}`}
        open={Boolean(duplicateTarget)}
        environment={duplicateTarget}
        isSubmitting={duplicateEnvironmentMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicateTarget(null);
          }
        }}
        onSubmit={handleDuplicateEnvironment}
      />
    </>
  );
}

export default EnvironmentManagementPage;
