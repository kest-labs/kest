'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  Bot,
  Boxes,
  Clock3,
  FileClock,
  FileJson2,
  FlaskConical,
  Globe,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
} from 'lucide-react';
import { StatCard, StatCardSkeleton } from '@/components/features/console/dashboard-stats';
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
import { ApiRequestWorkbench } from '@/components/features/project/api-request-workbench';
import { ApiSpecAICreateDialog } from '@/components/features/project/api-spec-ai-create-dialog';
import {
  buildCategoryOptions,
  findProjectCategory,
  flattenProjectCategories,
} from '@/components/features/project/category-helpers';
import { ProjectFlowManagementPage } from '@/components/features/project/flow-management-page';
import { getProjectModuleCopy } from '@/components/features/project/project-i18n';
import {
  buildProjectWorkspaceRoute,
  getProjectWorkspaceModuleMeta,
  type ProjectWorkspaceModule,
} from '@/components/features/project/project-navigation';
import {
  buildProjectApiSpecsRoute,
  buildProjectCategoriesRoute,
  buildProjectDetailRoute,
  buildProjectEnvironmentsRoute,
  buildProjectHistoriesRoute,
  buildProjectTestCasesRoute,
} from '@/constants/routes';
import {
  useAcceptApiSpecAIDraft,
  useApiSpecFull,
  useApiSpecs,
  useCreateApiSpecAIDraft,
  useCreateApiSpec,
  useProjectApiCategories,
  useRefineApiSpecAIDraft,
} from '@/hooks/use-api-specs';
import { useProjectCategories, useProjectCategory } from '@/hooks/use-categories';
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
import { useProject, useProjectStats } from '@/hooks/use-projects';
import type { ApiSpec, CreateApiSpecRequest, HttpMethod } from '@/types/api-spec';
import type {
  CreateEnvironmentRequest,
  DuplicateEnvironmentRequest,
  ProjectEnvironment,
  UpdateEnvironmentRequest,
} from '@/types/environment';
import type { ProjectHistory } from '@/types/history';
import { PROJECT_MEMBER_WRITE_ROLES, type ProjectMemberRole } from '@/types/member';
import { useT } from '@/i18n/client';
import { cn, formatDate } from '@/utils';

const MAX_MODULE_ITEMS = 500;
const EMPTY_SPECS: ApiSpec[] = [];
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

const getCLIRequestRecord = (history?: ProjectHistory | null) => {
  if (history?.entity_type !== 'cli_request') {
    return null;
  }
  return getHistoryNestedRecord(getHistoryDataRecord(history)?.request);
};

const getCLIRequestResponseRecord = (history?: ProjectHistory | null) => {
  if (history?.entity_type !== 'cli_request') {
    return null;
  }
  return getHistoryNestedRecord(getHistoryDataRecord(history)?.response);
};

const getCLIRunRecord = (history?: ProjectHistory | null) => {
  if (history?.entity_type !== 'cli_run') {
    return null;
  }
  return getHistoryNestedRecord(getHistoryDataRecord(history)?.run);
};

const getCLIRunResults = (history?: ProjectHistory | null) =>
  history?.entity_type === 'cli_run'
    ? getHistoryNestedList(getHistoryDataRecord(history)?.results)
    : [];

const getCLIRunLogRecord = (history?: ProjectHistory | null) =>
  history?.entity_type === 'cli_run'
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
  history.entity_type === 'cli_request'
    ? `${history.action} recorded for CLI request #${history.entity_id}`
    : history.entity_type === 'cli_run'
      ? `${history.action} recorded for CLI run ${getHistoryRunSourceName(history) ?? `#${history.entity_id}`}`
      : `${history.action} recorded for ${history.entity_type} #${history.entity_id}`;

type EnvironmentFormMode = 'create' | 'edit';

interface EnvironmentFormDraft {
  name: string;
  displayName: string;
  baseUrl: string;
  variables: string;
  headers: string;
}

