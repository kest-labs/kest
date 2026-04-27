'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Boxes,
  Copy,
  FileJson2,
  FlaskConical,
  Globe,
  Pencil,
  Play,
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
import { Switch } from '@/components/ui/switch';
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
  buildProjectEnvironmentsRoute,
} from '@/constants/routes';
import { useApiSpecExamples, useApiSpecs } from '@/hooks/use-api-specs';
import { useEnvironments } from '@/hooks/use-environments';
import { useProjectMemberRole } from '@/hooks/use-members';
import { useProject } from '@/hooks/use-projects';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import {
  useCreateTestCase,
  useCreateTestCaseFromSpec,
  useDeleteTestCase,
  useDuplicateTestCase,
  useRunTestCase,
  useTestCase,
  useTestCaseRun,
  useTestCaseRuns,
  useTestCases,
  useUpdateTestCase,
} from '@/hooks/use-test-cases';
import type { ApiSpec } from '@/types/api-spec';
import type { ProjectEnvironment } from '@/types/environment';
import {
  PROJECT_MEMBER_WRITE_ROLES,
  type ProjectMemberRole,
} from '@/types/member';
import type {
  CreateTestCaseFromSpecRequest,
  CreateTestCaseRequest,
  DuplicateTestCaseRequest,
  ExtractVariable,
  ProjectTestCase,
  RunTestCaseRequest,
  RunTestCaseResponse,
  TestCaseAssertion,
  TestCaseRun,
  UpdateTestCaseRequest,
} from '@/types/test-case';
import { cn, formatDate } from '@/utils';

const PAGE_SIZE = 10;
const RUN_PAGE_SIZE = 8;
const EMPTY_TEST_CASES: ProjectTestCase[] = [];
const EMPTY_RUNS: TestCaseRun[] = [];
const EMPTY_SPECS: ApiSpec[] = [];
const EMPTY_ENVIRONMENTS: ProjectEnvironment[] = [];
const WRITE_ROLES = PROJECT_MEMBER_WRITE_ROLES;

type ProjectT = ScopedTranslations<'project'>;
type TestCaseFormMode = 'create' | 'edit';
type DetailTab = 'overview' | 'request' | 'runs';
type HistoryFilterStatus = 'all' | 'pass' | 'fail' | 'error';

interface TestCaseFormDraft {
  apiSpecId: string;
  name: string;
  description: string;
  env: string;
  headers: string;
  queryParams: string;
  pathParams: string;
  requestBody: string;
  preScript: string;
  postScript: string;
  assertions: string;
  extractVars: string;
}

interface DuplicateDraft {
  name: string;
}

interface FromSpecDraft {
  apiSpecId: string;
  name: string;
  env: string;
  useExample: boolean;
  exampleId: string;
}

interface RunDraft {
  envId: string;
  globalVars: string;
  variableKeys: string;
}

const getRoleLabel = (t: ProjectT, role?: ProjectMemberRole) => {
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

const formatJson = (value: unknown) => {
  if (value === undefined || value === null) {
    return '';
  }

  return JSON.stringify(value, null, 2);
};

const parseJsonInput = <T,>(
  t: ProjectT,
  value: string,
  label: string,
  expectation: 'object' | 'array' | 'any' = 'any'
) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedValue);
  } catch {
    throw new Error(t('common.jsonMustBeValid', { label }));
  }

  if (expectation === 'array' && !Array.isArray(parsed)) {
    throw new Error(t('common.jsonMustBeArray', { label }));
  }

  if (
    expectation === 'object' &&
    (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null)
  ) {
    throw new Error(t('common.jsonMustBeObject', { label }));
  }

  return parsed as T;
};

const parseStringRecordInput = (t: ProjectT, value: string, label: string) => {
  const parsed = parseJsonInput<Record<string, unknown>>(t, value, label, 'object');

  if (!parsed) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, entryValue]) => [key, String(entryValue)])
  ) as Record<string, string>;
};

const normalizeRunStatus = (status?: string) => {
  if (status === 'passed') {
    return 'pass';
  }

  if (status === 'failed') {
    return 'fail';
  }

  return status;
};

const getRunStatusLabel = (t: ProjectT, status?: string) => {
  switch (normalizeRunStatus(status)) {
    case 'pass':
      return t('testCasesPage.statusPassed');
    case 'fail':
      return t('testCasesPage.statusFailed');
    case 'error':
      return t('testCasesPage.statusError');
    case 'running':
      return t('testCasesPage.statusRunning');
    default:
      return status || t('common.unknown');
  }
};

const getRunStatusBadgeClassName = (status?: string) => {
  switch (normalizeRunStatus(status)) {
    case 'pass':
      return 'border-emerald-200 bg-emerald-500/10 text-emerald-700';
    case 'fail':
      return 'border-rose-200 bg-rose-500/10 text-rose-700';
    case 'error':
      return 'border-amber-200 bg-amber-500/10 text-amber-700';
    case 'running':
      return 'border-sky-200 bg-sky-500/10 text-sky-700';
    default:
      return 'border-slate-200 bg-slate-500/10 text-slate-700';
  }
};

const getMethodBadgeClassName = (method?: string) => {
  switch (method) {
    case 'GET':
      return 'border-emerald-200 bg-emerald-500/10 text-emerald-700';
    case 'POST':
      return 'border-sky-200 bg-sky-500/10 text-sky-700';
    case 'PUT':
      return 'border-amber-200 bg-amber-500/10 text-amber-700';
    case 'PATCH':
      return 'border-violet-200 bg-violet-500/10 text-violet-700';
    case 'DELETE':
      return 'border-rose-200 bg-rose-500/10 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-500/10 text-slate-700';
  }
};

const getTestCaseFormDraft = (testCase?: ProjectTestCase | null): TestCaseFormDraft => ({
  apiSpecId: testCase?.api_spec_id ? String(testCase.api_spec_id) : '',
  name: testCase?.name ?? '',
  description: testCase?.description ?? '',
  env: testCase?.env ?? '',
  headers: formatJson(testCase?.headers),
  queryParams: formatJson(testCase?.query_params),
  pathParams: formatJson(testCase?.path_params),
  requestBody: formatJson(testCase?.request_body),
  preScript: testCase?.pre_script ?? '',
  postScript: testCase?.post_script ?? '',
  assertions: formatJson(testCase?.assertions),
  extractVars: formatJson(testCase?.extract_vars),
});

const getDuplicateDraft = (
  t: ProjectT,
  testCase?: ProjectTestCase | null
): DuplicateDraft => ({
  name: testCase
    ? t('testCasesPage.duplicateName', { name: testCase.name })
    : '',
});

const getDefaultFromSpecName = (t: ProjectT, apiSpec?: ApiSpec | null) =>
  apiSpec
    ? t('testCasesPage.defaultName', {
        method: apiSpec.method,
        path: apiSpec.path,
      }).trim()
    : '';

const getFromSpecDraft = (apiSpec: ApiSpec | null | undefined, t: ProjectT): FromSpecDraft => ({
  apiSpecId: apiSpec?.id ? String(apiSpec.id) : '',
  name: getDefaultFromSpecName(t, apiSpec),
  env: '',
  useExample: false,
  exampleId: 'auto',
});

const getRunDraft = (): RunDraft => ({
  envId: 'none',
  globalVars: '',
  variableKeys: '',
});

function RoleBadge({ role }: { role?: ProjectMemberRole }) {
  const t = useT('project');

  return (
    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
      {t('roles.badge', { role: getRoleLabel(t, role) })}
    </Badge>
  );
}

function MethodBadge({ method }: { method?: string }) {
  const t = useT('project');

  return (
    <Badge variant="outline" className={cn('font-mono', getMethodBadgeClassName(method))}>
      {method || t('testCasesPage.notApplicable')}
    </Badge>
  );
}

function RunStatusBadge({ status }: { status?: string }) {
  const t = useT('project');

  return (
    <Badge variant="outline" className={cn(getRunStatusBadgeClassName(status))}>
      {getRunStatusLabel(t, status)}
    </Badge>
  );
}

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

