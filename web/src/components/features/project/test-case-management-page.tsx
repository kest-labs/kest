'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
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
import { useApiSpecExamples, useApiSpecs, useProjectMemberRole } from '@/hooks/use-api-specs';
import { useEnvironments } from '@/hooks/use-environments';
import { useProject } from '@/hooks/use-projects';
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
import type { ApiSpec, ProjectMemberRole } from '@/types/api-spec';
import type { ProjectEnvironment } from '@/types/environment';
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
const WRITE_ROLES: ProjectMemberRole[] = ['write', 'admin', 'owner'];

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

const getRoleLabel = (role?: ProjectMemberRole) => {
  if (!role) {
    return 'Unknown';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

const formatJson = (value: unknown) => {
  if (value === undefined || value === null) {
    return '';
  }

  return JSON.stringify(value, null, 2);
};

const parseJsonInput = <T,>(
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
    throw new Error(`${label} must be valid JSON.`);
  }

  if (expectation === 'array' && !Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`);
  }

  if (
    expectation === 'object' &&
    (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null)
  ) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed as T;
};

const parseStringRecordInput = (value: string, label: string) => {
  const parsed = parseJsonInput<Record<string, unknown>>(value, label, 'object');

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

const getRunStatusLabel = (status?: string) => {
  switch (normalizeRunStatus(status)) {
    case 'pass':
      return 'Passed';
    case 'fail':
      return 'Failed';
    case 'error':
      return 'Error';
    case 'running':
      return 'Running';
    default:
      return status || 'Unknown';
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

const getDuplicateDraft = (testCase?: ProjectTestCase | null): DuplicateDraft => ({
  name: testCase ? `${testCase.name} Copy` : '',
});

const getDefaultFromSpecName = (apiSpec?: ApiSpec | null) =>
  apiSpec ? `Test ${apiSpec.method} ${apiSpec.path}`.trim() : '';

const getFromSpecDraft = (apiSpec?: ApiSpec | null): FromSpecDraft => ({
  apiSpecId: apiSpec?.id ? String(apiSpec.id) : '',
  name: getDefaultFromSpecName(apiSpec),
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
  return (
    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
      Role: {getRoleLabel(role)}
    </Badge>
  );
}

function MethodBadge({ method }: { method?: string }) {
  return (
    <Badge variant="outline" className={cn('font-mono', getMethodBadgeClassName(method))}>
      {method || 'N/A'}
    </Badge>
  );
}

function RunStatusBadge({ status }: { status?: string }) {
  return (
    <Badge variant="outline" className={cn(getRunStatusBadgeClassName(status))}>
      {getRunStatusLabel(status)}
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
  return (
    <div className="space-y-1 rounded-xl border border-border/60 bg-muted/15 p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || 'Not set'}</div>
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
      nextErrors.apiSpecId = 'Select an API spec before creating a test case.';
    }

    if (!trimmedName) {
      nextErrors.name = 'Name is required.';
    }

    try {
      headers = parseStringRecordInput(draft.headers, 'Headers');
    } catch (error) {
      nextErrors.headers = error instanceof Error ? error.message : 'Unable to parse Headers.';
    }

    try {
      queryParams = parseStringRecordInput(draft.queryParams, 'Query Params');
    } catch (error) {
      nextErrors.queryParams = error instanceof Error ? error.message : 'Unable to parse Query Params.';
    }

    try {
      pathParams = parseStringRecordInput(draft.pathParams, 'Path Params');
    } catch (error) {
      nextErrors.pathParams = error instanceof Error ? error.message : 'Unable to parse Path Params.';
    }

    try {
      requestBody = parseJsonInput(draft.requestBody, 'Request Body');
    } catch (error) {
      nextErrors.requestBody = error instanceof Error ? error.message : 'Unable to parse Request Body.';
    }

    try {
      assertions = parseJsonInput<TestCaseAssertion[]>(draft.assertions, 'Assertions', 'array');
    } catch (error) {
      nextErrors.assertions = error instanceof Error ? error.message : 'Unable to parse Assertions.';
    }

    try {
      extractVars = parseJsonInput<ExtractVariable[]>(draft.extractVars, 'Extract Vars', 'array');
    } catch (error) {
      nextErrors.extractVars = error instanceof Error ? error.message : 'Unable to parse Extract Vars.';
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
          <DialogTitle>{mode === 'create' ? 'Create Test Case' : 'Edit Test Case'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a project test case with POST /v1/projects/:id/test-cases.'
              : 'Update the current test case with PATCH /v1/projects/:id/test-cases/:tcid.'}
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
              <AlertTitle>Unable to load test case details</AlertTitle>
              <AlertDescription>
                The current test case is still loading. Close this dialog and try again.
              </AlertDescription>
            </Alert>
          ) : (
            <form id="test-case-form" onSubmit={handleSubmit} className="space-y-5 py-1">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-api-spec">API Spec</Label>
                  <Select
                    value={draft.apiSpecId || 'none'}
                    disabled={mode === 'edit'}
                    onValueChange={(value) => updateDraft('apiSpecId', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger id="test-case-api-spec" className="w-full">
                      <SelectValue placeholder="Select API spec" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select API spec</SelectItem>
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
                  <Label htmlFor="test-case-env">Environment</Label>
                  <Input
                    id="test-case-env"
                    value={draft.env}
                    onChange={(event) => updateDraft('env', event.target.value)}
                    placeholder="staging"
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-name">Name</Label>
                  <Input
                    id="test-case-name"
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                    placeholder="Create user happy path"
                    errorText={errors.name}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-description">Description</Label>
                  <Input
                    id="test-case-description"
                    value={draft.description}
                    onChange={(event) => updateDraft('description', event.target.value)}
                    placeholder="Optional short summary"
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-headers">Headers JSON</Label>
                  <Textarea
                    id="test-case-headers"
                    value={draft.headers}
                    onChange={(event) => updateDraft('headers', event.target.value)}
                    placeholder='{"Authorization":"Bearer {{token}}"}'
                    className="min-h-28 font-mono text-xs"
                    errorText={errors.headers}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-query-params">Query Params JSON</Label>
                  <Textarea
                    id="test-case-query-params"
                    value={draft.queryParams}
                    onChange={(event) => updateDraft('queryParams', event.target.value)}
                    placeholder='{"page":"1"}'
                    className="min-h-28 font-mono text-xs"
                    errorText={errors.queryParams}
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-path-params">Path Params JSON</Label>
                  <Textarea
                    id="test-case-path-params"
                    value={draft.pathParams}
                    onChange={(event) => updateDraft('pathParams', event.target.value)}
                    placeholder='{"id":"123"}'
                    className="min-h-28 font-mono text-xs"
                    errorText={errors.pathParams}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-request-body">Request Body JSON</Label>
                  <Textarea
                    id="test-case-request-body"
                    value={draft.requestBody}
                    onChange={(event) => updateDraft('requestBody', event.target.value)}
                    placeholder='{"username":"alice"}'
                    className="min-h-28 font-mono text-xs"
                    errorText={errors.requestBody}
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-pre-script">Pre Script</Label>
                  <Textarea
                    id="test-case-pre-script"
                    value={draft.preScript}
                    onChange={(event) => updateDraft('preScript', event.target.value)}
                    placeholder="// Prepare variables before request"
                    className="min-h-28 font-mono text-xs"
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-post-script">Post Script</Label>
                  <Textarea
                    id="test-case-post-script"
                    value={draft.postScript}
                    onChange={(event) => updateDraft('postScript', event.target.value)}
                    placeholder="// Cleanup after request"
                    className="min-h-28 font-mono text-xs"
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-case-assertions">Assertions JSON</Label>
                  <Textarea
                    id="test-case-assertions"
                    value={draft.assertions}
                    onChange={(event) => updateDraft('assertions', event.target.value)}
                    placeholder='[{"type":"status","operator":"equals","expect":200}]'
                    className="min-h-32 font-mono text-xs"
                    errorText={errors.assertions}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-case-extract-vars">Extract Vars JSON</Label>
                  <Textarea
                    id="test-case-extract-vars"
                    value={draft.extractVars}
                    onChange={(event) => updateDraft('extractVars', event.target.value)}
                    placeholder='[{"name":"user_id","source":"body","path":"$.id"}]'
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
            Cancel
          </Button>
          <Button
            type="submit"
            form="test-case-form"
            loading={isSubmitting}
            disabled={mode === 'edit' && isLoadingTestCase}
          >
            {mode === 'create' ? 'Create Test Case' : 'Save Changes'}
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
  const [draft, setDraft] = useState<DuplicateDraft>(() => getDuplicateDraft(testCase));
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = draft.name.trim();

    if (!trimmedName) {
      setError('New name is required.');
      return;
    }

    await onSubmit({ name: trimmedName });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Duplicate Test Case</DialogTitle>
          <DialogDescription>
            Duplicate the current test case with POST /v1/projects/:id/test-cases/:tcid/duplicate.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="duplicate-test-case-form" onSubmit={handleSubmit} className="space-y-4 py-1">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Source:
              {' '}
              <span className="font-medium text-foreground">{testCase?.name || 'Unknown test case'}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duplicate-test-case-name">New Name</Label>
              <Input
                id="duplicate-test-case-name"
                value={draft.name}
                onChange={(event) => setDraft({ name: event.target.value })}
                placeholder="Create user happy path copy"
                errorText={error}
                root
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="duplicate-test-case-form" loading={isSubmitting}>
            Duplicate
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
  projectId: number;
  apiSpecs: ApiSpec[];
  initialSpecId?: number | null;
  flowSource?: 'ai' | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTestCaseFromSpecRequest) => Promise<void>;
}) {
  const initialSpec = useMemo(
    () => apiSpecs.find((spec) => spec.id === initialSpecId) ?? null,
    [apiSpecs, initialSpecId]
  );
  const [draft, setDraft] = useState<FromSpecDraft>(() => getFromSpecDraft(initialSpec ?? undefined));
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
      nextErrors.apiSpecId = 'Select an API spec.';
    }

    if (!trimmedName) {
      nextErrors.name = 'Name is required.';
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
          <DialogTitle>Create Test Case from API Spec</DialogTitle>
          <DialogDescription>
            Turn an existing API spec into the first runnable test case without rebuilding the request by hand.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="from-spec-test-case-form" onSubmit={handleSubmit} className="space-y-5 py-1">
            {flowSource === 'ai' && initialSpec ? (
              <Alert>
                <AlertTitle>Continue from AI-generated spec</AlertTitle>
                <AlertDescription>
                  The new spec
                  {' '}
                  <code>{initialSpec.method} {initialSpec.path}</code>
                  {' '}
                  was just created. Generate its first test case now to keep the authoring flow continuous.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="from-spec-api-spec">API Spec</Label>
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
                            apiSpecs.find((spec) => spec.id === Number(value)) ?? null
                          )
                        : current.name,
                  }))
                }
              >
                <SelectTrigger id="from-spec-api-spec" className="w-full">
                  <SelectValue placeholder="Select API spec" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select API spec</SelectItem>
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
                  {selectedSpec.summary || selectedSpec.description || 'No summary'}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from-spec-name">Test Case Name</Label>
                <Input
                  id="from-spec-name"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Create user smoke test"
                  errorText={errors.name}
                  root
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="from-spec-env">Environment</Label>
                <Input
                  id="from-spec-env"
                  value={draft.env}
                  onChange={(event) => setDraft((current) => ({ ...current, env: event.target.value }))}
                  placeholder="staging"
                  root
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="from-spec-use-example" className="text-sm font-medium">
                    Use API Example
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    If the selected API spec already has examples, seed the test case with the
                    request and response example data.
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
                  <Label htmlFor="from-spec-example">Example</Label>
                  <Select
                    value={draft.exampleId}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, exampleId: value }))
                    }
                  >
                    <SelectTrigger id="from-spec-example" className="w-full">
                      <SelectValue placeholder="Use first example automatically" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Use first example automatically</SelectItem>
                      {specExamples.map((example) => (
                        <SelectItem key={example.id} value={String(example.id)}>
                          {example.name} (HTTP {example.response_status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {specExamplesQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Loading examples…</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="from-spec-test-case-form" loading={isSubmitting}>
            Generate Test Case
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
  const [draft, setDraft] = useState<RunDraft>(() => getRunDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    let globalVars: Record<string, unknown> | undefined;
    let variableKeys: Record<string, string> | undefined;

    try {
      globalVars = parseJsonInput<Record<string, unknown>>(draft.globalVars, 'Global Vars', 'object');
    } catch (error) {
      nextErrors.globalVars = error instanceof Error ? error.message : 'Unable to parse Global Vars.';
    }

    try {
      variableKeys = parseStringRecordInput(draft.variableKeys, 'Variable Keys');
    } catch (error) {
      nextErrors.variableKeys = error instanceof Error ? error.message : 'Unable to parse Variable Keys.';
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
          <DialogTitle>Run Test Case</DialogTitle>
          <DialogDescription>
            Run the current test case with POST /v1/projects/:id/test-cases/:tcid/run and override
            the environment or variables if needed.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="run-test-case-form" onSubmit={handleSubmit} className="space-y-5 py-1">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
              <div className="font-medium text-foreground">{testCase?.name || 'Unknown test case'}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                <MethodBadge method={testCase?.method} />
                <span className="font-mono">{testCase?.path || 'Path unavailable'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="run-test-case-env">Override Environment</Label>
              <Select
                value={draft.envId}
                onValueChange={(value) => setDraft((current) => ({ ...current, envId: value }))}
              >
                <SelectTrigger id="run-test-case-env" className="w-full">
                  <SelectValue placeholder="Use test case env" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use test case env</SelectItem>
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
                <Label htmlFor="run-test-case-global-vars">Global Vars JSON</Label>
                <Textarea
                  id="run-test-case-global-vars"
                  value={draft.globalVars}
                  onChange={(event) => setDraft((current) => ({ ...current, globalVars: event.target.value }))}
                  placeholder='{"token":"abc"}'
                  className="min-h-32 font-mono text-xs"
                  errorText={errors.globalVars}
                  root
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="run-test-case-variable-keys">Variable Keys JSON</Label>
                <Textarea
                  id="run-test-case-variable-keys"
                  value={draft.variableKeys}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, variableKeys: event.target.value }))
                  }
                  placeholder='{"user_id":"42"}'
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
            Cancel
          </Button>
          <Button type="submit" form="run-test-case-form" loading={isSubmitting}>
            Run Test Case
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Delete Test Case</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Run history will also lose its direct entry point.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="text-sm text-muted-foreground">
              You are deleting
              {' '}
              <span className="font-semibold text-foreground">{testCase?.name || 'this test case'}</span>
              .
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MethodBadge method={testCase?.method} />
              <Badge variant="outline" className="font-mono">
                {testCase?.path || 'Path unavailable'}
              </Badge>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={isDeleting} onClick={() => void onConfirm()}>
            Delete Test Case
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
  projectId: number;
  testCaseId?: number | null;
  runId?: number | null;
  onOpenChange: (open: boolean) => void;
}) {
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
          <DialogTitle>Run Detail</DialogTitle>
          <DialogDescription>
            Inspect the full request, response, and assertions returned by
            GET /v1/projects/:id/test-cases/:tcid/runs/:rid.
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
              <AlertTitle>Unable to load run detail</AlertTitle>
              <AlertDescription>
                The run detail could not be loaded. Try again in a moment.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-5 py-1">
              <div className="grid gap-3 md:grid-cols-4">
                <SummaryField label="Status" value={getRunStatusLabel(run.status)} />
                <SummaryField label="Duration" value={`${run.duration_ms} ms`} />
                <SummaryField label="Created At" value={formatDate(run.created_at)} />
                <SummaryField label="Run ID" value={run.id} />
              </div>

              {run.message ? (
                <Alert>
                  <AlertTitle>Run Message</AlertTitle>
                  <AlertDescription>{run.message}</AlertDescription>
                </Alert>
              ) : null}

              <Tabs defaultValue="request" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                  <TabsTrigger value="assertions">Assertions</TabsTrigger>
                  <TabsTrigger value="variables">Variables</TabsTrigger>
                </TabsList>

                <TabsContent value="request" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <SummaryField label="Method" value={run.request?.method || 'N/A'} />
                    <SummaryField label="URL" value={run.request?.url || 'N/A'} />
                    <SummaryField label="Headers" value={Object.keys(run.request?.headers || {}).length} />
                  </div>
                  <JsonPreview
                    title="Request Headers"
                    value={run.request?.headers}
                    emptyLabel="No request headers."
                  />
                  <JsonPreview
                    title="Request Body"
                    value={run.request?.body}
                    emptyLabel="No request body."
                  />
                </TabsContent>

                <TabsContent value="response" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <SummaryField label="HTTP Status" value={run.response?.status || 'N/A'} />
                    <SummaryField
                      label="Headers"
                      value={Object.keys(run.response?.headers || {}).length}
                    />
                  </div>
                  <JsonPreview
                    title="Response Headers"
                    value={run.response?.headers}
                    emptyLabel="No response headers."
                  />
                  <JsonPreview
                    title="Response Body"
                    value={run.response?.body}
                    emptyLabel="No response body."
                  />
                </TabsContent>

                <TabsContent value="assertions" className="space-y-3">
                  {!run.assertions || run.assertions.length === 0 ? (
                    <Alert>
                      <AlertTitle>No assertions recorded</AlertTitle>
                      <AlertDescription>
                        This run did not persist assertion details.
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
                          <JsonPreview title="Expected" value={assertion.expect} emptyLabel="No expected value." />
                          <JsonPreview title="Actual" value={assertion.actual} emptyLabel="No actual value." />
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
                    title="Extracted Variables"
                    value={run.variables}
                    emptyLabel="No variables extracted."
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
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
  projectId: number;
  autoOpenFromSpecSpecId?: number | null;
  flowSource?: 'ai' | null;
}) {
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
      label: isHeaderRefreshing ? 'Refreshing...' : 'Refresh',
      icon: RefreshCw,
      disabled: isHeaderRefreshing,
      onSelect: () => {
        void testCasesQuery.refetch();
      },
    },
    {
      key: 'test-cases-generate-from-spec',
      label: 'Generate from Spec',
      icon: FileJson2,
      disabled: !canCreate,
      onSelect: () => setIsFromSpecOpen(true),
    },
    {
      key: 'test-cases-api-specs',
      label: 'API Specs',
      icon: FileJson2,
      href: buildProjectApiSpecsRoute(projectId),
      separatorBefore: true,
    },
    {
      key: 'test-cases-environments',
      label: 'Environments',
      icon: Globe,
      href: buildProjectEnvironmentsRoute(projectId),
    },
    {
      key: 'test-cases-categories',
      label: 'Categories',
      icon: Tags,
      href: buildProjectCategoriesRoute(projectId),
    },
  ];
  const detailActionItems: ActionMenuItem[] = activeTestCase
    ? [
        {
          key: 'test-case-refresh',
          label:
            activeTestCaseQuery.isFetching && !activeTestCaseQuery.isLoading ? 'Refreshing...' : 'Refresh',
          icon: RefreshCw,
          disabled: activeTestCaseQuery.isFetching && !activeTestCaseQuery.isLoading,
          onSelect: () => {
            void activeTestCaseQuery.refetch();
          },
        },
        {
          key: 'test-case-edit',
          label: 'Edit',
          icon: Pencil,
          disabled: !canWrite,
          onSelect: () => openEditDialog(activeTestCase),
        },
        {
          key: 'test-case-duplicate',
          label: 'Duplicate',
          icon: Copy,
          disabled: !canWrite,
          onSelect: () => setDuplicateTarget(activeTestCase),
        },
        {
          key: 'test-case-delete',
          label: 'Delete',
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
                  Back to Project Overview
                </Link>
              </Button>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight">Test Cases</h1>
                  <FlaskConical className="h-6 w-6 text-primary" />
                </div>
                <p className="max-w-3xl text-sm text-text-muted">
                  Manage project-scoped test cases through
                  {' '}
                  <code>{buildApiPath('/projects/:id/test-cases')}</code>
                  , run them with
                  {' '}
                  <code>{buildApiPath('/projects/:id/test-cases/:tcid/run')}</code>
                  , and inspect run history through
                  {' '}
                  <code>{buildApiPath('/projects/:id/test-cases/:tcid/runs')}</code>
                  .
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  Project: {projectQuery.data?.name || `#${projectId}`}
                </Badge>
                <Badge variant="outline">{totalTestCases} test cases</Badge>
                <RoleBadge role={projectRole} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={openCreateDialog} disabled={!canCreate}>
                <Plus className="h-4 w-4" />
                New Test Case
              </Button>
              <ActionMenu
                items={headerActionItems}
                ariaLabel="Open test case management actions"
                triggerVariant="outline"
              />
            </div>
          </div>
        </div>

        {projectRole === 'read' ? (
          <Alert>
            <AlertTitle>Read-only access</AlertTitle>
            <AlertDescription>
              You can browse test cases and run history, but creating, editing, duplicating, deleting,
              and executing tests requires write permission.
            </AlertDescription>
          </Alert>
        ) : null}

        {apiSpecs.length === 0 ? (
          <Alert>
            <AlertTitle>No API specs available</AlertTitle>
            <AlertDescription>
              Test case generation depends on existing API Specs. Start with an AI draft or create an
              API Spec first, then come back to generate coverage from it.
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href={`${buildProjectApiSpecsRoute(projectId)}?ai=create`}>
                    <FileJson2 className="h-4 w-4" />
                    AI Draft API Spec
                  </Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {flowSource === 'ai' && autoOpenSpec ? (
          <Alert>
            <AlertTitle>AI spec ready for validation</AlertTitle>
            <AlertDescription>
              Continue the flow by generating the first test case from
              {' '}
              <code>{autoOpenSpec.method} {autoOpenSpec.path}</code>
              .
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
                title="Total Test Cases"
                value={totalTestCases}
                description={`Across ${totalPages} pages`}
                icon={FlaskConical}
                variant="primary"
              />
              <StatCard
                title="Current Page"
                value={testCases.length}
                description={`Page ${testCasesQuery.data?.meta.page || page} results`}
                icon={Boxes}
                variant="success"
              />
              <StatCard
                title="Linked API Specs"
                value={linkedApiSpecsCount}
                description="Distinct API specs on this page"
                icon={FileJson2}
                variant="warning"
              />
              <StatCard
                title="Assertions On Page"
                value={currentPageAssertionCount}
                description={`${environmentsInPage} environments referenced`}
                icon={ShieldCheck}
              />
            </>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-border/50 shadow-premium">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle>Test Case List</CardTitle>
              <CardDescription>
                List, filter, paginate, and select records from GET
                {' '}
                <code>{buildApiPath('/projects/:id/test-cases')}</code>
                .
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
                  placeholder="Search by name or description"
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
                    <SelectValue placeholder="Filter by API spec" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All API Specs</SelectItem>
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
                    <SelectValue placeholder="Filter by env" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Environments</SelectItem>
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
                  <AlertTitle>Unable to load test cases</AlertTitle>
                  <AlertDescription>
                    The current project test case list could not be loaded. Check your access or try again.
                  </AlertDescription>
                </Alert>
              ) : testCases.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FlaskConical className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">No test cases found</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {deferredKeyword || apiSpecFilter !== 'all' || envFilter !== 'all'
                      ? 'Adjust filters or search keyword to see more results.'
                      : 'Create the first test case manually or bootstrap it from an API Spec.'}
                  </p>
                  {canCreate ? (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                      <Button type="button" onClick={openCreateDialog}>
                        <Plus className="h-4 w-4" />
                        New Test Case
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsFromSpecOpen(true)}>
                        <FileJson2 className="h-4 w-4" />
                        Generate from Spec
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
                          <TableHead>Name</TableHead>
                          <TableHead>API Spec</TableHead>
                          <TableHead>Env</TableHead>
                          <TableHead>Assertions</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
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
                                    {testCase.path || linkedSpec?.path || 'Path unavailable'}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {linkedSpec ? `${linkedSpec.method} ${linkedSpec.path}` : `Spec #${testCase.api_spec_id}`}
                                </div>
                              </TableCell>
                              <TableCell>{testCase.env || 'Not set'}</TableCell>
                              <TableCell>{testCase.assertions?.length ?? 0}</TableCell>
                              <TableCell>{formatDate(testCase.updated_at)}</TableCell>
                              <TableCell className="text-right">
                                <ActionMenu
                                  items={[
                                    {
                                      key: `test-case-view-${testCase.id}`,
                                      label: 'View',
                                      onSelect: () => selectTestCase(testCase.id),
                                    },
                                    {
                                      key: `test-case-edit-${testCase.id}`,
                                      label: 'Edit',
                                      icon: Pencil,
                                      disabled: !canWrite,
                                      onSelect: () => {
                                        selectTestCase(testCase.id);
                                        openEditDialog(testCase);
                                      },
                                    },
                                    {
                                      key: `test-case-run-${testCase.id}`,
                                      label: 'Run',
                                      icon: Play,
                                      disabled: !canWrite,
                                      onSelect: () => {
                                        selectTestCase(testCase.id);
                                        setRunTarget(testCase);
                                      },
                                    },
                                    {
                                      key: `test-case-duplicate-${testCase.id}`,
                                      label: 'Duplicate',
                                      icon: Copy,
                                      disabled: !canWrite,
                                      onSelect: () => {
                                        selectTestCase(testCase.id);
                                        setDuplicateTarget(testCase);
                                      },
                                    },
                                    {
                                      key: `test-case-delete-${testCase.id}`,
                                      label: 'Delete',
                                      icon: Trash2,
                                      destructive: true,
                                      disabled: !canWrite,
                                      onSelect: () => {
                                        selectTestCase(testCase.id);
                                        setDeleteTarget(testCase);
                                      },
                                    },
                                  ]}
                                  ariaLabel={`Open actions for ${testCase.name}`}
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
                      Page
                      {' '}
                      {testCasesQuery.data?.meta.page || page}
                      {' '}
                      of
                      {' '}
                      {totalPages}
                      {' '}
                      •
                      {' '}
                      {totalTestCases}
                      {' '}
                      total test cases
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                        disabled={page <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setPage((currentPage) => Math.min(totalPages, currentPage + 1))
                        }
                        disabled={page >= totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-premium">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle>Test Case Detail</CardTitle>
              <CardDescription>
                Inspect GET
                {' '}
                <code>{buildApiPath('/projects/:id/test-cases/:tcid')}</code>
                {' '}
                and its associated run history.
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
                  <AlertTitle>No test case selected</AlertTitle>
                  <AlertDescription>
                    Pick a test case from the left table to inspect its full configuration and run history.
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
                          {activeTestCase.path || activeSpec?.path || 'Path unavailable'}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            API Spec: {activeSpec ? `${activeSpec.method} ${activeSpec.path}` : `#${activeTestCase.api_spec_id}`}
                          </Badge>
                          <Badge variant="outline">Env: {activeTestCase.env || 'Not set'}</Badge>
                          <Badge variant="outline">
                            Assertions: {activeTestCase.assertions?.length ?? 0}
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
                          Run
                        </Button>
                        <ActionMenu
                          items={detailActionItems}
                          ariaLabel="Open selected test case actions"
                          triggerVariant="outline"
                        />
                      </div>
                    </div>
                  </div>

                  {activeTestCase.description ? (
                    <Alert>
                      <AlertTitle>Description</AlertTitle>
                      <AlertDescription>{activeTestCase.description}</AlertDescription>
                    </Alert>
                  ) : null}

                    <Tabs
                    value={effectiveDetailTab}
                    onValueChange={(value) => setDetailTab(value as DetailTab)}
                    className="space-y-4"
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="request">Request Config</TabsTrigger>
                      <TabsTrigger value="runs">Run History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <SummaryField label="Created At" value={formatDate(activeTestCase.created_at)} />
                        <SummaryField label="Updated At" value={formatDate(activeTestCase.updated_at)} />
                        <SummaryField label="Created By" value={activeTestCase.created_by} />
                        <SummaryField label="API Spec ID" value={activeTestCase.api_spec_id} />
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <JsonPreview
                          title="Assertions"
                          value={activeTestCase.assertions}
                          emptyLabel="No assertions configured."
                        />
                        <JsonPreview
                          title="Extract Variables"
                          value={activeTestCase.extract_vars}
                          emptyLabel="No extract variables configured."
                        />
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Pre Script</div>
                          <CodeBlock
                            value={activeTestCase.pre_script}
                            emptyLabel="No pre script configured."
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Post Script</div>
                          <CodeBlock
                            value={activeTestCase.post_script}
                            emptyLabel="No post script configured."
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="request" className="space-y-4">
                      <div className="grid gap-4 xl:grid-cols-2">
                        <JsonPreview
                          title="Headers"
                          value={activeTestCase.headers}
                          emptyLabel="No headers configured."
                        />
                        <JsonPreview
                          title="Query Params"
                          value={activeTestCase.query_params}
                          emptyLabel="No query params configured."
                        />
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <JsonPreview
                          title="Path Params"
                          value={activeTestCase.path_params}
                          emptyLabel="No path params configured."
                        />
                        <JsonPreview
                          title="Request Body"
                          value={activeTestCase.request_body}
                          emptyLabel="No request body configured."
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="runs" className="space-y-4">
                      {effectiveLatestRunResult ? (
                        <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <div className="text-sm font-semibold">Latest Ad Hoc Run</div>
                              <div className="text-sm text-muted-foreground">
                                This result was returned directly by the latest run call and may appear in
                                history slightly later because the backend stores runs asynchronously.
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <RunStatusBadge status={effectiveLatestRunResult.status} />
                              <Badge variant="outline">{effectiveLatestRunResult.duration_ms} ms</Badge>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            <JsonPreview
                              title="Request"
                              value={effectiveLatestRunResult.request}
                              emptyLabel="No request payload returned."
                            />
                            <JsonPreview
                              title="Response"
                              value={effectiveLatestRunResult.response}
                              emptyLabel="No response payload returned."
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm text-muted-foreground">
                          {runHistoryQuery.data?.meta.total ?? 0}
                          {' '}
                          total runs
                          {latestHistoryRun
                            ? ` • latest persisted at ${formatDate(latestHistoryRun.created_at)}`
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
                              <SelectValue placeholder="Filter run status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All statuses</SelectItem>
                              <SelectItem value="pass">Passed</SelectItem>
                              <SelectItem value="fail">Failed</SelectItem>
                              <SelectItem value="error">Error</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void runHistoryQuery.refetch()}
                            loading={runHistoryQuery.isFetching && !runHistoryQuery.isLoading}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Refresh History
                          </Button>
                        </div>
                      </div>

                      {runHistoryQuery.isError ? (
                        <Alert>
                          <AlertTitle>Unable to load run history</AlertTitle>
                          <AlertDescription>
                            The run history list could not be loaded for the current test case.
                          </AlertDescription>
                        </Alert>
                      ) : runHistory.length === 0 ? (
                        <Alert>
                          <AlertTitle>No run history yet</AlertTitle>
                          <AlertDescription>
                            Execute this test case to start generating run records.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <div className="overflow-hidden rounded-xl border border-border/60">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Duration</TableHead>
                                  <TableHead>Created At</TableHead>
                                  <TableHead>Message</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
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
                                      {run.message || 'No message'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRunDetailId(run.id)}
                                      >
                                        View
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-muted-foreground">
                              Page
                              {' '}
                              {runHistoryQuery.data?.meta.page || effectiveHistoryPage}
                              {' '}
                              of
                              {' '}
                              {runHistoryQuery.data?.meta.total_pages || 1}
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
                                Previous
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
                                Next
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
        key={`from-spec-${isFromSpecOpen ? 'open' : 'closed'}`}
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