interface DuplicateEnvironmentDraft {
  name: string;
  overrideVars: string;
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

const getEnvironmentFormDraft = (
  environment?: ProjectEnvironment | null
): EnvironmentFormDraft => ({
  name: environment?.name ?? '',
  displayName: environment?.display_name ?? '',
  baseUrl: environment?.base_url ?? '',
  variables:
    environment?.variables === undefined ? '' : JSON.stringify(environment.variables, null, 2),
  headers: environment?.headers === undefined ? '' : JSON.stringify(environment.headers, null, 2),
});

const getDuplicateEnvironmentDraft = (
  environment?: ProjectEnvironment | null
): DuplicateEnvironmentDraft => ({
  name: environment ? `${environment.name}-copy` : '',
  overrideVars: '',
});

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
  const t = useT('project');
  const [draft, setDraft] = useState<EnvironmentFormDraft>(() =>
    getEnvironmentFormDraft(environment)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      variables = parseObjectJsonInput<Record<string, unknown>>(
        draft.variables,
        t('common.variablesJson'),
        {
          invalidJson: t('common.jsonMustBeValidObject', { label: t('common.variablesJson') }),
          invalidObject: t('common.jsonMustBeObject', { label: t('common.variablesJson') }),
        }
      );
    } catch (error) {
      nextErrors.variables =
        error instanceof Error
          ? error.message
          : t('common.parseFailed', { label: t('common.variablesJson') });
    }

    try {
      const parsedHeaders = parseObjectJsonInput<Record<string, unknown>>(
        draft.headers,
        t('common.headersJson'),
        {
          invalidJson: t('common.jsonMustBeValidObject', { label: t('common.headersJson') }),
          invalidObject: t('common.jsonMustBeObject', { label: t('common.headersJson') }),
        }
      );
      headers = parsedHeaders ? toStringRecord(parsedHeaders) : undefined;
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
                <div className="space-y-2">
                  <Label htmlFor="environment-variables">{t('common.variablesJson')}</Label>
                  <Textarea
                    id="environment-variables"
                    value={draft.variables}
                    onChange={event => updateDraft('variables', event.target.value)}
                    rows={14}
                    placeholder='{"API_URL":"https://api.example.com"}'
                    errorText={errors.variables}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment-headers">{t('common.headersJson')}</Label>
                  <Textarea
                    id="environment-headers"
                    value={draft.headers}
                    onChange={event => updateDraft('headers', event.target.value)}
                    rows={14}
                    placeholder='{"Authorization":"Bearer {{token}}"}'
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
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="environment-form"
            loading={isSubmitting}
            disabled={(mode === 'edit' && (isLoadingEnvironment || !environment)) || isSubmitting}
          >
            {mode === 'create' ? t('environments.createButton') : t('environments.saveButton')}
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAICreateOpen, setIsAICreateOpen] = useState(autoOpenAICreate ?? false);
  const deferredSearch = useDeferredValue(searchQuery);

  const specsQuery = useApiSpecs({
    projectId,
    page: 1,
    pageSize: MAX_MODULE_ITEMS,
  });
  const selectedSpecQuery = useApiSpecFull(projectId, selectedItemId ?? undefined);
  const categoriesQuery = useProjectApiCategories(projectId);
  const createSpecMutation = useCreateApiSpec(projectId);
  const createAIDraftMutation = useCreateApiSpecAIDraft(projectId);
  const refineAIDraftMutation = useRefineApiSpecAIDraft(projectId);
  const acceptAIDraftMutation = useAcceptApiSpecAIDraft(projectId);