function SummaryField({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  const t = useT('project');
  const hasValue =
    value !== undefined &&
    value !== null &&
    !(typeof value === 'string' && value.trim().length === 0);

  return (
    <div className="space-y-1 rounded-xl border border-border/60 bg-muted/15 p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">
        {hasValue ? value : t('common.notSet')}
      </div>
    </div>
  );
}

function TestCaseFormDialog({
  open,
  mode,
  testCase,
  apiSpecs,
  isLoadingTestCase,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: TestCaseFormMode;
  testCase?: ProjectTestCase | null;
  apiSpecs: ApiSpec[];
  isLoadingTestCase: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTestCaseRequest | UpdateTestCaseRequest) => Promise<void>;
}) {
  const t = useT('project');
  const rawT = useTranslations('project');
  const [draft, setDraft] = useState<TestCaseFormDraft>(() => getTestCaseFormDraft(testCase));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateDraft = <K extends keyof TestCaseFormDraft>(
    key: K,
    value: TestCaseFormDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const trimmedName = draft.name.trim();
    const trimmedEnv = draft.env.trim();
    let headers: Record<string, string> | undefined;
    let queryParams: Record<string, string> | undefined;
    let pathParams: Record<string, string> | undefined;
    let requestBody: unknown;
    let assertions: TestCaseAssertion[] | undefined;
    let extractVars: ExtractVariable[] | undefined;

    if (mode === 'create' && !draft.apiSpecId) {
      nextErrors.apiSpecId = t('common.fieldRequired', {
        field: t('testCasesPage.apiSpecLabel'),
      });
    }

    if (!trimmedName) {
      nextErrors.name = t('common.fieldRequired', { field: t('common.name') });
    }

    try {
      headers = parseStringRecordInput(t, draft.headers, t('testCasesPage.headersJsonLabel'));
    } catch (error) {
      nextErrors.headers = error instanceof Error
        ? error.message
        : t('common.parseFailed', { label: t('testCasesPage.headersJsonLabel') });
    }

    try {
      queryParams = parseStringRecordInput(t, draft.queryParams, t('testCasesPage.queryParamsJsonLabel'));
    } catch (error) {
      nextErrors.queryParams = error instanceof Error
        ? error.message
        : t('common.parseFailed', { label: t('testCasesPage.queryParamsJsonLabel') });
    }

    try {
      pathParams = parseStringRecordInput(t, draft.pathParams, t('testCasesPage.pathParamsJsonLabel'));
    } catch (error) {
      nextErrors.pathParams = error instanceof Error
        ? error.message
        : t('common.parseFailed', { label: t('testCasesPage.pathParamsJsonLabel') });
    }

    try {
      requestBody = parseJsonInput(t, draft.requestBody, t('testCasesPage.requestBodyJsonLabel'));
    } catch (error) {
      nextErrors.requestBody = error instanceof Error
        ? error.message
        : t('common.parseFailed', { label: t('testCasesPage.requestBodyJsonLabel') });
    }

    try {
      assertions = parseJsonInput<TestCaseAssertion[]>(
        t,
        draft.assertions,
        t('testCasesPage.assertionsJsonLabel'),
        'array'
      );
    } catch (error) {
      nextErrors.assertions = error instanceof Error
        ? error.message
        : t('common.parseFailed', { label: t('testCasesPage.assertionsJsonLabel') });
    }

    try {
      extractVars = parseJsonInput<ExtractVariable[]>(
        t,
        draft.extractVars,
        t('testCasesPage.extractVarsJsonLabel'),
        'array'
      );
    } catch (error) {
      nextErrors.extractVars = error instanceof Error
        ? error.message
        : t('common.parseFailed', { label: t('testCasesPage.extractVarsJsonLabel') });
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (mode === 'create') {
      await onSubmit({
        api_spec_id: Number(draft.apiSpecId),
        name: trimmedName,
        description: draft.description.trim() || undefined,
        env: trimmedEnv || undefined,
        headers,
        query_params: queryParams,
        path_params: pathParams,
        request_body: requestBody,
        pre_script: draft.preScript.trim() || undefined,
        post_script: draft.postScript.trim() || undefined,
        assertions,
        extract_vars: extractVars,
      });

      return;
    }

    await onSubmit({
      name: trimmedName,
      description: draft.description.trim() || undefined,
      env: trimmedEnv || undefined,
      headers,
      query_params: queryParams,
      path_params: pathParams,
      request_body: requestBody,
      pre_script: draft.preScript.trim() || undefined,
      post_script: draft.postScript.trim() || undefined,
      assertions,
      extract_vars: extractVars,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('testCasesPage.createDialogTitle')
              : t('testCasesPage.editDialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? t('testCasesPage.createDialogDescription')
              : t('testCasesPage.editDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {mode === 'edit' && isLoadingTestCase ? (
            <div className="space-y-3 py-2">
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-32 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : mode === 'edit' && !testCase ? (
            <Alert className="mt-2">
              <AlertTitle>{t('testCasesPage.formLoadFailedTitle')}</AlertTitle>
              <AlertDescription>
                {t('testCasesPage.formLoadFailedDescription')}
              </AlertDescription>
            </Alert>
          ) : (
            <form id="test-case-form" onSubmit={handleSubmit} className="space-y-5 py-1">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-api-spec">{t('testCasesPage.apiSpecLabel')}</Label>
                  <Select
                    value={draft.apiSpecId || 'none'}
                    disabled={mode === 'edit'}
                    onValueChange={(value) => updateDraft('apiSpecId', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger id="test-case-api-spec" className="w-full">
                      <SelectValue placeholder={t('testCasesPage.selectApiSpec')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('testCasesPage.selectApiSpec')}</SelectItem>
                      {apiSpecs.map((spec) => (
                        <SelectItem key={spec.id} value={String(spec.id)}>
                          {spec.method} {spec.path}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.apiSpecId ? (
                    <p className="text-xs font-medium text-destructive">{errors.apiSpecId}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-env">{t('common.environment')}</Label>
                  <Input
                    id="test-case-env"
                    value={draft.env}
                    onChange={(event) => updateDraft('env', event.target.value)}
                    placeholder={t('testCasesPage.environmentPlaceholder')}
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-name">{t('common.name')}</Label>
                  <Input
                    id="test-case-name"
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                    placeholder={t('testCasesPage.namePlaceholder')}
                    errorText={errors.name}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-description">{t('common.description')}</Label>
                  <Input
                    id="test-case-description"
                    value={draft.description}
                    onChange={(event) => updateDraft('description', event.target.value)}
                    placeholder={t('testCasesPage.descriptionPlaceholder')}
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-headers">{t('testCasesPage.headersJsonLabel')}</Label>
                  <Textarea
                    id="test-case-headers"
                    value={draft.headers}
                    onChange={(event) => updateDraft('headers', event.target.value)}
                    placeholder={rawT.raw('testCasesPage.headersJsonPlaceholder')}
                    className="min-h-28 font-mono text-xs"
                    errorText={errors.headers}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-query-params">{t('testCasesPage.queryParamsJsonLabel')}</Label>
                  <Textarea
                    id="test-case-query-params"
                    value={draft.queryParams}
                    onChange={(event) => updateDraft('queryParams', event.target.value)}
                    placeholder={rawT.raw('testCasesPage.queryParamsJsonPlaceholder')}
                    className="min-h-28 font-mono text-xs"
                    errorText={errors.queryParams}
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-path-params">{t('testCasesPage.pathParamsJsonLabel')}</Label>
                  <Textarea
                    id="test-case-path-params"
                    value={draft.pathParams}
                    onChange={(event) => updateDraft('pathParams', event.target.value)}
                    placeholder={rawT.raw('testCasesPage.pathParamsJsonPlaceholder')}
                    className="min-h-28 font-mono text-xs"
                    errorText={errors.pathParams}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-request-body">{t('testCasesPage.requestBodyJsonLabel')}</Label>
                  <Textarea
                    id="test-case-request-body"
                    value={draft.requestBody}
                    onChange={(event) => updateDraft('requestBody', event.target.value)}
                    placeholder={rawT.raw('testCasesPage.requestBodyJsonPlaceholder')}
                    className="min-h-28 font-mono text-xs"
                    errorText={errors.requestBody}
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-pre-script">{t('testCasesPage.preScript')}</Label>
                  <Textarea
                    id="test-case-pre-script"
                    value={draft.preScript}
                    onChange={(event) => updateDraft('preScript', event.target.value)}
                    placeholder={t('testCasesPage.preScriptPlaceholder')}
                    className="min-h-28 font-mono text-xs"
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-post-script">{t('testCasesPage.postScript')}</Label>
                  <Textarea
                    id="test-case-post-script"
                    value={draft.postScript}
                    onChange={(event) => updateDraft('postScript', event.target.value)}
                    placeholder={t('testCasesPage.postScriptPlaceholder')}
                    className="min-h-28 font-mono text-xs"
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-assertions">{t('testCasesPage.assertionsJsonLabel')}</Label>
                  <Textarea
                    id="test-case-assertions"
                    value={draft.assertions}
                    onChange={(event) => updateDraft('assertions', event.target.value)}
                    placeholder={rawT.raw('testCasesPage.assertionsJsonPlaceholder')}
                    className="min-h-32 font-mono text-xs"
                    errorText={errors.assertions}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-extract-vars">{t('testCasesPage.extractVarsJsonLabel')}</Label>
                  <Textarea
                    id="test-case-extract-vars"
                    value={draft.extractVars}
                    onChange={(event) => updateDraft('extractVars', event.target.value)}
                    placeholder={rawT.raw('testCasesPage.extractVarsJsonPlaceholder')}
                    className="min-h-32 font-mono text-xs"
                    errorText={errors.extractVars}
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
            form="test-case-form"
            loading={isSubmitting}
            disabled={mode === 'edit' && isLoadingTestCase}
          >
            {mode === 'create' ? t('testCasesPage.create') : t('common.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateTestCaseDialog({
  open,
  testCase,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  testCase?: ProjectTestCase | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: DuplicateTestCaseRequest) => Promise<void>;
}) {
  const t = useT('project');
  const [draft, setDraft] = useState<DuplicateDraft>(() => getDuplicateDraft(t, testCase));
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = draft.name.trim();

    if (!trimmedName) {
      setError(t('common.fieldRequired', { field: t('testCasesPage.duplicateNameLabel') }));
      return;
    }

    await onSubmit({ name: trimmedName });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{t('testCasesPage.duplicateDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('testCasesPage.duplicateDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="duplicate-test-case-form" onSubmit={handleSubmit} className="space-y-4 py-1">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              {t('testCasesPage.duplicateSourceLabel')}
              {' '}
              <span className="font-medium text-foreground">
                {testCase?.name || t('testCasesPage.unknownTestCase')}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duplicate-test-case-name">{t('testCasesPage.duplicateNameLabel')}</Label>
              <Input
                id="duplicate-test-case-name"
                value={draft.name}
                onChange={(event) => setDraft({ name: event.target.value })}
                placeholder={t('testCasesPage.duplicateNamePlaceholder')}
                errorText={error}
                root
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="duplicate-test-case-form" loading={isSubmitting}>
            {t('common.duplicate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateFromSpecDialog({
  open,
  projectId,
  apiSpecs,
  initialSpecId,
  flowSource,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  projectId: number | string;
  apiSpecs: ApiSpec[];
  initialSpecId?: string | number | null;
  flowSource?: 'ai' | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTestCaseFromSpecRequest) => Promise<void>;
}) {
  const t = useT('project');
  const initialSpec = useMemo(
    () => apiSpecs.find((spec) => spec.id === initialSpecId) ?? null,
    [apiSpecs, initialSpecId]
  );
  const [draft, setDraft] = useState<FromSpecDraft>(() =>
    getFromSpecDraft(initialSpec ?? undefined, t)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedSpecId = draft.apiSpecId ? Number(draft.apiSpecId) : undefined;
  const specExamplesQuery = useApiSpecExamples(
    projectId,
    draft.useExample ? selectedSpecId : undefined
  );
  const specExamples = specExamplesQuery.data?.items ?? [];

  const selectedSpec = useMemo(
    () => apiSpecs.find((spec) => spec.id === selectedSpecId),
    [apiSpecs, selectedSpecId]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const trimmedName = draft.name.trim();
    const trimmedEnv = draft.env.trim();

    if (!draft.apiSpecId) {
      nextErrors.apiSpecId = t('common.fieldRequired', {
        field: t('testCasesPage.apiSpecLabel'),
      });
    }

    if (!trimmedName) {
      nextErrors.name = t('common.fieldRequired', { field: t('common.name') });
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      api_spec_id: Number(draft.apiSpecId),
      name: trimmedName,
      env: trimmedEnv || undefined,
      use_example: draft.useExample,
      example_id:
        draft.useExample && draft.exampleId !== 'auto' ? Number(draft.exampleId) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('testCasesPage.fromSpecDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('testCasesPage.fromSpecDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="from-spec-test-case-form" onSubmit={handleSubmit} className="space-y-5 py-1">
            {flowSource === 'ai' && initialSpec ? (
              <Alert>
                <AlertTitle>{t('testCasesPage.continueFromAiTitle')}</AlertTitle>
                <AlertDescription>
                  {t('testCasesPage.continueFromAiDescription', {
                    spec: `${initialSpec.method} ${initialSpec.path}`,
                  })}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="from-spec-api-spec">{t('testCasesPage.apiSpecLabel')}</Label>
              <Select
                value={draft.apiSpecId || 'none'}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    apiSpecId: value === 'none' ? '' : value,
                    exampleId: 'auto',
                    name:
                      value !== 'none' && !current.name.trim()
                        ? getDefaultFromSpecName(
                            t,
                            apiSpecs.find((spec) => spec.id === Number(value)) ?? null
                          )
                        : current.name,
                  }))
                }
              >
                <SelectTrigger id="from-spec-api-spec" className="w-full">
                  <SelectValue placeholder={t('testCasesPage.selectApiSpec')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('testCasesPage.selectApiSpec')}</SelectItem>
                  {apiSpecs.map((spec) => (
                    <SelectItem key={spec.id} value={String(spec.id)}>
                      {spec.method} {spec.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.apiSpecId ? (
                <p className="text-xs font-medium text-destructive">{errors.apiSpecId}</p>
              ) : null}
            </div>

            {selectedSpec ? (
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm">
                <div className="font-medium text-foreground">{selectedSpec.method} {selectedSpec.path}</div>
                <div className="mt-1 text-muted-foreground">
                  {selectedSpec.summary || selectedSpec.description || t('common.noSummaryProvided')}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from-spec-name">{t('testCasesPage.testCaseNameLabel')}</Label>
                <Input
                  id="from-spec-name"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder={t('testCasesPage.fromSpecNamePlaceholder')}
                  errorText={errors.name}
                  root
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="from-spec-env">{t('common.environment')}</Label>
                <Input
                  id="from-spec-env"
                  value={draft.env}
                  onChange={(event) => setDraft((current) => ({ ...current, env: event.target.value }))}
                  placeholder={t('testCasesPage.environmentPlaceholder')}
                  root
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="from-spec-use-example" className="text-sm font-medium">
                    {t('testCasesPage.useApiExample')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('testCasesPage.useApiExampleDescription')}
                  </p>
                </div>
                <Switch
                  id="from-spec-use-example"
                  checked={draft.useExample}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      useExample: checked,
                      exampleId: 'auto',
                    }))
                  }
                />
              </div>

              {draft.useExample ? (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="from-spec-example">{t('common.examples')}</Label>
                  <Select
                    value={draft.exampleId}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, exampleId: value }))
                    }
                  >
                    <SelectTrigger id="from-spec-example" className="w-full">
                      <SelectValue placeholder={t('testCasesPage.useFirstExample')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t('testCasesPage.useFirstExample')}</SelectItem>
                      {specExamples.map((example) => (
                        <SelectItem key={example.id} value={String(example.id)}>
                          {t('testCasesPage.exampleOption', {
                            name: example.name,
                            status: example.response_status,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {specExamplesQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">{t('testCasesPage.loadingExamples')}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="from-spec-test-case-form" loading={isSubmitting}>
            {t('testCasesPage.generateFromSpec')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunTestCaseDialog({
  open,
  testCase,
  environments,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  testCase?: ProjectTestCase | null;
  environments: ProjectEnvironment[];
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: RunTestCaseRequest) => Promise<void>;
}) {
  const t = useT('project');
  const rawT = useTranslations('project');
  const [draft, setDraft] = useState<RunDraft>(() => getRunDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    let globalVars: Record<string, unknown> | undefined;
    let variableKeys: Record<string, string> | undefined;

    try {
      globalVars = parseJsonInput<Record<string, unknown>>(
        t,
        draft.globalVars,
        t('testCasesPage.globalVarsJsonLabel'),
        'object'
      );
    } catch (error) {
      nextErrors.globalVars = error instanceof Error
        ? error.message
        : t('common.parseFailed', { label: t('testCasesPage.globalVarsJsonLabel') });
    }

    try {
      variableKeys = parseStringRecordInput(
        t,
        draft.variableKeys,
        t('testCasesPage.variableKeysJsonLabel')
      );
    } catch (error) {
      nextErrors.variableKeys = error instanceof Error
        ? error.message
        : t('common.parseFailed', { label: t('testCasesPage.variableKeysJsonLabel') });
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      env_id: draft.envId !== 'none' ? Number(draft.envId) : undefined,
      global_vars: globalVars,
      variable_keys: variableKeys,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('testCasesPage.runDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('testCasesPage.runDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="run-test-case-form" onSubmit={handleSubmit} className="space-y-5 py-1">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
              <div className="font-medium text-foreground">
                {testCase?.name || t('testCasesPage.unknownTestCase')}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                <MethodBadge method={testCase?.method} />
                <span className="font-mono">
                  {testCase?.path || t('testCasesPage.pathUnavailable')}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="run-test-case-env">{t('testCasesPage.overrideEnvironment')}</Label>
              <Select
                value={draft.envId}
                onValueChange={(value) => setDraft((current) => ({ ...current, envId: value }))}
              >
                <SelectTrigger id="run-test-case-env" className="w-full">
                  <SelectValue placeholder={t('testCasesPage.useTestCaseEnv')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('testCasesPage.useTestCaseEnv')}</SelectItem>
                  {environments.map((environment) => (
                    <SelectItem key={environment.id} value={String(environment.id)}>
                      {environment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="run-test-case-global-vars">{t('testCasesPage.globalVarsJsonLabel')}</Label>
                <Textarea
                  id="run-test-case-global-vars"
                  value={draft.globalVars}
                  onChange={(event) => setDraft((current) => ({ ...current, globalVars: event.target.value }))}
                  placeholder={rawT.raw('testCasesPage.globalVarsJsonPlaceholder')}
                  className="min-h-32 font-mono text-xs"
                  errorText={errors.globalVars}
                  root
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="run-test-case-variable-keys">{t('testCasesPage.variableKeysJsonLabel')}</Label>
                <Textarea
                  id="run-test-case-variable-keys"
                  value={draft.variableKeys}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, variableKeys: event.target.value }))
                  }
                  placeholder={rawT.raw('testCasesPage.variableKeysJsonPlaceholder')}
                  className="min-h-32 font-mono text-xs"
                  errorText={errors.variableKeys}
                  root
                />
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="run-test-case-form" loading={isSubmitting}>
            {t('testCasesPage.run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTestCaseDialog({
  open,
  testCase,
  isDeleting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  testCase?: ProjectTestCase | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT('project');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{t('testCasesPage.deleteDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('testCasesPage.deleteDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="text-sm text-muted-foreground">
              {t('testCasesPage.deleteTargetDescription', {
                name: testCase?.name || t('testCasesPage.deleteFallbackTarget'),
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MethodBadge method={testCase?.method} />
              <Badge variant="outline" className="font-mono">
                {testCase?.path || t('testCasesPage.pathUnavailable')}
              </Badge>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="destructive" loading={isDeleting} onClick={() => void onConfirm()}>
            {t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunDetailDialog({
  open,
  projectId,
  testCaseId,
  runId,
  onOpenChange,
}: {
  open: boolean;
  projectId: number | string;
  testCaseId?: number | null;
  runId?: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT('project');
  const runQuery = useTestCaseRun(
    projectId,
    testCaseId ?? undefined,
    open ? runId ?? undefined : undefined
  );
  const run = runQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t('testCasesPage.runDetailDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('testCasesPage.runDetailDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {runQuery.isLoading ? (
            <div className="space-y-3 py-2">
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-24 animate-pulse rounded-xl bg-muted" />
              <div className="h-48 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : runQuery.isError || !run ? (
            <Alert>
              <AlertTitle>{t('testCasesPage.runDetailLoadFailedTitle')}</AlertTitle>
              <AlertDescription>
                {t('testCasesPage.runDetailLoadFailedDescription')}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-5 py-1">
              <div className="grid gap-3 md:grid-cols-4">
                <SummaryField label={t('common.status')} value={getRunStatusLabel(t, run.status)} />
                <SummaryField
                  label={t('common.duration')}
                  value={t('testCasesPage.durationMs', { value: run.duration_ms })}
                />
                <SummaryField label={t('common.created')} value={formatDate(run.created_at)} />
                <SummaryField label={t('testCasesPage.runIdLabel')} value={run.id} />
              </div>

              {run.message ? (
                <Alert>
                  <AlertTitle>{t('testCasesPage.runMessageTitle')}</AlertTitle>
                  <AlertDescription>{run.message}</AlertDescription>
                </Alert>
              ) : null}

              <Tabs defaultValue="request" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="request">{t('common.request')}</TabsTrigger>
                  <TabsTrigger value="response">{t('common.response')}</TabsTrigger>
                  <TabsTrigger value="assertions">{t('testCasesPage.assertionsTab')}</TabsTrigger>
                  <TabsTrigger value="variables">{t('common.variables')}</TabsTrigger>
                </TabsList>

                <TabsContent value="request" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <SummaryField label={t('common.method')} value={run.request?.method || t('testCasesPage.notApplicable')} />
                    <SummaryField label={t('common.url')} value={run.request?.url || t('testCasesPage.notApplicable')} />
                    <SummaryField label={t('common.headers')} value={Object.keys(run.request?.headers || {}).length} />
                  </div>
                  <JsonPreview
                    title={t('testCasesPage.requestHeadersTitle')}
                    value={run.request?.headers}
                    emptyLabel={t('testCasesPage.requestHeadersEmpty')}
                  />
                  <JsonPreview
                    title={t('testCasesPage.requestBodyTitle')}
                    value={run.request?.body}
                    emptyLabel={t('testCasesPage.requestBodyResultEmpty')}
                  />
                </TabsContent>

                <TabsContent value="response" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <SummaryField label={t('common.httpStatus')} value={run.response?.status || t('testCasesPage.notApplicable')} />
                    <SummaryField
                      label={t('common.headers')}
                      value={Object.keys(run.response?.headers || {}).length}
                    />
                  </div>
                  <JsonPreview
                    title={t('testCasesPage.responseHeadersTitle')}
                    value={run.response?.headers}
                    emptyLabel={t('testCasesPage.responseHeadersEmpty')}
                  />
                  <JsonPreview
                    title={t('testCasesPage.responseBodyTitle')}
                    value={run.response?.body}
                    emptyLabel={t('testCasesPage.responseBodyEmpty')}
                  />
                </TabsContent>

                <TabsContent value="assertions" className="space-y-3">
                  {!run.assertions || run.assertions.length === 0 ? (
                    <Alert>
                      <AlertTitle>{t('testCasesPage.noAssertionsRecordedTitle')}</AlertTitle>
                      <AlertDescription>
                        {t('testCasesPage.noAssertionsRecordedDescription')}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    run.assertions.map((assertion, index) => (
                      <div
                        key={`${assertion.type}-${index}`}
                        className="rounded-xl border border-border/60 bg-muted/15 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <RunStatusBadge status={assertion.passed ? 'pass' : 'fail'} />
                          <Badge variant="outline">{assertion.type}</Badge>
                          {assertion.operator ? <Badge variant="outline">{assertion.operator}</Badge> : null}
                          {assertion.path ? <Badge variant="outline" className="font-mono">{assertion.path}</Badge> : null}
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <JsonPreview
                            title={t('testCasesPage.expectedTitle')}
                            value={assertion.expect}
                            emptyLabel={t('testCasesPage.expectedEmpty')}
                          />
                          <JsonPreview
                            title={t('testCasesPage.actualTitle')}
                            value={assertion.actual}
                            emptyLabel={t('testCasesPage.actualEmpty')}
                          />
                        </div>
                        {assertion.message ? (
                          <p className="mt-3 text-sm text-muted-foreground">{assertion.message}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="variables">
                  <JsonPreview
                    title={t('testCasesPage.extractedVariablesTitle')}
                    value={run.variables}
                    emptyLabel={t('testCasesPage.noVariablesExtracted')}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TestCaseManagementPage({
  projectId,
  autoOpenFromSpecSpecId = null,
  flowSource = null,
}: {
  projectId: number | string;
  autoOpenFromSpecSpecId?: string | number | null;
  flowSource?: 'ai' | null;
}) {
  const t = useT('project');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [apiSpecFilter, setApiSpecFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState('all');
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [historyStatus, setHistoryStatus] = useState<HistoryFilterStatus>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [formMode, setFormMode] = useState<TestCaseFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formTargetId, setFormTargetId] = useState<number | null>(null);
  const [isFromSpecOpen, setIsFromSpecOpen] = useState(Boolean(autoOpenFromSpecSpecId));
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectTestCase | null>(null);
  const [runTarget, setRunTarget] = useState<ProjectTestCase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectTestCase | null>(null);
  const [runDetailId, setRunDetailId] = useState<number | null>(null);
  const [latestRunResult, setLatestRunResult] = useState<RunTestCaseResponse | null>(null);

  const deferredKeyword = useDeferredValue(keyword.trim());

  const projectQuery = useProject(projectId);
  const apiSpecsQuery = useApiSpecs({
    projectId,
    page: 1,
    pageSize: 100,
  });
  const environmentsQuery = useEnvironments(projectId);
  const memberRoleQuery = useProjectMemberRole(projectId);

  const testCasesQuery = useTestCases({
    projectId,
    page,
    pageSize: PAGE_SIZE,
    apiSpecId: apiSpecFilter !== 'all' ? Number(apiSpecFilter) : undefined,
    env: envFilter !== 'all' ? envFilter : undefined,
    keyword: deferredKeyword || undefined,
  });

  const testCases = testCasesQuery.data?.items ?? EMPTY_TEST_CASES;
  const apiSpecs = apiSpecsQuery.data?.items ?? EMPTY_SPECS;
  const environments = environmentsQuery.data?.items ?? EMPTY_ENVIRONMENTS;
  const projectRole = memberRoleQuery.data?.role;
  const canWrite = projectRole ? WRITE_ROLES.includes(projectRole) : false;
  const canCreate = canWrite && apiSpecs.length > 0;
  const resolvedSelectedTestCaseId =
    selectedTestCaseId !== null && testCases.some((testCase) => testCase.id === selectedTestCaseId)
      ? selectedTestCaseId
      : testCases[0]?.id ?? null;
  const isImplicitSelection = resolvedSelectedTestCaseId !== selectedTestCaseId;
  const effectiveDetailTab: DetailTab = isImplicitSelection ? 'overview' : detailTab;
  const effectiveHistoryStatus: HistoryFilterStatus = isImplicitSelection ? 'all' : historyStatus;
  const effectiveHistoryPage = isImplicitSelection ? 1 : historyPage;
  const effectiveRunDetailId = isImplicitSelection ? null : runDetailId;
  const effectiveLatestRunResult =
    latestRunResult?.test_case_id === resolvedSelectedTestCaseId ? latestRunResult : null;

  const activeTestCaseQuery = useTestCase(projectId, resolvedSelectedTestCaseId ?? undefined);
  const formTargetQuery = useTestCase(projectId, formTargetId ?? undefined);
  const runHistoryQuery = useTestCaseRuns(
    resolvedSelectedTestCaseId
      ? {
          projectId,
          testCaseId: resolvedSelectedTestCaseId,
          page: effectiveHistoryPage,
          pageSize: RUN_PAGE_SIZE,
          status: effectiveHistoryStatus !== 'all' ? effectiveHistoryStatus : undefined,
        }
      : undefined
  );

  const createTestCaseMutation = useCreateTestCase(projectId);
  const updateTestCaseMutation = useUpdateTestCase(projectId);
  const deleteTestCaseMutation = useDeleteTestCase(projectId);
  const duplicateTestCaseMutation = useDuplicateTestCase(projectId);
  const fromSpecMutation = useCreateTestCaseFromSpec(projectId);
  const runTestCaseMutation = useRunTestCase(projectId);

  const runHistory = runHistoryQuery.data?.items ?? EMPTY_RUNS;
  const activeTestCase =
    activeTestCaseQuery.data ??
    testCases.find((testCase) => testCase.id === resolvedSelectedTestCaseId) ??
    null;
  const formTarget = formTargetQuery.data ?? null;

  const apiSpecsById = useMemo(
    () =>
      new Map(apiSpecs.map((apiSpec) => [apiSpec.id, apiSpec])),
    [apiSpecs]
  );

  const environmentOptions = useMemo(() => {
    const values = new Set<string>();

    environments.forEach((environment) => {
      values.add(environment.name);
    });

    testCases.forEach((testCase) => {
      if (testCase.env) {
        values.add(testCase.env);
      }
    });

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [environments, testCases]);

  const totalTestCases = testCasesQuery.data?.meta.total ?? 0;
  const totalPages = testCasesQuery.data?.meta.total_pages ?? 1;
  const linkedApiSpecsCount = new Set(testCases.map((testCase) => testCase.api_spec_id)).size;
  const environmentsInPage = new Set(testCases.map((testCase) => testCase.env).filter(Boolean)).size;
  const currentPageAssertionCount = testCases.reduce(
    (total, testCase) => total + (testCase.assertions?.length ?? 0),
    0
  );

  const activeSpec = activeTestCase ? apiSpecsById.get(activeTestCase.api_spec_id) : undefined;
  const latestHistoryRun = runHistory[0] ?? null;
  const autoOpenSpec = autoOpenFromSpecSpecId ? apiSpecsById.get(autoOpenFromSpecSpecId) : undefined;

  const clearGenerationIntent = () => {
    if (!searchParams?.size) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('fromSpec');
    nextParams.delete('source');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  const selectTestCase = (testCaseId: number) => {
    setSelectedTestCaseId(testCaseId);
    setDetailTab('overview');
    setHistoryStatus('all');
    setHistoryPage(1);
    setRunDetailId(null);
    setLatestRunResult(null);
  };

  const openCreateDialog = () => {
    setFormMode('create');
    setFormTargetId(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (testCase: ProjectTestCase) => {
    setFormMode('edit');
    setFormTargetId(testCase.id);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (
    payload: CreateTestCaseRequest | UpdateTestCaseRequest
  ) => {
    try {
      if (formMode === 'create') {
        const created = await createTestCaseMutation.mutateAsync(payload as CreateTestCaseRequest);
        selectTestCase(created.id);
        setPage(1);
      } else if (formTargetId) {
        const updated = await updateTestCaseMutation.mutateAsync({
          testCaseId: formTargetId,
          data: payload as UpdateTestCaseRequest,
        });
        selectTestCase(updated.id);
      }

      setIsFormOpen(false);
      setFormTargetId(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleFromSpecSubmit = async (payload: CreateTestCaseFromSpecRequest) => {
    try {
      const created = await fromSpecMutation.mutateAsync(payload);
      selectTestCase(created.id);
      setPage(1);
      setIsFromSpecOpen(false);
      clearGenerationIntent();
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDuplicateSubmit = async (payload: DuplicateTestCaseRequest) => {
    if (!duplicateTarget) {
      return;
    }

    try {
      const duplicated = await duplicateTestCaseMutation.mutateAsync({
        testCaseId: duplicateTarget.id,
        data: payload,
      });
      selectTestCase(duplicated.id);
      setPage(1);
      setDuplicateTarget(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleRunSubmit = async (payload: RunTestCaseRequest) => {
    if (!runTarget) {
      return;
    }

    try {
      const result = await runTestCaseMutation.mutateAsync({
        testCaseId: runTarget.id,
        data: payload,
      });
      setSelectedTestCaseId(runTarget.id);
      setHistoryStatus('all');
      setHistoryPage(1);
      setRunDetailId(null);
      setLatestRunResult(result);
      setRunTarget(null);
      setDetailTab('runs');
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    const shouldStepBackPage = testCases.length === 1 && page > 1;

    try {
      await deleteTestCaseMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);

      if (resolvedSelectedTestCaseId === deleteTarget.id) {
        setSelectedTestCaseId(null);
      }

      if (shouldStepBackPage) {
        setPage((currentPage) => currentPage - 1);
      }
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const isHeaderRefreshing = testCasesQuery.isFetching && !testCasesQuery.isLoading;
  const headerActionItems: ActionMenuItem[] = [
    {
      key: 'test-cases-refresh',
      label: isHeaderRefreshing ? t('common.refreshing') : t('common.refresh'),
      icon: RefreshCw,
      disabled: isHeaderRefreshing,
      onSelect: () => {
        void testCasesQuery.refetch();
      },
    },
    {
      key: 'test-cases-generate-from-spec',
      label: t('testCasesPage.generateFromSpec'),
      icon: FileJson2,
      disabled: !canCreate,
      onSelect: () => setIsFromSpecOpen(true),
    },
    {
      key: 'test-cases-api-specs',
      label: t('apiSpecs.title'),
      icon: FileJson2,
      href: buildProjectApiSpecsRoute(projectId),
      separatorBefore: true,
    },
    {
      key: 'test-cases-environments',
      label: t('environments.title'),
      icon: Globe,
      href: buildProjectEnvironmentsRoute(projectId),
    },
    {
      key: 'test-cases-categories',
      label: t('categoriesPage.title'),
      icon: Tags,
      href: buildProjectCategoriesRoute(projectId),
    },
  ];
  const detailActionItems: ActionMenuItem[] = activeTestCase
    ? [
        {
          key: 'test-case-refresh',
          label:
            activeTestCaseQuery.isFetching && !activeTestCaseQuery.isLoading
              ? t('common.refreshing')
              : t('common.refresh'),
          icon: RefreshCw,
          disabled: activeTestCaseQuery.isFetching && !activeTestCaseQuery.isLoading,
          onSelect: () => {
            void activeTestCaseQuery.refetch();
          },
        },
        {
          key: 'test-case-edit',
          label: t('common.edit'),
          icon: Pencil,
          disabled: !canWrite,
          onSelect: () => openEditDialog(activeTestCase),
        },
        {
          key: 'test-case-duplicate',
          label: t('common.duplicate'),
          icon: Copy,
          disabled: !canWrite,
          onSelect: () => setDuplicateTarget(activeTestCase),
        },
        {
          key: 'test-case-delete',
          label: t('common.delete'),
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          disabled: !canWrite,
          onSelect: () => setDeleteTarget(activeTestCase),
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
                  {t('testCasesPage.backToProjectOverview')}
                </Link>
              </Button>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight">{t('testCasesPage.title')}</h1>
                  <FlaskConical className="h-6 w-6 text-primary" />
                </div>
                <p className="max-w-3xl text-sm text-text-muted">
                  {t('testCasesPage.description', {
                    listPath: buildApiPath('/projects/:id/test-cases'),
                    runPath: buildApiPath('/projects/:id/test-cases/:tcid/run'),
                    historyPath: buildApiPath('/projects/:id/test-cases/:tcid/runs'),
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {t('testCasesPage.projectBadge', {
                    name: projectQuery.data?.name || `#${projectId}`,
                  })}
                </Badge>
                <Badge variant="outline">{t('testCasesPage.totalCount', { count: totalTestCases })}</Badge>
                <RoleBadge role={projectRole} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={openCreateDialog} disabled={!canCreate}>
                <Plus className="h-4 w-4" />
                {t('testCasesPage.create')}
              </Button>
              <ActionMenu
                items={headerActionItems}
                ariaLabel={t('testCasesPage.openManagementActions')}
                triggerVariant="outline"
              />
            </div>
          </div>
        </div>

        {projectRole === 'read' ? (
          <Alert>
            <AlertTitle>{t('testCasesPage.readOnlyTitle')}</AlertTitle>
            <AlertDescription>
              {t('testCasesPage.readOnlyDescription')}
            </AlertDescription>
          </Alert>
        ) : null}

        {apiSpecs.length === 0 ? (
          <Alert>
            <AlertTitle>{t('testCasesPage.noApiSpecsTitle')}</AlertTitle>
            <AlertDescription>
              {t('testCasesPage.noApiSpecsDescription')}
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href={`${buildProjectApiSpecsRoute(projectId)}?ai=create`}>
                    <FileJson2 className="h-4 w-4" />
                    {t('testCasesPage.aiDraftSpecButton')}
                  </Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {flowSource === 'ai' && autoOpenSpec ? (
          <Alert>
            <AlertTitle>{t('testCasesPage.aiSpecReadyTitle')}</AlertTitle>
            <AlertDescription>
              {t('testCasesPage.aiSpecReadyDescription', {
                spec: `${autoOpenSpec.method} ${autoOpenSpec.path}`,
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {testCasesQuery.isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                title={t('testCasesPage.totalTitle')}
                value={totalTestCases}
                description={t('testCasesPage.totalDescription', { pages: totalPages })}
                icon={FlaskConical}
                variant="primary"
              />
              <StatCard
                title={t('testCasesPage.currentPageTitle')}
                value={testCases.length}
                description={t('testCasesPage.currentPageDescription', {
                  page: testCasesQuery.data?.meta.page || page,
                })}
                icon={Boxes}
                variant="success"
              />
              <StatCard
                title={t('testCasesPage.linkedSpecsTitle')}
                value={linkedApiSpecsCount}
                description={t('testCasesPage.linkedSpecsDescription')}
                icon={FileJson2}
                variant="warning"
              />
              <StatCard
                title={t('testCasesPage.assertionsTitle')}
                value={currentPageAssertionCount}
                description={t('testCasesPage.assertionsDescription', {
                  count: environmentsInPage,
                })}
                icon={ShieldCheck}
              />
            </>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-border/50 shadow-premium">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle>{t('testCasesPage.listTitle')}</CardTitle>
              <CardDescription>
                {t('testCasesPage.listDescription', {
                  path: buildApiPath('/projects/:id/test-cases'),
                })}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-3 xl:grid-cols-[1.25fr_0.85fr_0.85fr]">
                <Input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder={t('testCasesPage.searchPlaceholder')}
                  leftIcon={<Search className="h-4 w-4" />}
                  root
                />

                <Select
                  value={apiSpecFilter}
                  onValueChange={(value) => {
                    setApiSpecFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('testCasesPage.filterByApiSpec')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('testCasesPage.allApiSpecs')}</SelectItem>
                    {apiSpecs.map((spec) => (
                      <SelectItem key={spec.id} value={String(spec.id)}>
                        {spec.method} {spec.path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={envFilter}
                  onValueChange={(value) => {
                    setEnvFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('testCasesPage.filterByEnv')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('testCasesPage.allEnvironments')}</SelectItem>
                    {environmentOptions.map((environmentName) => (
                      <SelectItem key={environmentName} value={environmentName}>
                        {environmentName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {testCasesQuery.isError ? (
                <Alert>
                  <AlertTitle>{t('testCasesPage.loadFailedTitle')}</AlertTitle>
                  <AlertDescription>
                    {t('testCasesPage.loadFailedDescription')}
                  </AlertDescription>
                </Alert>
              ) : testCases.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FlaskConical className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{t('testCasesPage.emptyTitle')}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {deferredKeyword || apiSpecFilter !== 'all' || envFilter !== 'all'
                      ? t('testCasesPage.emptyFilteredDescription')
                      : t('testCasesPage.emptyDefaultDescription')}
                  </p>
                  {canCreate ? (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                      <Button type="button" onClick={openCreateDialog}>
                        <Plus className="h-4 w-4" />
                        {t('testCasesPage.create')}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsFromSpecOpen(true)}>
                        <FileJson2 className="h-4 w-4" />
                        {t('testCasesPage.generateFromSpec')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-xl border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('common.name')}</TableHead>
                          <TableHead>{t('testCasesPage.tableApiSpec')}</TableHead>
                          <TableHead>{t('testCasesPage.tableEnv')}</TableHead>
                          <TableHead>{t('testCasesPage.tableAssertions')}</TableHead>
                          <TableHead>{t('common.updated')}</TableHead>
                          <TableHead className="text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {testCases.map((testCase) => {
                          const linkedSpec = apiSpecsById.get(testCase.api_spec_id);
                          const isActive = testCase.id === activeTestCase?.id;

                          return (
                            <TableRow
                              key={testCase.id}
                              className={cn(
                                'cursor-pointer transition-colors hover:bg-muted/40',
                                isActive && 'bg-primary/5'
                              )}
                              onClick={() => selectTestCase(testCase.id)}
                            >
                              <TableCell>
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{testCase.name}</span>
                                    <MethodBadge method={testCase.method} />
                                  </div>
                                  <div className="font-mono text-xs text-muted-foreground">
                                    {testCase.path || linkedSpec?.path || t('testCasesPage.pathUnavailable')}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {linkedSpec
                                    ? `${linkedSpec.method} ${linkedSpec.path}`
                                    : t('testCasesPage.specFallback', { id: testCase.api_spec_id })}
                                </div>
                              </TableCell>
                              <TableCell>{testCase.env || t('common.notSet')}</TableCell>
                              <TableCell>{testCase.assertions?.length ?? 0}</TableCell>
                              <TableCell>{formatDate(testCase.updated_at)}</TableCell>
                              <TableCell className="text-right">
                                <ActionMenu
                                  items={[
                                    {
                                      key: `test-case-view-${testCase.id}`,
                                      label: t('common.view'),
                                      onSelect: () => selectTestCase(testCase.id),
                                    },
                                    {
                                      key: `test-case-edit-${testCase.id}`,
                                      label: t('common.edit'),
                                      icon: Pencil,
                                      disabled: !canWrite,
                                      onSelect: () => {
                                        selectTestCase(testCase.id);
                                        openEditDialog(testCase);
                                      },
                                    },
                                    {
                                      key: `test-case-run-${testCase.id}`,
                                      label: t('testCasesPage.run'),
                                      icon: Play,
                                      disabled: !canWrite,
                                      onSelect: () => {
                                        selectTestCase(testCase.id);
                                        setRunTarget(testCase);
                                      },
                                    },
                                    {
                                      key: `test-case-duplicate-${testCase.id}`,
                                      label: t('common.duplicate'),
                                      icon: Copy,
                                      disabled: !canWrite,
                                      onSelect: () => {
                                        selectTestCase(testCase.id);
                                        setDuplicateTarget(testCase);
                                      },
                                    },
                                    {
                                      key: `test-case-delete-${testCase.id}`,
                                      label: t('common.delete'),
                                      icon: Trash2,
                                      destructive: true,
                                      disabled: !canWrite,
                                      onSelect: () => {
                                        selectTestCase(testCase.id);
                                        setDeleteTarget(testCase);
                                      },
                                    },
                                  ]}
                                  ariaLabel={t('testCasesPage.openActionsFor', { name: testCase.name })}
                                  stopPropagation
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      {t('testCasesPage.pageSummary', {
                        page: testCasesQuery.data?.meta.page || page,
                        pages: totalPages,
                        total: totalTestCases,
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                        disabled={page <= 1}
                      >
                        {t('common.previous')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setPage((currentPage) => Math.min(totalPages, currentPage + 1))
                        }
                        disabled={page >= totalPages}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-premium">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle>{t('testCasesPage.detailTitle')}</CardTitle>
              <CardDescription>
                {t('testCasesPage.detailDescription', {
                  path: buildApiPath('/projects/:id/test-cases/:tcid'),
                })}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              {activeTestCaseQuery.isLoading && !activeTestCase ? (
                <div className="space-y-3">
                  <div className="h-10 animate-pulse rounded-xl bg-muted" />
                  <div className="h-28 animate-pulse rounded-xl bg-muted" />
                  <div className="h-56 animate-pulse rounded-xl bg-muted" />
                </div>
              ) : !activeTestCase ? (
                <Alert>
                  <AlertTitle>{t('testCasesPage.noSelectionTitle')}</AlertTitle>
                  <AlertDescription>
                    {t('testCasesPage.noSelectionDescription')}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="rounded-2xl border border-primary/10 bg-linear-to-br from-primary/10 via-transparent to-white p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">{activeTestCase.name}</h2>
                          <MethodBadge method={activeTestCase.method} />
                          {effectiveLatestRunResult ? <RunStatusBadge status={effectiveLatestRunResult.status} /> : null}
                        </div>

                        <div className="font-mono text-sm text-muted-foreground">
                          {activeTestCase.path || activeSpec?.path || t('testCasesPage.pathUnavailable')}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {t('testCasesPage.apiSpecBadge', {
                              spec: activeSpec
                                ? `${activeSpec.method} ${activeSpec.path}`
                                : `#${activeTestCase.api_spec_id}`,
                            })}
                          </Badge>
                          <Badge variant="outline">
                            {t('testCasesPage.envBadge', {
                              env: activeTestCase.env || t('common.notSet'),
                            })}
                          </Badge>
                          <Badge variant="outline">
                            {t('testCasesPage.assertionsBadge', {
                              count: activeTestCase.assertions?.length ?? 0,
                            })}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => setRunTarget(activeTestCase)}
                          disabled={!canWrite}
                        >
                          <Play className="h-4 w-4" />
                          {t('testCasesPage.run')}
                        </Button>
                        <ActionMenu
                          items={detailActionItems}
                          ariaLabel={t('testCasesPage.openSelectedActions')}
                          triggerVariant="outline"
                        />
                      </div>
                    </div>
                  </div>

                  {activeTestCase.description ? (
                    <Alert>
                      <AlertTitle>{t('common.description')}</AlertTitle>
                      <AlertDescription>{activeTestCase.description}</AlertDescription>
                    </Alert>
                  ) : null}

                    <Tabs
                    value={effectiveDetailTab}
                    onValueChange={(value) => setDetailTab(value as DetailTab)}
                    className="space-y-4"
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="overview">{t('common.overview')}</TabsTrigger>
                      <TabsTrigger value="request">{t('testCasesPage.tabsRequest')}</TabsTrigger>
                      <TabsTrigger value="runs">{t('testCasesPage.tabsRuns')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <SummaryField label={t('common.created')} value={formatDate(activeTestCase.created_at)} />
                        <SummaryField label={t('common.updated')} value={formatDate(activeTestCase.updated_at)} />
                        <SummaryField label={t('testCasesPage.createdBy')} value={activeTestCase.created_by} />
                        <SummaryField label={t('testCasesPage.apiSpecIdLabel')} value={activeTestCase.api_spec_id} />
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <JsonPreview
                          title={t('testCasesPage.tableAssertions')}
                          value={activeTestCase.assertions}
                          emptyLabel={t('testCasesPage.assertionsEmpty')}
                        />
                        <JsonPreview
                          title={t('testCasesPage.extractVariables')}
                          value={activeTestCase.extract_vars}
                          emptyLabel={t('testCasesPage.extractVariablesEmpty')}
                        />
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">{t('testCasesPage.preScript')}</div>
                          <CodeBlock
                            value={activeTestCase.pre_script}
                            emptyLabel={t('testCasesPage.preScriptEmpty')}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-medium">{t('testCasesPage.postScript')}</div>
                          <CodeBlock
                            value={activeTestCase.post_script}
                            emptyLabel={t('testCasesPage.postScriptEmpty')}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="request" className="space-y-4">
                      <div className="grid gap-4 xl:grid-cols-2">
                        <JsonPreview
                          title={t('common.headers')}
                          value={activeTestCase.headers}
                          emptyLabel={t('testCasesPage.headersEmpty')}
                        />
                        <JsonPreview
                          title={t('testCasesPage.queryParamsTitle')}
                          value={activeTestCase.query_params}
                          emptyLabel={t('testCasesPage.queryParamsEmpty')}
                        />
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <JsonPreview
                          title={t('testCasesPage.pathParamsTitle')}
                          value={activeTestCase.path_params}
                          emptyLabel={t('testCasesPage.pathParamsEmpty')}
                        />
                        <JsonPreview
                          title={t('common.requestBody')}
                          value={activeTestCase.request_body}
                          emptyLabel={t('testCasesPage.requestBodyEmpty')}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="runs" className="space-y-4">
                      {effectiveLatestRunResult ? (
                        <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <div className="text-sm font-semibold">{t('testCasesPage.latestAdHocRun')}</div>
                              <div className="text-sm text-muted-foreground">
                                {t('testCasesPage.latestAdHocRunDescription')}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <RunStatusBadge status={effectiveLatestRunResult.status} />
                              <Badge variant="outline">
                                {t('testCasesPage.durationMs', {
                                  value: effectiveLatestRunResult.duration_ms,
                                })}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            <JsonPreview
                              title={t('common.request')}
                              value={effectiveLatestRunResult.request}
                              emptyLabel={t('testCasesPage.noRequestPayloadReturned')}
                            />
                            <JsonPreview
                              title={t('common.response')}
                              value={effectiveLatestRunResult.response}
                              emptyLabel={t('testCasesPage.noResponsePayloadReturned')}
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm text-muted-foreground">
                          {t('testCasesPage.totalRuns', {
                            count: runHistoryQuery.data?.meta.total ?? 0,
                          })}
                          {latestHistoryRun
                            ? ` • ${t('testCasesPage.latestPersistedAt', {
                                value: formatDate(latestHistoryRun.created_at),
                              })}`
                            : ''}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={effectiveHistoryStatus}
                            onValueChange={(value) => {
                              setHistoryStatus(value as HistoryFilterStatus);
                              setHistoryPage(1);
                            }}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder={t('testCasesPage.filterRunStatus')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t('testCasesPage.allStatuses')}</SelectItem>
                              <SelectItem value="pass">{t('testCasesPage.statusPassed')}</SelectItem>
                              <SelectItem value="fail">{t('testCasesPage.statusFailed')}</SelectItem>
                              <SelectItem value="error">{t('testCasesPage.statusError')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void runHistoryQuery.refetch()}
                            loading={runHistoryQuery.isFetching && !runHistoryQuery.isLoading}
                          >
                            <RefreshCw className="h-4 w-4" />
                            {t('testCasesPage.refreshHistory')}
                          </Button>
                        </div>
                      </div>

                      {runHistoryQuery.isError ? (
                        <Alert>
                          <AlertTitle>{t('testCasesPage.runHistoryLoadFailedTitle')}</AlertTitle>
                          <AlertDescription>
                            {t('testCasesPage.runHistoryLoadFailedDescription')}
                          </AlertDescription>
                        </Alert>
                      ) : runHistory.length === 0 ? (
                        <Alert>
                          <AlertTitle>{t('testCasesPage.noRunHistoryTitle')}</AlertTitle>
                          <AlertDescription>
                            {t('testCasesPage.noRunHistoryDescription')}
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <div className="overflow-hidden rounded-xl border border-border/60">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t('common.status')}</TableHead>
                                  <TableHead>{t('testCasesPage.tableDuration')}</TableHead>
                                  <TableHead>{t('common.created')}</TableHead>
                                  <TableHead>{t('testCasesPage.tableMessage')}</TableHead>
                                  <TableHead className="text-right">{t('testCasesPage.tableAction')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {runHistory.map((run) => (
                                  <TableRow key={run.id}>
                                    <TableCell>
                                      <RunStatusBadge status={run.status} />
                                    </TableCell>
                                    <TableCell>{run.duration_ms} ms</TableCell>
                                    <TableCell>{formatDate(run.created_at)}</TableCell>
                                    <TableCell className="max-w-[240px] truncate">
                                      {run.message || t('testCasesPage.noMessage')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRunDetailId(run.id)}
                                      >
                                        {t('common.view')}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-muted-foreground">
                              {t('testCasesPage.runPageSummary', {
                                page: runHistoryQuery.data?.meta.page || effectiveHistoryPage,
                                pages: runHistoryQuery.data?.meta.total_pages || 1,
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  setHistoryPage((currentPage) => Math.max(1, currentPage - 1))
                                }
                                disabled={effectiveHistoryPage <= 1}
                              >
                                {t('common.previous')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  setHistoryPage((currentPage) => {
                                    const nextPage = currentPage + 1;
                                    return Math.min(
                                      runHistoryQuery.data?.meta.total_pages || 1,
                                      nextPage
                                    );
                                  })
                                }
                                disabled={
                                  effectiveHistoryPage >= (runHistoryQuery.data?.meta.total_pages || 1)
                                }
                              >
                                {t('common.next')}
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </main>

      <TestCaseFormDialog
        key={`${formMode}-${formTargetId ?? 'create'}-${formTarget?.updated_at ?? 'draft'}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        testCase={formTarget}
        apiSpecs={apiSpecs}
        isLoadingTestCase={formMode === 'edit' && formTargetQuery.isLoading}
        isSubmitting={
          createTestCaseMutation.isPending || updateTestCaseMutation.isPending
        }
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setFormTargetId(null);
          }
        }}
        onSubmit={handleFormSubmit}
      />

      <CreateFromSpecDialog
        key={`from-spec-${isFromSpecOpen ? 'open' : 'closed'}-${autoOpenFromSpecSpecId ?? 'none'}-${apiSpecs.length}`}
        open={isFromSpecOpen}
        projectId={projectId}
        apiSpecs={apiSpecs}
        initialSpecId={autoOpenFromSpecSpecId}
        flowSource={flowSource}
        isSubmitting={fromSpecMutation.isPending}
        onOpenChange={(open) => {
          setIsFromSpecOpen(open);
          if (!open) {
            clearGenerationIntent();
          }
        }}
        onSubmit={handleFromSpecSubmit}
      />

      <DuplicateTestCaseDialog
        key={`duplicate-${duplicateTarget?.id ?? 'none'}-${duplicateTarget?.updated_at ?? 'closed'}`}
        open={Boolean(duplicateTarget)}
        testCase={duplicateTarget}
        isSubmitting={duplicateTestCaseMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicateTarget(null);
          }
        }}
        onSubmit={handleDuplicateSubmit}
      />

      <RunTestCaseDialog
        key={`run-${runTarget?.id ?? 'none'}-${Boolean(runTarget) ? 'open' : 'closed'}`}
        open={Boolean(runTarget)}
        testCase={runTarget}
        environments={environments}
        isSubmitting={runTestCaseMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setRunTarget(null);
          }
        }}
        onSubmit={handleRunSubmit}
      />

      <DeleteTestCaseDialog
        open={Boolean(deleteTarget)}
        testCase={deleteTarget}
        isDeleting={deleteTestCaseMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDelete}
      />

      <RunDetailDialog
        key={`run-detail-${effectiveRunDetailId ?? 'none'}-${Boolean(effectiveRunDetailId) ? 'open' : 'closed'}`}
        open={Boolean(effectiveRunDetailId)}
        projectId={projectId}
        testCaseId={resolvedSelectedTestCaseId}
        runId={effectiveRunDetailId}
        onOpenChange={(open) => {
          if (!open) {
            setRunDetailId(null);
          }
        }}
      />
    </>
  );
}
