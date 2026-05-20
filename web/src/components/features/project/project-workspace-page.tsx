'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  Bot,
  Boxes,
  Clock3,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  FileClock,
  FileCode2,
  FileJson2,
  FlaskConical,
  Globe,
  KeyRound,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react';
import { ActionMenu, type ActionMenuItem } from '@/components/features/project/action-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiExternalBaseUrl, buildApiPath } from '@/config/api';
import { ApiRequestWorkbench } from '@/components/features/project/api-request-workbench';
import { ApiSpecAICreateDialog } from '@/components/features/project/api-spec-ai-create-dialog';
import {
  AiActionDialog,
  BatchGenDocDialog,
  DeleteSpecDialog,
  downloadExportPayload,
  ExampleFormDialog,
  ExportSpecsDialog,
  ImportSpecsDialog,
  SpecFormDialog,
} from '@/components/features/project/api-spec-management-page';
import {
  buildCategoryOptions,
  findProjectCategory,
  flattenProjectCategories,
} from '@/components/features/project/category-helpers';
import { CategoryFormDialog } from '@/components/features/project/category-shared';
import { ProjectFlowManagementPage } from '@/components/features/project/flow-management-page';
import { getProjectModuleCopy } from '@/components/features/project/project-i18n';
import {
  buildProjectWorkspaceRoute,
  getProjectWorkspaceModuleMeta,
  type ProjectWorkspaceModule,
} from '@/components/features/project/project-navigation';
import {
  buildApiSpecShareRoute,
  buildProjectApiSpecsRoute,
  buildProjectCategoriesRoute,
  buildProjectDetailRoute,
  buildProjectEnvironmentsRoute,
  buildProjectHistoriesRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';
import {
  useAcceptApiSpecAIDraft,
  useApiSpec,
  useApiSpecFull,
  useApiSpecShare,
  useApiSpecs,
  useBatchGenApiDocs,
  useCreateApiExample,
  useCreateApiSpecAIDraftStream,
  useCreateApiSpec,
  useDeleteApiSpec,
  useDeleteApiSpecShare,
  useExportApiSpecs,
  useGenApiDoc,
  useGenApiTest,
  useGeneratedApiTest,
  useImportApiSpecs,
  usePublishApiSpecShare,
  useProjectApiCategories,
  useRefineApiSpecAIDraft,
  useUpdateApiSpec,
} from '@/hooks/use-api-specs';
import {
  useCreateCategory,
  useProjectCategories,
  useProjectCategory,
} from '@/hooks/use-categories';
import { useProjectMemberRole } from '@/hooks/use-members';
import {
  useCreateEnvironment,
  useDeleteEnvironment,
  useDuplicateEnvironment,
  useEnvironment,
  useEnvironments,
  useUpdateEnvironment,
} from '@/hooks/use-environments';
import { useProjectHistories, useProjectHistory } from '@/hooks/use-histories';
import { useGenerateProjectCliToken, useProject } from '@/hooks/use-projects';
import type {
  ApiSpec,
  ApiSpecExportFormat,
  ApiSpecLanguage,
  BatchGenDocRequest,
  CreateApiExampleRequest,
  CreateApiSpecRequest,
  HttpMethod,
  UpdateApiSpecRequest,
} from '@/types/api-spec';
import type { CreateCategoryRequest, ProjectCategory } from '@/types/category';
import type {
  CreateEnvironmentRequest,
  DuplicateEnvironmentRequest,
  ProjectEnvironment,
  UpdateEnvironmentRequest,
} from '@/types/environment';
import type { ProjectHistory } from '@/types/history';
import { PROJECT_MEMBER_WRITE_ROLES, type ProjectMemberRole } from '@/types/member';
import type { GenerateProjectCliTokenResponse } from '@/types/project';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import { buildKestConnectionKey } from '@/utils/kest-connection-key';
import { cn, formatDate } from '@/utils';
import { toast } from 'sonner';

const MAX_MODULE_ITEMS = 500;
const EMPTY_SPECS: ApiSpec[] = [];
const EMPTY_CATEGORIES: ProjectCategory[] = [];
const EMPTY_ENVIRONMENTS: ProjectEnvironment[] = [];
const EMPTY_HISTORIES: ProjectHistory[] = [];
const SPEC_METHOD_OPTIONS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
];
const WRITE_ROLES = PROJECT_MEMBER_WRITE_ROLES;

interface ApiSpecSidebarGroup {
  key: string;
  label: string;
  depth: number;
  categoryId?: string | null;
  specs: ApiSpec[];
}

const buildModuleHref = (
  projectId: number | string,
  module: ProjectWorkspaceModule,
  itemId?: string | number | null
) => {
  const baseRoute = buildProjectWorkspaceRoute(projectId, module);

  if (!itemId) {
    return baseRoute;
  }

  return `${baseRoute}?item=${itemId}`;
};

const formatJson = (value: unknown) => {
  if (value === undefined || value === null) {
    return 'No data';
  }

  return JSON.stringify(value, null, 2);
};

const getHistoryDataRecord = (history?: ProjectHistory | null) => {
  if (!history?.data || typeof history.data !== 'object' || Array.isArray(history.data)) {
    return null;
  }

  return history.data as Record<string, unknown>;
};

const getHistoryNestedRecord = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const getHistoryNestedList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => !!getHistoryNestedRecord(item));
};

const getHistoryString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const getHistoryNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getHistoryBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }
  return null;
};

const formatHistoryDuration = (value: unknown) => {
  const duration = getHistoryNumber(value);
  return duration === null ? null : `${duration}ms`;
};

const isRequestHistoryRecord = (history?: ProjectHistory | null) =>
  history?.entity_type === 'cli_request' || history?.entity_type === 'request';

const isRunHistoryRecord = (history?: ProjectHistory | null) =>
  history?.entity_type === 'cli_run';

const getCLIRequestRecord = (history?: ProjectHistory | null) => {
  if (!isRequestHistoryRecord(history)) {
    return null;
  }
  return getHistoryNestedRecord(getHistoryDataRecord(history)?.request);
};

const getCLIRequestResponseRecord = (history?: ProjectHistory | null) => {
  if (!isRequestHistoryRecord(history)) {
    return null;
  }
  return getHistoryNestedRecord(getHistoryDataRecord(history)?.response);
};

const getCLIRunRecord = (history?: ProjectHistory | null) => {
  if (!isRunHistoryRecord(history)) {
    return null;
  }
  return getHistoryNestedRecord(getHistoryDataRecord(history)?.run);
};

const getCLIRunResults = (history?: ProjectHistory | null) =>
  isRunHistoryRecord(history)
    ? getHistoryNestedList(getHistoryDataRecord(history)?.results)
    : [];

const getCLIRunLogRecord = (history?: ProjectHistory | null) =>
  isRunHistoryRecord(history)
    ? getHistoryNestedRecord(getHistoryDataRecord(history)?.log)
    : null;

const getHistoryRequestTitle = (history?: ProjectHistory | null) => {
  const requestRecord = getCLIRequestRecord(history);
  if (!requestRecord) {
    return null;
  }

  const method = getHistoryString(requestRecord.method) ?? 'REQUEST';
  const path = getHistoryString(requestRecord.path);
  const url = getHistoryString(requestRecord.url);
  return [method.toUpperCase(), path || url || `record #${history?.entity_id}`]
    .filter(Boolean)
    .join(' ');
};

const getHistoryRequestStatus = (history?: ProjectHistory | null) =>
  getHistoryNumber(getCLIRequestResponseRecord(history)?.status);

const getHistoryRequestDuration = (history?: ProjectHistory | null) =>
  formatHistoryDuration(getCLIRequestResponseRecord(history)?.duration_ms);

const getHistoryRunSourceName = (history?: ProjectHistory | null) =>
  getHistoryString(getCLIRunRecord(history)?.source_name);

const getHistoryRunStepCount = (history?: ProjectHistory | null) =>
  getHistoryNumber(getCLIRunRecord(history)?.total_steps);

const getHistoryFlowName = (history?: ProjectHistory | null) => {
  const flowRecord = getHistoryNestedRecord(getHistoryDataRecord(history)?.flow);
  const flowName = flowRecord?.name;
  return typeof flowName === 'string' && flowName.trim() ? flowName.trim() : null;
};

const getHistoryRunStatus = (history?: ProjectHistory | null) => {
  const runRecord = getHistoryNestedRecord(getHistoryDataRecord(history)?.run);
  const status = runRecord?.status;
  return typeof status === 'string' && status.trim() ? status.trim() : null;
};

const getHistoryExecutionMode = (history?: ProjectHistory | null) => {
  const runRecord = getHistoryNestedRecord(getHistoryDataRecord(history)?.run);
  const executionMode = runRecord?.execution_mode;
  return typeof executionMode === 'string' && executionMode.trim() ? executionMode.trim() : null;
};

const getHistoryPrimaryTitle = (history: ProjectHistory) =>
  getHistoryRequestTitle(history) ??
  getHistoryRunSourceName(history) ??
  getHistoryFlowName(history) ??
  `${history.entity_type} #${history.entity_id}`;

const getHistoryFallbackDescription = (history: ProjectHistory) =>
  history.entity_type === 'cli_request' || history.entity_type === 'request'
    ? `${history.action} recorded for CLI request #${history.entity_id}`
    : history.entity_type === 'cli_run'
      ? `${history.action} recorded for CLI run ${getHistoryRunSourceName(history) ?? `#${history.entity_id}`}`
      : `${history.action} recorded for ${history.entity_type} #${history.entity_id}`;

type EnvironmentFormMode = 'create' | 'edit';

interface EnvironmentFormDraft {
  name: string;
  displayName: string;
  baseUrl: string;
  variables: EnvironmentFieldRow[];
  headers: EnvironmentFieldRow[];
}

interface DuplicateEnvironmentDraft {
  name: string;
  overrideVars: string;
}

type EnvironmentFieldKind = 'variables' | 'headers';
type EnvironmentFieldValueType = 'string' | 'secret' | 'number' | 'boolean';

interface EnvironmentFieldRow {
  id: string;
  key: string;
  value: string;
  type: EnvironmentFieldValueType;
}

const getRoleLabel = (role?: ProjectMemberRole) => {
  if (!role) {
    return 'Unknown';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

const parseObjectJsonInput = <T extends Record<string, unknown> | Record<string, string>>(
  value: string,
  label: string,
  messages?: {
    invalidJson: string;
    invalidObject: string;
  }
) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedValue);
  } catch {
    throw new Error(messages?.invalidJson ?? `${label} must be a valid JSON object.`);
  }

  if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
    throw new Error(messages?.invalidObject ?? `${label} must be a JSON object.`);
  }

  return parsed as T;
};

const toStringRecord = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)])) as Record<
    string,
    string
  >;

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

const inferEnvironmentFieldType = (key: string, value: unknown): EnvironmentFieldValueType => {
  if (isLikelySecretKey(key)) {
    return 'secret';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  return 'string';
};

const isEnvironmentFieldRowBlank = (row: EnvironmentFieldRow) =>
  !row.key.trim() && !row.value.trim();

const normalizeEnvironmentFieldRows = (rows: EnvironmentFieldRow[], kind: EnvironmentFieldKind) => {
  const fallbackType = kind === 'headers' ? 'string' : 'string';
  const nextRows =
    rows.length > 0 ? [...rows] : [createEnvironmentFieldRow({ type: fallbackType })];

  const compactRows = nextRows.filter((row, index) => {
    if (!isEnvironmentFieldRowBlank(row)) {
      return true;
    }

    return index === nextRows.length - 1;
  });

  const normalizedRows =
    compactRows.length > 0 ? compactRows : [createEnvironmentFieldRow({ type: fallbackType })];
  const lastRow = normalizedRows[normalizedRows.length - 1];

  if (!isEnvironmentFieldRowBlank(lastRow)) {
    normalizedRows.push(createEnvironmentFieldRow({ type: fallbackType }));
  }

  return normalizedRows;
};

const recordToEnvironmentFieldRows = (
  value: Record<string, unknown> | Record<string, string> | undefined,
  kind: EnvironmentFieldKind
) => {
  if (!value || Object.keys(value).length === 0) {
    return [createEnvironmentFieldRow()];
  }

  return normalizeEnvironmentFieldRows(
    Object.entries(value).map(([key, item]) =>
      createEnvironmentFieldRow({
        key,
        value: typeof item === 'string' ? item : JSON.stringify(item),
        type: inferEnvironmentFieldType(key, item),
      })
    ),
    kind
  );
};

const parseEnvironmentFieldValue = (row: EnvironmentFieldRow): string | number | boolean => {
  switch (row.type) {
    case 'number':
      return Number(row.value.trim());
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
        throw new Error(t('environments.keyRequiredForRow', { row: index + 1 }));
      }
      return;
    }

    if (row.type === 'number') {
      const trimmedValue = row.value.trim();

      if (!trimmedValue || Number.isNaN(Number(trimmedValue))) {
        throw new Error(t('environments.invalidNumberValue', { key: trimmedKey }));
      }
    }

    entries.push([trimmedKey, parseEnvironmentFieldValue(row)]);
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
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
        throw new Error(t('environments.keyRequiredForRow', { row: index + 1 }));
      }
      return;
    }

    entries.push([trimmedKey, row.value]);
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const mergeEnvironmentFieldRows = (
  currentRows: EnvironmentFieldRow[],
  importedRows: EnvironmentFieldRow[],
  kind: EnvironmentFieldKind
) => {
  const rowsByKey = new Map<string, EnvironmentFieldRow>();

  currentRows.forEach(row => {
    const key = row.key.trim();

    if (key) {
      rowsByKey.set(key, row);
    }
  });

  importedRows.forEach(row => {
    const key = row.key.trim();

    if (key) {
      rowsByKey.set(key, row);
    }
  });

  return normalizeEnvironmentFieldRows([...rowsByKey.values()], kind);
};

const getEnvironmentFormDraft = (
  environment?: ProjectEnvironment | null
): EnvironmentFormDraft => ({
  name: environment?.name ?? '',
  displayName: environment?.display_name ?? '',
  baseUrl: environment?.base_url ?? '',
  variables: recordToEnvironmentFieldRows(environment?.variables, 'variables'),
  headers: recordToEnvironmentFieldRows(environment?.headers, 'headers'),
});

const getDuplicateEnvironmentDraft = (
  environment?: ProjectEnvironment | null
): DuplicateEnvironmentDraft => ({
  name: environment ? `${environment.name}-copy` : '',
  overrideVars: '',
});