  const specs = specsQuery.data?.items ?? EMPTY_SPECS;
  const categoryOptions = useMemo(
    () => buildCategoryOptions(categoriesQuery.data?.items),
    [categoriesQuery.data?.items]
  );
  const filteredSpecs = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return specs;
    }

    return specs.filter(spec =>
      [spec.method, spec.path, spec.summary, spec.description, spec.version]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSearch, specs]);

  const selectedSpecFromList = specs.find(spec => spec.id === selectedItemId) ?? null;
  const selectedSpec = selectedSpecQuery.data ?? selectedSpecFromList;
  const docPreview =
    selectedSpec?.doc_markdown_en ||
    selectedSpec?.doc_markdown_zh ||
    selectedSpec?.doc_markdown ||
    null;
  const fullManagerHref = `${buildProjectApiSpecsRoute(projectId)}?mode=manage`;
  const isRefreshing = specsQuery.isFetching || selectedSpecQuery.isFetching;

  const handleRefresh = () => {
    void specsQuery.refetch();

    if (selectedItemId) {
      void selectedSpecQuery.refetch();
    }
  };

  const handleCreateSpec = async (payload: CreateApiSpecRequest) => {
    try {
      const createdSpec = await createSpecMutation.mutateAsync(payload);
      setIsCreateOpen(false);
      setSearchQuery('');
      await specsQuery.refetch();
      router.replace(buildModuleHref(projectId, 'api-specs', createdSpec.id));
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
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

  const moduleActionItems: ActionMenuItem[] = [
    {
      key: 'api-specs-manager',
      label: t('apiSpecs.openFullManager'),
      icon: FileJson2,
      href: fullManagerHref,
    },
    {
      key: 'api-specs-refresh',
      label: isRefreshing ? t('common.refreshing') : t('common.refresh'),
      icon: RefreshCw,
      disabled: isRefreshing,
      onSelect: handleRefresh,
    },
    {
      key: 'api-specs-ai-draft',
      label: t('apiSpecs.aiDraft'),
      icon: Sparkles,
      onSelect: () => setIsAICreateOpen(true),
    },
    {
      key: 'api-specs-create',
      label: t('apiSpecs.addSpec'),
      icon: Plus,
      onSelect: () => setIsCreateOpen(true),
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
            count={filteredSpecs.length}
            loading={specsQuery.isLoading}
            error={specsQuery.error}
            emptyState={
              <SidebarEmptyState
                icon={FileJson2}
                title={t('apiSpecs.emptyTitle')}
                description={t('apiSpecs.emptyDescription')}
              />
            }
          >
            {filteredSpecs.map(spec => (
              <ResourceListItem
                key={spec.id}
                href={buildModuleHref(projectId, 'api-specs', spec.id)}
                active={spec.id === selectedSpec?.id}
                title={`${spec.method} ${spec.path}`}
                description={spec.summary || spec.description || t('common.noSummaryProvided')}
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
                        key: `spec-manager-${spec.id}`,
                        label: t('apiSpecs.openInFullManager'),
                        icon: FileJson2,
                        href: `${fullManagerHref}&item=${spec.id}`,
                      },
                    ]}
                    ariaLabel={t('common.openActions')}
                    stopPropagation
                    triggerClassName="h-7 w-7 rounded-lg opacity-0 transition-opacity group-hover/resource:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100"
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
                <Button type="button" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('apiSpecs.addSpec')}
                </Button>
                <ActionMenu
                  items={moduleActionItems}
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
                onOpenManualCreate={() => setIsCreateOpen(true)}
                managerHref={`${buildProjectApiSpecsRoute(projectId)}?mode=manage`}
                testCasesHref={buildProjectTestCasesRoute(projectId)}
              />
            ) : (
              <div className="space-y-6">
                <Card className="border-border/60">
                  <CardHeader>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-primary/20 bg-primary/10 text-primary"
                          >
                            {selectedSpec.method}
                          </Badge>
                          <Badge variant="outline">{selectedSpec.version}</Badge>
                          {selectedSpec.is_public ? (
                            <Badge>{t('common.public')}</Badge>
                          ) : (
                            <Badge variant="secondary">{t('common.private')}</Badge>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-2xl tracking-tight">
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
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <Card className="min-w-0 border-border/60">
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

                  <Card className="min-w-0 border-border/60">
                    <CardHeader>
                      <CardTitle>{t('apiSpecs.documentationSnapshot')}</CardTitle>
                      <CardDescription>
                        {t('apiSpecs.documentationSnapshotDescription')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0">
                      {docPreview ? (
                        <pre className="min-w-0 max-h-[420px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
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
        categories={categoryOptions}
        isSubmitting={createSpecMutation.isPending}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateSpec}
      />
      <ApiSpecAICreateDialog
        open={isAICreateOpen}
        onOpenChange={handleAICreateOpenChange}
        projectId={projectId}
        categories={categoryOptions}
        isSubmittingDraft={createAIDraftMutation.isPending}
        isSubmittingRefine={refineAIDraftMutation.isPending}
        isSubmittingAccept={acceptAIDraftMutation.isPending}
        onCreateDraft={payload => createAIDraftMutation.mutateAsync(payload)}
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
    </>
  );
}

function CollectionsWorkspaceSection({ projectId }: { projectId: number | string }) {
  return <ApiRequestWorkbench projectId={projectId} />;
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
    selectedItemId && selectedItemId === suppressedSelectedEnvironmentId ? null : selectedItemId;

  const projectStatsQuery = useProjectStats(projectId);
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
    environments.find(environment => environment.id === effectiveSelectedItemId) ?? null;
  const selectedEnvironment = selectedEnvironmentQuery.data ?? selectedEnvironmentFromList;
  const currentRole = memberRoleQuery.data?.role;
  const canWrite = currentRole ? WRITE_ROLES.includes(currentRole) : false;
  const totalEnvironments =
    environmentsQuery.data?.total ??
    projectStatsQuery.data?.environment_count ??
    environments.length;
  const withBaseUrlCount = environments.filter(environment =>
    Boolean(environment.base_url?.trim())
  ).length;
  const withVariablesCount = environments.filter(
    environment => Object.keys(environment.variables || {}).length > 0
  ).length;
  const withHeadersCount = environments.filter(
    environment => Object.keys(environment.headers || {}).length > 0
  ).length;
  const listPreview =
    normalizedSearch.length > 0 ? filteredEnvironments.slice(0, 5) : environments.slice(0, 5);
  const environmentsPath = `/projects/${projectId}/environments`;
  const activeEnvironmentPath = selectedEnvironment
    ? `/projects/${projectId}/environments/${selectedEnvironment.id}`
    : `/projects/${projectId}/environments/:eid`;

  const openCreateDialog = () => {
    setFormMode('create');
    setEditingEnvironmentId(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (environmentId: number | string) => {
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
    const isDeletingSelectedEnvironment = selectedItemId === deletedId;

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
    const tasks: Array<Promise<unknown>> = [
      projectStatsQuery.refetch(),
      memberRoleQuery.refetch(),
      environmentsQuery.refetch(),
    ];

    if (effectiveSelectedItemId) {
      tasks.push(selectedEnvironmentQuery.refetch());
    }

    await Promise.all(tasks);
  };

  const isRefreshing =
    projectStatsQuery.isFetching ||
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
                      },
                      {
                        key: `environment-edit-${environment.id}`,
                        label: t('common.edit'),
                        icon: Pencil,
                        disabled: !canWrite,
                        onSelect: () => openEditDialog(environment.id),
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
                    triggerClassName="h-7 w-7 rounded-lg opacity-0 transition-opacity group-hover/resource:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100"
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
                    onClick={() => openEditDialog(selectedEnvironment.id)}
                    disabled={!canWrite}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                ) : null}
                <Button type="button" onClick={openCreateDialog} disabled={!canWrite}>
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

              {environmentsQuery.isLoading || projectStatsQuery.isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title={t('environments.totalEnvironments')}
                    value={totalEnvironments}
                    description={t('environments.totalEnvironmentsDescription')}
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
                      normalizedSearch
                        ? t('environments.searchFilteredBy', { query: normalizedSearch })
                        : t('environments.withHeadersDescription')
                    }
                    icon={Tags}
                  />
                </div>
              )}

              {effectiveSelectedItemId && selectedEnvironmentQuery.isLoading ? (
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
                  <Card className="border-dashed border-border/70">
                    <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                        <Globe className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-text-main">
                          {t('environments.noEnvironmentsYet')}
                        </p>
                        <p className="max-w-2xl text-sm leading-6 text-text-muted">
                          {t('environments.noEnvironmentsYetDescription')}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        <Button type="button" onClick={openCreateDialog} disabled={!canWrite}>
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
                    <Card className="border-border/60">
                      <CardHeader>
                        <CardTitle>{t('environments.overview')}</CardTitle>
                        <CardDescription>{t('environments.overviewDescription')}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-3">
                        <Button type="button" onClick={openCreateDialog} disabled={!canWrite}>
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
                      <Card className="border-border/60">
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
                                className="block rounded-2xl border border-border/60 bg-background/70 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
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

                      <Card className="border-border/60">
                        <CardHeader>
                          <CardTitle>{t('environments.apiSurface')}</CardTitle>
                          <CardDescription>
                            {t('environments.apiSurfaceDescription')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
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
                  <Card className="border-border/60">
                    <CardHeader>
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="border-primary/20 bg-primary/10 text-primary"
                            >
                              {t('modules.environments.label')}
                            </Badge>
                            <Badge variant="outline">{selectedEnvironment.name}</Badge>
                          </div>
                          <div>
                            <CardTitle className="text-2xl tracking-tight">
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
                    <Card className="border-border/60">
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

      <EnvironmentFormDialog
        key={`${formMode}-${editingEnvironmentQuery.data?.id ?? 'new'}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        environment={formMode === 'edit' ? (editingEnvironmentQuery.data ?? null) : null}
        isLoadingEnvironment={formMode === 'edit' && editingEnvironmentQuery.isLoading}
        isSubmitting={createEnvironmentMutation.isPending || updateEnvironmentMutation.isPending}
        onOpenChange={open => {
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
              <Card className="border-border/60">
                <CardHeader>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-primary/20 bg-primary/10 text-primary"
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
                        <CardTitle className="text-2xl tracking-tight">
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
                <Card className="border-border/60">
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

                <Card className="border-border/60">
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
                          className="rounded-2xl border border-border/60 bg-background/70 p-4"
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
                  {history.entity_type === 'cli_request' &&
                  getHistoryRequestStatus(history) !== null ? (
                    <Badge variant="secondary">{getHistoryRequestStatus(history)}</Badge>
                  ) : null}
                  {history.entity_type === 'cli_run' && getHistoryRunStatus(history) ? (
                    <Badge variant="secondary">{getHistoryRunStatus(history)}</Badge>
                  ) : null}
                  {history.entity_type !== 'cli_request' &&
                  history.entity_type !== 'cli_run' &&
                  getHistoryRunStatus(history) ? (
                    <Badge variant="secondary">{getHistoryRunStatus(history)}</Badge>
                  ) : null}
                  {history.entity_type === 'cli_request' && getHistoryRequestDuration(history) ? (
                    <span>{getHistoryRequestDuration(history)}</span>
                  ) : null}
                  {history.entity_type === 'cli_run' && getHistoryRunStepCount(history) !== null ? (
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
              <Card className="border-border/60">
                <CardHeader>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-primary/20 bg-primary/10 text-primary"
                        >
                          {selectedHistory.entity_type}
                        </Badge>
                        <Badge variant="outline">{selectedHistory.action}</Badge>
                        {selectedHistory.entity_type === 'cli_request' &&
                        getHistoryRequestStatus(selectedHistory) !== null ? (
                          <Badge variant="secondary">
                            {getHistoryRequestStatus(selectedHistory)}
                          </Badge>
                        ) : null}
                        {selectedHistory.entity_type !== 'cli_request' &&
                        getHistoryRunStatus(selectedHistory) ? (
                          <Badge variant="secondary">{getHistoryRunStatus(selectedHistory)}</Badge>
                        ) : null}
                        <Badge variant="secondary">
                          {t('history.recordNumber', { id: selectedHistory.id })}
                        </Badge>
                      </div>
                      <div>
                        <CardTitle className="text-2xl tracking-tight">
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
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle>{t('history.metadata')}</CardTitle>
                    <CardDescription>{t('history.metadataDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <DetailField label={t('history.recordId')}>{selectedHistory.id}</DetailField>
                    <DetailField label={t('common.projectId')}>
                      {selectedHistory.project_id}
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

                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle>{t('history.recordedNote')}</CardTitle>
                    <CardDescription>{t('history.recordedNoteDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm leading-6 text-text-muted">
                      {selectedHistory.message || t('history.noMessageRecorded')}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedCLIRequest && selectedCLIRequestResponse ? (
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="border-border/60">
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
                      <pre className="max-h-[280px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
                        {formatJson(selectedCLIRequest.headers)}
                      </pre>
                      <pre className="max-h-[280px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
                        {typeof selectedCLIRequest.body === 'string'
                          ? selectedCLIRequest.body
                          : formatJson(selectedCLIRequest.body)}
                      </pre>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
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
                      <pre className="max-h-[280px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
                        {formatJson(selectedCLIRequestResponse.headers)}
                      </pre>
                      <pre className="max-h-[280px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
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
                    <Card className="border-border/60">
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

                    <Card className="border-border/60">
                      <CardHeader>
                        <CardTitle>{t('history.logExcerpt')}</CardTitle>
                        <CardDescription>{t('history.logExcerptDescription')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="max-h-[340px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
                          {getHistoryString(selectedCLIRunLog?.excerpt) ||
                            t('history.noLogExcerpt')}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle>{t('history.stepResults')}</CardTitle>
                      <CardDescription>{t('history.stepResultsDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedCLIRunResults.length === 0 ? (
                        <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-text-muted">
                          {t('history.noStepResults')}
                        </div>
                      ) : (
                        selectedCLIRunResults.map((result, index) => (
                          <div
                            key={`${selectedHistory.id}-${index}`}
                            className="rounded-2xl border border-border/60 bg-background/70 p-4"
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden xl:flex-row">
      <aside className="w-full shrink-0 border-b border-border/60 bg-background/70 xl:w-[336px] xl:border-b-0 xl:border-r">
        {sidebar}
      </aside>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{content}</div>
    </div>
  );
}

function ResourceSidebar({
  module,
  title,
  description,
  count,
  loading,
  error,
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
  const moduleMeta = getProjectWorkspaceModuleMeta(module);
  const moduleShortLabel = getProjectModuleCopy(t, moduleMeta.i18nKey, 'shortLabel');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-border/60 bg-bg-surface/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                {moduleShortLabel}
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
            </div>
            <Badge variant="outline">{count}</Badge>
          </div>
          {headerActions ? <div className="mt-4 flex flex-wrap gap-2">{headerActions}</div> : null}
        </div>

        {onSearchChange ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={searchValue}
              onChange={event => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
                <div className="mt-3 h-3 w-20 animate-pulse rounded bg-muted" />
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
          <div className="space-y-2">{children}</div>
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
  indentLevel = 0,
}: {
  href: string;
  active: boolean;
  title: string;
  description: string;
  meta?: React.ReactNode;
  actionsMenu?: React.ReactNode;
  indentLevel?: number;
}) {
  return (
    <div
      className={cn(
        'group/resource rounded-2xl border px-4 py-3 transition-colors',
        active
          ? 'border-primary/30 bg-primary/10 shadow-sm'
          : 'border-transparent bg-background/70 hover:border-border/60 hover:bg-background'
      )}
      style={{ marginLeft: indentLevel > 0 ? `${indentLevel * 12}px` : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <Link href={href} className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-main">{title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">{description}</p>
          {meta ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">{meta}</div>
          ) : null}
        </Link>
        {actionsMenu ? <div className="shrink-0">{actionsMenu}</div> : null}
      </div>
    </div>
  );
}

function ResourceContent({
  projectId,
  projectName,
  module,
  currentTitle,
  description,
  actions,
  children,
}: {
  projectId: number | string;
  projectName: string;
  module: ProjectWorkspaceModule;
  currentTitle: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT('project');
  const moduleMeta = getProjectWorkspaceModuleMeta(module);
  const moduleLabel = getProjectModuleCopy(t, moduleMeta.i18nKey, 'label');

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="space-y-4 border-b border-border/60 bg-bg-surface/70 px-4 py-4 md:px-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/project">{t('common.projects')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={buildProjectDetailRoute(projectId)}>{projectName}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{moduleLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
              {moduleLabel}
            </Badge>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{currentTitle}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-text-muted">{description}</p>
            </div>
          </div>

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
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
    <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-text-muted">
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
    <Card className="border-dashed border-border/70">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-text-main">{title}</p>
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
  managerHref,
  testCasesHref,
}: {
  onOpenAICreate: () => void;
  onOpenManualCreate: () => void;
  managerHref: string;
  testCasesHref: string;
}) {
  const t = useT('project');

  return (
    <Card className="min-w-0 border-border/60">
      <CardContent className="space-y-6 py-8">
        <div className="flex flex-col items-start gap-4 rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight text-text-main">
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
            <Button asChild variant="ghost">
              <Link href={managerHref}>{t('common.fullManager')}</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
            <p className="text-sm font-semibold text-text-main">
              {t('apiSpecs.captureIntentTitle')}
            </p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {t('apiSpecs.captureIntentDescription')}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
            <p className="text-sm font-semibold text-text-main">{t('apiSpecs.reviewDraftTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {t('apiSpecs.reviewDraftDescription')}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
            <p className="text-sm font-semibold text-text-main">
              {t('apiSpecs.moveToTestingTitle')}
            </p>
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
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-text-main">{children}</p>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm">
      <span className="text-text-muted">{label}: </span>
      <span className="font-medium text-text-main">{value}</span>
    </div>
  );
}

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <Card className="min-w-0 border-border/60">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <pre className="min-w-0 max-h-[420px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
          {formatJson(value)}
        </pre>
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-36 animate-pulse rounded-3xl bg-muted" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-3xl bg-muted" />
        <div className="h-80 animate-pulse rounded-3xl bg-muted" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
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
  categories,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  categories: Array<{ value: string; label: string }>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateApiSpecRequest) => Promise<void>;
}) {
  const dialogKey = `create-api-spec-${open ? 'open' : 'closed'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CreateApiSpecDialogBody
        key={dialogKey}
        categories={categories}
        isSubmitting={isSubmitting}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}

function CreateApiSpecDialogBody({
  categories,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  categories: Array<{ value: string; label: string }>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateApiSpecRequest) => Promise<void>;
}) {
  const t = useT('project');
  const [draft, setDraft] = useState<CreateApiSpecDraft>(() => getCreateApiSpecDraft());
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

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
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
