'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  Eye,
  EyeOff,
  FileJson2,
  FlaskConical,
  FolderKanban,
  Globe,
  Info,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
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
  variables: EnvironmentFieldRow[];
  variablesJson: string;
  headers: EnvironmentFieldRow[];
  headersJson: string;
}

// 复制环境弹窗草稿。
// 作用：承载 duplicate 接口所需的新名称和可选变量覆盖文本。
interface DuplicateEnvironmentDraft {
  name: string;
  overrideVars: EnvironmentFieldRow[];
  overrideVarsJson: string;
}

type EnvironmentFieldEditorMode = 'table' | 'json';
type EnvironmentFieldKind = 'variables' | 'headers';
type EnvironmentFieldValueType = 'string' | 'secret' | 'number' | 'boolean';

interface EnvironmentFieldRow {
  id: string;
  key: string;
  value: string;
  type: EnvironmentFieldValueType;
}

// 项目角色显示文案解析器。
// 作用：统一把 owner/admin/write/read 映射成首字母大写的角色标签。
const getRoleLabel = (t: ScopedTranslations<'project'>, role?: ProjectMemberRole) => {
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

// JSON 序列化辅助方法。
// 作用：把对象格式化成带缩进文本，供 textarea 初始值和详情预览复用。
const formatJson = (value: unknown) => {
  if (value === undefined || value === null) {
    return '';
  }

  return JSON.stringify(value, null, 2);
};

const createEnvironmentFieldRow = (
  overrides: Partial<EnvironmentFieldRow> = {}
): EnvironmentFieldRow => ({
  id:
    overrides.id ??
    `env-field-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
  key: overrides.key ?? '',
  value: overrides.value ?? '',
  type: overrides.type ?? 'string',
});

const isLikelySecretKey = (key: string) => {
  const normalizedKey = key.trim().toLowerCase();

  if (!normalizedKey) {
    return false;
  }

  return [
    'secret',
    'token',
    'password',
    'authorization',
    'api_key',
    'apikey',
    'client_secret',
    'access_key',
    'private_key',
  ].some(fragment => normalizedKey.includes(fragment));
};

const inferEnvironmentFieldType = (
  key: string,
  value: unknown,
  kind: EnvironmentFieldKind
): EnvironmentFieldValueType => {
  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (kind === 'headers' || isLikelySecretKey(key)) {
    return 'secret';
  }

  return 'string';
};

const recordToEnvironmentFieldRows = (
  value: Record<string, unknown> | Record<string, string> | undefined,
  kind: EnvironmentFieldKind
) => {
  if (!value || Object.keys(value).length === 0) {
    return [createEnvironmentFieldRow({ type: kind === 'headers' ? 'secret' : 'string' })];
  }

  return Object.entries(value).map(([key, item]) =>
    createEnvironmentFieldRow({
      key,
      value: typeof item === 'string' ? item : JSON.stringify(item),
      type: inferEnvironmentFieldType(key, item, kind),
    })
  );
};

const environmentFieldRowsToJson = (rows: EnvironmentFieldRow[], kind: EnvironmentFieldKind) => {
  const normalizedEntries = rows
    .map((row) => {
      const trimmedKey = row.key.trim();

      if (!trimmedKey) {
        return null;
      }

      return [trimmedKey, parseEnvironmentFieldValue(row, kind)] as const;
    })
    .filter((entry): entry is readonly [string, string | number | boolean] => Boolean(entry));

  if (normalizedEntries.length === 0) {
    return '';
  }

  return JSON.stringify(Object.fromEntries(normalizedEntries), null, 2);
};

const parseEnvironmentFieldValue = (
  row: EnvironmentFieldRow,
  kind: EnvironmentFieldKind
): string | number | boolean => {
  if (kind === 'headers') {
    return row.value;
  }

  switch (row.type) {
    case 'number': {
      const trimmedValue = row.value.trim();

      if (!trimmedValue) {
        return 0;
      }

      return Number(trimmedValue);
    }
    case 'boolean':
      return row.value === 'true';
    default:
      return row.value;
  }
};

const buildVariablesRecordFromRows = (
  rows: EnvironmentFieldRow[],
  t: ScopedTranslations<'project'>
) => {
  const entries: Array<[string, string | number | boolean]> = [];

  rows.forEach((row, index) => {
    const trimmedKey = row.key.trim();

    if (!trimmedKey) {
      if (row.value.trim()) {
        throw new Error(
          t('environments.keyRequiredForRow', {
            row: index + 1,
          })
        );
      }
      return;
    }

    if (row.type === 'number') {
      const trimmedValue = row.value.trim();

      if (!trimmedValue || Number.isNaN(Number(trimmedValue))) {
        throw new Error(
          t('environments.invalidNumberValue', {
            key: trimmedKey,
          })
        );
      }
    }

    entries.push([trimmedKey, parseEnvironmentFieldValue(row, 'variables')]);
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as Record<string, unknown>;
};

const buildHeadersRecordFromRows = (
  rows: EnvironmentFieldRow[],
  t: ScopedTranslations<'project'>
) => {
  const entries: Array<[string, string]> = [];

  rows.forEach((row, index) => {
    const trimmedKey = row.key.trim();

    if (!trimmedKey) {
      if (row.value.trim()) {
        throw new Error(
          t('environments.keyRequiredForRow', {
            row: index + 1,
          })
        );
      }
      return;
    }

    entries.push([trimmedKey, row.value]);
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
};

const parseObjectJsonToRows = (
  value: string,
  label: string,
  t: ScopedTranslations<'project'>,
  kind: EnvironmentFieldKind
) => {
  const parsed = parseObjectJsonInput<Record<string, unknown>>(value, label, t);
  return recordToEnvironmentFieldRows(parsed, kind);
};

const maskSecretPreview = (value: string) => {
  if (!value) {
    return '';
  }

  if (value.length <= 4) {
    return '•'.repeat(Math.max(value.length, 4));
  }

  return `${'•'.repeat(Math.min(Math.max(value.length - 4, 4), 12))}${value.slice(-4)}`;
};

// JSON 输入解析器。
// 作用：统一解析对象类型输入，并在格式不合法时抛出中文错误。
const parseObjectJsonInput = <T extends Record<string, unknown> | Record<string, string>>(
  value: string,
  label: string,
  t: ScopedTranslations<'project'>
) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedValue);
  } catch {
    throw new Error(t('common.jsonMustBeValidObject', { label }));
  }

  if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
    throw new Error(t('common.jsonMustBeObject', { label }));
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
  variables: recordToEnvironmentFieldRows(environment?.variables, 'variables'),
  variablesJson: formatJson(environment?.variables),
  headers: recordToEnvironmentFieldRows(environment?.headers, 'headers'),
  headersJson: formatJson(environment?.headers),
});

// 复制环境弹窗默认值。
// 作用：根据源环境推导新名称，并初始化可选的 override variables 文本。
const getDuplicateEnvironmentDraft = (
  environment?: ProjectEnvironment | null
): DuplicateEnvironmentDraft => ({
  name: environment ? `${environment.name} Copy` : '',
  overrideVars: recordToEnvironmentFieldRows(undefined, 'variables'),
  overrideVarsJson: '',
});

// 角色徽章。
// 作用：在页面头部清晰展示当前用户对该项目环境的操作权限。
function RoleBadge({ role }: { role?: ProjectMemberRole }) {
  const t = useT('project');

  return (
    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
      {t('roles.badge', { role: getRoleLabel(t, role) })}
    </Badge>
  );
}

function EnvironmentFieldPreview({
  value,
  emptyLabel,
}: {
  value?: Record<string, unknown> | Record<string, string>;
  emptyLabel: string;
}) {
  const t = useT('project');
  const [visibleSecretKeys, setVisibleSecretKeys] = useState<Record<string, boolean>>({});
  const entries = Object.entries(value ?? {});

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader className="bg-muted/15">
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('environments.fieldTableKey')}</TableHead>
            <TableHead>{t('environments.fieldTableType')}</TableHead>
            <TableHead>{t('environments.fieldTableValue')}</TableHead>
            <TableHead className="w-[96px] text-right">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, rawValue]) => {
            const stringValue =
              typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
            const secret = isLikelySecretKey(key);
            const visible = visibleSecretKeys[key] ?? false;

            return (
              <TableRow key={key}>
                <TableCell className="font-mono text-xs">{key}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {typeof rawValue === 'boolean'
                      ? t('environments.fieldTypeBoolean')
                      : typeof rawValue === 'number'
                        ? t('environments.fieldTypeNumber')
                        : secret
                          ? t('environments.fieldTypeSecret')
                          : t('environments.fieldTypeString')}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {secret && !visible ? maskSecretPreview(stringValue) : stringValue}
                </TableCell>
                <TableCell className="text-right">
                  {secret ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setVisibleSecretKeys(current => ({
                          ...current,
                          [key]: !visible,
                        }))
                      }
                    >
                      {visible ? (
                        <>
                          <EyeOff className="size-4" />
                          {t('environments.hideSecret')}
                        </>
                      ) : (
                        <>
                          <Eye className="size-4" />
                          {t('environments.showSecret')}
                        </>
                      )}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function EnvironmentFieldEditor({
  label,
  kind,
  rows,
  jsonValue,
  mode,
  errorText,
  onRowsChange,
  onJsonChange,
  onModeChange,
}: {
  label: string;
  kind: EnvironmentFieldKind;
  rows: EnvironmentFieldRow[];
  jsonValue: string;
  mode: EnvironmentFieldEditorMode;
  errorText?: string;
  onRowsChange: (rows: EnvironmentFieldRow[]) => void;
  onJsonChange: (value: string) => void;
  onModeChange: (mode: EnvironmentFieldEditorMode) => void;
}) {
  const t = useT('project');
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  const updateRow = (rowId: string, updater: (row: EnvironmentFieldRow) => EnvironmentFieldRow) => {
    onRowsChange(rows.map(row => (row.id === rowId ? updater(row) : row)));
  };

  const addRow = () => {
    onRowsChange([
      ...rows,
      createEnvironmentFieldRow({ type: kind === 'headers' ? 'secret' : 'string' }),
    ]);
  };

  const removeRow = (rowId: string) => {
    const nextRows = rows.filter(row => row.id !== rowId);
    onRowsChange(
      nextRows.length > 0
        ? nextRows
        : [createEnvironmentFieldRow({ type: kind === 'headers' ? 'secret' : 'string' })]
    );
    setVisibleSecrets(current => {
      const nextVisible = { ...current };
      delete nextVisible[rowId];
      return nextVisible;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label>{label}</Label>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-3.5" />
            <span>
              {kind === 'variables'
                ? t('environments.variablesEditorHint')
                : t('environments.headersEditorHint')}
            </span>
          </div>
        </div>

        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(nextMode) => {
            if (nextMode === 'table' || nextMode === 'json') {
              onModeChange(nextMode);
            }
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="table">{t('environments.tableMode')}</ToggleGroupItem>
          <ToggleGroupItem value="json">{t('environments.jsonMode')}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {mode === 'table' ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/15">
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('environments.fieldTableKey')}</TableHead>
                  <TableHead className="w-[140px]">{t('environments.fieldTableType')}</TableHead>
                  <TableHead>{t('environments.fieldTableValue')}</TableHead>
                  <TableHead className="w-[80px] text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => {
                  const secret = row.type === 'secret';
                  const visible = visibleSecrets[row.id] ?? false;

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input
                          value={row.key}
                          onChange={(event) =>
                            updateRow(row.id, current => ({
                              ...current,
                              key: event.target.value,
                              type:
                                kind === 'headers'
                                  ? current.type
                                  : isLikelySecretKey(event.target.value) && current.type === 'string'
                                    ? 'secret'
                                    : current.type,
                            }))
                          }
                          placeholder={
                            kind === 'variables'
                              ? t('environments.variableKeyPlaceholder')
                              : t('environments.headerKeyPlaceholder')
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.type}
                          onValueChange={(nextType) =>
                            updateRow(row.id, current => ({
                              ...current,
                              type: nextType as EnvironmentFieldValueType,
                              value:
                                nextType === 'boolean' &&
                                current.value !== 'true' &&
                                current.value !== 'false'
                                  ? 'false'
                                  : current.value,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">{t('environments.fieldTypeString')}</SelectItem>
                            <SelectItem value="secret">{t('environments.fieldTypeSecret')}</SelectItem>
                            {kind === 'variables' ? (
                              <SelectItem value="number">{t('environments.fieldTypeNumber')}</SelectItem>
                            ) : null}
                            {kind === 'variables' ? (
                              <SelectItem value="boolean">{t('environments.fieldTypeBoolean')}</SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {row.type === 'boolean' ? (
                          <Select
                            value={row.value === 'true' ? 'true' : 'false'}
                            onValueChange={(nextValue) =>
                              updateRow(row.id, current => ({
                                ...current,
                                value: nextValue,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">true</SelectItem>
                              <SelectItem value="false">false</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={secret && !visible ? 'password' : 'text'}
                            value={row.value}
                            onChange={(event) =>
                              updateRow(row.id, current => ({
                                ...current,
                                value: event.target.value,
                              }))
                            }
                            placeholder={
                              kind === 'variables'
                                ? t('environments.variableValuePlaceholder')
                                : t('environments.headerValuePlaceholder')
                            }
                            rightIcon={
                              secret ? (
                                <button
                                  type="button"
                                  className="pointer-events-auto rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                                  onClick={() =>
                                    setVisibleSecrets(current => ({
                                      ...current,
                                      [row.id]: !visible,
                                    }))
                                  }
                                >
                                  {visible ? (
                                    <EyeOff className="size-4" />
                                  ) : (
                                    <Eye className="size-4" />
                                  )}
                                </button>
                              ) : undefined
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeRow(row.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="size-4" />
              {t('environments.addRow')}
            </Button>
            {errorText ? (
              <p className="text-xs font-medium text-destructive">{errorText}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <Textarea
          value={jsonValue}
          onChange={(event) => onJsonChange(event.target.value)}
          rows={14}
          placeholder={
            kind === 'variables'
              ? '{"API_URL": "https://api.example.com", "DEBUG": false}'
              : '{"Authorization": "Bearer {{token}}"}'
          }
          errorText={errorText}
          root
        />
      )}
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
  const i18n = useT();
  const t = i18n.project;
  const [draft, setDraft] = useState<EnvironmentFormDraft>(() => getEnvironmentFormDraft(environment));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [variablesMode, setVariablesMode] = useState<EnvironmentFieldEditorMode>('table');
  const [headersMode, setHeadersMode] = useState<EnvironmentFieldEditorMode>('table');

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
      nextErrors.name = t('environments.nameRequired');
    }

    try {
      if (variablesMode === 'json') {
        variables = parseObjectJsonInput<Record<string, unknown>>(
          draft.variablesJson,
          t('common.variablesJson'),
          t
        );
      } else {
        variables = buildVariablesRecordFromRows(draft.variables, t);
      }
    } catch (error) {
      nextErrors.variables =
        error instanceof Error
          ? error.message
          : t('common.parseFailed', { label: t('common.variablesJson') });
    }

    try {
      if (headersMode === 'json') {
        const parsedHeaders = parseObjectJsonInput<Record<string, unknown>>(
          draft.headersJson,
          t('common.headersJson'),
          t
        );
        headers = parsedHeaders ? toStringRecord(parsedHeaders) : undefined;
      } else {
        headers = buildHeadersRecordFromRows(draft.headers, t);
      }
    } catch (error) {
      nextErrors.headers =
        error instanceof Error
          ? error.message
          : t('common.parseFailed', { label: t('common.headersJson') });
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
          <DialogTitle>
            {mode === 'create'
              ? t('environments.createDialogTitle')
              : t('environments.editDialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? t('environments.createDialogDescription')
              : t('environments.editDialogDescription')}
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
              <AlertTitle>{t('environments.unableToLoadDetails')}</AlertTitle>
              <AlertDescription>
                {t('environments.unableToLoadDetailsDescription')}
              </AlertDescription>
            </Alert>
          ) : (
            <form id="environment-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="environment-name">{t('common.name')}</Label>
                  <Input
                    id="environment-name"
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                    placeholder={t('environments.systemName')}
                    errorText={errors.name}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment-display-name">{t('common.displayName')}</Label>
                  <Input
                    id="environment-display-name"
                    value={draft.displayName}
                    onChange={(event) => updateDraft('displayName', event.target.value)}
                    placeholder={t('common.displayName')}
                    root
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment-base-url">{t('common.baseUrl')}</Label>
                <Input
                  id="environment-base-url"
                  value={draft.baseUrl}
                  onChange={(event) => updateDraft('baseUrl', event.target.value)}
                  placeholder="https://api.example.com"
                  root
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <EnvironmentFieldEditor
                  label={t('common.variables')}
                  kind="variables"
                  rows={draft.variables}
                  jsonValue={draft.variablesJson}
                  mode={variablesMode}
                  errorText={errors.variables}
                  onRowsChange={(rows) =>
                    setDraft(current => ({
                      ...current,
                      variables: rows,
                      variablesJson: environmentFieldRowsToJson(rows, 'variables'),
                    }))
                  }
                  onJsonChange={(value) => updateDraft('variablesJson', value)}
                  onModeChange={(nextMode) => {
                    if (nextMode === 'json' && !draft.variablesJson.trim()) {
                      updateDraft('variablesJson', environmentFieldRowsToJson(draft.variables, 'variables'));
                    }

                    if (nextMode === 'table') {
                      try {
                        const nextRows = parseObjectJsonToRows(
                          draft.variablesJson,
                          t('common.variablesJson'),
                          t,
                          'variables'
                        );
                        setDraft(current => ({
                          ...current,
                          variables: nextRows,
                        }));
                        setErrors(current => ({ ...current, variables: '' }));
                      } catch {}
                    }

                    setVariablesMode(nextMode);
                  }}
                />

                <EnvironmentFieldEditor
                  label={t('common.headers')}
                  kind="headers"
                  rows={draft.headers}
                  jsonValue={draft.headersJson}
                  mode={headersMode}
                  errorText={errors.headers}
                  onRowsChange={(rows) =>
                    setDraft(current => ({
                      ...current,
                      headers: rows,
                      headersJson: environmentFieldRowsToJson(rows, 'headers'),
                    }))
                  }
                  onJsonChange={(value) => updateDraft('headersJson', value)}
                  onModeChange={(nextMode) => {
                    if (nextMode === 'json' && !draft.headersJson.trim()) {
                      updateDraft('headersJson', environmentFieldRowsToJson(draft.headers, 'headers'));
                    }

                    if (nextMode === 'table') {
                      try {
                        const nextRows = parseObjectJsonToRows(
                          draft.headersJson,
                          t('common.headersJson'),
                          t,
                          'headers'
                        );
                        setDraft(current => ({
                          ...current,
                          headers: nextRows,
                        }));
                        setErrors(current => ({ ...current, headers: '' }));
                      } catch {}
                    }

                    setHeadersMode(nextMode);
                  }}
                />
              </div>
            </form>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {i18n.common('cancel')}
          </Button>
          <Button
            type="submit"
            form="environment-form"
            loading={isSubmitting}
            disabled={(mode === 'edit' && (isLoadingEnvironment || !environment)) || isSubmitting}
          >
            {mode === 'create'
              ? t('environments.createButton')
              : t('environments.saveButton')}
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
  const i18n = useT();
  const t = i18n.project;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('environments.deleteDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('environments.deleteDialogDescription', {
              name: environment?.name || t('common.unknown'),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert variant="destructive">
            <AlertTitle>{t('common.irreversibleAction')}</AlertTitle>
            <AlertDescription>
              {t('environments.deleteWarning')}
            </AlertDescription>
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {i18n.common('cancel')}
          </Button>
          <Button type="button" variant="destructive" loading={isDeleting} onClick={() => void onConfirm()}>
            {t('common.delete')}
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
  const i18n = useT();
  const t = i18n.project;
  const [draft, setDraft] = useState<DuplicateEnvironmentDraft>(() =>
    getDuplicateEnvironmentDraft(environment)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [overrideMode, setOverrideMode] = useState<EnvironmentFieldEditorMode>('table');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const trimmedName = draft.name.trim();
    let overrideVars: Record<string, unknown> | undefined;

    if (!trimmedName) {
      nextErrors.name = t('environments.newNameRequired');
    }

    try {
      if (overrideMode === 'json') {
        overrideVars = parseObjectJsonInput<Record<string, unknown>>(
          draft.overrideVarsJson,
          t('common.overrideVariablesJson'),
          t
        );
      } else {
        overrideVars = buildVariablesRecordFromRows(draft.overrideVars, t);
      }
    } catch (error) {
      nextErrors.overrideVars =
        error instanceof Error
          ? error.message
          : t('common.parseFailed', { label: t('common.overrideVariablesJson') });
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
          <DialogTitle>{t('environments.duplicateDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('environments.duplicateDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="environment-duplicate-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="duplicate-environment-name">{t('environments.newEnvironmentName')}</Label>
              <Input
                id="duplicate-environment-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="production-copy"
                errorText={errors.name}
                root
              />
            </div>

            <EnvironmentFieldEditor
              label={t('common.variables')}
              kind="variables"
              rows={draft.overrideVars}
              jsonValue={draft.overrideVarsJson}
              mode={overrideMode}
              errorText={errors.overrideVars}
              onRowsChange={(rows) =>
                setDraft(current => ({
                  ...current,
                  overrideVars: rows,
                  overrideVarsJson: environmentFieldRowsToJson(rows, 'variables'),
                }))
              }
              onJsonChange={(value) =>
                setDraft(current => ({ ...current, overrideVarsJson: value }))
              }
              onModeChange={(nextMode) => {
                if (nextMode === 'json' && !draft.overrideVarsJson.trim()) {
                  setDraft(current => ({
                    ...current,
                    overrideVarsJson: environmentFieldRowsToJson(current.overrideVars, 'variables'),
                  }));
                }

                if (nextMode === 'table') {
                  try {
                    const nextRows = parseObjectJsonToRows(
                      draft.overrideVarsJson,
                      t('common.overrideVariablesJson'),
                      t,
                      'variables'
                    );
                    setDraft(current => ({
                      ...current,
                      overrideVars: nextRows,
                    }));
                    setErrors(current => ({ ...current, overrideVars: '' }));
                  } catch {}
                }

                setOverrideMode(nextMode);
              }}
            />
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {i18n.common('cancel')}
          </Button>
          <Button type="submit" form="environment-duplicate-form" loading={isSubmitting}>
            {t('common.duplicate')}
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
  projectId: number | string;
}) {
  const i18n = useT();
  const t = i18n.project;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<number | string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [formMode, setFormMode] = useState<EnvironmentFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<number | string | null>(null);
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
  const openEditDialog = (environmentId: number | string) => {
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
      label: isHeaderRefreshing ? i18n.common('refreshing') : i18n.common('refresh'),
      icon: RefreshCw,
      disabled: isHeaderRefreshing,
      onSelect: () => {
        void handleRefresh();
      },
    },
    {
      key: 'environment-api-specs',
      label: t('modules.apiSpecs.label'),
      icon: FileJson2,
      href: buildProjectApiSpecsRoute(projectId),
      separatorBefore: true,
    },
    {
      key: 'environment-categories',
      label: t('modules.categories.label'),
      icon: Tags,
      href: buildProjectCategoriesRoute(projectId),
    },
    {
      key: 'environment-test-cases',
      label: t('modules.testCases.label'),
      icon: FlaskConical,
      href: buildProjectTestCasesRoute(projectId),
    },
  ];
  const detailActionItems: ActionMenuItem[] = selectedEnvironment
    ? [
        {
          key: 'environment-duplicate',
          label: i18n.common('duplicate'),
          icon: Boxes,
          disabled: !canWrite,
          onSelect: () => setDuplicateTarget(selectedEnvironment),
        },
        {
          key: 'environment-delete',
          label: i18n.common('delete'),
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
                {t('common.backToProjectOverview')}
              </Link>
            </Button>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{t('environments.title')}</h1>
                <Globe className="h-6 w-6 text-primary" />
                <RoleBadge role={currentRole} />
              </div>

              <p className="max-w-4xl text-sm text-text-muted">
                {t('environments.currentDescriptionEmpty')}
              </p>
            </div>

            {projectQuery.data ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {projectQuery.data.slug}
                </Badge>
                <Badge variant="outline">
                  {projectQuery.data.platform || t('common.notSet')}
                </Badge>
                <Badge variant="outline">{t('environments.countBadge', { count: totalEnvironments })}</Badge>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={openCreateDialog} disabled={!canWrite}>
              <Plus className="h-4 w-4" />
              {t('environments.createButton')}
            </Button>
            <ActionMenu
              items={headerActionItems}
              ariaLabel={t('environments.openManagementActions')}
              triggerVariant="outline"
            />
          </div>
        </div>
      </div>

      {!canWrite && memberRoleQuery.isSuccess ? (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>{t('common.readOnlyAccess')}</AlertTitle>
          <AlertDescription>
            {t('environments.readOnlyDescription', {
              role: getRoleLabel(t, currentRole),
            })}
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
              title={t('environments.totalEnvironments')}
              value={totalEnvironments}
              description={t('environments.reportedByStats', {
                count: projectStatsQuery.data?.environment_count ?? totalEnvironments,
              })}
              icon={Globe}
              variant="primary"
            />
            <StatCard
              title={t('environments.withBaseUrl')}
              value={withBaseUrlCount}
              description={t('environments.withBaseUrlDescription')}
              icon={ShieldCheck}
              variant="success"
            />
            <StatCard
              title={t('environments.withVariables')}
              value={withVariablesCount}
              description={t('environments.withVariablesDescription')}
              icon={Boxes}
              variant="warning"
            />
            <StatCard
              title={t('environments.withHeaders')}
              value={withHeadersCount}
              description={
                deferredSearchQuery
                  ? t('environments.searchFilteredBy', { query: deferredSearchQuery })
                  : t('environments.currentProjectEnvironments')
              }
              icon={FolderKanban}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="overflow-hidden border-border/50 shadow-premium">
          <CardHeader className="gap-4 border-b bg-muted/20">
            <div>
              <CardTitle>{t('environments.listTitle')}</CardTitle>
              <CardDescription>
                {t('environments.listDescription')}
              </CardDescription>
            </div>

            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('environments.filterPlaceholder')}
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
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>{t('common.displayName')}</TableHead>
                      <TableHead>{t('common.baseUrl')}</TableHead>
                      <TableHead>{t('common.updated')}</TableHead>
                      <TableHead className="text-right">{t('common.openActions')}</TableHead>
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
                            <div className="text-xs text-muted-foreground">
                              {t('environments.environmentId')}: {environment.id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{environment.display_name || t('common.notSet')}</TableCell>
                        <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                          {environment.base_url || t('common.notSet')}
                        </TableCell>
                        <TableCell>{formatDate(environment.updated_at, 'YYYY-MM-DD HH:mm')}</TableCell>
                        <TableCell className="text-right">
                          <ActionMenu
                            items={[
                              {
                                key: `environment-view-${environment.id}`,
                                label: t('common.open'),
                                icon: Eye,
                                onSelect: () => {
                                  setSelectedEnvironmentId(environment.id);
                                  setDetailTab('overview');
                                },
                              },
                              {
                                key: `environment-edit-${environment.id}`,
                                label: i18n.common('edit'),
                                icon: Pencil,
                                disabled: !canWrite,
                                onSelect: () => openEditDialog(environment.id),
                              },
                              {
                                key: `environment-duplicate-${environment.id}`,
                                label: i18n.common('duplicate'),
                                icon: Boxes,
                                disabled: !canWrite,
                                onSelect: () => setDuplicateTarget(environment),
                              },
                              {
                                key: `environment-delete-${environment.id}`,
                                label: i18n.common('delete'),
                                icon: Trash2,
                                destructive: true,
                                disabled: !canWrite,
                                onSelect: () => setDeleteTarget(environment),
                              },
                            ]}
                            ariaLabel={i18n.common('openActions')}
                            stopPropagation
                          />
                        </TableCell>
                      </TableRow>
                    ))}

                    {filteredEnvironments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                          {environments.length === 0
                            ? t('environments.noEnvironmentsYetDescription')
                            : t('environments.noMatchingDescription')}
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
            <CardTitle>{t('environments.selectedTitle')}</CardTitle>
            <CardDescription>
              {t('environments.currentDescriptionWithSelection')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            {!selectedEnvironment ? (
              <Alert>
                <AlertTitle>{t('environments.selectEnvironmentTitle')}</AlertTitle>
                <AlertDescription>
                  {t('environments.selectEnvironmentDescription')}
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
                        {selectedEnvironment.base_url || t('environments.baseUrlMissing')}
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
                        {i18n.common('edit')}
                      </Button>
                      <ActionMenu
                        items={detailActionItems}
                        ariaLabel={t('environments.openSelectedActions')}
                        triggerVariant="outline"
                      />
                    </div>
                  </div>
                </div>

                <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as DetailTab)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">{t('environments.overview')}</TabsTrigger>
                    <TabsTrigger value="variables">{t('common.variablesJson')}</TabsTrigger>
                    <TabsTrigger value="headers">{t('common.headersJson')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('environments.environmentId')}</div>
                        <div className="mt-2 font-mono text-sm">{selectedEnvironment.id}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('common.projectId')}</div>
                        <div className="mt-2 font-mono text-sm">{selectedEnvironment.project_id}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('common.created')}</div>
                        <div className="mt-2 text-sm">{formatDate(selectedEnvironment.created_at, 'YYYY-MM-DD HH:mm')}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('common.updated')}</div>
                        <div className="mt-2 text-sm">{formatDate(selectedEnvironment.updated_at, 'YYYY-MM-DD HH:mm')}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border p-4">
                      <div className="mb-2 text-sm font-medium">{t('common.baseUrl')}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {selectedEnvironment.base_url || t('environments.baseUrlMissing')}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Globe className="h-4 w-4" />
                        {t('environments.apiSurface')}
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
                    <EnvironmentFieldPreview
                      value={selectedEnvironment.variables}
                      emptyLabel={t('common.noData')}
                    />
                  </TabsContent>

                  <TabsContent value="headers">
                    <EnvironmentFieldPreview
                      value={selectedEnvironment.headers}
                      emptyLabel={t('common.noData')}
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