function EnvironmentFormDialog({
  mode,
  environment,
  isLoadingEnvironment,
  isSubmitting,
  onCancel,
  onSubmit,
  onAutoSaveFields,
}: {
  mode: EnvironmentFormMode;
  environment?: ProjectEnvironment | null;
  isLoadingEnvironment: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateEnvironmentRequest | UpdateEnvironmentRequest) => Promise<void>;
  onAutoSaveFields?: (payload: Pick<UpdateEnvironmentRequest, 'variables' | 'headers'>) => void;
}) {
  const t = useT('project');
  const [draft, setDraft] = useState<EnvironmentFormDraft>(() =>
    getEnvironmentFormDraft(environment)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [importTarget, setImportTarget] = useState<EnvironmentFieldKind | null>(null);
  const [dirtyFieldKinds, setDirtyFieldKinds] = useState<Record<EnvironmentFieldKind, boolean>>({
    variables: false,
    headers: false,
  });
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formId = `environment-workspace-${mode}-form`;

  const updateDraft = <K extends keyof EnvironmentFormDraft>(
    key: K,
    value: EnvironmentFormDraft[K]
  ) => {
    setDraft(current => ({ ...current, [key]: value }));
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
      variables = buildVariablesRecordFromRows(draft.variables, t);
    } catch (error) {
      nextErrors.variables =
        error instanceof Error
          ? error.message
          : t('common.parseFailed', { label: t('common.variablesJson') });
    }

    try {
      headers = buildHeadersRecordFromRows(draft.headers, t);
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

  const updateRows = (kind: EnvironmentFieldKind, rows: EnvironmentFieldRow[]) => {
    setDraft(current => ({
      ...current,
      [kind]: normalizeEnvironmentFieldRows(rows, kind),
    }));
    setDirtyFieldKinds(current => ({
      ...current,
      [kind]: true,
    }));
    setErrors(current => ({
      ...current,
      [kind]: '',
    }));
  };

  const handleImportRows = (kind: EnvironmentFieldKind, rows: EnvironmentFieldRow[]) => {
    setDraft(current => ({
      ...current,
      [kind]: mergeEnvironmentFieldRows(current[kind], rows, kind),
    }));
    setErrors(current => ({
      ...current,
      [kind]: '',
    }));
    setDirtyFieldKinds(current => ({
      ...current,
      [kind]: true,
    }));
    setImportTarget(null);
  };

  useEffect(() => {
    if (mode !== 'edit' || !environment || !onAutoSaveFields) {
      return undefined;
    }

    const dirtyKinds = Object.entries(dirtyFieldKinds)
      .filter(([, dirty]) => dirty)
      .map(([kind]) => kind as EnvironmentFieldKind);

    if (dirtyKinds.length === 0) {
      return undefined;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const nextErrors: Record<string, string> = {};
      const payload: Pick<UpdateEnvironmentRequest, 'variables' | 'headers'> = {};

      try {
        if (dirtyFieldKinds.variables) {
          payload.variables = buildVariablesRecordFromRows(draft.variables, t);
        }
      } catch (error) {
        nextErrors.variables =
          error instanceof Error
            ? error.message
            : t('common.parseFailed', { label: t('common.variablesJson') });
      }

      try {
        if (dirtyFieldKinds.headers) {
          payload.headers = buildHeadersRecordFromRows(draft.headers, t);
        }
      } catch (error) {
        nextErrors.headers =
          error instanceof Error
            ? error.message
            : t('common.parseFailed', { label: t('common.headersJson') });
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors(current => ({ ...current, ...nextErrors }));
        return;
      }

      onAutoSaveFields(payload);
      setDirtyFieldKinds({ variables: false, headers: false });
    }, 900);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [dirtyFieldKinds, draft.headers, draft.variables, environment, mode, onAutoSaveFields, t]);

  return (
    <div className="mx-auto flex min-h-full max-w-[1600px] flex-col gap-4">
      <Card className="gap-0 rounded-xl border-border-subtle bg-bg-canvas py-0">
        <CardHeader className="gap-4 border-b border-border-subtle py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border-subtle bg-bg-soft text-text-main">
                  {t('modules.environments.label')}
                </Badge>
                <Badge variant="secondary">
                  {mode === 'create' ? t('common.create') : t('common.edit')}
                </Badge>
              </div>
              <div>
                <CardTitle className="text-xl tracking-normal">
                  {mode === 'create'
                    ? t('environments.createDialogTitle')
                    : t('environments.editDialogTitle')}
                </CardTitle>
                <CardDescription className="mt-1">
                  {mode === 'create'
                    ? t('environments.createDialogDescription')
                    : t('environments.editDialogDescription')}
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                form={formId}
                loading={isSubmitting}
                disabled={
                  (mode === 'edit' && (isLoadingEnvironment || !environment)) || isSubmitting
                }
              >
                {mode === 'create' ? t('environments.createButton') : t('environments.saveButton')}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 px-4 py-5 md:px-6">
          {mode === 'edit' && isLoadingEnvironment ? (
            <div className="space-y-4">
              <div className="h-11 animate-pulse rounded-md bg-muted" />
              <div className="h-11 animate-pulse rounded-md bg-muted" />
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="h-80 animate-pulse rounded-md bg-muted" />
                <div className="h-80 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
          ) : mode === 'edit' && !environment ? (
            <Alert>
              <AlertTitle>{t('environments.unableToLoadDetails')}</AlertTitle>
              <AlertDescription>
                {t('environments.unableToLoadDetailsDescription')}
              </AlertDescription>
            </Alert>
          ) : (
            <form id={formId} className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="environment-name">{t('common.name')}</Label>
                  <Input
                    id="environment-name"
                    value={draft.name}
                    onChange={event => updateDraft('name', event.target.value)}
                    placeholder="production"
                    errorText={errors.name}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment-display-name">{t('common.displayName')}</Label>
                  <Input
                    id="environment-display-name"
                    value={draft.displayName}
                    onChange={event => updateDraft('displayName', event.target.value)}
                    placeholder="Production"
                    root
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment-base-url">{t('common.baseUrl')}</Label>
                <Input
                  id="environment-base-url"
                  value={draft.baseUrl}
                  onChange={event => updateDraft('baseUrl', event.target.value)}
                  placeholder="https://api.example.com"
                  root
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <EnvironmentKeyValueEditor
                  label={t('common.variables')}
                  kind="variables"
                  rows={draft.variables}
                  errorText={errors.variables}
                  onRowsChange={rows => updateRows('variables', rows)}
                  onOpenImport={() => setImportTarget('variables')}
                />

                <EnvironmentKeyValueEditor
                  label={t('common.headers')}
                  kind="headers"
                  rows={draft.headers}
                  errorText={errors.headers}
                  onRowsChange={rows => updateRows('headers', rows)}
                  onOpenImport={() => setImportTarget('headers')}
                />
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <EnvironmentJsonImportDialog
        key={`${importTarget ?? 'none'}-${importTarget ? 'open' : 'closed'}`}
        open={Boolean(importTarget)}
        kind={importTarget ?? 'variables'}
        onOpenChange={open => {
          if (!open) {
            setImportTarget(null);
          }
        }}
        onImport={rows => {
          if (importTarget) {
            handleImportRows(importTarget, rows);
          }
        }}
      />
    </div>
  );
}

function EnvironmentKeyValueEditor({
  label,
  kind,
  rows,
  errorText,
  onRowsChange,
  onOpenImport,
}: {
  label: string;
  kind: EnvironmentFieldKind;
  rows: EnvironmentFieldRow[];
  errorText?: string;
  onRowsChange: (rows: EnvironmentFieldRow[]) => void;
  onOpenImport: () => void;
}) {
  const t = useT('project');
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  const updateRow = (rowId: string, updater: (row: EnvironmentFieldRow) => EnvironmentFieldRow) => {
    onRowsChange(rows.map(row => (row.id === rowId ? updater(row) : row)));
  };

  const removeRow = (rowId: string) => {
    onRowsChange(rows.filter(row => row.id !== rowId));
    setVisibleSecrets(current => {
      const nextVisible = { ...current };
      delete nextVisible[rowId];
      return nextVisible;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <Button type="button" size="sm" variant="outline" onClick={onOpenImport}>
          <Upload className="h-3.5 w-3.5" />
          {t('environments.importJson')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border-subtle bg-bg-canvas">
        <div className="grid min-h-10 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_2.5rem] border-b border-border-subtle bg-bg-soft text-sm font-medium text-text-muted">
          <div className="flex items-center border-r border-border-subtle px-3">
            {kind === 'variables'
              ? t('environments.variableColumn')
              : t('environments.headerColumn')}
          </div>
          <div className="flex items-center border-r border-border-subtle px-3">
            {t('environments.valueColumn')}
          </div>
          <div />
        </div>

        <div>
          {rows.map(row => {
            const blank = isEnvironmentFieldRowBlank(row);
            const secret = row.type === 'secret';
            const visible = visibleSecrets[row.id] ?? false;

            return (
              <div
                key={row.id}
                className="grid min-h-11 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_2.5rem] border-b border-border-subtle last:border-b-0"
              >
                <div className="border-r border-border-subtle">
                  <Input
                    value={row.key}
                    onChange={event =>
                      updateRow(row.id, current => ({
                        ...current,
                        key: event.target.value,
                        type:
                          isLikelySecretKey(event.target.value) && current.type === 'string'
                            ? 'secret'
                            : current.type,
                      }))
                    }
                    placeholder={
                      blank
                        ? kind === 'variables'
                          ? t('environments.addVariablePlaceholder')
                          : t('environments.addHeaderPlaceholder')
                        : kind === 'variables'
                          ? t('environments.variableKeyPlaceholder')
                          : t('environments.headerKeyPlaceholder')
                    }
                    className="h-11 rounded-none border-0 bg-transparent px-3 shadow-none input-depth-none focus-visible:ring-0"
                  />
                </div>

                <div className="border-r border-border-subtle">
                  <Input
                    type={secret && !visible ? 'password' : 'text'}
                    value={row.value}
                    onChange={event =>
                      updateRow(row.id, current => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                    placeholder={
                      blank
                        ? ''
                        : kind === 'variables'
                          ? t('environments.variableValuePlaceholder')
                          : t('environments.headerValuePlaceholder')
                    }
                    className="h-11 rounded-none border-0 bg-transparent px-3 shadow-none input-depth-none focus-visible:ring-0"
                    rightIcon={
                      secret && !blank ? (
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
                          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      ) : undefined
                    }
                  />
                </div>

                <div className="flex items-center justify-center">
                  {!blank ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      isIcon
                      className="h-8 w-8"
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {errorText ? <p className="text-xs font-medium text-destructive">{errorText}</p> : null}
    </div>
  );
}

function EnvironmentJsonImportDialog({
  open,
  kind,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  kind: EnvironmentFieldKind;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: EnvironmentFieldRow[]) => void;
}) {
  const t = useT('project');
  const [jsonValue, setJsonValue] = useState('');
  const [errorText, setErrorText] = useState('');
  const label = kind === 'variables' ? t('common.variables') : t('common.headers');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const parsed = parseObjectJsonInput<Record<string, unknown>>(jsonValue, label, {
        invalidJson: t('common.jsonMustBeValidObject', { label }),
        invalidObject: t('common.jsonMustBeObject', { label }),
      });

      const importedRecord = kind === 'headers' ? toStringRecord(parsed ?? {}) : parsed;
      onImport(recordToEnvironmentFieldRows(importedRecord, kind));
      setJsonValue('');
      setErrorText('');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t('common.parseFailed', { label }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{t('environments.importJsonTitle', { label })}</DialogTitle>
          <DialogDescription>{t('environments.importJsonDescription')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="environment-json-import-form" className="space-y-3" onSubmit={handleSubmit}>
            <Textarea
              value={jsonValue}
              onChange={event => {
                setJsonValue(event.target.value);
                setErrorText('');
              }}
              rows={12}
              placeholder={
                kind === 'variables'
                  ? '{\n  "API_URL": "https://api.example.com",\n  "DEBUG": false\n}'
                  : '{\n  "Authorization": "Bearer {{token}}"\n}'
              }
              errorText={errorText}
              root
            />
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="environment-json-import-form">
            {t('environments.importJson')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const t = useT('project');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('environments.deleteDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('environments.deleteDialogDescription', {
              name: environment ? `"${environment.name}"` : t('environments.title').toLowerCase(),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert variant="destructive">
            <AlertTitle>{t('common.irreversibleAction')}</AlertTitle>
            <AlertDescription>{t('environments.deleteWarning')}</AlertDescription>
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={isDeleting}
            onClick={() => void onConfirm()}
          >
            {t('environments.deleteDialogTitle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const t = useT('project');
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
      nextErrors.name = t('environments.newNameRequired');
    }

    try {
      overrideVars = parseObjectJsonInput<Record<string, unknown>>(
        draft.overrideVars,
        t('common.overrideVariablesJson'),
        {
          invalidJson: t('common.jsonMustBeValidObject', {
            label: t('common.overrideVariablesJson'),
          }),
          invalidObject: t('common.jsonMustBeObject', { label: t('common.overrideVariablesJson') }),
        }
      );
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
          <DialogDescription>{t('environments.duplicateDialogDescription')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="environment-duplicate-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="duplicate-environment-name">
                {t('environments.newEnvironmentName')}
              </Label>
              <Input
                id="duplicate-environment-name"
                value={draft.name}
                onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                placeholder="staging-copy"
                errorText={errors.name}
                root
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duplicate-environment-override-vars">
                {t('common.overrideVariablesJson')}
              </Label>
              <Textarea
                id="duplicate-environment-override-vars"
                value={draft.overrideVars}
                onChange={event =>
                  setDraft(current => ({ ...current, overrideVars: event.target.value }))
                }
                rows={12}
                placeholder='{"API_URL":"https://staging.example.com"}'
                errorText={errors.overrideVars}
                root
              />
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="environment-duplicate-form" loading={isSubmitting}>
            {t('environments.duplicateDialogTitle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectWorkspacePage({
  projectId,
  module,
  selectedItemId,
  autoOpenAICreate = false,
  initialHistoryEntityType,
}: {
  projectId: number | string;
  module: ProjectWorkspaceModule;
  selectedItemId?: string | number | null;
  autoOpenAICreate?: boolean;
  initialHistoryEntityType?: string | null;
}) {
  const t = useT('project');
  const projectQuery = useProject(projectId);
  const projectName = projectQuery.data?.name || `${t('common.project')} #${projectId}`;

  switch (module) {
    case 'collections':
      return <CollectionsWorkspaceSection projectId={projectId} />;
    case 'api-specs':
      return (
        <ApiSpecsWorkspaceSection
          projectId={projectId}
          projectName={projectName}
          selectedItemId={selectedItemId}
          autoOpenAICreate={autoOpenAICreate}
        />
      );
    case 'environments':
      return (
        <EnvironmentsWorkspaceSection
          projectId={projectId}
          projectName={projectName}
          selectedItemId={selectedItemId}
        />
      );
    case 'categories':
      return (
        <CategoriesWorkspaceSection
          projectId={projectId}
          projectName={projectName}
          selectedItemId={selectedItemId}
        />
      );
    case 'keys':
      return <ProjectKeysWorkspaceSection projectId={projectId} projectName={projectName} />;
    case 'histories':
      return (
        <HistoryWorkspaceSection
          key={`histories:${initialHistoryEntityType?.trim() || 'all'}`}
          projectId={projectId}
          projectName={projectName}
          selectedItemId={selectedItemId}
          initialEntityTypeFilter={initialHistoryEntityType}
        />
      );
    case 'flows':
      return <ProjectFlowManagementPage projectId={projectId} selectedItemId={selectedItemId} />;
    default:
      return (
        <PlaceholderWorkspaceSection
          projectId={projectId}
          projectName={projectName}
          module="api-specs"
        />
      );
  }
}

function ProjectKeysWorkspaceSection({
  projectId,
  projectName,
}: {
  projectId: number | string;
  projectName: string;
}) {
  const t = useT('project');
  const projectQuery = useProject(projectId);
  const generateCliTokenMutation = useGenerateProjectCliToken();
  const [generatedCliToken, setGeneratedCliToken] =
    useState<GenerateProjectCliTokenResponse | null>(null);

  const project = projectQuery.data;
  const scopedProjectId = String(project?.id ?? projectId);
  const cliPlatformUrl = (apiExternalBaseUrl || buildApiPath('/')).replace(/\/$/, '');
  const cliConnectionKey =
    generatedCliToken && project
      ? buildKestConnectionKey({
          version: 1,
          platform_url: cliPlatformUrl,
          platform_token: generatedCliToken.token,
          platform_project_id: String(project.id),
          platform_auto_sync_history: true,
        })
      : '';
  const cliConfigCommand = cliConnectionKey ? `kest key '${cliConnectionKey}'` : '';

  const handleCopyText = async (value: string, successMessage: string) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error(t('toasts.copyFailed'));
    }
  };

  const handleGenerateCliToken = async () => {
    if (!project) {
      return;
    }

    try {
      const token = await generateCliTokenMutation.mutateAsync({
        id: project.id,
        data: {
          name: `${project.name} CLI sync`,
          scopes: ['collection:read', 'collection:run', 'environment:read'],
        },
      });
      setGeneratedCliToken(token);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  return (
    <WorkspaceFrame
      sidebar={
        <ResourceSidebar
          module="keys"
          title={t('keysPage.sidebarTitle')}
          description={t('keysPage.sidebarDescription')}
          count={1}
          loading={projectQuery.isLoading}
          error={projectQuery.error}
          emptyState={
            <SidebarEmptyState
              icon={KeyRound}
              title={t('keysPage.emptyTitle')}
              description={t('keysPage.emptyDescription')}
            />
          }
        >
          <ResourceListItem
            href={buildProjectWorkspaceRoute(projectId, 'keys')}
            active
            title={t('keysPage.sidebarItemTitle')}
            description={t('keysPage.sidebarItemDescription')}
            meta={<Badge variant="outline">{t('keysPage.sidebarBadge')}</Badge>}
          />
        </ResourceSidebar>
      }
      content={
        <ResourceContent
          projectId={projectId}
          projectName={projectName}
          module="keys"
          actions={
            <Button
              type="button"
              onClick={() => void handleGenerateCliToken()}
              disabled={!project || generateCliTokenMutation.isPending}
            >
              <KeyRound className="h-4 w-4" />
              {generateCliTokenMutation.isPending
                ? t('keysPage.generating')
                : t('keysPage.generateKey')}
            </Button>
          }
        >
          <div className="space-y-6">
            {projectQuery.isError ? (
              <Alert>
                <AlertTitle>{t('keysPage.projectUnavailableTitle')}</AlertTitle>
                <AlertDescription>{t('keysPage.projectUnavailableDescription')}</AlertDescription>
              </Alert>
            ) : null}

            <Card className="border-border-subtle">
              <CardHeader>
                <CardTitle>{t('keysPage.title')}</CardTitle>
                <CardDescription>{t('keysPage.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-2">
                  <DetailField label={t('keysPage.platformUrl')}>
                    <span className="break-all font-mono text-xs">{cliPlatformUrl}</span>
                  </DetailField>
                  <DetailField label={t('keysPage.projectScope')}>
                    <span className="font-mono">{scopedProjectId}</span>
                  </DetailField>
                  <DetailField label={t('keysPage.scopes')}>
                    <span className="font-mono text-xs">
                      collection:read, collection:run, environment:read
                    </span>
                  </DetailField>
                  <DetailField label={t('keysPage.autoSyncHistory')}>
                    {t('keysPage.autoSyncHistoryEnabled')}
                  </DetailField>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border-subtle">
              <CardHeader>
                <CardTitle>{t('keysPage.generatedTitle')}</CardTitle>
                <CardDescription>{t('keysPage.generatedDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedCliToken ? (
                  <>
                    <Alert>
                      <ShieldCheck className="h-4 w-4" />
                      <AlertTitle>{t('keysPage.connectionCommand')}</AlertTitle>
                      <AlertDescription>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void handleCopyText(cliConfigCommand, t('keysPage.commandCopied'))
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {t('keysPage.copyCommand')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void handleCopyText(
                                generatedCliToken.token,
                                t('keysPage.rawTokenCopied')
                              )
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {t('keysPage.copyRawToken')}
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                        {t('keysPage.connectionCommand')}
                      </p>
                      <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-all rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-main">
                        {cliConfigCommand}
                      </pre>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <DetailField label={t('keysPage.tokenPrefix')}>
                        <span className="font-mono text-xs">
                          {generatedCliToken.token_info.token_prefix}
                        </span>
                      </DetailField>
                      <DetailField label={t('keysPage.rawToken')}>
                        <span className="break-all font-mono text-xs">
                          {generatedCliToken.token}
                        </span>
                      </DetailField>
                      <DetailField label={t('common.created')}>
                        {formatDate(generatedCliToken.token_info.created_at, 'YYYY-MM-DD HH:mm')}
                      </DetailField>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed border-border-subtle bg-bg-soft p-6">
                    <p className="text-sm font-medium text-text-main">{t('keysPage.emptyTitle')}</p>
                    <p className="mt-2 text-sm leading-6 text-text-muted">
                      {t('keysPage.emptyDescription')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ResourceContent>
      }
    />
  );
}

function ApiSpecsWorkspaceSection({
  projectId,
  projectName,
  selectedItemId,
  autoOpenAICreate,
}: {
  projectId: number | string;
  projectName: string;
  selectedItemId?: string | number | null;
  autoOpenAICreate?: boolean;
}) {
  const t = useT('project');
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [createSpecCategoryId, setCreateSpecCategoryId] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCategoryCreateOpen, setIsCategoryCreateOpen] = useState(false);
  const [isAICreateOpen, setIsAICreateOpen] = useState(autoOpenAICreate ?? false);
  const [editingSpecId, setEditingSpecId] = useState<string | number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiSpec | null>(null);
  const [suppressedSelectedSpecId, setSuppressedSelectedSpecId] = useState<number | string | null>(
    null
  );
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isBatchGenOpen, setIsBatchGenOpen] = useState(false);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const [generatedTestLanguage, setGeneratedTestLanguage] = useState<ApiSpecLanguage>('en');
  const [aiAction, setAiAction] = useState<{ mode: 'doc' | 'test'; spec: ApiSpec | null } | null>(
    null
  );
  const [draggingSpecId, setDraggingSpecId] = useState<string | number | null>(null);
  const deferredSearch = useDeferredValue(searchQuery);
  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor)
  );

  const specsQuery = useApiSpecs({
    projectId,
    page: 1,
    pageSize: MAX_MODULE_ITEMS,
  });
  const effectiveSelectedItemId =
    selectedItemId && String(selectedItemId) === String(suppressedSelectedSpecId)
      ? null
      : selectedItemId;

  const selectedSpecQuery = useApiSpecFull(projectId, effectiveSelectedItemId ?? undefined);
  const editingSpecQuery = useApiSpec(projectId, editingSpecId ?? undefined);
  const memberRoleQuery = useProjectMemberRole(projectId);
  const categoriesQuery = useProjectApiCategories(projectId);
  const createCategoryMutation = useCreateCategory(projectId);
  const createSpecMutation = useCreateApiSpec(projectId);
  const updateSpecMutation = useUpdateApiSpec(projectId);
  const createAIDraftStream = useCreateApiSpecAIDraftStream(projectId);
  const refineAIDraftMutation = useRefineApiSpecAIDraft(projectId);
  const acceptAIDraftMutation = useAcceptApiSpecAIDraft(projectId);
  const deleteSpecMutation = useDeleteApiSpec(projectId);
  const importSpecsMutation = useImportApiSpecs(projectId);
  const exportSpecsMutation = useExportApiSpecs(projectId);
  const batchGenMutation = useBatchGenApiDocs(projectId);
  const genDocMutation = useGenApiDoc(projectId);
  const genTestMutation = useGenApiTest(projectId);
  const createExampleMutation = useCreateApiExample(projectId);

  const specs = specsQuery.data?.items ?? EMPTY_SPECS;
  const categories = categoriesQuery.data?.items ?? EMPTY_CATEGORIES;
  const flatCategories = useMemo(() => flattenProjectCategories(categories), [categories]);
  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);
  const categoryNameById = useMemo(
    () => new Map(flatCategories.map(category => [String(category.id), category.name])),
    [flatCategories]
  );
  const filteredSpecs = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return specs;
    }

    return specs.filter(spec =>
      [
        spec.method,
        spec.path,
        spec.summary,
        spec.description,
        spec.version,
        spec.category_id ? categoryNameById.get(String(spec.category_id)) : undefined,
      ]
        .filter((value): value is string => Boolean(value))
        .some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [categoryNameById, deferredSearch, specs]);
  const sidebarGroups = useMemo<ApiSpecSidebarGroup[]>(() => {
    const specsByCategory = new Map<string, ApiSpec[]>();
    const uncategorizedSpecs: ApiSpec[] = [];

    filteredSpecs.forEach(spec => {
      if (!spec.category_id) {
        uncategorizedSpecs.push(spec);
        return;
      }

      const categoryId = String(spec.category_id);
      const categorySpecs = specsByCategory.get(categoryId) ?? [];
      categorySpecs.push(spec);
      specsByCategory.set(categoryId, categorySpecs);
    });

    const groups: ApiSpecSidebarGroup[] = flatCategories
      .map(category => ({
        key: `category-${category.id}`,
        label: category.name,
        depth: category.depth,
        categoryId: String(category.id),
        specs: specsByCategory.get(String(category.id)) ?? [],
      }))
      .filter(group => group.specs.length > 0 || !deferredSearch.trim());

    if (uncategorizedSpecs.length > 0 || !deferredSearch.trim()) {
      groups.push({
        key: 'uncategorized',
        label: t('apiSpecs.uncategorized'),
        depth: 0,
        categoryId: null,
        specs: uncategorizedSpecs,
      });
    }

    return groups;
  }, [deferredSearch, filteredSpecs, flatCategories, t]);
  const selectedSpecFromList =
    effectiveSelectedItemId === undefined || effectiveSelectedItemId === null
      ? null
      : (specs.find(spec => String(spec.id) === String(effectiveSelectedItemId)) ?? null);
  const selectedSpec = selectedSpecQuery.data ?? selectedSpecFromList;
  const draggingSpec = draggingSpecId
    ? (specs.find(spec => String(spec.id) === String(draggingSpecId)) ?? null)
    : null;
  const activeSpecId = selectedSpec?.id ?? effectiveSelectedItemId ?? null;
  const specShareQuery = useApiSpecShare(projectId, activeSpecId ?? undefined);
  const publishShareMutation = usePublishApiSpecShare(projectId);
  const deleteShareMutation = useDeleteApiSpecShare(projectId);
  const generatedTestQuery = useGeneratedApiTest(
    projectId,
    activeSpecId ?? undefined,
    generatedTestLanguage
  );
  const currentRole = memberRoleQuery.data?.role;
  const canWrite = currentRole ? WRITE_ROLES.includes(currentRole) : false;
  const docPreview =
    selectedSpec?.doc_markdown_en ||
    selectedSpec?.doc_markdown_zh ||
    selectedSpec?.doc_markdown ||
    null;
  const generatedTestPreview = generatedTestQuery.data || selectedSpec?.test_content || null;
  const shareRoute = specShareQuery.data?.slug
    ? buildApiSpecShareRoute(specShareQuery.data.slug)
    : null;
  const exportFileKey =
    projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `project-${projectId}`;
  const isRefreshing =
    specsQuery.isFetching ||
    selectedSpecQuery.isFetching ||
    categoriesQuery.isFetching ||
    memberRoleQuery.isFetching ||
    specShareQuery.isFetching;

  const handleRefresh = async () => {
    const tasks: Array<Promise<unknown>> = [
      specsQuery.refetch(),
      categoriesQuery.refetch(),
      memberRoleQuery.refetch(),
    ];

    if (activeSpecId) {
      tasks.push(selectedSpecQuery.refetch(), specShareQuery.refetch());
    }

    await Promise.all(tasks);
  };

  const handleCreateSpec = async (payload: CreateApiSpecRequest) => {
    try {
      const createdSpec = await createSpecMutation.mutateAsync(payload);
      setIsCreateOpen(false);
      setCreateSpecCategoryId('');
      setSearchQuery('');
      await specsQuery.refetch();
      router.replace(buildModuleHref(projectId, 'api-specs', createdSpec.id));
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleCreateCategory = async (payload: CreateCategoryRequest) => {
    try {
      await createCategoryMutation.mutateAsync(payload);
      setIsCategoryCreateOpen(false);
      await categoriesQuery.refetch();
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const openCreateSpecDialog = (categoryId = '') => {
    setCreateSpecCategoryId(categoryId);
    setIsCreateOpen(true);
  };

  const openEditDialog = (specId: string | number) => {
    setEditingSpecId(specId);

    if (String(selectedItemId ?? '') !== String(specId)) {
      router.replace(buildModuleHref(projectId, 'api-specs', specId));
    }
  };

  const handleUpdateSpec = async (payload: UpdateApiSpecRequest) => {
    if (!editingSpecId) {
      return;
    }

    try {
      await updateSpecMutation.mutateAsync({
        specId: editingSpecId,
        data: payload,
      });
      setEditingSpecId(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const moveSpecToCategory = async (spec: ApiSpec, categoryId: string | null) => {
    if (!canWrite || updateSpecMutation.isPending) {
      return;
    }

    const currentCategoryId = spec.category_id ? String(spec.category_id) : null;
    if (currentCategoryId === categoryId) {
      return;
    }

    const targetLabel = categoryId
      ? categoryNameById.get(categoryId) || t('common.category')
      : t('apiSpecs.uncategorized');

    try {
      await updateSpecMutation.mutateAsync({
        specId: spec.id,
        data: { category_id: categoryId },
        suppressToast: true,
      });
      toast.success(
        t('toasts.apiSpecMoved', {
          method: spec.method,
          path: spec.path,
          category: targetLabel,
        })
      );
      if (String(activeSpecId ?? '') === String(spec.id)) {
        await selectedSpecQuery.refetch();
      }
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleSpecDragStart = (event: DragStartEvent) => {
    const specId = event.active.data.current?.specId;
    setDraggingSpecId(typeof specId === 'string' || typeof specId === 'number' ? specId : null);
  };

  const handleSpecDragEnd = (event: DragEndEvent) => {
    setDraggingSpecId(null);

    const spec = event.active.data.current?.spec as ApiSpec | undefined;
    const categoryId = event.over?.data.current?.categoryId as string | null | undefined;
    if (!spec || categoryId === undefined) {
      return;
    }

    void moveSpecToCategory(spec, categoryId);
  };

  const handleDeleteSpec = async () => {
    if (!deleteTarget) {
      return;
    }

    const deletedId = deleteTarget.id;
    const deletingActiveSpec = activeSpecId !== null && String(activeSpecId) === String(deletedId);
    const fallbackSpec =
      specs.find(spec => String(spec.id) !== String(deletedId)) ??
      filteredSpecs.find(spec => String(spec.id) !== String(deletedId)) ??
      null;

    try {
      if (deletingActiveSpec) {
        setSuppressedSelectedSpecId(deletedId);
      }

      await deleteSpecMutation.mutateAsync(deletedId);
      setDeleteTarget(null);
      setEditingSpecId(current =>
        current !== null && String(current) === String(deletedId) ? null : current
      );

      if (deletingActiveSpec) {
        router.replace(
          fallbackSpec
            ? buildModuleHref(projectId, 'api-specs', fallbackSpec.id)
            : buildProjectApiSpecsRoute(projectId)
        );
      }
    } catch {
      if (deletingActiveSpec) {
        setSuppressedSelectedSpecId(null);
      }
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleImport = async (payload: { specs: CreateApiSpecRequest[] }) => {
    try {
      await importSpecsMutation.mutateAsync(payload);
      setIsImportOpen(false);
      setSearchQuery('');
      await specsQuery.refetch();
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleExport = async (format: ApiSpecExportFormat) => {
    try {
      const payload = await exportSpecsMutation.mutateAsync({ format });
      downloadExportPayload({
        payload,
        format,
        projectSlug: exportFileKey,
      });
      setIsExportOpen(false);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleBatchGenDoc = async (payload: BatchGenDocRequest) => {
    try {
      await batchGenMutation.mutateAsync(payload);
      setIsBatchGenOpen(false);
      await specsQuery.refetch();
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const queueSpecAiAction = (spec: ApiSpec, mode: 'doc' | 'test') => {
    if (String(selectedItemId ?? '') !== String(spec.id)) {
      router.replace(buildModuleHref(projectId, 'api-specs', spec.id));
    }

    setAiAction({ mode, spec });
  };

  const handleAiAction = async (lang: ApiSpecLanguage) => {
    if (!aiAction?.spec) {
      return;
    }

    try {
      if (aiAction.mode === 'doc') {
        await genDocMutation.mutateAsync({ specId: aiAction.spec.id, lang });
        if (String(activeSpecId ?? '') === String(aiAction.spec.id)) {
          await selectedSpecQuery.refetch();
        }
      } else {
        await genTestMutation.mutateAsync({ specId: aiAction.spec.id, lang });
        setGeneratedTestLanguage(lang);
      }

      setAiAction(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleCreateExample = async (payload: CreateApiExampleRequest) => {
    if (!activeSpecId) {
      return;
    }

    try {
      await createExampleMutation.mutateAsync({
        specId: activeSpecId,
        data: payload,
      });
      setIsExampleOpen(false);
      await selectedSpecQuery.refetch();
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleCopyShareLink = async (route = shareRoute) => {
    if (!route || typeof window === 'undefined') {
      return;
    }

    const absoluteUrl = new URL(route, window.location.origin).toString();
    await navigator.clipboard.writeText(absoluteUrl);
  };

  const handlePublishShare = async () => {
    if (!activeSpecId) {
      return;
    }

    try {
      const share = await publishShareMutation.mutateAsync(activeSpecId);
      await handleCopyShareLink(buildApiSpecShareRoute(share.slug));
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDeleteShare = async () => {
    if (!activeSpecId) {
      return;
    }

    try {
      await deleteShareMutation.mutateAsync(activeSpecId);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleCopyGeneratedTest = async () => {
    if (!generatedTestPreview) {
      return;
    }

    await navigator.clipboard.writeText(generatedTestPreview);
  };

  const handleAICreateOpenChange = (open: boolean) => {
    setIsAICreateOpen(open);

    if (!open && autoOpenAICreate) {
      router.replace(
        selectedItemId
          ? buildModuleHref(projectId, 'api-specs', selectedItemId)
          : buildProjectApiSpecsRoute(projectId)
      );
    }
  };

  const selectedSpecActionItems: ActionMenuItem[] = selectedSpec
    ? [
        {
          key: 'api-spec-selected-edit',
          label: t('common.edit'),
          icon: Pencil,
          disabled: !canWrite,
          onSelect: () => openEditDialog(selectedSpec.id),
        },
        specShareQuery.data
          ? {
              key: 'api-spec-selected-copy-link',
              label: t('apiSpecsPage.copyLink'),
              icon: Copy,
              onSelect: () => {
                void handleCopyShareLink();
              },
            }
          : {
              key: 'api-spec-selected-publish-share',
              label: t('apiSpecsPage.publishShare'),
              icon: Share2,
              disabled: !canWrite || publishShareMutation.isPending,
              onSelect: () => {
                void handlePublishShare();
              },
            },
        {
          key: 'api-spec-selected-preview-share',
          label: t('apiSpecsPage.previewShare'),
          icon: ExternalLink,
          href: shareRoute || '#',
          external: true,
          hidden: !Boolean(specShareQuery.data && shareRoute),
        },
        {
          key: 'api-spec-selected-disable-share',
          label: t('apiSpecsPage.disableShare'),
          icon: Trash2,
          destructive: true,
          hidden: !Boolean(specShareQuery.data),
          disabled: !canWrite || deleteShareMutation.isPending,
          onSelect: () => {
            void handleDeleteShare();
          },
        },
        {
          key: 'api-spec-selected-generate-doc',
          label: t('apiSpecsPage.genDoc'),
          icon: Bot,
          separatorBefore: true,
          disabled: !canWrite,
          onSelect: () => queueSpecAiAction(selectedSpec, 'doc'),
        },
        {
          key: 'api-spec-selected-generate-test',
          label: t('apiSpecsPage.genTest'),
          icon: FileCode2,
          disabled: !canWrite,
          onSelect: () => queueSpecAiAction(selectedSpec, 'test'),
        },
        {
          key: 'api-spec-selected-create-example',
          label: t('apiSpecsPage.createExample'),
          icon: Plus,
          disabled: !canWrite,
          onSelect: () => setIsExampleOpen(true),
        },
        {
          key: 'api-spec-selected-delete',
          label: t('common.delete'),
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          disabled: !canWrite,
          onSelect: () => setDeleteTarget(selectedSpec),
        },
      ]
    : [];

  const moduleActionItems: ActionMenuItem[] = [
    {
      key: 'api-specs-refresh',
      label: isRefreshing ? t('common.refreshing') : t('common.refresh'),
      icon: RefreshCw,
      disabled: isRefreshing,
      onSelect: () => {
        void handleRefresh();
      },
    },
    {
      key: 'api-specs-import',
      label: t('apiSpecsPage.import'),
      icon: Upload,
      disabled: !canWrite,
      onSelect: () => setIsImportOpen(true),
    },
    {
      key: 'api-specs-export',
      label: t('apiSpecsPage.export'),
      icon: Download,
      onSelect: () => setIsExportOpen(true),
    },
    {
      key: 'api-specs-batch-doc',
      label: t('apiSpecsPage.batchGenDoc'),
      icon: Sparkles,
      disabled: !canWrite,
      onSelect: () => setIsBatchGenOpen(true),
    },
    {
      key: 'api-specs-ai-draft',
      label: t('apiSpecs.aiDraft'),
      icon: Sparkles,
      disabled: !canWrite,
      onSelect: () => setIsAICreateOpen(true),
    },
    {
      key: 'api-specs-create',
      label: t('apiSpecs.addSpec'),
      icon: Plus,
      disabled: !canWrite,
      onSelect: () => openCreateSpecDialog(),
    },
    {
      key: 'api-specs-create-category',
      label: t('categoriesPage.createCategory'),
      icon: Tags,
      disabled: !canWrite,
      onSelect: () => setIsCategoryCreateOpen(true),
    },
    {
      key: 'api-specs-categories',
      label: t('categories.manageCategories'),
      icon: Tags,
      href: buildProjectCategoriesRoute(projectId),
      separatorBefore: true,
    },
    {
      key: 'api-specs-environments',
      label: t('environments.title'),
      icon: Globe,
      href: buildProjectEnvironmentsRoute(projectId),
    },
    {
      key: 'api-specs-test-cases',
      label: t('apiSpecs.openTestCases'),
      icon: FlaskConical,
      href: buildProjectTestCasesRoute(projectId),
    },
  ];

  return (
    <>
      <WorkspaceFrame
        sidebar={
          <ResourceSidebar
            module="api-specs"
            title={t('apiSpecs.title')}
            description={t('apiSpecs.description')}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t('apiSpecs.filterPlaceholder')}
            count={sidebarGroups.length}
            loading={specsQuery.isLoading}
            error={specsQuery.error}
            emptyState={
              <SidebarEmptyState
                icon={FileJson2}
                title={t('apiSpecs.emptyTitle')}
                description={t('apiSpecs.emptyDescription')}
              />
            }
            headerActions={
              <div className="w-full space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="h-7 flex-1 rounded-md px-2 text-xs"
                    onClick={() => setIsCategoryCreateOpen(true)}
                    disabled={!canWrite}
                  >
                    <Tags className="h-3.5 w-3.5" />
                    {t('categoriesPage.createCategory')}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    className="h-7 flex-1 rounded-md px-2 text-xs"
                    onClick={() => openCreateSpecDialog()}
                    disabled={!canWrite}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('apiSpecs.addSpec')}
                  </Button>
                </div>
                <div className="truncate text-[11px] leading-4 text-text-muted">
                  {t('apiSpecs.sidebarSummary', {
                    categories: flatCategories.length,
                    specs: filteredSpecs.length,
                  })}
                </div>
              </div>
            }
          >
            <DndContext
              sensors={dragSensors}
              collisionDetection={closestCenter}
              onDragStart={handleSpecDragStart}
              onDragEnd={handleSpecDragEnd}
              onDragCancel={() => setDraggingSpecId(null)}
            >
              <ApiSpecDirectoryList
                groups={sidebarGroups}
                projectId={projectId}
                selectedSpecId={selectedSpec?.id}
                canWrite={canWrite}
                movingSpecId={
                  updateSpecMutation.isPending ? updateSpecMutation.variables?.specId ?? null : null
                }
                onOpenCreate={openCreateSpecDialog}
                onOpenEdit={openEditDialog}
                onQueueAiAction={queueSpecAiAction}
                onDelete={setDeleteTarget}
              />
              <DragOverlay>
                {draggingSpec ? <ApiSpecDragPreview spec={draggingSpec} /> : null}
              </DragOverlay>
            </DndContext>
          </ResourceSidebar>
        }
        content={
          <ResourceContent
            projectId={projectId}
            projectName={projectName}
            module="api-specs"
            currentTitle={
              selectedSpec ? `${selectedSpec.method} ${selectedSpec.path}` : t('common.moduleGuide')
            }
            description={
              selectedSpec
                ? t('apiSpecs.currentDescriptionWithSelection')
                : t('apiSpecs.currentDescriptionEmpty')
            }
            actions={
              <>
                {selectedSpec ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openEditDialog(selectedSpec.id)}
                    disabled={!canWrite}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                ) : null}
                <Button type="button" onClick={() => openCreateSpecDialog()} disabled={!canWrite}>
                  <Plus className="h-4 w-4" />
                  {t('apiSpecs.addSpec')}
                </Button>
                <ActionMenu
                  items={[...selectedSpecActionItems, ...moduleActionItems]}
                  ariaLabel={t('common.openActions')}
                  triggerVariant="outline"
                />
              </>
            }
          >
            {selectedItemId && selectedSpecQuery.isLoading ? (
              <DetailSkeleton />
            ) : selectedItemId && !selectedSpec ? (
              <MissingDetailState
                moduleLabel={t('apiSpecs.title')}
                clearHref={buildProjectApiSpecsRoute(projectId)}
              />
            ) : !selectedSpec ? (
              <ApiSpecsGuideState
                onOpenAICreate={() => setIsAICreateOpen(true)}
                onOpenManualCreate={() => openCreateSpecDialog()}
                testCasesHref={buildProjectTestCasesRoute(projectId)}
              />
            ) : (
              <div className="space-y-6">
                {!canWrite && memberRoleQuery.isSuccess ? (
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>{t('apiSpecsPage.readOnlyTitle')}</AlertTitle>
                    <AlertDescription>
                      {t('apiSpecsPage.readOnlyDescription', {
                        role: getRoleLabel(currentRole),
                      })}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Card className="border-border-subtle">
                  <CardHeader>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-border-subtle bg-bg-subtle text-text-main"
                          >
                            {selectedSpec.method}
                          </Badge>
                          <Badge variant="outline">{selectedSpec.version}</Badge>
                          {selectedSpec.is_public ? (
                            <Badge>{t('common.public')}</Badge>
                          ) : (
                            <Badge variant="secondary">{t('common.private')}</Badge>
                          )}
                          {specShareQuery.data ? (
                            <Badge variant="outline">{t('share.shared')}</Badge>
                          ) : null}
                        </div>
                        <div>
                          <CardTitle className="text-2xl tracking-normal">
                            {selectedSpec.path}
                          </CardTitle>
                          <CardDescription className="mt-2 max-w-4xl leading-6">
                            {selectedSpec.summary ||
                              selectedSpec.description ||
                              t('apiSpecs.noSpecDescription')}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <InfoBadge
                          label={t('common.category')}
                          value={
                            selectedSpec.category_id
                              ? `#${selectedSpec.category_id}`
                              : t('common.unassigned')
                          }
                        />
                        <InfoBadge
                          label={t('common.examples')}
                          value={selectedSpec.examples?.length ?? 0}
                        />
                        <InfoBadge
                          label={t('common.responses')}
                          value={Object.keys(selectedSpec.responses || {}).length}
                        />
                        <InfoBadge
                          label={t('apiSpecsPage.tabsGeneratedTest')}
                          value={
                            generatedTestPreview ? t('common.available') : t('common.notDefined')
                          }
                        />
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <Card className="min-w-0 border-border-subtle">
                    <CardHeader>
                      <CardTitle>{t('apiSpecs.specSummary')}</CardTitle>
                      <CardDescription>{t('apiSpecs.specSummaryDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <DetailField label={t('common.created')}>
                        {formatDate(selectedSpec.created_at, 'YYYY-MM-DD HH:mm')}
                      </DetailField>
                      <DetailField label={t('common.updated')}>
                        {formatDate(selectedSpec.updated_at, 'YYYY-MM-DD HH:mm')}
                      </DetailField>
                      <DetailField label={t('common.requestParameters')}>
                        {selectedSpec.parameters?.length ?? 0}
                      </DetailField>
                      <DetailField label={t('common.requestBody')}>
                        {selectedSpec.request_body ? t('common.available') : t('common.notDefined')}
                      </DetailField>
                      <DetailField label={t('common.docSource')}>
                        {selectedSpec.doc_source || t('common.unknown')}
                      </DetailField>
                      <DetailField label={t('common.tags')}>
                        {(selectedSpec.tags?.length ?? 0) > 0
                          ? selectedSpec.tags.join(', ')
                          : t('common.noTags')}
                      </DetailField>
                    </CardContent>
                  </Card>

                  <Card className="min-w-0 border-border-subtle">
                    <CardHeader>
                      <CardTitle>{t('apiSpecs.documentationSnapshot')}</CardTitle>
                      <CardDescription>
                        {t('apiSpecs.documentationSnapshotDescription')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0">
                      {docPreview ? (
                        <pre className="min-w-0 max-h-[420px] overflow-auto rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-muted">
                          {docPreview}
                        </pre>
                      ) : (
                        <GuideState
                          icon={Clock3}
                          title={t('apiSpecs.documentationNotGenerated')}
                          description={t('apiSpecs.documentationNotGeneratedDescription')}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="min-w-0 border-border-subtle">
                  <CardHeader>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-1">
                        <CardTitle>{t('apiSpecsPage.tabsGeneratedTest')}</CardTitle>
                        <CardDescription>
                          {t('apiSpecsPage.generatedLanguage', {
                            lang: generatedTestLanguage.toUpperCase(),
                          })}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!generatedTestPreview}
                          onClick={() => void handleCopyGeneratedTest()}
                        >
                          <Copy className="h-4 w-4" />
                          {t('apiSpecsPage.copy')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => queueSpecAiAction(selectedSpec, 'test')}
                          disabled={!canWrite}
                        >
                          <FileCode2 className="h-4 w-4" />
                          {t('apiSpecsPage.aiGenerateTestButton')}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="min-w-0">
                    {generatedTestPreview ? (
                      <pre className="min-w-0 max-h-[420px] overflow-auto rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-muted">
                        {generatedTestPreview}
                      </pre>
                    ) : (
                      <GuideState
                        icon={FileCode2}
                        title={t('apiSpecsPage.tabsGeneratedTest')}
                        description={t('apiSpecsPage.generatedTestEmpty')}
                      />
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-2">
                  <JsonCard
                    title={t('common.requestBodySchema')}
                    value={selectedSpec.request_body}
                  />
                  <JsonCard title={t('common.responses')} value={selectedSpec.responses} />
                  <JsonCard title={t('common.parameters')} value={selectedSpec.parameters} />
                  <JsonCard title={t('common.examples')} value={selectedSpec.examples} />
                </div>
              </div>
            )}
          </ResourceContent>
        }
      />

      <CreateApiSpecDialog
        open={isCreateOpen}
        initialCategoryId={createSpecCategoryId}
        categories={categoryOptions}
        isSubmitting={createSpecMutation.isPending}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateSpec}
      />
      <CategoryFormDialog
        open={isCategoryCreateOpen}
        mode="create"
        categories={categories}
        isSubmitting={createCategoryMutation.isPending}
        onOpenChange={setIsCategoryCreateOpen}
        onSubmit={payload => handleCreateCategory(payload as CreateCategoryRequest)}
      />
      <ApiSpecAICreateDialog
        open={isAICreateOpen}
        onOpenChange={handleAICreateOpenChange}
        projectId={projectId}
        categories={categoryOptions}
        isSubmittingRefine={refineAIDraftMutation.isPending}
        isSubmittingAccept={acceptAIDraftMutation.isPending}
        onCreateDraft={(payload, options) => createAIDraftStream.create(payload, options)}
        onRefineDraft={(draftId, payload) =>
          refineAIDraftMutation.mutateAsync({
            draftId,
            data: payload,
          })
        }
        onAcceptDraft={(draftId, payload) =>
          acceptAIDraftMutation.mutateAsync({
            draftId,
            data: payload,
          })
        }
        onAccepted={({ specId, continueToTests }) => {
          void specsQuery.refetch();

          if (continueToTests) {
            router.replace(`${buildProjectTestCasesRoute(projectId)}?fromSpec=${specId}&source=ai`);
            return;
          }

          router.replace(buildModuleHref(projectId, 'api-specs', specId));
        }}
      />

      <SpecFormDialog
        key={`${editingSpecId ?? 'none'}-${editingSpecQuery.data?.updated_at ?? 'idle'}-${editingSpecId ? 'open' : 'closed'}`}
        open={editingSpecId !== null}
        mode="edit"
        spec={editingSpecQuery.data ?? null}
        categories={categoryOptions}
        isLoadingSpec={editingSpecQuery.isLoading}
        isSubmitting={updateSpecMutation.isPending}
        onOpenChange={open => {
          if (!open) {
            setEditingSpecId(null);
          }
        }}
        onSubmit={payload => handleUpdateSpec(payload as UpdateApiSpecRequest)}
      />

      <DeleteSpecDialog
        open={Boolean(deleteTarget)}
        spec={deleteTarget}
        isDeleting={deleteSpecMutation.isPending}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDeleteSpec}
      />

      <ImportSpecsDialog
        open={isImportOpen}
        isSubmitting={importSpecsMutation.isPending}
        onOpenChange={setIsImportOpen}
        onSubmit={handleImport}
      />

      <ExportSpecsDialog
        open={isExportOpen}
        isSubmitting={exportSpecsMutation.isPending}
        onOpenChange={setIsExportOpen}
        onSubmit={handleExport}
      />

      <BatchGenDocDialog
        open={isBatchGenOpen}
        categories={categoryOptions}
        isSubmitting={batchGenMutation.isPending}
        onOpenChange={setIsBatchGenOpen}
        onSubmit={handleBatchGenDoc}
      />

      <ExampleFormDialog
        open={isExampleOpen}
        isSubmitting={createExampleMutation.isPending}
        onOpenChange={setIsExampleOpen}
        onSubmit={handleCreateExample}
      />

      <AiActionDialog
        key={`${aiAction?.mode ?? 'none'}-${aiAction?.spec?.id ?? 'none'}-${aiAction ? 'open' : 'closed'}`}
        open={Boolean(aiAction)}
        mode={aiAction?.mode ?? 'doc'}
        spec={aiAction?.spec}
        isSubmitting={genDocMutation.isPending || genTestMutation.isPending}
        onOpenChange={open => {
          if (!open) {
            setAiAction(null);
          }
        }}
        onSubmit={handleAiAction}
      />
    </>
  );
}

function CollectionsWorkspaceSection({ projectId }: { projectId: number | string }) {
  return <ApiRequestWorkbench projectId={projectId} />;
}

function ApiSpecDirectoryList({
  groups,
  projectId,
  selectedSpecId,
  canWrite,
  movingSpecId,
  onOpenCreate,
  onOpenEdit,
  onQueueAiAction,
  onDelete,
}: {
  groups: ApiSpecSidebarGroup[];
  projectId: number | string;
  selectedSpecId?: string | number | null;
  canWrite: boolean;
  movingSpecId?: string | number | null;
  onOpenCreate: (categoryId?: string) => void;
  onOpenEdit: (specId: string | number) => void;
  onQueueAiAction: (spec: ApiSpec, mode: 'doc' | 'test') => void;
  onDelete: (spec: ApiSpec) => void;
}) {
  return (
    <div className="space-y-2">
      {groups.map(group => (
        <div key={group.key} className="space-y-1">
          <ApiSpecCategoryDropZone
            group={group}
            canWrite={canWrite}
            onOpenCreate={onOpenCreate}
          />

          {group.specs.map(spec => (
            <DraggableApiSpecListItem
              key={spec.id}
              spec={spec}
              projectId={projectId}
              active={String(spec.id) === String(selectedSpecId ?? '')}
              canWrite={canWrite}
              indentLevel={Math.min(group.depth + 1, 5)}
              isMoving={String(spec.id) === String(movingSpecId ?? '')}
              onOpenEdit={onOpenEdit}
              onQueueAiAction={onQueueAiAction}
              onDelete={onDelete}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ApiSpecCategoryDropZone({
  group,
  canWrite,
  onOpenCreate,
}: {
  group: ApiSpecSidebarGroup;
  canWrite: boolean;
  onOpenCreate: (categoryId?: string) => void;
}) {
  const t = useT('project');
  const { isOver, setNodeRef } = useDroppable({
    id: `api-spec-category-${group.categoryId ?? 'uncategorized'}`,
    data: {
      categoryId: group.categoryId ?? null,
      label: group.label,
    },
    disabled: !canWrite,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group/category flex min-h-7 items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-[11px] font-medium uppercase leading-4 text-text-muted transition-colors',
        canWrite ? 'data-[droppable=true]:cursor-copy' : '',
        isOver && 'border-primary bg-primary/10 text-text-main'
      )}
      data-droppable={canWrite}
      style={{ paddingLeft: `${8 + group.depth * 10}px` }}
    >
      <Tags className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{group.label}</span>
      <span className="shrink-0 tabular-nums">{group.specs.length}</span>
      {group.categoryId ? (
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-opacity hover:bg-bg-subtle hover:text-text-main group-hover/category:opacity-100 focus:opacity-100"
          onClick={() => onOpenCreate(group.categoryId ?? undefined)}
          aria-label={t('apiSpecs.addSpecToCategory', { category: group.label })}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function DraggableApiSpecListItem({
  spec,
  projectId,
  active,
  canWrite,
  indentLevel,
  isMoving,
  onOpenEdit,
  onQueueAiAction,
  onDelete,
}: {
  spec: ApiSpec;
  projectId: number | string;
  active: boolean;
  canWrite: boolean;
  indentLevel: number;
  isMoving: boolean;
  onOpenEdit: (specId: string | number) => void;
  onQueueAiAction: (spec: ApiSpec, mode: 'doc' | 'test') => void;
  onDelete: (spec: ApiSpec) => void;
}) {
  const t = useT('project');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `api-spec-${spec.id}`,
    data: {
      spec,
      specId: spec.id,
    },
    disabled: !canWrite,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn((isDragging || isMoving) && 'opacity-55')}
    >
      <ResourceListItem
        href={buildModuleHref(projectId, 'api-specs', spec.id)}
        active={active}
        title={`${spec.method} ${spec.path}`}
        description={spec.summary || spec.description || t('common.noSummaryProvided')}
        indentLevel={indentLevel}
        leading={
          canWrite ? (
            <button
              type="button"
              className={cn(
                'mt-0.5 inline-flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-main active:cursor-grabbing',
                active && 'text-primary-foreground/72 hover:bg-primary-foreground/15 hover:text-primary-foreground'
              )}
              aria-label={t('apiSpecs.dragSpecHandle')}
              {...listeners}
              {...attributes}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          ) : null
        }
        meta={
          <>
            <Badge variant="outline">{spec.version}</Badge>
            <span>
              {t('common.examples')}: {spec.examples?.length ?? 0}
            </span>
          </>
        }
        actionsMenu={
          <ActionMenu
            items={[
              {
                key: `spec-open-${spec.id}`,
                label: t('common.open'),
                href: buildModuleHref(projectId, 'api-specs', spec.id),
              },
              {
                key: `spec-edit-${spec.id}`,
                label: t('common.edit'),
                icon: Pencil,
                disabled: !canWrite,
                onSelect: () => onOpenEdit(spec.id),
              },
              {
                key: `spec-gen-doc-${spec.id}`,
                label: t('apiSpecsPage.genDoc'),
                icon: Bot,
                disabled: !canWrite,
                onSelect: () => onQueueAiAction(spec, 'doc'),
              },
              {
                key: `spec-gen-test-${spec.id}`,
                label: t('apiSpecsPage.genTest'),
                icon: FileCode2,
                disabled: !canWrite,
                onSelect: () => onQueueAiAction(spec, 'test'),
              },
              {
                key: `spec-delete-${spec.id}`,
                label: t('common.delete'),
                icon: Trash2,
                destructive: true,
                separatorBefore: true,
                disabled: !canWrite,
                onSelect: () => onDelete(spec),
              },
            ]}
            ariaLabel={t('common.openActions')}
            stopPropagation
            triggerClassName="h-6 w-6 rounded-md opacity-0 transition-opacity group-hover/resource:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100 [&>svg]:h-3.5 [&>svg]:w-3.5"
          />
        }
      />
    </div>
  );
}

function ApiSpecDragPreview({ spec }: { spec: ApiSpec }) {
  return (
    <div className="w-72 rounded-md border border-primary bg-bg-canvas px-3 py-2 shadow-modal">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="shrink-0">
          {spec.method}
        </Badge>
        <p className="min-w-0 truncate text-[13px] font-medium leading-5 text-text-main">
          {spec.path}
        </p>
      </div>
      <p className="mt-1 line-clamp-1 text-xs leading-4 text-text-muted">
        {spec.summary || spec.description || 'No summary provided'}
      </p>
    </div>
  );
}

function EnvironmentsWorkspaceSection({
  projectId,
  projectName,
  selectedItemId,
}: {
  projectId: number | string;
  projectName: string;
  selectedItemId?: string | number | null;
}) {
  const t = useT('project');
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [formMode, setFormMode] = useState<EnvironmentFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<number | string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectEnvironment | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectEnvironment | null>(null);
  const [suppressedSelectedEnvironmentId, setSuppressedSelectedEnvironmentId] = useState<
    number | string | null
  >(null);
  const deferredSearch = useDeferredValue(searchQuery);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const effectiveSelectedItemId =
    selectedItemId && String(selectedItemId) === String(suppressedSelectedEnvironmentId)
      ? null
      : selectedItemId;

  const memberRoleQuery = useProjectMemberRole(projectId);
  const environmentsQuery = useEnvironments(projectId);
  const selectedEnvironmentQuery = useEnvironment(projectId, effectiveSelectedItemId ?? undefined);
  const editingEnvironmentQuery = useEnvironment(projectId, editingEnvironmentId ?? undefined);
  const createEnvironmentMutation = useCreateEnvironment(projectId);
  const updateEnvironmentMutation = useUpdateEnvironment(projectId);
  const deleteEnvironmentMutation = useDeleteEnvironment(projectId);
  const duplicateEnvironmentMutation = useDuplicateEnvironment(projectId);

  const environments = environmentsQuery.data?.items ?? EMPTY_ENVIRONMENTS;
  const filteredEnvironments = useMemo(() => {
    if (!normalizedSearch) {
      return environments;
    }

    return environments.filter(environment =>
      [environment.name, environment.display_name || '', environment.base_url || ''].some(value =>
        value.toLowerCase().includes(normalizedSearch)
      )
    );
  }, [normalizedSearch, environments]);

  const selectedEnvironmentFromList =
    environments.find(environment => String(environment.id) === String(effectiveSelectedItemId)) ??
    null;
  const selectedEnvironment = selectedEnvironmentQuery.data ?? selectedEnvironmentFromList;
  const currentRole = memberRoleQuery.data?.role;
  const canWrite = currentRole ? WRITE_ROLES.includes(currentRole) : false;
  const listPreview =
    normalizedSearch.length > 0 ? filteredEnvironments.slice(0, 5) : environments.slice(0, 5);
  const environmentsPath = `/workspaces/${projectId}/environments`;
  const activeEnvironmentPath = selectedEnvironment
    ? `/workspaces/${projectId}/environments/${selectedEnvironment.id}`
    : `/workspaces/${projectId}/environments/:eid`;

  const closeEnvironmentForm = () => {
    setIsFormOpen(false);
    setEditingEnvironmentId(null);
  };

  const openCreateEnvironment = () => {
    setFormMode('create');
    setEditingEnvironmentId(null);
    setIsFormOpen(true);
  };

  const openEditEnvironment = (environmentId: number | string) => {
    setFormMode('edit');
    setEditingEnvironmentId(environmentId);
    setIsFormOpen(true);
  };

  const handleEnvironmentSubmit = async (
    payload: CreateEnvironmentRequest | UpdateEnvironmentRequest
  ) => {
    try {
      if (formMode === 'create') {
        const createdEnvironment = await createEnvironmentMutation.mutateAsync(
          payload as CreateEnvironmentRequest
        );
        setIsFormOpen(false);
        setEditingEnvironmentId(null);
        setSearchQuery('');
        router.replace(buildModuleHref(projectId, 'environments', createdEnvironment.id));
        return;
      }

      if (!editingEnvironmentId) {
        return;
      }

      const updatedEnvironment = await updateEnvironmentMutation.mutateAsync({
        environmentId: editingEnvironmentId,
        data: payload as UpdateEnvironmentRequest,
      });
      setIsFormOpen(false);
      setEditingEnvironmentId(null);
      router.replace(buildModuleHref(projectId, 'environments', updatedEnvironment.id));
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDeleteEnvironment = async () => {
    if (!deleteTarget) {
      return;
    }

    const deletedId = deleteTarget.id;
    const isDeletingSelectedEnvironment =
      selectedItemId !== null &&
      selectedItemId !== undefined &&
      String(selectedItemId) === String(deletedId);

    try {
      if (isDeletingSelectedEnvironment) {
        setSuppressedSelectedEnvironmentId(deletedId);
      }

      await deleteEnvironmentMutation.mutateAsync(deletedId);
      setDeleteTarget(null);

      if (isDeletingSelectedEnvironment) {
        router.replace(buildProjectEnvironmentsRoute(projectId));
      }
    } catch {
      if (isDeletingSelectedEnvironment) {
        setSuppressedSelectedEnvironmentId(null);
      }
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
      setDuplicateTarget(null);
      setSearchQuery('');
      router.replace(buildModuleHref(projectId, 'environments', duplicatedEnvironment.id));
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleRefresh = async () => {
    const tasks: Array<Promise<unknown>> = [memberRoleQuery.refetch(), environmentsQuery.refetch()];

    if (effectiveSelectedItemId) {
      tasks.push(selectedEnvironmentQuery.refetch());
    }

    await Promise.all(tasks);
  };

  const isRefreshing =
    memberRoleQuery.isFetching ||
    environmentsQuery.isFetching ||
    selectedEnvironmentQuery.isFetching;
  const workspaceActionItems: ActionMenuItem[] = [
    {
      key: 'environments-refresh',
      label: isRefreshing ? t('common.refreshing') : t('common.refresh'),
      icon: RefreshCw,
      disabled: isRefreshing,
      onSelect: () => void handleRefresh(),
    },
    {
      key: 'environments-api-specs',
      label: t('apiSpecs.title'),
      icon: FileJson2,
      href: buildProjectApiSpecsRoute(projectId),
      separatorBefore: selectedEnvironment ? true : undefined,
    },
    {
      key: 'environments-categories',
      label: t('categories.title'),
      icon: Tags,
      href: buildProjectCategoriesRoute(projectId),
    },
    {
      key: 'environments-test-cases',
      label: t('apiSpecs.openTestCases'),
      icon: FlaskConical,
      href: buildProjectTestCasesRoute(projectId),
    },
  ];

  if (selectedEnvironment) {
    workspaceActionItems.splice(1, 0, {
      key: 'environments-duplicate',
      label: t('common.duplicate'),
      icon: Boxes,
      disabled: !canWrite,
      onSelect: () => setDuplicateTarget(selectedEnvironment),
    });
    workspaceActionItems.splice(2, 0, {
      key: 'environments-delete',
      label: t('common.delete'),
      icon: Trash2,
      destructive: true,
      disabled: !canWrite,
      onSelect: () => setDeleteTarget(selectedEnvironment),
    });
  }

  return (
    <>
      <WorkspaceFrame
        sidebar={
          <ResourceSidebar
            module="environments"
            title={t('environments.title')}
            description={t('environments.description')}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t('environments.filterPlaceholder')}
            count={filteredEnvironments.length}
            loading={environmentsQuery.isLoading}
            error={environmentsQuery.error}
            emptyState={
              <SidebarEmptyState
                icon={Globe}
                title={t('environments.emptyTitle')}
                description={t('environments.emptyDescription')}
              />
            }
          >
            {filteredEnvironments.map(environment => (
              <ResourceListItem
                key={environment.id}
                href={buildModuleHref(projectId, 'environments', environment.id)}
                active={environment.id === selectedEnvironment?.id}
                title={environment.display_name || environment.name}
                description={environment.base_url || t('environments.baseUrlNotConfigured')}
                onOpen={closeEnvironmentForm}
                meta={
                  <>
                    <span>
                      {t('environments.vars', {
                        count: Object.keys(environment.variables || {}).length,
                      })}
                    </span>
                    <span>
                      {t('environments.headers', {
                        count: Object.keys(environment.headers || {}).length,
                      })}
                    </span>
                  </>
                }
                actionsMenu={
                  <ActionMenu
                    items={[
                      {
                        key: `environment-open-${environment.id}`,
                        label: t('common.open'),
                        href: buildModuleHref(projectId, 'environments', environment.id),
                        onSelect: closeEnvironmentForm,
                      },
                      {
                        key: `environment-edit-${environment.id}`,
                        label: t('common.edit'),
                        icon: Pencil,
                        disabled: !canWrite,
                        onSelect: () => openEditEnvironment(environment.id),
                      },
                      {
                        key: `environment-duplicate-${environment.id}`,
                        label: t('common.duplicate'),
                        icon: Boxes,
                        disabled: !canWrite,
                        onSelect: () => setDuplicateTarget(environment),
                      },
                      {
                        key: `environment-delete-${environment.id}`,
                        label: t('common.delete'),
                        icon: Trash2,
                        destructive: true,
                        disabled: !canWrite,
                        onSelect: () => setDeleteTarget(environment),
                      },
                    ]}
                    ariaLabel={t('common.openActions')}
                    stopPropagation
                    triggerClassName="h-6 w-6 rounded-md opacity-0 transition-opacity group-hover/resource:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100 [&>svg]:h-3.5 [&>svg]:w-3.5"
                  />
                }
              />
            ))}
          </ResourceSidebar>
        }
        content={
          <ResourceContent
            projectId={projectId}
            projectName={projectName}
            module="environments"
            currentTitle={
              selectedEnvironment
                ? selectedEnvironment.display_name || selectedEnvironment.name
                : t('environments.workspaceTitle')
            }
            description={
              selectedEnvironment
                ? t('environments.currentDescriptionWithSelection')
                : t('environments.currentDescriptionEmpty')
            }
            actions={
              <>
                {selectedEnvironment ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openEditEnvironment(selectedEnvironment.id)}
                    disabled={!canWrite}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                ) : null}
                <Button type="button" onClick={openCreateEnvironment} disabled={!canWrite}>
                  <Plus className="h-4 w-4" />
                  {t('environments.createButton')}
                </Button>
                <ActionMenu
                  items={workspaceActionItems}
                  ariaLabel={t('common.openActions')}
                  triggerVariant="outline"
                />
              </>
            }
          >
            <div className="space-y-6">
              {!canWrite && memberRoleQuery.isSuccess ? (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>{t('common.readOnlyAccess')}</AlertTitle>
                  <AlertDescription>
                    {t('environments.readOnlyDescription', { role: getRoleLabel(currentRole) })}
                  </AlertDescription>
                </Alert>
              ) : null}

              {isFormOpen ? (
                <EnvironmentFormDialog
                  key={`${formMode}-${editingEnvironmentQuery.data?.id ?? editingEnvironmentId ?? 'new'}`}
                  mode={formMode}
                  environment={formMode === 'edit' ? (editingEnvironmentQuery.data ?? null) : null}
                  isLoadingEnvironment={formMode === 'edit' && editingEnvironmentQuery.isLoading}
                  isSubmitting={
                    createEnvironmentMutation.isPending || updateEnvironmentMutation.isPending
                  }
                  onCancel={closeEnvironmentForm}
                  onSubmit={handleEnvironmentSubmit}
                  onAutoSaveFields={payload => {
                    if (formMode !== 'edit' || !editingEnvironmentId) {
                      return;
                    }

                    updateEnvironmentMutation.mutate({
                      environmentId: editingEnvironmentId,
                      data: payload,
                    });
                  }}
                />
              ) : effectiveSelectedItemId && selectedEnvironmentQuery.isLoading ? (
                <DetailSkeleton />
              ) : effectiveSelectedItemId && !selectedEnvironment ? (
                <MissingDetailState
                  moduleLabel={t('modules.environments.label').toLowerCase()}
                  clearHref={buildProjectEnvironmentsRoute(projectId)}
                />
              ) : !selectedEnvironment ? (
                environmentsQuery.isLoading ? (
                  <DetailSkeleton />
                ) : environments.length === 0 ? (
                  <Card className="border-dashed border-border-subtle">
                    <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Globe className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-medium text-text-main">
                          {t('environments.noEnvironmentsYet')}
                        </p>
                        <p className="max-w-2xl text-sm leading-6 text-text-muted">
                          {t('environments.noEnvironmentsYetDescription')}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        <Button type="button" onClick={openCreateEnvironment} disabled={!canWrite}>
                          <Plus className="h-4 w-4" />
                          {t('environments.createButton')}
                        </Button>
                        <Button asChild variant="outline">
                          <Link href={buildProjectApiSpecsRoute(projectId)}>
                            {t('environments.openApiSpecs')}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    <Card className="border-border-subtle">
                      <CardHeader>
                        <CardTitle>{t('environments.overview')}</CardTitle>
                        <CardDescription>{t('environments.overviewDescription')}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-3">
                        <Button type="button" onClick={openCreateEnvironment} disabled={!canWrite}>
                          <Plus className="h-4 w-4" />
                          {t('environments.createButton')}
                        </Button>
                        <Button asChild variant="outline">
                          <Link href={buildProjectTestCasesRoute(projectId)}>
                            {t('environments.openTestCases')}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>

                    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                      <Card className="border-border-subtle">
                        <CardHeader>
                          <CardTitle>
                            {normalizedSearch
                              ? t('environments.matchingEnvironments')
                              : t('environments.availableEnvironments')}
                          </CardTitle>
                          <CardDescription>{t('environments.visibleQuickLinks')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {listPreview.length === 0 ? (
                            <GuideState
                              icon={Globe}
                              title={t('environments.noMatchingEnvironments')}
                              description={t('environments.noMatchingDescription')}
                            />
                          ) : (
                            listPreview.map(environment => (
                              <Link
                                key={environment.id}
                                href={buildModuleHref(projectId, 'environments', environment.id)}
                                className="block rounded-md border border-border-subtle bg-bg-canvas p-4 transition-colors hover:bg-bg-subtle"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-text-main">
                                      {environment.display_name || environment.name}
                                    </p>
                                    <p className="mt-1 text-xs text-text-muted">
                                      {environment.base_url ||
                                        t('environments.baseUrlNotConfigured')}
                                    </p>
                                  </div>
                                  <Badge variant="outline">{environment.name}</Badge>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
                                  <span>
                                    {t('environments.vars', {
                                      count: Object.keys(environment.variables || {}).length,
                                    })}
                                  </span>
                                  <span>
                                    {t('environments.headers', {
                                      count: Object.keys(environment.headers || {}).length,
                                    })}
                                  </span>
                                  <span>
                                    {formatDate(environment.updated_at, 'YYYY-MM-DD HH:mm')}
                                  </span>
                                </div>
                              </Link>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-border-subtle">
                        <CardHeader>
                          <CardTitle>{t('environments.apiSurface')}</CardTitle>
                          <CardDescription>
                            {t('environments.apiSurfaceDescription')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="overflow-x-auto rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-muted">
                            <code>{`GET ${environmentsPath}
POST ${environmentsPath}
GET ${activeEnvironmentPath}
PATCH ${activeEnvironmentPath}
DELETE ${activeEnvironmentPath}
POST ${activeEnvironmentPath}/duplicate`}</code>
                          </pre>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-6">
                  <Card className="border-border-subtle">
                    <CardHeader>
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="border-border-subtle bg-bg-subtle text-text-main"
                            >
                              {t('modules.environments.label')}
                            </Badge>
                            <Badge variant="outline">{selectedEnvironment.name}</Badge>
                          </div>
                          <div>
                            <CardTitle className="text-2xl tracking-normal">
                              {selectedEnvironment.display_name || selectedEnvironment.name}
                            </CardTitle>
                            <CardDescription className="mt-2">
                              {selectedEnvironment.base_url || t('environments.baseUrlMissing')}
                            </CardDescription>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <InfoBadge
                            label={t('common.variablesJson')}
                            value={Object.keys(selectedEnvironment.variables || {}).length}
                          />
                          <InfoBadge
                            label={t('common.headersJson')}
                            value={Object.keys(selectedEnvironment.headers || {}).length}
                          />
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <Card className="border-border-subtle">
                      <CardHeader>
                        <CardTitle>{t('environments.metadata')}</CardTitle>
                        <CardDescription>{t('environments.metadataDescription')}</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <DetailField label={t('environments.systemName')}>
                          {selectedEnvironment.name}
                        </DetailField>
                        <DetailField label={t('common.displayName')}>
                          {selectedEnvironment.display_name || t('common.notSet')}
                        </DetailField>
                        <DetailField label={t('common.created')}>
                          {formatDate(selectedEnvironment.created_at, 'YYYY-MM-DD HH:mm')}
                        </DetailField>
                        <DetailField label={t('common.updated')}>
                          {formatDate(selectedEnvironment.updated_at, 'YYYY-MM-DD HH:mm')}
                        </DetailField>
                      </CardContent>
                    </Card>

                    <JsonCard title={t('common.headersJson')} value={selectedEnvironment.headers} />
                  </div>

                  <JsonCard
                    title={t('common.variablesJson')}
                    value={selectedEnvironment.variables}
                  />
                </div>
              )}
            </div>
          </ResourceContent>
        }
      />

      <DeleteEnvironmentDialog
        open={Boolean(deleteTarget)}
        environment={deleteTarget}
        isDeleting={deleteEnvironmentMutation.isPending}
        onOpenChange={open => {
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
        onOpenChange={open => {
          if (!open) {
            setDuplicateTarget(null);
          }
        }}
        onSubmit={handleDuplicateEnvironment}
      />
    </>
  );
}

function CategoriesWorkspaceSection({
  projectId,
  projectName,
  selectedItemId,
}: {
  projectId: number | string;
  projectName: string;
  selectedItemId?: string | number | null;
}) {
  const t = useT('project');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);

  const categoriesQuery = useProjectCategories({
    projectId,
    tree: true,
  });
  const selectedCategoryQuery = useProjectCategory(projectId, selectedItemId ?? undefined);

  const flatCategories = flattenProjectCategories(categoriesQuery.data?.items);
  const filteredCategories = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return flatCategories;
    }

    return flatCategories.filter(category =>
      [category.name, category.description || '', category.parent_name || ''].some(value =>
        value.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [deferredSearch, flatCategories]);

  const selectedCategoryFromList =
    flatCategories.find(category => category.id === selectedItemId) ?? null;
  const selectedCategory = selectedCategoryQuery.data ?? selectedCategoryFromList;
  const selectedCategoryTreeNode = findProjectCategory(
    categoriesQuery.data?.items,
    selectedCategory?.id
  );
  const childCategories = selectedCategoryTreeNode?.children ?? [];
  const fullManagerHref = `${buildProjectCategoriesRoute(projectId)}?mode=manage`;
  const refreshActionItems: ActionMenuItem[] = [
    {
      key: 'categories-refresh',
      label:
        categoriesQuery.isFetching || selectedCategoryQuery.isFetching
          ? t('common.refreshing')
          : t('common.refresh'),
      icon: RefreshCw,
      disabled: categoriesQuery.isFetching || selectedCategoryQuery.isFetching,
      onSelect: () => {
        void categoriesQuery.refetch();

        if (selectedItemId) {
          void selectedCategoryQuery.refetch();
        }
      },
    },
  ];
  return (
    <WorkspaceFrame
      sidebar={
        <ResourceSidebar
          module="categories"
          title={t('categories.title')}
          description={t('categories.description')}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t('categories.filterPlaceholder')}
          count={filteredCategories.length}
          loading={categoriesQuery.isLoading}
          error={categoriesQuery.error}
          emptyState={
            <SidebarEmptyState
              icon={Tags}
              title={t('categories.emptyTitle')}
              description={t('categories.emptyDescription')}
            />
          }
        >
          {filteredCategories.map(category => (
            <ResourceListItem
              key={category.id}
              href={buildModuleHref(projectId, 'categories', category.id)}
              active={category.id === selectedCategory?.id}
              title={category.name}
              description={category.description || t('common.noDescriptionProvided')}
              indentLevel={Math.min(category.depth, 4)}
              meta={
                <>
                  <span>
                    {t('categories.sortOrder')} {category.sort_order}
                  </span>
                  {category.test_cases_count ? (
                    <span>
                      {t('categories.tests')}: {category.test_cases_count}
                    </span>
                  ) : null}
                </>
              }
            />
          ))}
        </ResourceSidebar>
      }
      content={
        <ResourceContent
          projectId={projectId}
          projectName={projectName}
          module="categories"
          currentTitle={selectedCategory ? selectedCategory.name : t('common.moduleGuide')}
          description={
            selectedCategory
              ? t('categories.categoryMetadataDescription')
              : t('categories.chooseCategoryDescription')
          }
          actions={
            <>
              <Button asChild variant="outline">
                <Link href={fullManagerHref}>{t('common.fullManager')}</Link>
              </Button>
              <ActionMenu
                items={refreshActionItems}
                ariaLabel={t('common.openActions')}
                triggerVariant="outline"
              />
            </>
          }
        >
          {selectedItemId && selectedCategoryQuery.isLoading ? (
            <DetailSkeleton />
          ) : selectedItemId && !selectedCategory ? (
            <MissingDetailState
              moduleLabel={t('modules.categories.label').toLowerCase()}
              clearHref={buildProjectCategoriesRoute(projectId)}
            />
          ) : !selectedCategory ? (
            <GuideState
              icon={Tags}
              title={t('categories.chooseCategory')}
              description={t('categories.chooseCategoryDescription')}
              actionHref={`${buildProjectCategoriesRoute(projectId)}?mode=manage`}
              actionLabel={t('categories.manageCategories')}
            />
          ) : (
            <div className="space-y-6">
              <Card className="border-border-subtle">
                <CardHeader>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-border-subtle bg-bg-subtle text-text-main"
                        >
                          {t('common.category')}
                        </Badge>
                        {selectedCategory.parent_id ? (
                          <Badge variant="outline">
                            {t('categories.parent')} #{selectedCategory.parent_id}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t('common.root')}</Badge>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-2xl tracking-normal">
                          {selectedCategory.name}
                        </CardTitle>
                        <CardDescription className="mt-2 max-w-3xl leading-6">
                          {selectedCategory.description || t('common.noDescriptionProvided')}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <InfoBadge label={t('categories.children')} value={childCategories.length} />
                      <InfoBadge
                        label={t('categories.sortOrder')}
                        value={selectedCategory.sort_order}
                      />
                      <InfoBadge
                        label={t('categories.tests')}
                        value={selectedCategory.test_cases_count ?? 0}
                      />
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <Card className="border-border-subtle">
                  <CardHeader>
                    <CardTitle>{t('categories.categoryMetadata')}</CardTitle>
                    <CardDescription>{t('categories.categoryMetadataDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <DetailField label={t('categories.parent')}>
                      {selectedCategory.parent_name ||
                        (selectedCategory.parent_id
                          ? `#${selectedCategory.parent_id}`
                          : t('common.rootCategory'))}
                    </DetailField>
                    <DetailField label={t('common.created')}>
                      {formatDate(selectedCategory.created_at, 'YYYY-MM-DD HH:mm')}
                    </DetailField>
                    <DetailField label={t('common.updated')}>
                      {formatDate(selectedCategory.updated_at, 'YYYY-MM-DD HH:mm')}
                    </DetailField>
                    <DetailField label={t('common.projectId')}>
                      {selectedCategory.project_id}
                    </DetailField>
                  </CardContent>
                </Card>

                <Card className="border-border-subtle">
                  <CardHeader>
                    <CardTitle>{t('categories.childCategories')}</CardTitle>
                    <CardDescription>{t('categories.childCategoriesDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {childCategories.length === 0 ? (
                      <GuideState
                        icon={Layers3}
                        title={t('categories.noChildCategories')}
                        description={t('categories.noChildCategoriesDescription')}
                      />
                    ) : (
                      childCategories.map(child => (
                        <div
                          key={child.id}
                          className="rounded-md border border-border-subtle bg-bg-canvas p-4"
                        >
                          <p className="text-sm font-medium">{child.name}</p>
                          <p className="mt-1 text-xs text-text-muted">
                            {child.description || t('common.noDescriptionProvided')}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </ResourceContent>
      }
    />
  );
}

function HistoryWorkspaceSection({
  projectId,
  projectName,
  selectedItemId,
  initialEntityTypeFilter,
}: {
  projectId: number | string;
  projectName: string;
  selectedItemId?: string | number | null;
  initialEntityTypeFilter?: string | null;
}) {
  const t = useT('project');
  const [searchQuery, setSearchQuery] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState(
    initialEntityTypeFilter?.trim() || 'all'
  );
  const deferredSearch = useDeferredValue(searchQuery);

  const historiesQuery = useProjectHistories({
    projectId: String(projectId),
    page: 1,
    pageSize: MAX_MODULE_ITEMS,
    entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
  });
  const selectedHistoryQuery = useProjectHistory(
    String(projectId),
    selectedItemId != null ? String(selectedItemId) : undefined
  );

  const histories = historiesQuery.data?.items ?? EMPTY_HISTORIES;
  const entityTypeOptions = useMemo(
    () => Array.from(new Set(histories.map(history => history.entity_type).filter(Boolean))).sort(),
    [histories]
  );
  const filteredHistories = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return histories;
    }

    return histories.filter(history =>
      [
        history.message || '',
        history.action,
        history.entity_type,
        String(history.id),
        String(history.entity_id),
        String(history.user_id),
      ].some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSearch, histories]);

  const selectedHistoryFromList = histories.find(history => history.id === selectedItemId) ?? null;
  const selectedHistory = selectedHistoryQuery.data ?? selectedHistoryFromList;
  const selectedCLIRequest = getCLIRequestRecord(selectedHistory);
  const selectedCLIRequestResponse = getCLIRequestResponseRecord(selectedHistory);
  const selectedCLIRun = getCLIRunRecord(selectedHistory);
  const selectedCLIRunResults = getCLIRunResults(selectedHistory);
  const selectedCLIRunLog = getCLIRunLogRecord(selectedHistory);
  const isFiltered = entityTypeFilter !== 'all' || deferredSearch.trim().length > 0;
  const refreshActionItems: ActionMenuItem[] = [
    {
      key: 'histories-refresh',
      label:
        historiesQuery.isFetching || selectedHistoryQuery.isFetching
          ? t('common.refreshing')
          : t('common.refresh'),
      icon: RefreshCw,
      disabled: historiesQuery.isFetching || selectedHistoryQuery.isFetching,
      onSelect: () => {
        void historiesQuery.refetch();

        if (selectedItemId) {
          void selectedHistoryQuery.refetch();
        }
      },
    },
  ];

  return (
    <WorkspaceFrame
      sidebar={
        <ResourceSidebar
          module="histories"
          title={t('history.title')}
          description={t('history.description')}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t('history.searchPlaceholder')}
          count={filteredHistories.length}
          loading={historiesQuery.isLoading}
          error={historiesQuery.error}
          headerActions={
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('history.filterByEntityType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('history.allEntityTypes')}</SelectItem>
                {entityTypeOptions.map(entityType => (
                  <SelectItem key={entityType} value={entityType}>
                    {entityType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          emptyState={
            <SidebarEmptyState
              icon={FileClock}
              title={isFiltered ? t('history.noMatchingHistory') : t('history.noHistoryYet')}
              description={
                isFiltered ? t('history.noMatchingDescription') : t('history.emptyDescription')
              }
            />
          }
        >
          {filteredHistories.map(history => (
            <ResourceListItem
              key={history.id}
              href={buildModuleHref(projectId, 'histories', history.id)}
              active={history.id === selectedHistory?.id}
              title={getHistoryPrimaryTitle(history)}
              description={history.message || getHistoryFallbackDescription(history)}
              meta={
                <>
                  <Badge variant="outline">{history.action}</Badge>
                  {isRequestHistoryRecord(history) && getHistoryRequestStatus(history) !== null ? (
                    <Badge variant="secondary">{getHistoryRequestStatus(history)}</Badge>
                  ) : null}
                  {isRunHistoryRecord(history) && getHistoryRunStatus(history) ? (
                    <Badge variant="secondary">{getHistoryRunStatus(history)}</Badge>
                  ) : null}
                  {!isRequestHistoryRecord(history) &&
                  !isRunHistoryRecord(history) &&
                  getHistoryRunStatus(history) ? (
                    <Badge variant="secondary">{getHistoryRunStatus(history)}</Badge>
                  ) : null}
                  {isRequestHistoryRecord(history) && getHistoryRequestDuration(history) ? (
                    <span>{getHistoryRequestDuration(history)}</span>
                  ) : null}
                  {isRunHistoryRecord(history) && getHistoryRunStepCount(history) !== null ? (
                    <span>
                      {getHistoryRunStepCount(history)} {t('history.totalSteps').toLowerCase()}
                    </span>
                  ) : null}
                  {getHistoryExecutionMode(history) ? (
                    <span>{getHistoryExecutionMode(history)}</span>
                  ) : null}
                  <span>
                    {t('history.user')} #{history.user_id}
                  </span>
                  <span>{formatDate(history.created_at, 'YYYY-MM-DD HH:mm')}</span>
                </>
              }
            />
          ))}
        </ResourceSidebar>
      }
      content={
        <ResourceContent
          projectId={projectId}
          projectName={projectName}
          module="histories"
          currentTitle={
            selectedHistory ? getHistoryPrimaryTitle(selectedHistory) : t('history.projectHistory')
          }
          description={
            selectedHistory
              ? t('history.currentDescriptionWithSelection')
              : t('history.currentDescriptionEmpty')
          }
          actions={
            <ActionMenu
              items={refreshActionItems}
              ariaLabel={t('common.openActions')}
              triggerVariant="outline"
            />
          }
        >
          {selectedItemId && selectedHistoryQuery.isLoading ? (
            <DetailSkeleton />
          ) : selectedItemId && !selectedHistory ? (
            <MissingDetailState
              moduleLabel={t('history.recordId').toLowerCase()}
              clearHref={buildProjectHistoriesRoute(projectId)}
            />
          ) : historiesQuery.isLoading ? (
            <DetailSkeleton />
          ) : histories.length === 0 ? (
            <GuideState
              icon={FileClock}
              title={isFiltered ? t('history.noMatchingRecord') : t('history.noHistoryRecorded')}
              description={
                isFiltered
                  ? t('history.noMatchingRecordDescription')
                  : t('history.noHistoryRecordedDescription')
              }
            />
          ) : !selectedHistory ? (
            <GuideState
              icon={FileClock}
              title={t('history.chooseRecord')}
              description={t('history.chooseRecordDescription')}
            />
          ) : (
            <div className="space-y-6">
              <Card className="border-border-subtle">
                <CardHeader>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-border-subtle bg-bg-subtle text-text-main"
                        >
                          {selectedHistory.entity_type}
                        </Badge>
                        <Badge variant="outline">{selectedHistory.action}</Badge>
                        {isRequestHistoryRecord(selectedHistory) &&
                        getHistoryRequestStatus(selectedHistory) !== null ? (
                          <Badge variant="secondary">
                            {getHistoryRequestStatus(selectedHistory)}
                          </Badge>
                        ) : null}
                        {!isRequestHistoryRecord(selectedHistory) &&
                        getHistoryRunStatus(selectedHistory) ? (
                          <Badge variant="secondary">{getHistoryRunStatus(selectedHistory)}</Badge>
                        ) : null}
                        <Badge variant="secondary">
                          {t('history.recordNumber', { id: selectedHistory.id })}
                        </Badge>
                      </div>
                      <div>
                        <CardTitle className="text-2xl tracking-normal">
                          {getHistoryPrimaryTitle(selectedHistory)}
                        </CardTitle>
                        <CardDescription className="mt-2 max-w-4xl leading-6">
                          {selectedHistory.message || t('history.noMessageForEntry')}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <InfoBadge label={t('history.user')} value={`#${selectedHistory.user_id}`} />
                      {selectedHistory.source ? (
                        <InfoBadge label={t('history.syncSource')} value={selectedHistory.source} />
                      ) : null}
                      <InfoBadge
                        label={t('common.created')}
                        value={formatDate(selectedHistory.created_at, 'YYYY-MM-DD HH:mm')}
                      />
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <Card className="border-border-subtle">
                  <CardHeader>
                    <CardTitle>{t('history.metadata')}</CardTitle>
                    <CardDescription>{t('history.metadataDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <DetailField label={t('history.recordId')}>{selectedHistory.id}</DetailField>
                    <DetailField label={t('history.workspaceId')}>
                      {selectedHistory.workspace_id}
                    </DetailField>
                    <DetailField label={t('history.entityType')}>
                      {selectedHistory.entity_type}
                    </DetailField>
                    <DetailField label={t('history.entityId')}>
                      {selectedHistory.entity_id}
                    </DetailField>
                    <DetailField label={t('history.action')}>{selectedHistory.action}</DetailField>
                    <DetailField label={t('history.userId')}>{selectedHistory.user_id}</DetailField>
                    <DetailField label={t('history.syncSource')}>
                      {selectedHistory.source || t('common.unknown')}
                    </DetailField>
                    <DetailField label={t('history.sourceEventId')}>
                      {selectedHistory.source_event_id || t('common.unknown')}
                    </DetailField>
                  </CardContent>
                </Card>

                <Card className="border-border-subtle">
                  <CardHeader>
                    <CardTitle>{t('history.recordedNote')}</CardTitle>
                    <CardDescription>{t('history.recordedNoteDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border border-border-subtle bg-bg-canvas p-4 text-sm leading-6 text-text-muted">
                      {selectedHistory.message || t('history.noMessageRecorded')}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedCLIRequest && selectedCLIRequestResponse ? (
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="border-border-subtle">
                    <CardHeader>
                      <CardTitle>{t('common.request')}</CardTitle>
                      <CardDescription>{t('history.cliRequestDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <DetailField label={t('common.method')}>
                          {getHistoryString(selectedCLIRequest.method) || t('common.unknown')}
                        </DetailField>
                        <DetailField label={t('common.environment')}>
                          {getHistoryString(selectedCLIRequest.environment) || t('common.unknown')}
                        </DetailField>
                        <DetailField label={t('common.url')}>
                          {getHistoryString(selectedCLIRequest.url) || t('common.unknown')}
                        </DetailField>
                        <DetailField label={t('history.transport')}>
                          {getHistoryString(selectedCLIRequest.transport) || t('common.unknown')}
                        </DetailField>
                      </div>
                      <pre className="max-h-[280px] overflow-auto rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-muted">
                        {formatJson(selectedCLIRequest.headers)}
                      </pre>
                      <pre className="max-h-[280px] overflow-auto rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-muted">
                        {typeof selectedCLIRequest.body === 'string'
                          ? selectedCLIRequest.body
                          : formatJson(selectedCLIRequest.body)}
                      </pre>
                    </CardContent>
                  </Card>

                  <Card className="border-border-subtle">
                    <CardHeader>
                      <CardTitle>{t('common.response')}</CardTitle>
                      <CardDescription>{t('history.cliResponseDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <DetailField label={t('common.httpStatus')}>
                          {getHistoryNumber(selectedCLIRequestResponse.status) ??
                            t('common.unknown')}
                        </DetailField>
                        <DetailField label={t('common.duration')}>
                          {formatHistoryDuration(selectedCLIRequestResponse.duration_ms) ||
                            t('common.unknown')}
                        </DetailField>
                      </div>
                      <pre className="max-h-[280px] overflow-auto rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-muted">
                        {formatJson(selectedCLIRequestResponse.headers)}
                      </pre>
                      <pre className="max-h-[280px] overflow-auto rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-muted">
                        {typeof selectedCLIRequestResponse.body === 'string'
                          ? selectedCLIRequestResponse.body
                          : formatJson(selectedCLIRequestResponse.body)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {selectedCLIRun ? (
                <>
                  <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <Card className="border-border-subtle">
                      <CardHeader>
                        <CardTitle>{t('history.cliRunSummary')}</CardTitle>
                        <CardDescription>{t('history.cliRunSummaryDescription')}</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <DetailField label={t('history.runFile')}>
                          {getHistoryString(selectedCLIRun.source_name) || t('common.unknown')}
                        </DetailField>
                        <DetailField label={t('common.status')}>
                          {getHistoryString(selectedCLIRun.status) || t('common.unknown')}
                        </DetailField>
                        <DetailField label={t('history.totalSteps')}>
                          {getHistoryNumber(selectedCLIRun.total_steps) ?? 0}
                        </DetailField>
                        <DetailField label={t('history.passedSteps')}>
                          {getHistoryNumber(selectedCLIRun.passed_steps) ?? 0}
                        </DetailField>
                        <DetailField label={t('history.failedSteps')}>
                          {getHistoryNumber(selectedCLIRun.failed_steps) ?? 0}
                        </DetailField>
                        <DetailField label={t('common.duration')}>
                          {formatHistoryDuration(selectedCLIRun.total_duration_ms) ||
                            t('common.unknown')}
                        </DetailField>
                      </CardContent>
                    </Card>

                    <Card className="border-border-subtle">
                      <CardHeader>
                        <CardTitle>{t('history.logExcerpt')}</CardTitle>
                        <CardDescription>{t('history.logExcerptDescription')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="max-h-[340px] overflow-auto rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-muted">
                          {getHistoryString(selectedCLIRunLog?.excerpt) ||
                            t('history.noLogExcerpt')}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-border-subtle">
                    <CardHeader>
                      <CardTitle>{t('history.stepResults')}</CardTitle>
                      <CardDescription>{t('history.stepResultsDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedCLIRunResults.length === 0 ? (
                        <div className="rounded-md border border-border-subtle bg-bg-canvas p-4 text-sm text-text-muted">
                          {t('history.noStepResults')}
                        </div>
                      ) : (
                        selectedCLIRunResults.map((result, index) => (
                          <div
                            key={`${selectedHistory.id}-${index}`}
                            className="rounded-md border border-border-subtle bg-bg-canvas p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                {getHistoryString(result.method) ||
                                  getHistoryString(result.name) ||
                                  `Step ${index + 1}`}
                              </Badge>
                              {getHistoryBoolean(result.success) !== null ? (
                                <Badge variant="secondary">
                                  {getHistoryBoolean(result.success) ? 'passed' : 'failed'}
                                </Badge>
                              ) : null}
                              {getHistoryNumber(result.status) !== null ? (
                                <Badge variant="secondary">{getHistoryNumber(result.status)}</Badge>
                              ) : null}
                              {formatHistoryDuration(result.duration_ms) ? (
                                <span className="text-xs text-text-muted">
                                  {formatHistoryDuration(result.duration_ms)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm font-medium text-text-main">
                              {getHistoryString(result.url) ||
                                getHistoryString(result.name) ||
                                t('history.noStepLabel')}
                            </p>
                            {getHistoryString(result.error) ? (
                              <p className="mt-2 text-xs leading-6 text-destructive">
                                {getHistoryString(result.error)}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-2">
                <JsonCard title={t('history.snapshotData')} value={selectedHistory.data} />
                <JsonCard title={t('history.diff')} value={selectedHistory.diff} />
              </div>
            </div>
          )}
        </ResourceContent>
      }
    />
  );
}

function PlaceholderWorkspaceSection({
  projectId,
  projectName,
  module,
}: {
  projectId: number | string;
  projectName: string;
  module: ProjectWorkspaceModule;
}) {
  const t = useT('project');
  const moduleMeta = getProjectWorkspaceModuleMeta(module);
  const moduleLabel = getProjectModuleCopy(t, moduleMeta.i18nKey, 'label');
  const moduleDescription = getProjectModuleCopy(t, moduleMeta.i18nKey, 'description');
  const Icon = moduleMeta.icon;
  const isHistoryModule = module === 'histories';

  return (
    <WorkspaceFrame
      sidebar={
        <ResourceSidebar
          module={module}
          title={moduleLabel}
          description={moduleDescription}
          count={0}
          loading={false}
          error={null}
          emptyState={
            <SidebarEmptyState
              icon={moduleMeta.icon}
              title={t('workspace.placeholderTitle', { module: moduleLabel })}
              description={t('workspace.placeholderSidebarDescription', {
                module: moduleLabel.toLowerCase(),
              })}
            />
          }
        />
      }
      content={
        <ResourceContent
          projectId={projectId}
          projectName={projectName}
          module={module}
          currentTitle={t('workspace.placeholderTitle', { module: moduleLabel })}
          description={t('workspace.placeholderContentDescription', {
            module: moduleLabel.toLowerCase(),
          })}
          actions={
            isHistoryModule ? (
              <Button asChild variant="outline">
                <Link href={buildProjectTestCasesRoute(projectId)}>
                  {t('common.openLegacyTestCases')}
                </Link>
              </Button>
            ) : null
          }
        >
          <GuideState
            icon={Icon}
            title={t('workspace.moduleNotConnected', { module: moduleLabel })}
            description={
              isHistoryModule
                ? t('workspace.historyPlaceholderDescription')
                : t('workspace.placeholderDescription')
            }
            actionHref={isHistoryModule ? buildProjectTestCasesRoute(projectId) : undefined}
            actionLabel={isHistoryModule ? t('common.openLegacyTestCases') : undefined}
          />
        </ResourceContent>
      }
    />
  );
}

function WorkspaceFrame({
  sidebar,
  content,
}: {
  sidebar: React.ReactNode;
  content: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-canvas xl:flex-row">
      <aside className="w-full shrink-0 border-b border-border-subtle bg-bg-canvas xl:w-[336px] xl:border-b-0 xl:border-r">
        {sidebar}
      </aside>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{content}</div>
    </div>
  );
}

function ResourceSidebar({
  title,
  loading,
  error,
  count,
  children,
  emptyState,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  headerActions,
}: {
  module: ProjectWorkspaceModule;
  title: string;
  description: string;
  count: number;
  loading: boolean;
  error: unknown;
  children?: React.ReactNode;
  emptyState: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  headerActions?: React.ReactNode;
}) {
  const t = useT('project');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="space-y-2 px-3 py-2">
        <div className="flex min-h-8 items-center">
          <h2 className="truncate text-sm font-medium tracking-normal text-text-main">{title}</h2>
        </div>

        {headerActions ? <div className="flex flex-wrap gap-2">{headerActions}</div> : null}

        {onSearchChange ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={searchValue}
              onChange={event => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-sm"
            />
          </div>
        ) : null}
      </div>

      <Separator className="bg-border-main" />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="rounded-md border border-border-subtle bg-bg-canvas p-3">
                <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-1.5 h-2.5 w-full animate-pulse rounded bg-muted" />
                <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Alert>
            <AlertTitle>{t('workspace.unableToLoadModuleList')}</AlertTitle>
            <AlertDescription>{t('workspace.unableToLoadModuleListDescription')}</AlertDescription>
          </Alert>
        ) : count === 0 ? (
          emptyState
        ) : (
          <div className="space-y-1.5">{children}</div>
        )}
      </div>
    </div>
  );
}

function ResourceListItem({
  href,
  active,
  title,
  description,
  meta,
  actionsMenu,
  leading,
  onOpen,
  indentLevel = 0,
}: {
  href: string;
  active: boolean;
  title: string;
  description: string;
  meta?: React.ReactNode;
  actionsMenu?: React.ReactNode;
  leading?: React.ReactNode;
  onOpen?: () => void;
  indentLevel?: number;
}) {
  return (
    <div
      className={cn(
        'group/resource rounded-md border px-3 py-2 transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border-subtle bg-bg-canvas hover:bg-bg-subtle'
      )}
      style={{ marginLeft: indentLevel > 0 ? `${indentLevel * 12}px` : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          {leading}
          <Link href={href} className="min-w-0 flex-1" onClick={onOpen}>
            <p
              className={cn(
                'truncate text-[13px] font-medium leading-5',
                active ? 'text-primary-foreground' : 'text-text-main'
              )}
            >
              {title}
            </p>
            <p
              className={cn(
                'mt-0.5 line-clamp-1 text-xs leading-4',
                active ? 'text-primary-foreground/72' : 'text-text-muted'
              )}
            >
              {description}
            </p>
            {meta ? (
              <div
                className={cn(
                  'mt-1.5 flex max-w-full flex-nowrap items-center gap-1.5 overflow-hidden text-[11px] leading-4 [&_[data-slot=badge]]:px-1.5 [&_[data-slot=badge]]:py-0 [&_[data-slot=badge]]:text-[11px] [&_[data-slot=badge]]:font-medium [&_[data-slot=badge]]:leading-4 [&_span]:min-w-0 [&_span]:truncate',
                  active ? 'text-primary-foreground/72' : 'text-text-muted'
                )}
              >
                {meta}
              </div>
            ) : null}
          </Link>
        </div>
        {actionsMenu ? <div className="-mr-1 shrink-0">{actionsMenu}</div> : null}
      </div>
    </div>
  );
}

function ResourceContent({
  projectId,
  projectName,
  module,
  actions,
  children,
}: {
  projectId: number | string;
  projectName: string;
  module: ProjectWorkspaceModule;
  currentTitle?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT('project');
  const moduleMeta = getProjectWorkspaceModuleMeta(module);
  const moduleLabel = getProjectModuleCopy(t, moduleMeta.i18nKey, 'label');

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border-subtle bg-bg-canvas px-4 py-2 md:px-6">
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="min-w-0 shrink-0">
              <BreadcrumbLink asChild>
                <Link href="/project">{t('common.projects')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0 shrink">
              <BreadcrumbLink asChild>
                <Link href={buildProjectDetailRoute(projectId)} className="truncate">
                  {projectName}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0 shrink-0">
              <BreadcrumbPage>{moduleLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {actions ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 [&_[data-slot=button]]:h-8 [&_[data-slot=button]]:min-h-8 [&_[data-slot=button]]:px-3 [&_[data-slot=button]]:py-1.5 [&_[data-slot=button]]:text-xs [&_[data-slot=button][data-slot=button]]:gap-1.5 [&_[data-slot=button]>svg]:h-3.5 [&_[data-slot=button]>svg]:w-3.5">
            {actions}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">{children}</div>
    </main>
  );
}

function SidebarEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border-subtle bg-bg-soft p-5 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-bg-canvas text-text-muted">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-text-main">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p>
    </div>
  );
}

function GuideState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card className="border-dashed border-border-subtle">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-medium text-text-main">{title}</p>
          <p className="max-w-2xl text-sm leading-6 text-text-muted">{description}</p>
        </div>
        {actionHref && actionLabel ? (
          <Button asChild variant="outline">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ApiSpecsGuideState({
  onOpenAICreate,
  onOpenManualCreate,
  testCasesHref,
}: {
  onOpenAICreate: () => void;
  onOpenManualCreate: () => void;
  testCasesHref: string;
}) {
  const t = useT('project');

  return (
    <Card className="min-w-0 border-border-subtle">
      <CardContent className="space-y-6 py-8">
        <div className="flex flex-col items-start gap-4 rounded-lg border border-border-subtle bg-bg-surface p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-medium tracking-normal text-text-main">
              {t('apiSpecs.guideTitle')}
            </p>
            <p className="max-w-3xl text-sm leading-6 text-text-muted">
              {t('apiSpecs.guideDescription')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={onOpenAICreate}>
              <Sparkles className="h-4 w-4" />
              {t('apiSpecs.describeWithAi')}
            </Button>
            <Button type="button" variant="outline" onClick={onOpenManualCreate}>
              <Plus className="h-4 w-4" />
              {t('apiSpecs.addSpecManually')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-md border border-border-subtle bg-bg-canvas p-5">
            <p className="text-sm font-medium text-text-main">{t('apiSpecs.captureIntentTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {t('apiSpecs.captureIntentDescription')}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-bg-canvas p-5">
            <p className="text-sm font-medium text-text-main">{t('apiSpecs.reviewDraftTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {t('apiSpecs.reviewDraftDescription')}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-bg-canvas p-5">
            <p className="text-sm font-medium text-text-main">{t('apiSpecs.moveToTestingTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {t('apiSpecs.moveToTestingDescription')}
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link href={testCasesHref}>
                {t('apiSpecs.openTestCases')}
                <FlaskConical className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MissingDetailState({
  moduleLabel,
  clearHref,
}: {
  moduleLabel: string;
  clearHref: string;
}) {
  const t = useT('project');

  return (
    <GuideState
      icon={FileClock}
      title={t('workspace.notFoundTitle', { moduleLabel })}
      description={t('workspace.missingDetailDescription', { moduleLabel })}
      actionHref={clearHref}
      actionLabel={t('common.clearSelection')}
    />
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-canvas p-4">
      <p className="figma-caption text-text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-text-main">{children}</p>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-full border border-border-subtle bg-bg-canvas px-3 py-2 text-sm">
      <span className="text-text-muted">{label}: </span>
      <span className="font-medium text-text-main">{value}</span>
    </div>
  );
}

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <Card className="min-w-0 border-border-subtle">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <pre className="min-w-0 max-h-[420px] overflow-auto rounded-md border border-border-subtle bg-bg-soft p-4 text-xs leading-6 text-text-muted">
          {formatJson(value)}
        </pre>
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-36 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-md bg-muted" />
        <div className="h-80 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-64 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

interface CreateApiSpecDraft {
  method: HttpMethod;
  path: string;
  version: string;
  categoryId: string;
  summary: string;
  description: string;
  tags: string;
  isPublic: boolean;
}

const getCreateApiSpecDraft = (): CreateApiSpecDraft => ({
  method: 'GET',
  path: '',
  version: '1.0.0',
  categoryId: '',
  summary: '',
  description: '',
  tags: '',
  isPublic: false,
});

const normalizeTags = (value: string) =>
  value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

function CreateApiSpecDialog({
  open,
  initialCategoryId = '',
  categories,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initialCategoryId?: string;
  categories: Array<{ value: string; label: string }>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateApiSpecRequest) => Promise<void>;
}) {
  const dialogKey = `create-api-spec-${initialCategoryId || 'none'}-${open ? 'open' : 'closed'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CreateApiSpecDialogBody
        key={dialogKey}
        initialCategoryId={initialCategoryId}
        categories={categories}
        isSubmitting={isSubmitting}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}

function CreateApiSpecDialogBody({
  initialCategoryId = '',
  categories,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  initialCategoryId?: string;
  categories: Array<{ value: string; label: string }>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateApiSpecRequest) => Promise<void>;
}) {
  const t = useT('project');
  const [draft, setDraft] = useState<CreateApiSpecDraft>(() => ({
    ...getCreateApiSpecDraft(),
    categoryId: initialCategoryId,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateDraft = <K extends keyof CreateApiSpecDraft>(
    key: K,
    value: CreateApiSpecDraft[K]
  ) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPath = draft.path.trim();
    const trimmedVersion = draft.version.trim();
    const trimmedSummary = draft.summary.trim();
    const trimmedDescription = draft.description.trim();
    const nextErrors: Record<string, string> = {};

    if (!trimmedPath) {
      nextErrors.path = t('common.fieldRequired', { field: t('common.path') });
    }

    if (!trimmedVersion) {
      nextErrors.version = t('common.fieldRequired', { field: t('common.version') });
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      method: draft.method,
      path: trimmedPath,
      version: trimmedVersion,
      category_id: draft.categoryId.trim() || undefined,
      summary: trimmedSummary || undefined,
      description: trimmedDescription || undefined,
      tags: normalizeTags(draft.tags),
      is_public: draft.isPublic,
      doc_source: 'manual',
    });
  };

  return (
    <DialogContent size="default">
      <DialogHeader>
        <DialogTitle>{t('apiSpecs.createDialogTitle')}</DialogTitle>
        <DialogDescription>{t('apiSpecs.createDialogDescription')}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <form id="create-api-spec-form" className="space-y-5 py-1" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-spec-method">{t('common.method')}</Label>
              <Select
                value={draft.method}
                onValueChange={value => updateDraft('method', value as HttpMethod)}
              >
                <SelectTrigger id="workspace-spec-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEC_METHOD_OPTIONS.map(method => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="workspace-spec-path">{t('common.path')}</Label>
              <Input
                id="workspace-spec-path"
                value={draft.path}
                onChange={event => updateDraft('path', event.target.value)}
                placeholder="/api/v1/orders"
                errorText={errors.path}
                root
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-spec-version">{t('common.version')}</Label>
              <Input
                id="workspace-spec-version"
                value={draft.version}
                onChange={event => updateDraft('version', event.target.value)}
                placeholder="1.0.0"
                errorText={errors.version}
                root
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workspace-spec-category">{t('common.category')}</Label>
              <Select
                value={draft.categoryId || 'none'}
                onValueChange={value => updateDraft('categoryId', value === 'none' ? '' : value)}
              >
                <SelectTrigger id="workspace-spec-category" className="w-full">
                  <SelectValue placeholder={t('apiSpecs.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.notSet')}</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-spec-tags">{t('common.tags')}</Label>
              <Input
                id="workspace-spec-tags"
                value={draft.tags}
                onChange={event => updateDraft('tags', event.target.value)}
                placeholder="auth, user, public"
                root
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-spec-summary">{t('common.summary')}</Label>
            <Input
              id="workspace-spec-summary"
              value={draft.summary}
              onChange={event => updateDraft('summary', event.target.value)}
              placeholder={t('apiSpecs.shortSummaryPlaceholder')}
              root
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-spec-description">{t('common.description')}</Label>
            <Textarea
              id="workspace-spec-description"
              value={draft.description}
              onChange={event => updateDraft('description', event.target.value)}
              placeholder={t('apiSpecs.descriptionPlaceholder')}
              rows={6}
              root
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-canvas px-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="workspace-spec-public">{t('apiSpecs.publicSpec')}</Label>
              <p className="text-xs text-text-muted">{t('apiSpecs.publicSpecDescription')}</p>
            </div>
            <Switch
              id="workspace-spec-public"
              checked={draft.isPublic}
              onCheckedChange={checked => updateDraft('isPublic', checked)}
            />
          </div>
        </form>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form="create-api-spec-form" loading={isSubmitting}>
          {t('apiSpecs.addSpec')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
