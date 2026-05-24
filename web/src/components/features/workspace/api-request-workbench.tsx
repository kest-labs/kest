'use client';

import {
  closestCenter,
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery } from '@tanstack/react-query';
import {
  startTransition,
  type ComponentType,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import {
  AlertCircle,
  Binary,
  Braces,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  FileText,
  FileType2,
  FolderOpen,
  FormInput,
  GripVertical,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  SendHorizonal,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  collectionKeys,
  useCreateCollection,
  useDeleteCollection,
  useUpdateCollection,
} from '@/hooks/use-collections';
import {
  useCreateRequestExample,
  useDeleteRequestExample,
  useGenerateRequestExamples,
  useRequestExample,
  useRequestExamples,
  useSaveRequestExampleResponse,
  useSetDefaultRequestExample,
  useUpdateRequestExample,
} from '@/hooks/use-example';
import { useEnvironments } from '@/hooks/use-environments';
import { useCreateWorkspaceHistory } from '@/hooks/use-histories';
import { useImportMarkdownCollection, useImportPostmanCollection } from '@/hooks/use-importer';
import { useT } from '@/i18n/client';
import { collectionService } from '@/services/collection';
import { localRunnerService } from '@/services/local-runner';
import {
  useCreateRequest,
  useDeleteRequest,
  useGenRequestDoc,
  useUpdateRequest,
} from '@/hooks/use-requests';
import { requestService } from '@/services/request';
import type { ScopedTranslations } from '@/i18n/shared';
import type { WorkspaceCollection, WorkspaceCollectionTreeNode } from '@/types/collection';
import type {
  CreateExampleRequest,
  RequestExampleAssertion,
  RequestExampleCategory,
  RequestExampleDraft,
  RequestExample,
  SaveExampleResponseRequest,
  UpdateExampleRequest,
} from '@/types/example';
import type { WorkspaceEnvironment } from '@/types/environment';
import type { CreateHistoryRequest } from '@/types/history';
import type {
  ImportMarkdownCollectionRequest,
  ImportPostmanCollectionRequest,
} from '@/types/importer';
import type { ApiSpecLanguage } from '@/types/api-spec';
import type {
  CreateRequestRequest,
  WorkspaceRequest,
  RequestAuthConfig,
  RequestKeyValue,
  RunRequestResponse,
  UpdateRequestRequest,
} from '@/types/request';
import { cn } from '@/utils';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type RequestSection =
  | 'docs'
  | 'params'
  | 'authorization'
  | 'headers'
  | 'body'
  | 'scripts'
  | 'settings'
  | 'examples';
type BulkMode = 'table' | 'bulk';
type AuthorizationMode = 'none' | 'bearer' | 'basic' | 'api-key';
type BodyMode = 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded' | 'binary' | 'graphql';
type BodyValueType = 'text' | 'file';
type RequestDocLanguage = 'default' | ApiSpecLanguage;
type RequestDocMode = 'preview' | 'edit';

interface KeyValueRow {
  id: string;
  key: string;
  value: string;
  description: string;
  type: BodyValueType;
}

interface BodyFileValue {
  name: string;
  type: string;
  size: number;
  contentBase64: string;
}

interface BinaryBodyValue {
  file_name: string;
  content_type?: string;
}

interface GraphqlBodyValue {
  query: string;
  variables_text?: string;
  operation_name?: string;
}

interface DirectRequestExecutionPayload {
  body?: string;
  body_base64?: string;
  form_data?: Array<{
    key: string;
    value?: string;
    type?: BodyValueType;
    file_name?: string;
    content_type?: string;
    file_base64?: string;
  }>;
  historyBody?: string;
}

interface RunnableRequestState {
  name: string;
  method: string;
  url: string;
  headers: RequestKeyValue[];
  query_params: RequestKeyValue[];
  body: string;
  body_type: string;
  auth?: RequestAuthConfig | null;
}

interface ResponseDraft {
  status: number | null;
  statusLabel: string;
  durationMs: number | null;
  sizeBytes: number | null;
  headers: Record<string, string>;
  body: string;
  error: string | null;
}

type ExampleRunStatus = 'pass' | 'fail' | 'error';

interface ExampleRunAssertionResult {
  type: string;
  path?: string;
  operator?: string;
  expect?: unknown;
  actual?: unknown;
  passed: boolean;
  message?: string;
}

interface ExampleRunResult {
  id: string;
  exampleId: number | string;
  exampleName: string;
  method: string;
  url: string;
  status: ExampleRunStatus;
  expectedStatus: number | null;
  actualStatus: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  responseBody: string;
  assertions: ExampleRunAssertionResult[];
  error: string | null;
  completedAt: string;
}

interface ExampleRunReport {
  id: string;
  startedAt: string;
  completedAt: string;
  total: number;
  passed: number;
  failed: number;
  errored: number;
  durationMs: number;
  results: ExampleRunResult[];
}

interface RequestPageTab {
  id: string;
  title: string;
  collectionId: string | null;
  method: RequestMethod;
  url: string;
  pathParams: Record<string, string>;
  activeSection: RequestSection;
  docSource: 'manual' | 'ai';
  docMarkdown: string;
  docMarkdownZh: string;
  docMarkdownEn: string;
  paramsMode: BulkMode;
  paramsRows: KeyValueRow[];
  paramsBulk: string;
  authorizationMode: AuthorizationMode;
  authorizationValue: string;
  headersMode: BulkMode;
  headersRows: KeyValueRow[];
  headersBulk: string;
  bodyMode: BodyMode;
  bodyContent: string;
  bodyFiles: Record<string, BodyFileValue>;
  binaryFile: BodyFileValue | null;
  scripts: string;
  settings: {
    followRedirects: boolean;
    strictTls: boolean;
    persistCookies: boolean;
  };
  response: ResponseDraft;
  isSending: boolean;
}

interface CollectionNode {
  id: string;
  name: string;
  colorTone: CollectionColorTone;
  isFolder: boolean;
  requestIds: string[];
}

interface InitialWorkbenchState {
  tabs: RequestPageTab[];
  collections: CollectionNode[];
  activeTabId: string | null;
  openTabIds: string[];
  activeCollectionId: string | null;
  expandedCollectionIds: string[];
  nextTabIndex: number;
}

interface ExampleFormDraft {
  name: string;
  description: string;
  isDefault: boolean;
}

interface GenerateExamplesFormDraft {
  count: number;
  categories: RequestExampleCategory[];
  instructions: string;
}

interface GenerateExamplesDialogText {
  title: string;
  description: string;
  countLabel: string;
  countHint: string;
  categoriesLabel: string;
  categoryRequired: string;
  instructionsLabel: string;
  instructionsPlaceholder: string;
  cancel: string;
  generatePreview: string;
  categoryLabels: Record<RequestExampleCategory, string>;
}

interface ExampleDraftReviewItem {
  clientId: string;
  selected: boolean;
  draft: RequestExampleDraft;
}

interface ExampleDraftReviewState {
  collectionId: string;
  requestId: string;
  items: ExampleDraftReviewItem[];
}

interface ImportDialogTarget {
  kind: ImportDialogKind;
  parentCollectionId: string | null;
  parentCollectionName: string | null;
}

type ImportDialogKind = 'postman' | 'markdown';
type WorkspaceTranslationFn = ScopedTranslations<'workspace'>;
type CollectionColorTone = 'lime' | 'mint' | 'cream' | 'lilac' | 'pink' | 'coral';
const METHOD_OPTIONS: RequestMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const PRIMARY_SECTION_ITEMS: RequestSection[] = [
  'docs',
  'params',
  'authorization',
  'headers',
  'body',
  'settings',
];
const OVERFLOW_SECTION_ITEMS: RequestSection[] = ['scripts', 'examples'];
const BODY_MODE_OPTIONS: BodyMode[] = [
  'json',
  'raw',
  'form-data',
  'x-www-form-urlencoded',
  'binary',
  'graphql',
];
const AUTHORIZATION_OPTIONS: AuthorizationMode[] = ['none', 'bearer', 'basic', 'api-key'];
const COLLECTION_COLOR_TONES: CollectionColorTone[] = [
  'lime',
  'mint',
  'cream',
  'lilac',
  'pink',
  'coral',
];
const COLLECTION_COLOR_DOT_CLASS_NAMES: Record<CollectionColorTone, string> = {
  lime: 'bg-[var(--miro-surface-yellow)]',
  mint: 'bg-bg-surface',
  cream: 'bg-bg-surface',
  lilac: 'bg-bg-surface',
  pink: 'bg-bg-surface',
  coral: 'bg-bg-surface',
};
const REQUEST_TEMPLATE_PATTERN = /\{\{([^}]+)\}\}/g;
const DEFAULT_JSON_BODY = '{\n  "ping": "hello"\n}';
const DEFAULT_JSON_PLACEHOLDER = '{\n  \n}';
const DEFAULT_GRAPHQL_QUERY = 'query Example {\n  \n}';
const DEFAULT_GRAPHQL_VARIABLES = '{\n  \n}';
const METHOD_BADGE_STYLES: Record<RequestMethod, string> = {
  GET: 'border-[var(--miro-brand-teal)]/30 bg-[var(--miro-teal-light)] text-[var(--miro-moss-dark)]',
  POST: 'border-[var(--miro-brand-blue)]/25 bg-[var(--miro-surface-featured)] text-[var(--miro-blue-pressed)]',
  PUT: 'border-[var(--miro-brand-yellow-deep)]/35 bg-[var(--miro-surface-yellow)] text-[var(--miro-yellow-dark)]',
  PATCH:
    'border-[var(--miro-brand-coral)]/35 bg-[var(--miro-orange-light)] text-[var(--miro-coral-dark)]',
  DELETE:
    'border-[var(--miro-brand-coral)]/40 bg-[var(--miro-brand-red)] text-[var(--miro-coral-dark)]',
};

const createLocalId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

const DEFAULT_REQUEST_TEMPLATE = '{{base_url}}/path';
const DEFAULT_AI_EXAMPLE_COUNT = 6;
const MIN_AI_EXAMPLE_COUNT = 1;
const MAX_AI_EXAMPLE_COUNT = 12;
const AI_EXAMPLE_CATEGORY_OPTIONS: RequestExampleCategory[] = [
  'positive',
  'negative',
  'boundary',
  'security',
];
const getCollectionColorTone = (index: number) =>
  COLLECTION_COLOR_TONES[index % COLLECTION_COLOR_TONES.length];

const getDefaultRequestTitle = (t: WorkspaceTranslationFn, index: number) =>
  index === 1
    ? t('collections.workbench.defaultRequestTitle')
    : t('collections.workbench.defaultRequestTitleWithIndex', { index });

const getDefaultCollectionName = (t: WorkspaceTranslationFn, index: number) =>
  t('collections.workbench.defaultCollectionName', { index });

const getSectionLabel = (t: WorkspaceTranslationFn, section: RequestSection) =>
  t(`collections.workbench.sections.${section}`);

const getSectionIcon = (section: RequestSection) => {
  if (section === 'docs') {
    return <FileText className="h-4 w-4" />;
  }

  return null;
};

const getBodyModeLabel = (
  t: WorkspaceTranslationFn,
  mode: BodyMode | 'text' | 'none' | string | null | undefined
) => {
  switch (mode) {
    case 'json':
      return t('collections.workbench.bodyModes.json');
    case 'raw':
    case 'text':
      return t('collections.workbench.bodyModes.raw');
    case 'form-data':
      return t('collections.workbench.bodyModes.form-data');
    case 'x-www-form-urlencoded':
      return t('collections.workbench.bodyModes.x-www-form-urlencoded');
    case 'binary':
      return t('collections.workbench.bodyModes.binary');
    case 'graphql':
      return t('collections.workbench.bodyModes.graphql');
    case 'none':
    case undefined:
    case null:
    default:
      return mode ? String(mode) : t('collections.workbench.authModes.none');
  }
};

const getAuthorizationModeLabel = (
  t: WorkspaceTranslationFn,
  mode: AuthorizationMode | string | null | undefined
) => {
  switch (mode) {
    case 'bearer':
      return t('collections.workbench.authModes.bearer');
    case 'basic':
      return t('collections.workbench.authModes.basic');
    case 'api-key':
      return t('collections.workbench.authModes.api-key');
    case 'none':
    default:
      return t('collections.workbench.authModes.none');
  }
};

const getApiKeyLocationLabel = (t: WorkspaceTranslationFn, location?: string | null) => {
  switch (location) {
    case 'query':
      return t('collections.workbench.authLocations.query');
    case 'cookie':
      return t('collections.workbench.authLocations.cookie');
    case 'header':
    default:
      return t('collections.workbench.authLocations.header');
  }
};

const getAuthCredentialLabel = (t: WorkspaceTranslationFn, mode: AuthorizationMode) => {
  switch (mode) {
    case 'basic':
      return t('collections.workbench.authorization.usernamePassword');
    case 'api-key':
      return t('collections.workbench.authorization.apiKey');
    case 'bearer':
    default:
      return t('collections.workbench.authorization.token');
  }
};

const getAuthCredentialPlaceholder = (t: WorkspaceTranslationFn, mode: AuthorizationMode) => {
  switch (mode) {
    case 'basic':
      return t('collections.workbench.authorization.basicPlaceholder');
    case 'api-key':
      return t('collections.workbench.authorization.apiKeyPlaceholder');
    case 'bearer':
    default:
      return t('collections.workbench.authorization.credentialPlaceholder');
  }
};

const getExampleResponseValue = (
  t: WorkspaceTranslationFn,
  responseStatus: number,
  responseTime: number
) =>
  responseStatus > 0
    ? t('collections.workbench.examples.responseCaptured', {
        status: responseStatus,
        time: responseTime,
      })
    : t('collections.workbench.examples.notCaptured');

const getExampleCategoryLabelKey = (category?: RequestExampleCategory | string | null) => {
  switch (category) {
    case 'positive':
      return 'collections.workbench.examples.categories.positive';
    case 'negative':
      return 'collections.workbench.examples.categories.negative';
    case 'boundary':
      return 'collections.workbench.examples.categories.boundary';
    case 'security':
      return 'collections.workbench.examples.categories.security';
    case 'general':
    default:
      return 'collections.workbench.examples.categories.general';
  }
};

const getExampleExpectedStatus = (example: RequestExample) =>
  example.response_status > 0 ? example.response_status : null;

const valuesEqual = (actual: unknown, expected: unknown) => String(actual) === String(expected);

const resolveHeaderValue = (headers: Record<string, string> | undefined, path?: string) => {
  if (!headers) {
    return undefined;
  }
  if (!path) {
    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
  const normalizedPath = path.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === normalizedPath);
  return entry?.[1];
};

const resolvePathValue = (value: unknown, path?: string): unknown => {
  if (!path) {
    return value;
  }
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    if (typeof current === 'object') {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
};

const parseJsonBody = (body: string) => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
};

const evaluateExampleAssertion = (
  assertion: RequestExampleAssertion,
  response: RunRequestResponse
): ExampleRunAssertionResult => {
  const operator = assertion.operator || 'equals';
  const responseBody = formatResponseBody(response.body);
  let actual: unknown;

  switch (assertion.type) {
    case 'status':
      actual = response.status;
      break;
    case 'header':
      actual = resolveHeaderValue(response.headers, assertion.path);
      break;
    case 'body_contains':
      actual = responseBody;
      break;
    case 'json_path':
      actual = resolvePathValue(parseJsonBody(responseBody), assertion.path);
      break;
    default:
      return {
        ...assertion,
        operator,
        actual: null,
        passed: false,
        message: assertion.message || `Unsupported assertion type: ${assertion.type || 'unknown'}`,
      };
  }

  let passed = false;
  switch (operator) {
    case 'equals':
      passed = valuesEqual(actual, assertion.expect);
      break;
    case 'not_equals':
      passed = !valuesEqual(actual, assertion.expect);
      break;
    case 'exists':
      passed = actual !== undefined && actual !== null && actual !== '';
      break;
    case 'contains':
      passed = String(actual ?? '').includes(String(assertion.expect ?? ''));
      break;
    default:
      return {
        ...assertion,
        operator,
        actual,
        passed: false,
        message: assertion.message || `Unsupported assertion operator: ${operator}`,
      };
  }

  return {
    ...assertion,
    operator,
    actual,
    passed,
    message:
      passed || assertion.message
        ? assertion.message
        : `Expected ${assertion.expect ?? 'value'}, got ${actual ?? 'empty'}`,
  };
};

const evaluateExampleAssertions = (
  example: RequestExample,
  response: RunRequestResponse
): ExampleRunAssertionResult[] => {
  const assertions = example.assertions ?? [];
  if (assertions.length > 0) {
    return assertions.map(assertion => evaluateExampleAssertion(assertion, response));
  }

  const expectedStatus = getExampleExpectedStatus(example);
  return [
    {
      type: 'status',
      operator: 'equals',
      expect: expectedStatus ?? '2xx/3xx',
      actual: response.status,
      passed:
        expectedStatus !== null
          ? response.status === expectedStatus
          : response.status >= 200 && response.status < 400,
    },
  ];
};

const getExampleRunStatus = (
  example: RequestExample,
  response: RunRequestResponse,
  assertions = evaluateExampleAssertions(example, response)
): ExampleRunStatus => (assertions.every(assertion => assertion.passed) ? 'pass' : 'fail');

const getExampleRunStatusClassName = (status: ExampleRunStatus) => {
  switch (status) {
    case 'pass':
      return 'border-[var(--miro-brand-teal)]/30 bg-[var(--miro-teal-light)] text-[var(--miro-moss-dark)]';
    case 'fail':
      return 'border-[var(--miro-brand-yellow-deep)]/35 bg-[var(--miro-surface-yellow)] text-[var(--miro-yellow-dark)]';
    case 'error':
    default:
      return 'border-[var(--miro-brand-coral)]/40 bg-[var(--miro-brand-red)] text-[var(--miro-coral-dark)]';
  }
};

const buildExampleRunReport = (
  id: string,
  startedAt: string,
  results: ExampleRunResult[],
  completedAt = new Date().toISOString()
): ExampleRunReport => ({
  id,
  startedAt,
  completedAt,
  total: results.length,
  passed: results.filter(result => result.status === 'pass').length,
  failed: results.filter(result => result.status === 'fail').length,
  errored: results.filter(result => result.status === 'error').length,
  durationMs: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
  results,
});

const buildRunnableRequestFromExample = <T extends RunnableRequestState>(
  request: T,
  example: RequestExample
): T => ({
  ...request,
  name: example.name || request.name,
  method: example.method || request.method,
  url: example.url || request.url,
  headers: example.headers ?? [],
  query_params: example.query_params ?? [],
  body: example.body ?? '',
  body_type: example.body_type || 'none',
  auth: example.auth === undefined ? request.auth : example.auth,
});

const createKeyValueRow = (key = '', value = '', description = ''): KeyValueRow => ({
  id: createLocalId('kv'),
  key,
  value,
  description,
  type: 'text',
});

const createEmptyResponse = (): ResponseDraft => ({
  status: null,
  statusLabel: '',
  durationMs: null,
  sizeBytes: null,
  headers: {},
  body: '',
  error: null,
});

const resolveNextActiveTabId = (
  currentOpenTabIds: string[],
  nextOpenTabIds: string[],
  currentActiveTabId: string | null
) => {
  if (currentActiveTabId && nextOpenTabIds.includes(currentActiveTabId)) {
    return currentActiveTabId;
  }

  if (!currentActiveTabId) {
    return nextOpenTabIds[0] ?? null;
  }

  const currentIndex = currentOpenTabIds.indexOf(currentActiveTabId);
  if (currentIndex === -1) {
    return nextOpenTabIds[0] ?? null;
  }

  return (
    nextOpenTabIds[currentIndex] ?? nextOpenTabIds[currentIndex - 1] ?? nextOpenTabIds[0] ?? null
  );
};

const DEFAULT_NEW_REQUEST_URL = '';
// The API requires a non-empty URL for persisted requests, but the workbench allows blank
// draft URLs before a request is runnable. We store an `.invalid` placeholder and map it
// back to an empty field in the UI.
const PERSISTED_DRAFT_URL_PLACEHOLDER = 'https://placeholder.invalid';
const WORKBENCH_PAGE_SIZE = 100;
const SIDEBAR_COLLECTIONS_PAGE_SIZE = 24;

const UUID_LIKE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_NUMERIC_ID_PATTERN = /^\d+$/;

const isPersistedResourceId = (value: string) =>
  UUID_LIKE_ID_PATTERN.test(value) || LEGACY_NUMERIC_ID_PATTERN.test(value);

const isPersistedCollectionId = (value: string) => {
  return isPersistedResourceId(value);
};

const getPersistedRequestId = (value: string) => {
  if (!value.startsWith('request-')) {
    return null;
  }

  const requestId = value.slice('request-'.length).trim();
  return isPersistedResourceId(requestId) ? requestId : null;
};

const toRequestMethod = (method: string): RequestMethod =>
  METHOD_OPTIONS.includes(method as RequestMethod) ? (method as RequestMethod) : 'GET';

const toBodyMode = (bodyType: string): BodyMode => {
  switch (bodyType) {
    case 'form-data':
      return 'form-data';
    case 'x-www-form-urlencoded':
      return 'x-www-form-urlencoded';
    case 'binary':
      return 'binary';
    case 'graphql':
      return 'graphql';
    case 'text':
      return 'raw';
    case 'json':
      return 'json';
    default:
      return 'json';
  }
};

const toAuthorizationMode = (auth?: RequestAuthConfig | null): AuthorizationMode => {
  if (!auth?.type) {
    return 'none';
  }

  return AUTHORIZATION_OPTIONS.includes(auth.type as AuthorizationMode)
    ? (auth.type as AuthorizationMode)
    : 'none';
};

const toAuthorizationValue = (auth?: RequestAuthConfig | null) => {
  switch (auth?.type) {
    case 'basic':
      return auth.basic ? `${auth.basic.username}:${auth.basic.password}` : '';
    case 'bearer':
      return auth.bearer?.token ?? '';
    case 'api-key':
      return auth.api_key ? `${auth.api_key.key}: ${auth.api_key.value}` : '';
    default:
      return '';
  }
};

const toKeyValueRows = (rows: RequestKeyValue[] | undefined) =>
  rows && rows.length > 0
    ? rows.map(row => createKeyValueRow(row.key, row.value, row.description ?? ''))
    : [createKeyValueRow()];

const toScriptsValue = (request: WorkspaceRequest) =>
  [request.pre_request, request.test].filter(Boolean).join('\n\n');

const toRequestPageTab = (request: WorkspaceRequest): RequestPageTab => {
  const paramsRows = toKeyValueRows(request.query_params);
  const headersRows = toKeyValueRows(request.headers);
  const method = toRequestMethod(request.method);

  return createRequestPageTab(1, {
    id: `request-${request.id}`,
    title: request.name,
    collectionId: String(request.collection_id),
    method,
    url:
      request.url === PERSISTED_DRAFT_URL_PLACEHOLDER ? DEFAULT_NEW_REQUEST_URL : request.url || '',
    pathParams: request.path_params ?? {},
    activeSection: method === 'POST' || method === 'PUT' || method === 'PATCH' ? 'body' : 'params',
    docSource: request.doc_source === 'ai' ? 'ai' : 'manual',
    docMarkdown: request.doc_markdown ?? '',
    docMarkdownZh: request.doc_markdown_zh ?? '',
    docMarkdownEn: request.doc_markdown_en ?? '',
    paramsRows,
    paramsBulk: rowsToBulkText(paramsRows),
    authorizationMode: toAuthorizationMode(request.auth),
    authorizationValue: toAuthorizationValue(request.auth),
    headersRows,
    headersBulk: rowsToBulkText(headersRows),
    bodyMode: toBodyMode(request.body_type),
    bodyContent: request.body,
    bodyFiles: {},
    binaryFile: null,
    scripts: toScriptsValue(request),
  });
};

const createRequestPageTab = (
  index: number,
  overrides: Partial<RequestPageTab> = {},
  copy?: {
    defaultRequestTitle?: string;
    defaultRequestTitleWithIndex?: string;
    defaultHeaderDescription?: string;
    defaultBodyContent?: string;
    defaultScripts?: string;
  }
): RequestPageTab => ({
  id: overrides.id ?? createLocalId('request-tab'),
  title:
    overrides.title ??
    (index === 1
      ? (copy?.defaultRequestTitle ?? 'New Request')
      : (copy?.defaultRequestTitleWithIndex ?? `New Request ${index}`)),
  collectionId: overrides.collectionId ?? null,
  method: overrides.method ?? 'GET',
  url: overrides.url ?? DEFAULT_NEW_REQUEST_URL,
  pathParams: overrides.pathParams ?? {},
  activeSection: overrides.activeSection ?? 'params',
  docSource: overrides.docSource ?? 'manual',
  docMarkdown: overrides.docMarkdown ?? '',
  docMarkdownZh: overrides.docMarkdownZh ?? '',
  docMarkdownEn: overrides.docMarkdownEn ?? '',
  paramsMode: overrides.paramsMode ?? 'table',
  paramsRows: overrides.paramsRows ?? [createKeyValueRow()],
  paramsBulk: overrides.paramsBulk ?? '',
  authorizationMode: overrides.authorizationMode ?? 'none',
  authorizationValue: overrides.authorizationValue ?? '',
  headersMode: overrides.headersMode ?? 'table',
  headersRows: overrides.headersRows ?? [
    createKeyValueRow(
      'Accept',
      'application/json',
      copy?.defaultHeaderDescription ?? 'Default header'
    ),
  ],
  headersBulk: overrides.headersBulk ?? 'Accept: application/json',
  bodyMode: overrides.bodyMode ?? 'json',
  bodyContent: overrides.bodyContent ?? copy?.defaultBodyContent ?? DEFAULT_JSON_BODY,
  bodyFiles: overrides.bodyFiles ?? {},
  binaryFile: overrides.binaryFile ?? null,
  scripts:
    overrides.scripts ??
    copy?.defaultScripts ??
    "// Inspect the response here\npm.test('status should be 200', () => true);",
  settings: overrides.settings ?? {
    followRedirects: true,
    strictTls: true,
    persistCookies: false,
  },
  response: overrides.response ?? createEmptyResponse(),
  isSending: overrides.isSending ?? false,
});

const rowsToBulkText = (rows: KeyValueRow[]) =>
  rows
    .filter(row => row.key.trim() || row.value.trim() || row.description.trim())
    .map(row => `${row.key}: ${row.value}${row.description ? ` # ${row.description}` : ''}`)
    .join('\n');

const bulkTextToRows = (value: string) => {
  const rows = value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [pairPart, descriptionPart = ''] = line.split('#');
      const separatorIndex = pairPart.includes(':') ? pairPart.indexOf(':') : pairPart.indexOf('=');
      const key = separatorIndex >= 0 ? pairPart.slice(0, separatorIndex).trim() : pairPart.trim();
      const fieldValue = separatorIndex >= 0 ? pairPart.slice(separatorIndex + 1).trim() : '';

      return createKeyValueRow(key, fieldValue, descriptionPart.trim());
    });

  return rows.length > 0 ? rows : [createKeyValueRow()];
};

const createBodyFileValue = async (file: File): Promise<BodyFileValue> => {
  const contentBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Unable to read file'));
    };

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read file'));
        return;
      }

      const [, base64 = ''] = reader.result.split(',', 2);
      resolve(base64);
    };

    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    contentBase64,
  };
};

const parseStructuredBodyRows = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return [createKeyValueRow()];
  }

  try {
    const parsed = JSON.parse(trimmed) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) {
      return bulkTextToRows(value);
    }

    const rows = parsed.map(row => {
      const nextRow = createKeyValueRow(
        typeof row?.key === 'string' ? row.key : '',
        typeof row?.value === 'string' ? row.value : '',
        typeof row?.description === 'string' ? row.description : ''
      );
      nextRow.id = typeof row?.id === 'string' && row.id.trim() ? row.id : nextRow.id;
      nextRow.type = row?.type === 'file' ? 'file' : 'text';
      return nextRow;
    });
    return rows.length > 0 ? rows : [createKeyValueRow()];
  } catch {
    return bulkTextToRows(value);
  }
};

const serializeStructuredBodyRows = (rows: KeyValueRow[]) => {
  const payload = rows
    .filter(row => row.key.trim() || row.value.trim() || row.description.trim())
    .map(row => ({
      id: row.id,
      key: row.key.trim(),
      value: row.value,
      type: row.type === 'file' ? 'file' : undefined,
      enabled: true,
      description: row.description.trim() || undefined,
    }));

  return payload.length > 0 ? JSON.stringify(payload, null, 2) : '';
};

const parseBinaryBodyValue = (value: string): BinaryBodyValue => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { file_name: '', content_type: '' };
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<BinaryBodyValue>;
    return {
      file_name: typeof parsed.file_name === 'string' ? parsed.file_name : '',
      content_type: typeof parsed.content_type === 'string' ? parsed.content_type : '',
    };
  } catch {
    return {
      file_name: trimmed,
      content_type: '',
    };
  }
};

const serializeBinaryBodyValue = (value: BinaryBodyValue) => {
  const fileName = value.file_name.trim();
  const contentType = value.content_type?.trim() ?? '';

  if (!fileName && !contentType) {
    return '';
  }

  return JSON.stringify(
    {
      file_name: fileName,
      content_type: contentType || undefined,
    },
    null,
    2
  );
};

const parseGraphqlBodyValue = (value: string): GraphqlBodyValue => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      query: '',
      variables_text: '',
      operation_name: '',
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return {
      query: typeof parsed.query === 'string' ? parsed.query : '',
      variables_text:
        typeof parsed.variables_text === 'string'
          ? parsed.variables_text
          : parsed.variables !== undefined
            ? JSON.stringify(parsed.variables, null, 2)
            : '',
      operation_name:
        typeof parsed.operation_name === 'string'
          ? parsed.operation_name
          : typeof parsed.operationName === 'string'
            ? parsed.operationName
            : '',
    };
  } catch {
    return {
      query: value,
      variables_text: '',
      operation_name: '',
    };
  }
};

const serializeGraphqlBodyValue = (value: GraphqlBodyValue) => {
  const query = value.query.trim();
  const variablesText = value.variables_text?.trim() ?? '';
  const operationName = value.operation_name?.trim() ?? '';

  if (!query && !variablesText && !operationName) {
    return '';
  }

  return JSON.stringify(
    {
      query,
      variables_text: variablesText || undefined,
      operation_name: operationName || undefined,
    },
    null,
    2
  );
};

const formatBodyFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getNextBodyContentForMode = (nextMode: BodyMode, currentMode: BodyMode, value: string) => {
  if (nextMode === currentMode) {
    return value;
  }

  switch (nextMode) {
    case 'json':
      return currentMode === 'raw' ? value : DEFAULT_JSON_BODY;
    case 'raw':
      return currentMode === 'json' ? value : '';
    case 'form-data':
      if (currentMode === 'x-www-form-urlencoded') {
        return serializeStructuredBodyRows(parseStructuredBodyRows(value));
      }
      return '';
    case 'x-www-form-urlencoded':
      if (currentMode === 'form-data') {
        return serializeStructuredBodyRows(
          parseStructuredBodyRows(value).map(row => ({
            ...row,
            type: 'text',
            value: row.type === 'file' ? '' : row.value,
          }))
        );
      }
      return '';
    case 'binary':
      return '';
    case 'graphql': {
      if (currentMode === 'raw') {
        return serializeGraphqlBodyValue({
          query: value,
          variables_text: '',
          operation_name: '',
        });
      }
      return serializeGraphqlBodyValue({
        query: DEFAULT_GRAPHQL_QUERY,
        variables_text: DEFAULT_GRAPHQL_VARIABLES,
        operation_name: '',
      });
    }
    default:
      return value;
  }
};

const getTabSaveLabel = (tab: RequestPageTab) => {
  if (!tab.url.trim()) {
    return tab.title;
  }

  try {
    const parsed = new URL(tab.url);
    const path = parsed.pathname === '/' ? parsed.host : parsed.pathname;
    return `${tab.method} ${path}`;
  } catch {
    return `${tab.method} ${tab.url.trim()}`;
  }
};

const getPersistedTabName = (tab: RequestPageTab) => {
  const trimmedTitle = tab.title.trim();
  return trimmedTitle || getTabSaveLabel(tab);
};

const byteLength = (value: string) =>
  typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(value).length : value.length;

const encodeBase64 = (value: string, errorMessage: string) => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(value);
  }

  throw new Error(errorMessage);
};

const requestBodyTypeFromMode = (mode: BodyMode, value: string) => {
  if (!value.trim()) {
    return 'none';
  }

  switch (mode) {
    case 'form-data':
      return 'form-data';
    case 'x-www-form-urlencoded':
      return 'x-www-form-urlencoded';
    case 'binary':
      return 'binary';
    case 'graphql':
      return 'graphql';
    case 'raw':
      return 'text';
    case 'json':
    default:
      return 'json';
  }
};

const toRequestKeyValues = (
  mode: BulkMode,
  rows: KeyValueRow[],
  bulkValue: string
): RequestKeyValue[] =>
  (mode === 'bulk' ? bulkTextToRows(bulkValue) : rows)
    .filter(row => row.key.trim())
    .map(row => ({
      key: row.key.trim(),
      value: row.value,
      type: row.type !== 'text' ? row.type : undefined,
      enabled: true,
      description: row.description.trim() || undefined,
    }));

const toRequestAuthConfig = (mode: AuthorizationMode, value: string): RequestAuthConfig | null => {
  if (mode === 'none') {
    return null;
  }

  if (mode === 'bearer') {
    return {
      type: 'bearer',
      bearer: {
        token: value.trim(),
      },
    };
  }

  if (mode === 'basic') {
    const separatorIndex = value.indexOf(':');
    const username = separatorIndex >= 0 ? value.slice(0, separatorIndex).trim() : value.trim();
    const password = separatorIndex >= 0 ? value.slice(separatorIndex + 1).trim() : '';

    return {
      type: 'basic',
      basic: {
        username,
        password,
      },
    };
  }

  const separatorIndex = value.indexOf(':');
  const key = separatorIndex >= 0 ? value.slice(0, separatorIndex).trim() : 'X-API-Key';
  const apiValue = separatorIndex >= 0 ? value.slice(separatorIndex + 1).trim() : value.trim();

  return {
    type: 'api-key',
    api_key: {
      key,
      value: apiValue,
      in: 'header',
    },
  };
};

const toRequestScripts = (value: string) => ({
  pre_request: '',
  test: value,
});

const formatResponseBody = (value: string) => {
  if (!value.trim()) {
    return '';
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

const toResponseDraft = (response: RunRequestResponse): ResponseDraft => ({
  status: response.status,
  statusLabel: response.status_text.replace(/^\d+\s*/, '').trim(),
  durationMs: response.time,
  sizeBytes: response.size || byteLength(response.body),
  headers: response.headers ?? {},
  body: formatResponseBody(response.body),
  error: null,
});

const canCaptureResponse = (response: ResponseDraft) => response.status !== null && !response.error;

const getExampleFormDraft = (requestLabel: string): ExampleFormDraft => ({
  name: requestLabel,
  description: '',
  isDefault: false,
});

const getGenerateExamplesFormDraft = (): GenerateExamplesFormDraft => ({
  count: DEFAULT_AI_EXAMPLE_COUNT,
  categories: ['positive', 'negative', 'boundary', 'security'],
  instructions: '',
});

const toExampleFormDraft = (example: RequestExample): ExampleFormDraft => ({
  name: example.name,
  description: example.description ?? '',
  isDefault: example.is_default,
});

const toCreateExamplePayload = (
  tab: RequestPageTab,
  draft: ExampleFormDraft
): CreateExampleRequest => ({
  name: draft.name.trim(),
  description: draft.description.trim() || undefined,
  url: tab.url.trim() || undefined,
  method: tab.method,
  headers: toRequestKeyValues(tab.headersMode, tab.headersRows, tab.headersBulk),
  query_params: toRequestKeyValues(tab.paramsMode, tab.paramsRows, tab.paramsBulk),
  body: tab.bodyContent,
  body_type: requestBodyTypeFromMode(tab.bodyMode, tab.bodyContent),
  auth: toRequestAuthConfig(tab.authorizationMode, tab.authorizationValue),
  is_default: draft.isDefault,
});

const toCreateExamplePayloadFromDraft = (draft: RequestExampleDraft): CreateExampleRequest => ({
  name: draft.name.trim(),
  description: draft.description?.trim() || undefined,
  category: draft.category ?? 'general',
  source: draft.source ?? 'ai',
  url: draft.url || undefined,
  method: draft.method,
  headers: draft.headers ?? [],
  query_params: draft.query_params ?? [],
  body: draft.body ?? '',
  body_type: draft.body_type ?? 'none',
  auth: draft.auth ?? null,
  assertions: draft.assertions ?? [],
  response_status: draft.response_status ?? 0,
  response_headers: draft.response_headers ?? {},
  response_body: draft.response_body ?? '',
  sort_order: draft.sort_order,
});

const toUpdateExamplePayload = (draft: ExampleFormDraft): UpdateExampleRequest => ({
  name: draft.name.trim(),
  description: draft.description.trim(),
  is_default: draft.isDefault,
});

const toSaveExampleResponsePayload = (
  response: ResponseDraft
): SaveExampleResponseRequest | null => {
  if (!canCaptureResponse(response)) {
    return null;
  }

  return {
    response_status: response.status ?? 0,
    response_headers: response.headers,
    response_body: response.body,
    response_time: response.durationMs ?? 0,
  };
};

const maskSecret = (value: string, emptyLabel: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return emptyLabel;
  }

  if (trimmed.length <= 6) {
    return '••••';
  }

  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-2)}`;
};

const formatExampleKeyValues = (rows: RequestKeyValue[] | undefined, emptyState: string) =>
  rows && rows.length > 0
    ? rows
        .map(row => `${row.key}: ${row.value}${row.description ? ` # ${row.description}` : ''}`)
        .join('\n')
    : emptyState;

const formatExampleResponseHeaders = (
  headers: Record<string, string> | undefined,
  emptyState: string
) => {
  const entries = Object.entries(headers ?? {});
  return entries.length > 0
    ? entries.map(([key, value]) => `${key}: ${value}`).join('\n')
    : emptyState;
};

const formatExampleAssertions = (
  assertions: RequestExampleAssertion[] | undefined,
  emptyState: string
) =>
  assertions && assertions.length > 0
    ? assertions
        .map(assertion => {
          const target = assertion.path ? ` ${assertion.path}` : '';
          const expected =
            assertion.expect === undefined ? '' : ` ${JSON.stringify(assertion.expect)}`;
          return `${assertion.type}${target} ${assertion.operator || 'equals'}${expected}`.trim();
        })
        .join('\n')
    : emptyState;

const formatExampleAuth = (t: WorkspaceTranslationFn, auth?: RequestAuthConfig | null) => {
  const emptyLabel = t('collections.workbench.examples.emptyValue');

  switch (auth?.type) {
    case 'bearer':
      return auth.bearer?.token
        ? `Bearer ${maskSecret(auth.bearer.token, emptyLabel)}`
        : t('collections.workbench.examples.bearerToken');
    case 'basic':
      return auth.basic
        ? `${auth.basic.username || t('collections.workbench.examples.defaultUser')}:${maskSecret(auth.basic.password ?? '', emptyLabel)}`
        : t('collections.workbench.examples.basicAuth');
    case 'api-key':
      return auth.api_key
        ? `${auth.api_key.key || t('collections.workbench.authorization.defaultApiKeyName')} (${getApiKeyLocationLabel(t, auth.api_key.in ?? auth.api_key.add_to)}): ${maskSecret(
            auth.api_key.value ?? '',
            emptyLabel
          )}`
        : t('collections.workbench.authorization.apiKey');
    default:
      return t('collections.workbench.authModes.none');
  }
};

const formatExampleTimestamp = (value: string, unknownLabel: string) => {
  if (!value) {
    return unknownLabel;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const HISTORY_SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
]);

const maskHistoryValue = (value: string) => {
  if (!value) {
    return '';
  }

  if (value.length <= 6) {
    return '****';
  }

  return `${value.slice(0, 3)}****${value.slice(-2)}`;
};

const sanitizeHistoryHeaders = (headers: RequestKeyValue[]) =>
  headers.map(header => {
    const normalizedKey = header.key.trim().toLowerCase();
    return HISTORY_SENSITIVE_HEADER_NAMES.has(normalizedKey)
      ? { ...header, value: maskHistoryValue(header.value) }
      : header;
  });

const sanitizeHistoryHeaderMap = (headers: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      HISTORY_SENSITIVE_HEADER_NAMES.has(key.trim().toLowerCase())
        ? maskHistoryValue(value)
        : value,
    ])
  );

const sanitizeHistoryAuth = (auth?: RequestAuthConfig | null) => {
  if (!auth?.type) {
    return null;
  }

  switch (auth.type) {
    case 'basic':
      return auth.basic
        ? {
            type: 'basic',
            basic: {
              username: auth.basic.username,
              password: auth.basic.password ? '****' : '',
            },
          }
        : { type: 'basic' };
    case 'bearer':
      return {
        type: 'bearer',
        bearer: auth.bearer?.token ? '****' : '',
      };
    case 'api-key':
      return auth.api_key
        ? {
            type: 'api-key',
            api_key: {
              key: auth.api_key.key,
              in: auth.api_key.in ?? auth.api_key.add_to ?? 'header',
              value: auth.api_key.value ? '****' : '',
            },
          }
        : { type: 'api-key' };
    default:
      return { type: auth.type };
  }
};

const buildRequestRunHistoryPayload = ({
  request,
  executedUrl,
  requestHeaders,
  requestBody,
  settings,
  response,
  errorMessage,
  messages,
}: {
  request: WorkspaceRequest;
  executedUrl: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  settings: RequestPageTab['settings'];
  response?: RunRequestResponse;
  errorMessage?: string;
  messages: {
    executed: (requestLabel: string, status?: number) => string;
    failed: (requestLabel: string, message: string) => string;
  };
}): CreateHistoryRequest => {
  const requestLabel =
    request.url === PERSISTED_DRAFT_URL_PLACEHOLDER
      ? request.name
      : `${request.method} ${request.url}`;
  const succeeded = !errorMessage;

  return {
    entity_type: 'request',
    entity_id: String(request.id),
    action: succeeded ? 'run' : 'run_failed',
    message: succeeded
      ? messages.executed(requestLabel, response?.status)
      : messages.failed(requestLabel, errorMessage ?? ''),
    data: {
      request: {
        id: request.id,
        collection_id: request.collection_id,
        name: request.name,
        method: request.method,
        url: request.url,
        executed_url: executedUrl,
        headers: sanitizeHistoryHeaders(request.headers),
        executed_headers: sanitizeHistoryHeaderMap(requestHeaders),
        query_params: request.query_params,
        path_params: request.path_params,
        body: requestBody ?? '',
        body_type: request.body_type,
        auth: sanitizeHistoryAuth(request.auth),
      },
      runner: {
        mode: 'local',
        follow_redirects: settings.followRedirects,
        strict_tls: settings.strictTls,
      },
      response: response
        ? {
            status: response.status,
            status_text: response.status_text,
            headers: sanitizeHistoryHeaderMap(response.headers ?? {}),
            body: response.body,
            time: response.time,
            size: response.size,
          }
        : undefined,
      error: errorMessage || undefined,
    },
  };
};

const applyExampleToTab = (tab: RequestPageTab, example: RequestExample): RequestPageTab => {
  const paramsRows = toKeyValueRows(example.query_params);
  const headersRows = toKeyValueRows(example.headers);
  const method = toRequestMethod(example.method);

  return {
    ...tab,
    method,
    url: example.url || '',
    activeSection: method === 'POST' || method === 'PUT' || method === 'PATCH' ? 'body' : 'params',
    paramsMode: 'table',
    paramsRows,
    paramsBulk: rowsToBulkText(paramsRows),
    authorizationMode: toAuthorizationMode(example.auth),
    authorizationValue: toAuthorizationValue(example.auth),
    headersMode: 'table',
    headersRows,
    headersBulk: rowsToBulkText(headersRows),
    bodyMode: toBodyMode(example.body_type),
    bodyContent: example.body || '',
    bodyFiles: {},
    binaryFile: null,
  };
};

const isEnabledRequestKeyValue = (row: RequestKeyValue) =>
  row.enabled !== false && row.key.trim().length > 0;

const headersToObject = (headers: Headers) => Object.fromEntries(Array.from(headers.entries()));

const toEnvironmentVariableValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
};

const buildExecutionVariables = (environment?: WorkspaceEnvironment | null) => {
  const variables: Record<string, string> = {};

  Object.entries(environment?.variables ?? {}).forEach(([key, value]) => {
    variables[key] = toEnvironmentVariableValue(value);
  });

  const baseUrl = environment?.base_url?.trim();
  if (baseUrl && !variables.base_url) {
    variables.base_url = baseUrl;
  }

  return variables;
};

const resolveTemplateValue = (value: string, variables: Record<string, string>) =>
  value.replace(REQUEST_TEMPLATE_PATTERN, (match, key: string) => {
    const resolved = variables[key.trim()];
    return resolved === undefined ? match : resolved;
  });

const findUnresolvedTemplateKeys = (value: string) =>
  Array.from(
    new Set(Array.from(value.matchAll(REQUEST_TEMPLATE_PATTERN)).map(match => match[1].trim()))
  );

const getMissingVariableMessage = (
  keys: string[],
  environment: WorkspaceEnvironment | null | undefined,
  t: WorkspaceTranslationFn
) => {
  if (keys.length === 0) {
    return null;
  }

  if (keys.includes('base_url')) {
    if (!environment) {
      return t('collections.workbench.missingBaseUrlNoEnvironment', {
        template: '{{base_url}}',
      });
    }

    return t('collections.workbench.missingBaseUrlInEnvironment', {
      name: environment.display_name || environment.name,
    });
  }

  return t('collections.workbench.missingVariables', {
    keys: keys.join(', '),
  });
};

const resolveExecutionPathParams = (
  pathParams: Record<string, string>,
  variables: Record<string, string>
) =>
  Object.fromEntries(
    Object.entries(pathParams).map(([key, value]) => [key, resolveTemplateValue(value, variables)])
  );

const applyPathParamsToUrl = (url: string, pathParams: Record<string, string>) => {
  let resolvedUrl = url;

  Object.entries(pathParams).forEach(([key, value]) => {
    const encodedValue = encodeURIComponent(value);
    resolvedUrl = resolvedUrl
      .replaceAll(`{{${key}}}`, encodedValue)
      .replaceAll(`:${key}`, encodedValue);
  });

  return resolvedUrl;
};

const buildExecutableRequestUrl = (
  request: WorkspaceRequest,
  environment: WorkspaceEnvironment | null | undefined,
  t: WorkspaceTranslationFn
) => {
  const variables = buildExecutionVariables(environment);
  const resolvedPathParams = resolveExecutionPathParams(request.path_params ?? {}, variables);
  const resolvedUrl = resolveTemplateValue(
    applyPathParamsToUrl(request.url, resolvedPathParams),
    variables
  );
  const missingVariableMessage = getMissingVariableMessage(
    findUnresolvedTemplateKeys(resolvedUrl),
    environment,
    t
  );
  if (missingVariableMessage) {
    throw new Error(missingVariableMessage);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(resolvedUrl);
  } catch {
    throw new Error(t('collections.invalidResolvedUrl'));
  }

  request.query_params.filter(isEnabledRequestKeyValue).forEach(queryParam => {
    const key = resolveTemplateValue(queryParam.key.trim(), variables);
    const value = resolveTemplateValue(queryParam.value, variables);
    targetUrl.searchParams.append(key, value);
  });

  if (request.auth?.type === 'api-key') {
    const apiKeyLocation = request.auth.api_key?.add_to ?? request.auth.api_key?.in;
    if (
      apiKeyLocation === 'query' &&
      request.auth.api_key?.key?.trim() &&
      request.auth.api_key.value
    ) {
      targetUrl.searchParams.set(
        resolveTemplateValue(request.auth.api_key.key.trim(), variables),
        resolveTemplateValue(request.auth.api_key.value, variables)
      );
    }
  }

  return targetUrl.toString();
};

const buildDirectRequestHeaders = (
  request: WorkspaceRequest,
  environment: WorkspaceEnvironment | null | undefined,
  base64UnavailableMessage: string
) => {
  const headers = new Headers();
  const variables = buildExecutionVariables(environment);

  Object.entries(environment?.headers ?? {}).forEach(([key, value]) => {
    headers.set(
      resolveTemplateValue(key.trim(), variables),
      resolveTemplateValue(value, variables)
    );
  });

  request.headers.filter(isEnabledRequestKeyValue).forEach(header => {
    headers.set(
      resolveTemplateValue(header.key.trim(), variables),
      resolveTemplateValue(header.value, variables)
    );
  });

  if (
    request.auth?.type === 'bearer' &&
    request.auth.bearer?.token &&
    !headers.has('Authorization')
  ) {
    headers.set(
      'Authorization',
      `Bearer ${resolveTemplateValue(request.auth.bearer.token, variables)}`
    );
  }

  if (request.auth?.type === 'basic' && request.auth.basic && !headers.has('Authorization')) {
    headers.set(
      'Authorization',
      `Basic ${encodeBase64(
        `${resolveTemplateValue(request.auth.basic.username, variables)}:${resolveTemplateValue(request.auth.basic.password, variables)}`,
        base64UnavailableMessage
      )}`
    );
  }

  if (request.auth?.type === 'api-key') {
    const apiKeyLocation = request.auth.api_key?.add_to ?? request.auth.api_key?.in;
    if (
      apiKeyLocation !== 'query' &&
      request.auth.api_key?.key?.trim() &&
      request.auth.api_key.value
    ) {
      headers.set(
        resolveTemplateValue(request.auth.api_key.key.trim(), variables),
        resolveTemplateValue(request.auth.api_key.value, variables)
      );
    }
  }

  if (request.body_type === 'form-data') {
    headers.delete('Content-Type');
  }

  if (request.body.trim() && !headers.has('Content-Type')) {
    switch (request.body_type) {
      case 'json':
        headers.set('Content-Type', 'application/json');
        break;
      case 'text':
        headers.set('Content-Type', 'text/plain');
        break;
      case 'x-www-form-urlencoded':
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
        break;
      case 'graphql':
        headers.set('Content-Type', 'application/json');
        break;
      case 'binary': {
        const binary = parseBinaryBodyValue(request.body);
        headers.set('Content-Type', binary.content_type?.trim() || 'application/octet-stream');
        break;
      }
      default:
        break;
    }
  }

  return headers;
};

const buildDirectRequestPayload = (
  request: WorkspaceRequest,
  tab: RequestPageTab,
  t: WorkspaceTranslationFn,
  environment?: WorkspaceEnvironment | null
): DirectRequestExecutionPayload => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return {};
  }

  const variables = buildExecutionVariables(environment);

  switch (request.body_type) {
    case 'form-data': {
      const rows = parseStructuredBodyRows(request.body).filter(row => row.key.trim());
      if (rows.length === 0) {
        return {};
      }

      const formData = rows.map(field => {
        const key = resolveTemplateValue(field.key.trim(), variables);
        if (field.type === 'file') {
          const selectedFile = tab.bodyFiles[field.id];
          return {
            key,
            type: 'file' as const,
            file_name: selectedFile?.name || field.value.trim(),
            content_type: selectedFile?.type || undefined,
            file_base64: selectedFile?.contentBase64 || undefined,
          };
        }

        return {
          key,
          type: 'text' as const,
          value: resolveTemplateValue(field.value, variables),
        };
      });

      const missingFileField = formData.find(field => field.type === 'file' && !field.file_base64);
      if (missingFileField) {
        throw new Error(
          t('collections.workbench.body.fileRequired', {
            field: missingFileField.key || t('collections.workbench.editors.key'),
          })
        );
      }

      return {
        form_data: formData,
        historyBody: request.body,
      };
    }
    case 'x-www-form-urlencoded': {
      const rows = parseStructuredBodyRows(request.body).filter(row => row.key.trim());
      const body = rows
        .map(
          row =>
            `${encodeURIComponent(resolveTemplateValue(row.key.trim(), variables))}=${encodeURIComponent(resolveTemplateValue(row.value, variables))}`
        )
        .join('&');

      return {
        body: body || undefined,
        historyBody: body,
      };
    }
    case 'binary': {
      const binary = parseBinaryBodyValue(request.body);
      if (!tab.binaryFile?.contentBase64) {
        if (binary.file_name.trim()) {
          throw new Error(t('collections.workbench.body.binaryFileRequired'));
        }

        return {};
      }

      return {
        body_base64: tab.binaryFile.contentBase64,
        historyBody: binary.file_name || tab.binaryFile.name,
      };
    }
    case 'graphql': {
      const graphql = parseGraphqlBodyValue(request.body);
      const query = resolveTemplateValue(graphql.query, variables).trim();
      const variablesText = resolveTemplateValue(graphql.variables_text ?? '', variables).trim();
      let parsedVariables: unknown;

      if (variablesText) {
        try {
          parsedVariables = JSON.parse(variablesText) as unknown;
        } catch {
          throw new Error(
            t('common.jsonMustBeValid', {
              label: t('collections.workbench.body.graphqlVariablesLabel'),
            })
          );
        }
      }

      const body = JSON.stringify(
        {
          query,
          variables: parsedVariables,
          operationName: graphql.operation_name?.trim() || undefined,
        },
        null,
        2
      );

      return {
        body: query ? body : undefined,
        historyBody: query ? body : '',
      };
    }
    default: {
      const resolvedBody = resolveTemplateValue(request.body, variables);
      return {
        body: resolvedBody.trim() ? resolvedBody : undefined,
        historyBody: resolvedBody.trim() ? resolvedBody : '',
      };
    }
  }
};

const flattenCollectionTree = (nodes: WorkspaceCollectionTreeNode[]): WorkspaceCollectionTreeNode[] =>
  nodes.flatMap(node => [node, ...flattenCollectionTree(node.children ?? [])]);

const sortCollectionTreeNodes = (nodes: WorkspaceCollectionTreeNode[]) => {
  nodes.sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return String(left.id).localeCompare(String(right.id));
  });

  nodes.forEach(node => {
    if (node.children?.length) {
      sortCollectionTreeNodes(node.children);
    }
  });
};

const buildCollectionTreeFromList = (
  collections: WorkspaceCollection[]
): WorkspaceCollectionTreeNode[] => {
  const uniqueCollections = Array.from(
    new Map(collections.map(collection => [String(collection.id), collection])).values()
  );
  const nodeMap = new Map<string, WorkspaceCollectionTreeNode>();
  const rootNodes: WorkspaceCollectionTreeNode[] = [];

  uniqueCollections.forEach(collection => {
    nodeMap.set(String(collection.id), {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      workspace_id: collection.workspace_id ?? '',
      parent_id: collection.parent_id,
      is_folder: collection.is_folder,
      sort_order: collection.sort_order,
      children: [],
    });
  });

  uniqueCollections.forEach(collection => {
    const node = nodeMap.get(String(collection.id));
    if (!node) {
      return;
    }

    if (collection.parent_id == null) {
      rootNodes.push(node);
      return;
    }

    const parentNode = nodeMap.get(String(collection.parent_id));
    if (!parentNode) {
      rootNodes.push(node);
      return;
    }

    parentNode.children = parentNode.children ?? [];
    parentNode.children.push(node);
  });

  sortCollectionTreeNodes(rootNodes);
  return rootNodes;
};

const fetchAllWorkspaceCollections = async (
  workspaceId: number | string
): Promise<WorkspaceCollectionTreeNode[]> => {
  const items: WorkspaceCollection[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await collectionService.list({
      workspaceId: workspaceId,
      page,
      perPage: WORKBENCH_PAGE_SIZE,
    });

    items.push(...response.items);
    totalPages = Math.max(response.meta?.pages ?? 1, 1);
    page += 1;
  } while (page <= totalPages);

  const dedupedItems = Array.from(
    new Map(items.map(collection => [collection.id, collection])).values()
  );

  return buildCollectionTreeFromList(dedupedItems);
};

const fetchAllCollectionRequests = async (
  workspaceId: number | string,
  collectionId: number | string
): Promise<WorkspaceRequest[]> => {
  const items: WorkspaceRequest[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await requestService.list({
      workspaceId: workspaceId,
      collectionId,
      page,
      perPage: WORKBENCH_PAGE_SIZE,
    });

    items.push(...response.items);
    totalPages = Math.max(response.meta?.pages ?? 1, 1);
    page += 1;
  } while (page <= totalPages);

  return items;
};

const buildWorkbenchStateFromServer = (
  treeNodes: WorkspaceCollectionTreeNode[],
  requestsByCollectionId: Record<string, WorkspaceRequest[]>
): InitialWorkbenchState => {
  const flattenedCollections = flattenCollectionTree(treeNodes);
  const collections: CollectionNode[] = flattenedCollections.map((collection, index) => ({
    id: String(collection.id),
    name: collection.name,
    colorTone: getCollectionColorTone(index),
    isFolder: collection.is_folder,
    requestIds: (requestsByCollectionId[String(collection.id)] ?? []).map(
      request => `request-${request.id}`
    ),
  }));
  const tabs = flattenedCollections.flatMap(collection =>
    (requestsByCollectionId[String(collection.id)] ?? []).map(request => toRequestPageTab(request))
  );

  return {
    tabs,
    collections,
    activeTabId: null,
    openTabIds: [],
    activeCollectionId: collections[0]?.id ?? null,
    expandedCollectionIds: collections.map(collection => collection.id),
    nextTabIndex: tabs.length + 1,
  };
};

const mergeServerCollections = (
  currentCollections: CollectionNode[],
  serverCollections: CollectionNode[]
) => {
  const currentById = new Map(currentCollections.map(collection => [collection.id, collection]));
  const serverIds = new Set(serverCollections.map(collection => collection.id));
  const localOnlyCollections = currentCollections.filter(
    collection => !serverIds.has(collection.id) && !isPersistedCollectionId(collection.id)
  );

  return [
    ...serverCollections.map(collection => {
      const currentCollection = currentById.get(collection.id);
      const localOnlyRequestIds =
        currentCollection?.requestIds.filter(
          requestId => getPersistedRequestId(requestId) === null
        ) ?? [];

      return {
        ...collection,
        colorTone: currentCollection?.colorTone ?? collection.colorTone,
        isFolder: currentCollection?.isFolder ?? collection.isFolder,
        requestIds: Array.from(new Set([...localOnlyRequestIds, ...collection.requestIds])),
      };
    }),
    ...localOnlyCollections,
  ];
};

const mergeServerTabs = (currentTabs: RequestPageTab[], serverTabs: RequestPageTab[]) => {
  const currentById = new Map(currentTabs.map(tab => [tab.id, tab]));
  const serverIds = new Set(serverTabs.map(tab => tab.id));
  const localOnlyTabs = currentTabs.filter(
    tab => !serverIds.has(tab.id) && getPersistedRequestId(tab.id) === null
  );

  return [
    ...serverTabs.map(serverTab => {
      const currentTab = currentById.get(serverTab.id);

      // Opened request tabs act like local editing buffers. Background refetches
      // should not clobber the user's in-progress section selection or unsaved edits.
      return currentTab
        ? {
            ...currentTab,
            collectionId: serverTab.collectionId,
          }
        : serverTab;
    }),
    ...localOnlyTabs,
  ];
};

const mergeExpandedCollectionIds = (currentIds: string[], serverIds: string[]) => {
  if (currentIds.length === 0) {
    return serverIds;
  }

  return Array.from(new Set([...serverIds, ...currentIds]));
};

const normalizeCollectionNodes = (items: CollectionNode[]) => {
  const orderedIds: string[] = [];
  const mergedById = new Map<string, CollectionNode>();

  items.forEach(collection => {
    const existing = mergedById.get(collection.id);
    const nextRequestIds = existing
      ? Array.from(new Set([...existing.requestIds, ...collection.requestIds]))
      : Array.from(new Set(collection.requestIds));

    if (!existing) {
      orderedIds.push(collection.id);
    }

    mergedById.set(collection.id, {
      ...(existing ?? collection),
      ...collection,
      requestIds: nextRequestIds,
    });
  });

  return orderedIds
    .map(collectionId => mergedById.get(collectionId))
    .filter((collection): collection is CollectionNode => Boolean(collection));
};

const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const areCollectionNodesEqual = (left: CollectionNode[], right: CollectionNode[]) =>
  left.length === right.length &&
  left.every((collection, index) => {
    const other = right[index];

    return (
      collection.id === other.id &&
      collection.name === other.name &&
      collection.colorTone === other.colorTone &&
      collection.isFolder === other.isFolder &&
      areStringArraysEqual(collection.requestIds, other.requestIds)
    );
  });

const areTabsEquivalent = (left: RequestPageTab[], right: RequestPageTab[]) =>
  left.length === right.length &&
  left.every((tab, index) => {
    const other = right[index];

    return (
      tab.id === other.id &&
      tab.title === other.title &&
      tab.collectionId === other.collectionId &&
      tab.method === other.method &&
      tab.url === other.url &&
      tab.docSource === other.docSource &&
      tab.docMarkdown === other.docMarkdown &&
      tab.docMarkdownZh === other.docMarkdownZh &&
      tab.docMarkdownEn === other.docMarkdownEn &&
      JSON.stringify(tab.pathParams) === JSON.stringify(other.pathParams)
    );
  });

const getInitialWorkbenchState = (): InitialWorkbenchState => {
  return {
    tabs: [],
    collections: [],
    activeTabId: null,
    openTabIds: [],
    activeCollectionId: null,
    expandedCollectionIds: [],
    nextTabIndex: 1,
  };
};

export function ApiRequestWorkbench({ workspaceId }: { workspaceId: number | string }) {
  const t = useT('workspace');
  const defaultRequestTitle = t('collections.workbench.defaultRequestTitle');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialState = useMemo(() => getInitialWorkbenchState(), []);
  const quickRequestIntentConsumedRef = useRef(false);
  const [tabs, setTabs] = useState<RequestPageTab[]>(initialState.tabs);
  const [collections, setCollections] = useState<CollectionNode[]>(initialState.collections);
  const [activeTabId, setActiveTabId] = useState<string | null>(initialState.activeTabId);
  const [openTabIds, setOpenTabIds] = useState<string[]>(initialState.openTabIds);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    initialState.activeCollectionId
  );
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<string[]>(
    initialState.expandedCollectionIds
  );
  const [nextTabIndex, setNextTabIndex] = useState(initialState.nextTabIndex);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<CollectionNode | null>(null);
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [creatingRequestCollectionId, setCreatingRequestCollectionId] = useState<string | null>(
    null
  );
  const [deletingRequestTabId, setDeletingRequestTabId] = useState<string | null>(null);
  const [deleteRequestTarget, setDeleteRequestTarget] = useState<RequestPageTab | null>(null);
  const [renamingRequestTabId, setRenamingRequestTabId] = useState<string | null>(null);
  const [renameDialogCollectionId, setRenameDialogCollectionId] = useState<string | null>(null);
  const [renameDraftName, setRenameDraftName] = useState('');
  const [renameDialogRequestTabId, setRenameDialogRequestTabId] = useState<string | null>(null);
  const [renameRequestDraftName, setRenameRequestDraftName] = useState('');
  const [importDialogTarget, setImportDialogTarget] = useState<ImportDialogTarget | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isExampleDialogOpen, setIsExampleDialogOpen] = useState(false);
  const [isGenerateExamplesDialogOpen, setIsGenerateExamplesDialogOpen] = useState(false);
  const [generateExamplesDraft, setGenerateExamplesDraft] = useState<GenerateExamplesFormDraft>(
    () => getGenerateExamplesFormDraft()
  );
  const [exampleDraftReview, setExampleDraftReview] = useState<ExampleDraftReviewState | null>(
    null
  );
  const [isAcceptingExampleDrafts, setIsAcceptingExampleDrafts] = useState(false);
  const [viewingExampleId, setViewingExampleId] = useState<number | string | null>(null);
  const [editingExampleId, setEditingExampleId] = useState<number | string | null>(null);
  const [deleteExampleTarget, setDeleteExampleTarget] = useState<RequestExample | null>(null);
  const [savingResponseExampleId, setSavingResponseExampleId] = useState<number | string | null>(
    null
  );
  const [defaultingExampleId, setDefaultingExampleId] = useState<number | string | null>(null);
  const [deletingExampleId, setDeletingExampleId] = useState<number | string | null>(null);
  const [isRunningExamples, setIsRunningExamples] = useState(false);
  const [runningExampleId, setRunningExampleId] = useState<number | string | null>(null);
  const [exampleRunReport, setExampleRunReport] = useState<ExampleRunReport | null>(null);
  const [requestDocGenerationError, setRequestDocGenerationError] = useState<string | null>(null);
  const [generatingRequestDocLang, setGeneratingRequestDocLang] = useState<ApiSpecLanguage | null>(
    null
  );
  const createCollectionMutation = useCreateCollection(workspaceId);
  const deleteCollectionMutation = useDeleteCollection(workspaceId);
  const updateCollectionMutation = useUpdateCollection(workspaceId);
  const importPostmanMutation = useImportPostmanCollection(workspaceId);
  const importMarkdownMutation = useImportMarkdownCollection(workspaceId);
  const environmentsQuery = useEnvironments(workspaceId);
  const createRequestMutation = useCreateRequest(workspaceId);
  const updateRequestMutation = useUpdateRequest(workspaceId);
  const genRequestDocMutation = useGenRequestDoc(workspaceId);
  const deleteRequestMutation = useDeleteRequest(workspaceId);
  const createHistoryMutation = useCreateWorkspaceHistory(workspaceId);
  const createExampleMutation = useCreateRequestExample(workspaceId);
  const generateExamplesMutation = useGenerateRequestExamples(workspaceId);
  const updateExampleMutation = useUpdateRequestExample(workspaceId);
  const deleteExampleMutation = useDeleteRequestExample(workspaceId);
  const saveExampleResponseMutation = useSaveRequestExampleResponse(workspaceId);
  const setDefaultExampleMutation = useSetDefaultRequestExample(workspaceId);
  const collectionTreeQuery = useQuery({
    queryKey: collectionKeys.workbenchTree(workspaceId),
    queryFn: () => fetchAllWorkspaceCollections(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
    placeholderData: previousData => previousData,
  });

  const deferredSidebarQuery = useDeferredValue(sidebarQuery);
  const environments = useMemo(
    () => environmentsQuery.data?.items ?? [],
    [environmentsQuery.data?.items]
  );
  const selectedEnvironment = useMemo(
    () =>
      !selectedEnvironmentId || selectedEnvironmentId === 'none'
        ? null
        : (environments.find(environment => String(environment.id) === selectedEnvironmentId) ??
          null),
    [environments, selectedEnvironmentId]
  );
  const selectedEnvironmentBaseUrl = selectedEnvironment?.base_url?.trim() ?? '';
  const createDraftTab = useCallback(
    (index: number, overrides: Partial<RequestPageTab> = {}) =>
      createRequestPageTab(index, overrides, {
        defaultRequestTitle,
        defaultRequestTitleWithIndex: t('collections.workbench.defaultRequestTitleWithIndex', {
          index,
        }),
        defaultHeaderDescription: t('collections.workbench.editors.defaultHeaderDescription'),
        defaultScripts: t('collections.workbench.scripts.defaultScript'),
      }),
    [defaultRequestTitle, t]
  );
  const serverCollections = useMemo(
    () => flattenCollectionTree(collectionTreeQuery.data ?? []),
    [collectionTreeQuery.data]
  );
  const persistedRequestCollectionIds = useMemo(
    () =>
      serverCollections
        .filter(collection => !collection.is_folder)
        .map(collection => collection.id),
    [serverCollections]
  );
  const collectionRequestsQuery = useQuery({
    queryKey: [
      'collections',
      'workspace',
      workspaceId,
      'workbench-requests',
      persistedRequestCollectionIds,
    ],
    queryFn: async () => {
      const entries = await Promise.all(
        persistedRequestCollectionIds.map(async collectionId => {
          try {
            const requests = await fetchAllCollectionRequests(workspaceId, collectionId);
            return [collectionId, requests] as const;
          } catch {
            return [collectionId, []] as const;
          }
        })
      );

      return Object.fromEntries(entries) as Record<string, WorkspaceRequest[]>;
    },
    enabled: collectionTreeQuery.isSuccess && persistedRequestCollectionIds.length > 0,
    staleTime: 60_000,
    placeholderData: previousData => previousData,
  });

  const tabMap = useMemo(() => new Map(tabs.map(tab => [tab.id, tab])), [tabs]);
  const updateCollections = useCallback(
    (updater: CollectionNode[] | ((currentCollections: CollectionNode[]) => CollectionNode[])) => {
      setCollections(current => {
        const nextCollections = typeof updater === 'function' ? updater(current) : updater;
        const normalizedCollections = normalizeCollectionNodes(nextCollections);

        return areCollectionNodesEqual(current, normalizedCollections)
          ? current
          : normalizedCollections;
      });
    },
    []
  );
  const openTabs = useMemo(
    () =>
      openTabIds
        .map(tabId => tabMap.get(tabId))
        .filter((tab): tab is RequestPageTab => Boolean(tab)),
    [openTabIds, tabMap]
  );
  const activeTab = useMemo(
    () => (activeTabId ? (tabMap.get(activeTabId) ?? null) : (openTabs[0] ?? null)),
    [activeTabId, openTabs, tabMap]
  );
  const persistedActiveCollectionId = useMemo(() => {
    if (!activeTab?.collectionId || !isPersistedCollectionId(activeTab.collectionId)) {
      return null;
    }

    return activeTab.collectionId;
  }, [activeTab?.collectionId]);
  const persistedActiveRequestId = useMemo(
    () => (activeTab ? getPersistedRequestId(activeTab.id) : null),
    [activeTab]
  );
  const examplesQuery = useRequestExamples(
    persistedActiveCollectionId && persistedActiveRequestId
      ? {
          workspaceId: workspaceId,
          collectionId: persistedActiveCollectionId,
          requestId: persistedActiveRequestId,
        }
      : undefined
  );
  const requestExamples = useMemo(
    () =>
      [...(examplesQuery.data ?? [])].sort((left, right) => {
        if (left.is_default !== right.is_default) {
          return left.is_default ? -1 : 1;
        }

        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order;
        }

        return String(left.id).localeCompare(String(right.id));
      }),
    [examplesQuery.data]
  );
  const selectedExampleId = viewingExampleId ?? editingExampleId;
  const exampleDetailQuery = useRequestExample(
    persistedActiveCollectionId && persistedActiveRequestId && selectedExampleId
      ? {
          workspaceId: workspaceId,
          collectionId: persistedActiveCollectionId,
          requestId: persistedActiveRequestId,
          exampleId: selectedExampleId,
        }
      : undefined
  );
  const selectedExample = useMemo(() => {
    if (!selectedExampleId) {
      return null;
    }

    return (
      exampleDetailQuery.data ??
      requestExamples.find(example => String(example.id) === String(selectedExampleId)) ??
      null
    );
  }, [exampleDetailQuery.data, requestExamples, selectedExampleId]);
  const scratchpadTabs = useMemo(() => tabs.filter(tab => !tab.collectionId), [tabs]);

  const collectionViews = useMemo(() => {
    const normalizedQuery = deferredSidebarQuery.trim().toLowerCase();

    return collections.reduce<Array<{ collection: CollectionNode; requests: RequestPageTab[] }>>(
      (accumulator, collection) => {
        const requests = collection.requestIds
          .map(requestId => tabMap.get(requestId))
          .filter((request): request is RequestPageTab => Boolean(request));

        if (!normalizedQuery) {
          accumulator.push({ collection, requests });
          return accumulator;
        }

        const collectionMatches = collection.name.toLowerCase().includes(normalizedQuery);
        const requestMatches = requests.filter(request =>
          [request.title, request.url, request.method].some(value =>
            value.toLowerCase().includes(normalizedQuery)
          )
        );

        if (collectionMatches || requestMatches.length > 0) {
          accumulator.push({
            collection,
            requests: collectionMatches ? requests : requestMatches,
          });
        }

        return accumulator;
      },
      []
    );
  }, [collections, deferredSidebarQuery, tabMap]);

  const visibleScratchpadTabs = useMemo(() => {
    const normalizedQuery = deferredSidebarQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return scratchpadTabs;
    }

    return scratchpadTabs.filter(tab =>
      [tab.title, tab.url, tab.method].some(value => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSidebarQuery, scratchpadTabs]);

  const updateTab = (tabId: string, updater: (tab: RequestPageTab) => RequestPageTab) => {
    setTabs(current => current.map(tab => (tab.id === tabId ? updater(tab) : tab)));
  };

  const refreshWorkbenchFromServer = useCallback(async () => {
    const treeNodes = await fetchAllWorkspaceCollections(workspaceId);
    const flattenedCollections = flattenCollectionTree(treeNodes);
    const requestEntries = await Promise.all(
      flattenedCollections
        .filter(collection => !collection.is_folder)
        .map(async collection => {
          try {
            const requests = await fetchAllCollectionRequests(workspaceId, collection.id);
            return [collection.id, requests] as const;
          } catch {
            return [collection.id, []] as const;
          }
        })
    );
    const requestsByCollectionId = Object.fromEntries(requestEntries) as Record<
      string,
      WorkspaceRequest[]
    >;
    const nextState = buildWorkbenchStateFromServer(treeNodes, requestsByCollectionId);

    updateCollections(current => {
      const mergedCollections = mergeServerCollections(current, nextState.collections);
      return mergedCollections;
    });
    setTabs(current => {
      const mergedTabs = mergeServerTabs(current, nextState.tabs);
      return areTabsEquivalent(current, mergedTabs) ? current : mergedTabs;
    });
    setOpenTabIds(current => (current.length > 0 ? current : nextState.openTabIds));
    setActiveTabId(current => current ?? nextState.activeTabId);
    setActiveCollectionId(current => current ?? nextState.activeCollectionId);
    setExpandedCollectionIds(current => {
      const mergedIds = mergeExpandedCollectionIds(current, nextState.expandedCollectionIds);
      return areStringArraysEqual(current, mergedIds) ? current : mergedIds;
    });
    setNextTabIndex(current => Math.max(current, nextState.nextTabIndex));
  }, [updateCollections, workspaceId]);

  useEffect(() => {
    if (!collectionTreeQuery.isSuccess) {
      return;
    }

    const nextCollections = buildWorkbenchStateFromServer(
      serverCollections,
      collectionRequestsQuery.data ?? {}
    ).collections;

    updateCollections(current => {
      const mergedCollections = mergeServerCollections(current, nextCollections);
      return mergedCollections;
    });
    setActiveCollectionId(current => current ?? nextCollections[0]?.id ?? null);
    setExpandedCollectionIds(current => {
      const mergedIds = mergeExpandedCollectionIds(
        current,
        nextCollections.map(collection => collection.id)
      );
      return areStringArraysEqual(current, mergedIds) ? current : mergedIds;
    });
  }, [
    collectionRequestsQuery.data,
    collectionTreeQuery.isSuccess,
    serverCollections,
    updateCollections,
  ]);

  useEffect(() => {
    const hasPersistedRequestTabs = tabs.some(tab => getPersistedRequestId(tab.id) !== null);

    if (
      !collectionTreeQuery.isSuccess ||
      !collectionRequestsQuery.isSuccess ||
      hasPersistedRequestTabs
    ) {
      return;
    }

    const nextState = buildWorkbenchStateFromServer(
      serverCollections,
      collectionRequestsQuery.data ?? {}
    );

    setTabs(current => {
      const mergedTabs = mergeServerTabs(current, nextState.tabs);
      return areTabsEquivalent(current, mergedTabs) ? current : mergedTabs;
    });
    setOpenTabIds(current => {
      if (current.length > 0) {
        return current;
      }

      return areStringArraysEqual(current, nextState.openTabIds) ? current : nextState.openTabIds;
    });
    setActiveTabId(current => current ?? nextState.activeTabId);
    setActiveCollectionId(current => current ?? nextState.activeCollectionId);
    setExpandedCollectionIds(current => {
      const mergedIds = mergeExpandedCollectionIds(current, nextState.expandedCollectionIds);
      return areStringArraysEqual(current, mergedIds) ? current : mergedIds;
    });
    setNextTabIndex(current => Math.max(current, nextState.nextTabIndex));
  }, [
    collectionRequestsQuery.data,
    collectionRequestsQuery.isSuccess,
    collectionTreeQuery.isSuccess,
    serverCollections,
    tabs,
  ]);

  useEffect(() => {
    setViewingExampleId(null);
    setEditingExampleId(null);
    setDeleteExampleTarget(null);
    setDeletingExampleId(null);
    setExampleRunReport(null);
    setRunningExampleId(null);
    setExampleDraftReview(null);
    setRequestDocGenerationError(null);
  }, [persistedActiveCollectionId, persistedActiveRequestId]);

  useEffect(() => {
    if (environments.length === 0) {
      if (selectedEnvironmentId !== 'none') {
        setSelectedEnvironmentId('none');
      }
      return;
    }

    if (selectedEnvironmentId === '') {
      const preferredEnvironment =
        environments.find(environment => environment.base_url?.trim()) ?? environments[0];
      setSelectedEnvironmentId(String(preferredEnvironment.id));
      return;
    }

    if (selectedEnvironmentId === 'none') {
      return;
    }

    const exists = environments.some(
      environment => String(environment.id) === selectedEnvironmentId
    );
    if (exists) {
      return;
    }

    const preferredEnvironment =
      environments.find(environment => environment.base_url?.trim()) ?? environments[0];
    setSelectedEnvironmentId(String(preferredEnvironment.id));
  }, [environments, selectedEnvironmentId]);

  const updateActiveTab = (updater: (tab: RequestPageTab) => RequestPageTab) => {
    if (!activeTab) {
      return;
    }

    updateTab(activeTab.id, updater);
  };

  const buildCreatePayloadFromTab = (
    tab: RequestPageTab,
    collectionId: string,
    sortOrder: number,
    name = tab.title
  ): CreateRequestRequest => {
    const scripts = toRequestScripts(tab.scripts);

    return {
      collection_id: collectionId,
      name,
      description: '',
      method: tab.method,
      url: tab.url.trim() || PERSISTED_DRAFT_URL_PLACEHOLDER,
      headers: toRequestKeyValues(tab.headersMode, tab.headersRows, tab.headersBulk),
      query_params: toRequestKeyValues(tab.paramsMode, tab.paramsRows, tab.paramsBulk),
      path_params: tab.pathParams,
      body: tab.bodyContent,
      body_type: requestBodyTypeFromMode(tab.bodyMode, tab.bodyContent),
      auth: toRequestAuthConfig(tab.authorizationMode, tab.authorizationValue),
      doc_markdown: tab.docMarkdown,
      doc_markdown_zh: tab.docMarkdownZh,
      doc_markdown_en: tab.docMarkdownEn,
      doc_source: tab.docSource,
      pre_request: scripts.pre_request,
      test: scripts.test,
      sort_order: sortOrder,
    };
  };

  const buildUpdatePayloadFromTab = (
    tab: RequestPageTab,
    name = tab.title
  ): UpdateRequestRequest => {
    const scripts = toRequestScripts(tab.scripts);

    return {
      name,
      description: '',
      method: tab.method,
      url: tab.url.trim() || PERSISTED_DRAFT_URL_PLACEHOLDER,
      headers: toRequestKeyValues(tab.headersMode, tab.headersRows, tab.headersBulk),
      query_params: toRequestKeyValues(tab.paramsMode, tab.paramsRows, tab.paramsBulk),
      path_params: tab.pathParams,
      body: tab.bodyContent,
      body_type: requestBodyTypeFromMode(tab.bodyMode, tab.bodyContent),
      auth: toRequestAuthConfig(tab.authorizationMode, tab.authorizationValue),
      doc_markdown: tab.docMarkdown,
      doc_markdown_zh: tab.docMarkdownZh,
      doc_markdown_en: tab.docMarkdownEn,
      doc_source: tab.docSource,
      pre_request: scripts.pre_request,
      test: scripts.test,
    };
  };

  const buildTransientRequestFromTab = (tab: RequestPageTab): WorkspaceRequest => {
    const scripts = toRequestScripts(tab.scripts);

    return {
      id: tab.id,
      collection_id: tab.collectionId ?? 'quick-request',
      name: getPersistedTabName(tab),
      description: '',
      method: tab.method,
      url: tab.url.trim(),
      headers: toRequestKeyValues(tab.headersMode, tab.headersRows, tab.headersBulk),
      query_params: toRequestKeyValues(tab.paramsMode, tab.paramsRows, tab.paramsBulk),
      path_params: tab.pathParams,
      body: tab.bodyContent,
      body_type: requestBodyTypeFromMode(tab.bodyMode, tab.bodyContent),
      auth: toRequestAuthConfig(tab.authorizationMode, tab.authorizationValue),
      doc_markdown: tab.docMarkdown,
      doc_markdown_zh: tab.docMarkdownZh,
      doc_markdown_en: tab.docMarkdownEn,
      doc_source: tab.docSource,
      pre_request: scripts.pre_request,
      test: scripts.test,
      sort_order: 0,
      created_at: '',
      updated_at: '',
    };
  };

  const syncPersistedRequestInWorkbench = (
    sourceTabId: string,
    persistedRequest: WorkspaceRequest,
    overrides: Partial<Pick<RequestPageTab, 'isSending' | 'response'>> = {}
  ) => {
    const nextTab = toRequestPageTab(persistedRequest);

    setTabs(current =>
      current.map(tab =>
        tab.id === sourceTabId
          ? {
              ...nextTab,
              activeSection: tab.activeSection,
              paramsMode: tab.paramsMode,
              headersMode: tab.headersMode,
              bodyFiles: tab.bodyFiles,
              binaryFile: tab.binaryFile,
              settings: tab.settings,
              isSending: overrides.isSending ?? tab.isSending,
              response: overrides.response ?? tab.response,
            }
          : tab
      )
    );

    if (nextTab.id !== sourceTabId) {
      updateCollections(current =>
        current.map(collection =>
          collection.requestIds.includes(sourceTabId)
            ? {
                ...collection,
                requestIds: collection.requestIds.map(requestId =>
                  requestId === sourceTabId ? nextTab.id : requestId
                ),
              }
            : collection
        )
      );
      setOpenTabIds(current =>
        current.map(requestId => (requestId === sourceTabId ? nextTab.id : requestId))
      );
      setActiveTabId(current => (current === sourceTabId ? nextTab.id : current));
    }

    return nextTab.id;
  };

  const persistTabRequest = async (
    tab: RequestPageTab,
    options: {
      name?: string;
      requireRunnableUrl?: boolean;
    } = {}
  ) => {
    const persistedCollectionId =
      tab.collectionId && isPersistedCollectionId(tab.collectionId) ? tab.collectionId : null;

    if (!persistedCollectionId) {
      throw new Error(t('collections.saveBeforeSend'));
    }

    if (options.requireRunnableUrl) {
      if (!tab.url.trim()) {
        throw new Error(t('collections.enterUrlBeforeSend'));
      }
    }

    const persistedRequestId = getPersistedRequestId(tab.id);
    if (persistedRequestId) {
      return requestService.update(
        workspaceId,
        persistedCollectionId,
        persistedRequestId,
        buildUpdatePayloadFromTab(tab, options.name)
      );
    }

    const targetCollection = collections.find(collection => collection.id === tab.collectionId);
    return requestService.create(
      workspaceId,
      persistedCollectionId,
      buildCreatePayloadFromTab(
        tab,
        persistedCollectionId,
        targetCollection?.requestIds.length ?? 0,
        options.name
      )
    );
  };

  const ensurePersistedRequestForExamples = async (tab: RequestPageTab) => {
    if (!tab.collectionId || !isPersistedCollectionId(tab.collectionId)) {
      throw new Error(t('collections.saveBeforeExamples'));
    }

    const collectionId = tab.collectionId;
    const persistedRequestId = getPersistedRequestId(tab.id);

    if (persistedRequestId) {
      return {
        collectionId,
        requestId: persistedRequestId,
      };
    }

    const persistedRequest = await persistTabRequest(tab, {
      name: getPersistedTabName(tab),
    });

    syncPersistedRequestInWorkbench(tab.id, persistedRequest);

    return {
      collectionId,
      requestId: persistedRequest.id,
    };
  };

  const openCreateExampleDialog = () => {
    if (!activeTab) {
      return;
    }

    if (!activeTab.collectionId || !isPersistedCollectionId(activeTab.collectionId)) {
      toast.error(t('collections.saveBeforeExamples'));
      return;
    }

    setIsExampleDialogOpen(true);
  };

  const openGenerateExamplesDialog = () => {
    if (!activeTab) {
      return;
    }

    if (!activeTab.collectionId || !isPersistedCollectionId(activeTab.collectionId)) {
      toast.error(t('collections.saveBeforeExamples'));
      return;
    }

    setGenerateExamplesDraft(getGenerateExamplesFormDraft());
    setIsGenerateExamplesDialogOpen(true);
  };

  const handleGenerateExamples = async (draft: GenerateExamplesFormDraft) => {
    if (!activeTab || generateExamplesMutation.isPending) {
      return;
    }

    const tabSnapshot = activeTab;
    const count = Math.min(
      MAX_AI_EXAMPLE_COUNT,
      Math.max(MIN_AI_EXAMPLE_COUNT, Math.round(draft.count || DEFAULT_AI_EXAMPLE_COUNT))
    );

    try {
      const persistedRequest = await persistTabRequest(tabSnapshot, {
        name: getPersistedTabName(tabSnapshot),
        requireRunnableUrl: true,
      });
      const collectionId = String(persistedRequest.collection_id);
      const requestId = String(persistedRequest.id);
      syncPersistedRequestInWorkbench(tabSnapshot.id, persistedRequest);
      const result = await generateExamplesMutation.mutateAsync({
        collectionId,
        requestId,
        data: {
          count,
          categories: draft.categories.length > 0 ? draft.categories : AI_EXAMPLE_CATEGORY_OPTIONS,
          instructions: draft.instructions.trim() || undefined,
          preview_only: true,
        },
      });
      setActiveTabId(`request-${requestId}`);
      setExampleRunReport(null);
      setExampleDraftReview({
        collectionId,
        requestId,
        items: (result.drafts ?? []).map(item => ({
          clientId: createLocalId('ai-example-draft'),
          selected: true,
          draft: item,
        })),
      });
      setIsGenerateExamplesDialogOpen(false);
      toast.success(t('collections.workbench.examples.draftsGenerated', { count: result.total }));
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const toggleExampleDraftSelection = (clientId: string) => {
    setExampleDraftReview(current =>
      current
        ? {
            ...current,
            items: current.items.map(item =>
              item.clientId === clientId ? { ...item, selected: !item.selected } : item
            ),
          }
        : current
    );
  };

  const discardExampleDraft = (clientId: string) => {
    setExampleDraftReview(current => {
      if (!current) {
        return current;
      }
      const items = current.items.filter(item => item.clientId !== clientId);
      return items.length > 0 ? { ...current, items } : null;
    });
  };

  const clearExampleDraftReview = () => {
    setExampleDraftReview(null);
  };

  const acceptSelectedExampleDrafts = async () => {
    if (!exampleDraftReview || isAcceptingExampleDrafts) {
      return;
    }

    const selectedItems = exampleDraftReview.items.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error(t('collections.workbench.examples.noDraftsSelected'));
      return;
    }

    try {
      setIsAcceptingExampleDrafts(true);
      for (const item of selectedItems) {
        await createExampleMutation.mutateAsync({
          collectionId: exampleDraftReview.collectionId,
          requestId: exampleDraftReview.requestId,
          data: toCreateExamplePayloadFromDraft(item.draft),
        });
      }
      setExampleDraftReview(current => {
        if (!current) {
          return current;
        }
        const acceptedIds = new Set(selectedItems.map(item => item.clientId));
        const remaining = current.items.filter(item => !acceptedIds.has(item.clientId));
        return remaining.length > 0 ? { ...current, items: remaining } : null;
      });
      setActiveTabId(`request-${exampleDraftReview.requestId}`);
      toast.success(
        t('collections.workbench.examples.draftsAccepted', { count: selectedItems.length })
      );
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setIsAcceptingExampleDrafts(false);
    }
  };

  const handleCreateExample = async (draft: ExampleFormDraft) => {
    if (!activeTab) {
      return;
    }

    const tabSnapshot = activeTab;

    try {
      const { collectionId, requestId } = await ensurePersistedRequestForExamples(tabSnapshot);
      const createdExample = await createExampleMutation.mutateAsync({
        collectionId,
        requestId,
        data: toCreateExamplePayload(tabSnapshot, draft),
      });
      const responsePayload = toSaveExampleResponsePayload(tabSnapshot.response);

      if (responsePayload) {
        await saveExampleResponseMutation.mutateAsync({
          collectionId,
          requestId,
          exampleId: createdExample.id,
          data: responsePayload,
        });
      }

      setIsExampleDialogOpen(false);
      setActiveTabId(`request-${requestId}`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleApplyExample = (example: RequestExample) => {
    if (!activeTab) {
      return;
    }

    updateActiveTab(tab => applyExampleToTab(tab, example));
    toast.success(t('collections.applyExample', { name: example.name }));
  };

  const handleSaveLatestResponseToExample = async (example: RequestExample) => {
    if (!activeTab) {
      return;
    }

    const responsePayload = toSaveExampleResponsePayload(activeTab.response);
    if (!responsePayload) {
      toast.error(t('collections.sendBeforeCapture'));
      return;
    }

    try {
      setSavingResponseExampleId(example.id);
      const { collectionId, requestId } = await ensurePersistedRequestForExamples(activeTab);
      await saveExampleResponseMutation.mutateAsync({
        collectionId,
        requestId,
        exampleId: example.id,
        data: responsePayload,
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setSavingResponseExampleId(null);
    }
  };

  const handleSetDefaultExample = async (example: RequestExample) => {
    if (!activeTab) {
      return;
    }

    try {
      setDefaultingExampleId(example.id);
      const { collectionId, requestId } = await ensurePersistedRequestForExamples(activeTab);
      await setDefaultExampleMutation.mutateAsync({
        collectionId,
        requestId,
        exampleId: example.id,
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setDefaultingExampleId(null);
    }
  };

  const handleRunAllExamples = async () => {
    if (!activeTab || isRunningExamples) {
      return;
    }

    if (requestExamples.length === 0) {
      toast.error(t('collections.workbench.examples.runAllEmpty'));
      return;
    }

    const tabSnapshot = activeTab;
    const reportId = createLocalId('example-run');
    const startedAt = new Date().toISOString();
    const results: ExampleRunResult[] = [];

    setIsRunningExamples(true);
    setRunningExampleId(null);
    setExampleRunReport(buildExampleRunReport(reportId, startedAt, [], startedAt));

    try {
      if (tabSnapshot.settings.persistCookies) {
        throw new Error(t('collections.workbench.persistCookiesUnavailable'));
      }

      const persistedRequest = await persistTabRequest(tabSnapshot, {
        requireRunnableUrl: true,
      });
      syncPersistedRequestInWorkbench(tabSnapshot.id, persistedRequest);

      for (const example of requestExamples) {
        setRunningExampleId(example.id);

        try {
          const runnableRequest = buildRunnableRequestFromExample(persistedRequest, example);
          const exampleTab = applyExampleToTab(tabSnapshot, example);
          const executableUrl = buildExecutableRequestUrl(runnableRequest, selectedEnvironment, t);
          const executableHeaders = headersToObject(
            buildDirectRequestHeaders(
              runnableRequest,
              selectedEnvironment,
              t('collections.base64Unavailable')
            )
          );
          const runnerPayload = buildDirectRequestPayload(
            runnableRequest,
            exampleTab,
            t,
            selectedEnvironment
          );
          delete runnerPayload.historyBody;
          const response = await localRunnerService.execute({
            method: runnableRequest.method,
            url: executableUrl,
            headers: executableHeaders,
            ...runnerPayload,
            follow_redirects: tabSnapshot.settings.followRedirects,
            strict_tls: tabSnapshot.settings.strictTls,
          });
          const assertionResults = evaluateExampleAssertions(example, response);

          results.push({
            id: createLocalId('example-result'),
            exampleId: example.id,
            exampleName: example.name,
            method: runnableRequest.method,
            url: executableUrl,
            status: getExampleRunStatus(example, response, assertionResults),
            expectedStatus: getExampleExpectedStatus(example),
            actualStatus: response.status,
            durationMs: response.time,
            sizeBytes: response.size || byteLength(response.body),
            responseBody: formatResponseBody(response.body),
            assertions: assertionResults,
            error: null,
            completedAt: new Date().toISOString(),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t('collections.workbench.unableToSend');

          results.push({
            id: createLocalId('example-result'),
            exampleId: example.id,
            exampleName: example.name,
            method: example.method,
            url: example.url,
            status: 'error',
            expectedStatus: getExampleExpectedStatus(example),
            actualStatus: null,
            durationMs: null,
            sizeBytes: null,
            responseBody: '',
            assertions: [],
            error: message,
            completedAt: new Date().toISOString(),
          });
        }

        setExampleRunReport(buildExampleRunReport(reportId, startedAt, [...results]));
      }

      const finishedReport = buildExampleRunReport(reportId, startedAt, results);
      setExampleRunReport(finishedReport);
      toast.success(
        t('collections.workbench.examples.runAllFinished', {
          total: finishedReport.total,
          passed: finishedReport.passed,
          failed: finishedReport.failed,
          errored: finishedReport.errored,
        })
      );
    } catch (error) {
      setExampleRunReport(null);
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setIsRunningExamples(false);
      setRunningExampleId(null);
    }
  };

  const openViewExampleDialog = (example: RequestExample) => {
    setEditingExampleId(null);
    setViewingExampleId(example.id);
  };

  const closeViewExampleDialog = (open: boolean) => {
    if (!open) {
      setViewingExampleId(null);
    }
  };

  const openEditExampleDialog = (example: RequestExample) => {
    setViewingExampleId(null);
    setEditingExampleId(example.id);
  };

  const closeEditExampleDialog = (open: boolean) => {
    if (!open) {
      setEditingExampleId(null);
    }
  };

  const openDeleteExampleDialog = (example: RequestExample) => {
    setViewingExampleId(null);
    setEditingExampleId(null);
    setDeleteExampleTarget(example);
  };

  const closeDeleteExampleDialog = (open: boolean) => {
    if (!open) {
      setDeleteExampleTarget(null);
      setDeletingExampleId(null);
    }
  };

  const handleUpdateExample = async (draft: ExampleFormDraft) => {
    if (editingExampleId === null || !persistedActiveCollectionId || !persistedActiveRequestId) {
      toast.error(t('collections.selectExampleBeforeEdit'));
      return;
    }

    try {
      await updateExampleMutation.mutateAsync({
        collectionId: persistedActiveCollectionId,
        requestId: persistedActiveRequestId,
        exampleId: editingExampleId,
        data: toUpdateExamplePayload(draft),
      });
      setEditingExampleId(null);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleDeleteExample = async () => {
    if (!deleteExampleTarget || !persistedActiveCollectionId || !persistedActiveRequestId) {
      return;
    }

    try {
      setDeletingExampleId(deleteExampleTarget.id);
      await deleteExampleMutation.mutateAsync({
        collectionId: persistedActiveCollectionId,
        requestId: persistedActiveRequestId,
        exampleId: deleteExampleTarget.id,
      });
      setDeleteExampleTarget(null);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setDeletingExampleId(null);
    }
  };

  const createCollection = async () => {
    if (!workspaceId || createCollectionMutation.isPending) {
      return;
    }

    try {
      const collectionNumber = collections.length + 1;
      const createdCollection = await createCollectionMutation.mutateAsync({
        name: getDefaultCollectionName(t, collectionNumber),
        description: '',
        is_folder: false,
        sort_order: collections.length,
      });
      const nextCollection: CollectionNode = {
        id: String(createdCollection.id),
        name: createdCollection.name,
        colorTone: getCollectionColorTone(collectionNumber - 1),
        isFolder: createdCollection.is_folder,
        requestIds: [],
      };

      updateCollections(current => [nextCollection, ...current]);
      setExpandedCollectionIds(current =>
        current.includes(nextCollection.id) ? current : [nextCollection.id, ...current]
      );
      setActiveCollectionId(nextCollection.id);
    } catch {}
  };

  const openCollectionImportDialog = (collection: CollectionNode, kind: ImportDialogKind) => {
    if (!collection.isFolder) {
      toast.error(t('collections.importTargetInvalid'));
      return;
    }

    setImportDialogTarget({
      kind,
      parentCollectionId: collection.id,
      parentCollectionName: collection.name,
    });
    setImportFile(null);
  };

  const openRootImportDialog = (kind: ImportDialogKind) => {
    setImportDialogTarget({
      kind,
      parentCollectionId: null,
      parentCollectionName: null,
    });
    setImportFile(null);
  };

  const closeImportDialog = (open: boolean) => {
    if (!open) {
      setImportDialogTarget(null);
      setImportFile(null);
    }
  };

  const handleImportCollection = async () => {
    if (!importDialogTarget) {
      return;
    }

    if (!importFile) {
      toast.error(
        importDialogTarget.kind === 'markdown'
          ? t('collections.chooseMarkdownFile')
          : t('collections.choosePostmanFile')
      );
      return;
    }

    const payload: ImportPostmanCollectionRequest | ImportMarkdownCollectionRequest = {
      file: importFile,
    };

    if (importDialogTarget.parentCollectionId) {
      const targetCollection = collections.find(
        collection => collection.id === importDialogTarget.parentCollectionId
      );

      if (!targetCollection?.isFolder) {
        toast.error(t('collections.importTargetInvalid'));
        return;
      }

      if (!isPersistedCollectionId(importDialogTarget.parentCollectionId)) {
        toast.error(t('collections.saveTargetBeforeImport'));
        return;
      }

      payload.parent_id = importDialogTarget.parentCollectionId;
    }

    try {
      if (importDialogTarget.kind === 'markdown') {
        await importMarkdownMutation.mutateAsync({
          ...(payload as ImportMarkdownCollectionRequest),
          base_url_override: selectedEnvironmentBaseUrl || undefined,
        });
      } else {
        await importPostmanMutation.mutateAsync(payload as ImportPostmanCollectionRequest);
      }
      await refreshWorkbenchFromServer();

      if (importDialogTarget.parentCollectionId) {
        setExpandedCollectionIds(current =>
          current.includes(importDialogTarget.parentCollectionId as string)
            ? current
            : [...current, importDialogTarget.parentCollectionId as string]
        );
      }

      closeImportDialog(false);
    } catch {}
  };

  const removeCollectionFromWorkbench = (collectionId: string) => {
    const targetCollection = collections.find(collection => collection.id === collectionId);
    if (!targetCollection) {
      return;
    }

    const removedTabIds = new Set(targetCollection.requestIds);
    const remainingCollections = collections.filter(collection => collection.id !== collectionId);
    const remainingTabs = tabs.filter(tab => tab.collectionId !== collectionId);
    const nextOpenTabIds = openTabIds.filter(tabId => !removedTabIds.has(tabId));
    const nextActiveTabId = resolveNextActiveTabId(openTabIds, nextOpenTabIds, activeTabId);

    startTransition(() => {
      updateCollections(remainingCollections);
      setTabs(remainingTabs);
      setOpenTabIds(nextOpenTabIds);
      setExpandedCollectionIds(current => current.filter(id => id !== collectionId));
      setActiveCollectionId(current =>
        current === collectionId ? (remainingCollections[0]?.id ?? null) : current
      );
      setActiveTabId(nextActiveTabId);
    });
  };

  const closeDeleteCollectionDialog = (open: boolean) => {
    if (!open && !deletingCollectionId) {
      setDeleteCollectionTarget(null);
    }
  };

  const handleDeleteCollection = async () => {
    const collection = deleteCollectionTarget;

    if (!collection || deletingCollectionId) {
      return;
    }

    setDeletingCollectionId(collection.id);

    try {
      if (isPersistedCollectionId(collection.id)) {
        await deleteCollectionMutation.mutateAsync(collection.id);
      }

      removeCollectionFromWorkbench(collection.id);
      setDeleteCollectionTarget(null);
    } catch {
    } finally {
      setDeletingCollectionId(null);
    }
  };

  const openRenameCollectionDialog = (collection: CollectionNode) => {
    setRenameDialogCollectionId(collection.id);
    setRenameDraftName(collection.name);
  };

  const closeRenameCollectionDialog = (open: boolean) => {
    if (!open) {
      setRenameDialogCollectionId(null);
      setRenameDraftName('');
    }
  };

  const openRenameRequestDialog = (request: RequestPageTab) => {
    setRenameDialogRequestTabId(request.id);
    setRenameRequestDraftName(request.title);
  };

  const closeRenameRequestDialog = (open: boolean) => {
    if (!open) {
      setRenameDialogRequestTabId(null);
      setRenameRequestDraftName('');
    }
  };

  const closeDeleteRequestDialog = (open: boolean) => {
    if (!open && !deletingRequestTabId) {
      setDeleteRequestTarget(null);
    }
  };

  const handleRenameCollection = async () => {
    if (!renameDialogCollectionId || renamingCollectionId) {
      return;
    }

    const nextName = renameDraftName.trim();
    if (!nextName) {
      return;
    }

    const targetCollection = collections.find(
      collection => collection.id === renameDialogCollectionId
    );
    if (!targetCollection) {
      closeRenameCollectionDialog(false);
      return;
    }

    setRenamingCollectionId(targetCollection.id);

    try {
      if (isPersistedCollectionId(targetCollection.id)) {
        await updateCollectionMutation.mutateAsync({
          collectionId: targetCollection.id,
          data: { name: nextName },
        });
      }

      startTransition(() => {
        updateCollections(current =>
          current.map(collection =>
            collection.id === targetCollection.id ? { ...collection, name: nextName } : collection
          )
        );
      });
      closeRenameCollectionDialog(false);
    } catch {
    } finally {
      setRenamingCollectionId(null);
    }
  };

  const toggleCollection = (collectionId: string) => {
    setActiveCollectionId(collectionId);
    setExpandedCollectionIds(current =>
      current.includes(collectionId)
        ? current.filter(id => id !== collectionId)
        : [...current, collectionId]
    );
  };

  const selectRequest = (tabId: string, collectionId: string | null) => {
    setActiveTabId(tabId);
    setOpenTabIds(current => (current.includes(tabId) ? current : [...current, tabId]));

    if (collectionId) {
      setActiveCollectionId(collectionId);
      setExpandedCollectionIds(current =>
        current.includes(collectionId) ? current : [...current, collectionId]
      );
    }
  };

  const renameRequestInWorkbench = (tabId: string, nextName: string) => {
    startTransition(() => {
      setTabs(current =>
        current.map(tab => (tab.id === tabId ? { ...tab, title: nextName } : tab))
      );
    });
  };

  const removeRequestFromWorkbench = (tabId: string) => {
    const nextOpenTabIds = openTabIds.filter(id => id !== tabId);
    const nextActiveTabId = resolveNextActiveTabId(openTabIds, nextOpenTabIds, activeTabId);

    startTransition(() => {
      setTabs(current => current.filter(tab => tab.id !== tabId));
      updateCollections(current =>
        current.map(collection =>
          collection.requestIds.includes(tabId)
            ? {
                ...collection,
                requestIds: collection.requestIds.filter(requestId => requestId !== tabId),
              }
            : collection
        )
      );
      setOpenTabIds(nextOpenTabIds);
      setActiveTabId(nextActiveTabId);
    });
  };

  const handleDuplicateTab = () => {
    if (!activeTab) {
      return;
    }

    duplicateTab(activeTab.id);
  };

  const duplicateTab = (sourceTabId: string) => {
    const sourceTab = tabs.find(tab => tab.id === sourceTabId);
    if (!sourceTab) {
      return;
    }

    const duplicatedTab: RequestPageTab = {
      ...sourceTab,
      id: createLocalId('request-tab'),
      title: t('collections.workbench.copyTitle', { title: sourceTab.title }),
      response: createEmptyResponse(),
      isSending: false,
      paramsRows: sourceTab.paramsRows.map(row => ({ ...row, id: createLocalId('kv') })),
      headersRows: sourceTab.headersRows.map(row => ({ ...row, id: createLocalId('kv') })),
    };

    startTransition(() => {
      setTabs(current => [...current, duplicatedTab]);
      setOpenTabIds(current => [...current, duplicatedTab.id]);

      if (duplicatedTab.collectionId) {
        updateCollections(current =>
          current.map(collection =>
            collection.id === duplicatedTab.collectionId
              ? {
                  ...collection,
                  requestIds: [duplicatedTab.id, ...collection.requestIds],
                }
              : collection
          )
        );
      }

      if (duplicatedTab.collectionId) {
        setActiveCollectionId(duplicatedTab.collectionId);
      }

      setActiveTabId(duplicatedTab.id);
      setNextTabIndex(current => current + 1);
    });
  };

  const handleSaveTab = async () => {
    if (!activeTab) {
      return;
    }

    const nextName = getPersistedTabName(activeTab);
    const tabSnapshot = {
      ...activeTab,
      title: nextName,
    };

    updateTab(activeTab.id, tab => ({
      ...tab,
      title: nextName,
    }));

    if (!tabSnapshot.collectionId || !isPersistedCollectionId(tabSnapshot.collectionId)) {
      return;
    }

    try {
      const persistedRequest = await persistTabRequest(tabSnapshot, { name: nextName });
      syncPersistedRequestInWorkbench(activeTab.id, persistedRequest);
    } catch {}
  };

  const handleGenerateRequestDoc = async (lang: ApiSpecLanguage) => {
    if (!activeTab) {
      return;
    }

    setRequestDocGenerationError(null);
    setGeneratingRequestDocLang(lang);

    const nextName = getPersistedTabName(activeTab);
    const tabSnapshot = {
      ...activeTab,
      title: nextName,
    };

    if (!tabSnapshot.collectionId || !isPersistedCollectionId(tabSnapshot.collectionId)) {
      const message = t('collections.workbench.docs.saveBeforeGenerate');
      setRequestDocGenerationError(message);
      setGeneratingRequestDocLang(null);
      toast.error(message);
      return;
    }

    try {
      const persistedRequest = await persistTabRequest(tabSnapshot, { name: nextName });
      const sourceTabId = syncPersistedRequestInWorkbench(activeTab.id, persistedRequest);
      const persistedRequestId = getPersistedRequestId(sourceTabId);
      if (!persistedRequestId) {
        throw new Error(t('collections.workbench.docs.requestIdMissing'));
      }

      const generatedRequest = await genRequestDocMutation.mutateAsync({
        collectionId: tabSnapshot.collectionId,
        requestId: persistedRequestId,
        lang,
      });
      syncPersistedRequestInWorkbench(sourceTabId, generatedRequest);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('collections.workbench.docs.generateFailed');
      setRequestDocGenerationError(message);
      toast.error(message);
    } finally {
      setGeneratingRequestDocLang(null);
    }
  };

  const handleSend = async () => {
    if (!activeTab) {
      return;
    }

    const tabSnapshot = activeTab;
    let tabId = activeTab.id;
    let persistedRequest: WorkspaceRequest | null = null;
    let runnableRequest: WorkspaceRequest | null = null;
    let executableUrl = '';
    let executableHeaders: Record<string, string> = {};
    let executablePayload: DirectRequestExecutionPayload = {};
    let historyRequestBody: string | undefined;

    updateTab(tabId, tab => ({
      ...tab,
      isSending: true,
      response: {
        ...tab.response,
        error: null,
      },
    }));

    try {
      const persistedCollectionId =
        tabSnapshot.collectionId && isPersistedCollectionId(tabSnapshot.collectionId)
          ? tabSnapshot.collectionId
          : null;

      if (persistedCollectionId) {
        persistedRequest = await persistTabRequest(tabSnapshot, {
          requireRunnableUrl: true,
        });
        tabId = syncPersistedRequestInWorkbench(tabId, persistedRequest, {
          isSending: true,
        });
        runnableRequest = persistedRequest;
      } else {
        if (!tabSnapshot.url.trim()) {
          throw new Error(t('collections.enterUrlBeforeSend'));
        }

        runnableRequest = buildTransientRequestFromTab(tabSnapshot);
      }

      if (tabSnapshot.settings.persistCookies) {
        throw new Error(t('collections.workbench.persistCookiesUnavailable'));
      }

      executableUrl = buildExecutableRequestUrl(runnableRequest, selectedEnvironment, t);
      executableHeaders = headersToObject(
        buildDirectRequestHeaders(
          runnableRequest,
          selectedEnvironment,
          t('collections.base64Unavailable')
        )
      );
      executablePayload = buildDirectRequestPayload(
        runnableRequest,
        tabSnapshot,
        t,
        selectedEnvironment
      );
      const { historyBody: nextHistoryBody, ...runnerPayload } = executablePayload;
      historyRequestBody = nextHistoryBody;
      const response = await localRunnerService.execute({
        method: runnableRequest.method,
        url: executableUrl,
        headers: executableHeaders,
        ...runnerPayload,
        follow_redirects: tabSnapshot.settings.followRedirects,
        strict_tls: tabSnapshot.settings.strictTls,
      });

      updateTab(tabId, tab => ({
        ...tab,
        isSending: false,
        response: toResponseDraft(response),
      }));

      if (persistedRequest) {
        void createHistoryMutation
          .mutateAsync(
            buildRequestRunHistoryPayload({
              request: persistedRequest,
              executedUrl: executableUrl,
              requestHeaders: executableHeaders,
              requestBody: historyRequestBody,
              settings: tabSnapshot.settings,
              response,
              messages: {
                executed: (requestLabel, status) =>
                  status
                    ? t('collections.workbench.historyExecutedWithStatus', {
                        label: requestLabel,
                        status,
                      })
                    : t('collections.workbench.historyExecuted', { label: requestLabel }),
                failed: (requestLabel, message) =>
                  t('collections.workbench.historyFailed', {
                    label: requestLabel,
                    error: message,
                  }),
              },
            })
          )
          .catch(() => {});
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('collections.workbench.unableToSend');

      updateTab(tabId, tab => ({
        ...tab,
        isSending: false,
        response: {
          ...createEmptyResponse(),
          error: message,
        },
      }));

      if (persistedRequest) {
        if (!executableUrl) {
          executableUrl = buildExecutableRequestUrl(persistedRequest, selectedEnvironment, t);
          executableHeaders = headersToObject(
            buildDirectRequestHeaders(
              persistedRequest,
              selectedEnvironment,
              t('collections.base64Unavailable')
            )
          );
          executablePayload = buildDirectRequestPayload(
            persistedRequest,
            tabSnapshot,
            t,
            selectedEnvironment
          );
          historyRequestBody = executablePayload.historyBody;
        }

        void createHistoryMutation
          .mutateAsync(
            buildRequestRunHistoryPayload({
              request: persistedRequest,
              executedUrl: executableUrl,
              requestHeaders: executableHeaders,
              requestBody: historyRequestBody,
              settings: tabSnapshot.settings,
              errorMessage: message,
              messages: {
                executed: (requestLabel, status) =>
                  status
                    ? t('collections.workbench.historyExecutedWithStatus', {
                        label: requestLabel,
                        status,
                      })
                    : t('collections.workbench.historyExecuted', { label: requestLabel }),
                failed: (requestLabel, errorText) =>
                  t('collections.workbench.historyFailed', {
                    label: requestLabel,
                    error: errorText,
                  }),
              },
            })
          )
          .catch(() => {});
      }
    }
  };

  const attachRequestTabToCollection = (collectionId: string, tab: RequestPageTab) => {
    startTransition(() => {
      setTabs(current => [...current, tab]);
      setOpenTabIds(current => [...current, tab.id]);
      updateCollections(current =>
        current.map(collection =>
          collection.id === collectionId
            ? {
                ...collection,
                requestIds: [tab.id, ...collection.requestIds],
              }
            : collection
        )
      );
      setExpandedCollectionIds(current =>
        current.includes(collectionId) ? current : [...current, collectionId]
      );
      setActiveCollectionId(collectionId);
      setActiveTabId(tab.id);
      setNextTabIndex(current => current + 1);
    });
  };

  const createScratchpadRequest = useCallback(() => {
    const nextTab = createDraftTab(nextTabIndex, {
      id: createLocalId('request-tab'),
      collectionId: null,
    });

    startTransition(() => {
      setTabs(current => [...current, nextTab]);
      setOpenTabIds(current => [...current, nextTab.id]);
      setActiveTabId(nextTab.id);
      setNextTabIndex(current => current + 1);
    });
  }, [createDraftTab, nextTabIndex]);

  useEffect(() => {
    if (searchParams.get('quickRequest') !== '1' || quickRequestIntentConsumedRef.current) {
      return;
    }

    quickRequestIntentConsumedRef.current = true;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('quickRequest');

    const nextHref = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;

    window.history.replaceState(window.history.state, '', nextHref);
    createScratchpadRequest();
  }, [createScratchpadRequest, pathname, searchParams]);

  const handleCloseTab = (tabId: string) => {
    const nextOpenTabIds = openTabIds.filter(id => id !== tabId);
    const nextActiveTabId = resolveNextActiveTabId(openTabIds, nextOpenTabIds, activeTabId);

    startTransition(() => {
      setOpenTabIds(nextOpenTabIds);
      setActiveTabId(nextActiveTabId);
    });
  };

  const handleCloseOtherTabs = (tabId: string) => {
    if (!openTabIds.includes(tabId)) {
      return;
    }

    startTransition(() => {
      setOpenTabIds([tabId]);
      setActiveTabId(tabId);
    });
  };

  const handleCloseAllTabs = () => {
    startTransition(() => {
      setOpenTabIds([]);
      setActiveTabId(null);
    });
  };

  const handleReorderOpenTabs = (activeId: string, overId: string) => {
    if (activeId === overId) {
      return;
    }

    setOpenTabIds(current => {
      const activeIndex = current.indexOf(activeId);
      const overIndex = current.indexOf(overId);

      if (activeIndex === -1 || overIndex === -1) {
        return current;
      }

      return arrayMove(current, activeIndex, overIndex);
    });
  };

  const handleRenameRequest = async () => {
    if (!renameDialogRequestTabId || renamingRequestTabId) {
      return;
    }

    const nextName = renameRequestDraftName.trim();
    if (!nextName) {
      return;
    }

    const targetRequest = tabs.find(tab => tab.id === renameDialogRequestTabId);
    if (!targetRequest) {
      closeRenameRequestDialog(false);
      return;
    }

    setRenamingRequestTabId(targetRequest.id);

    try {
      const persistedCollectionId =
        targetRequest.collectionId && isPersistedCollectionId(targetRequest.collectionId)
          ? targetRequest.collectionId
          : null;
      const persistedRequestId = getPersistedRequestId(targetRequest.id);

      if (persistedCollectionId && persistedRequestId) {
        await updateRequestMutation.mutateAsync({
          collectionId: persistedCollectionId,
          requestId: persistedRequestId,
          data: { name: nextName },
        });
      }

      renameRequestInWorkbench(targetRequest.id, nextName);
      closeRenameRequestDialog(false);
    } catch {
    } finally {
      setRenamingRequestTabId(null);
    }
  };

  const handleDeleteRequest = async () => {
    const request = deleteRequestTarget;

    if (!request || deletingRequestTabId) {
      return;
    }

    setDeletingRequestTabId(request.id);

    try {
      const persistedCollectionId =
        request.collectionId && isPersistedCollectionId(request.collectionId)
          ? request.collectionId
          : null;
      const persistedRequestId = getPersistedRequestId(request.id);

      if (persistedCollectionId && persistedRequestId) {
        await deleteRequestMutation.mutateAsync({
          collectionId: persistedCollectionId,
          requestId: persistedRequestId,
        });
      }

      removeRequestFromWorkbench(request.id);
      setDeleteRequestTarget(null);
    } catch {
    } finally {
      setDeletingRequestTabId(null);
    }
  };

  const handleCreateRequest = async (collection: CollectionNode) => {
    if (creatingRequestCollectionId) {
      return;
    }

    const localTab = createDraftTab(nextTabIndex, {
      title: getDefaultRequestTitle(t, nextTabIndex),
      collectionId: collection.id,
      url: DEFAULT_NEW_REQUEST_URL,
    });

    if (!isPersistedCollectionId(collection.id)) {
      attachRequestTabToCollection(collection.id, localTab);
      return;
    }

    setCreatingRequestCollectionId(collection.id);

    try {
      const persistedCollectionId = collection.id;
      const createdRequest = await createRequestMutation.mutateAsync({
        collectionId: persistedCollectionId,
        data: buildCreatePayloadFromTab(
          localTab,
          persistedCollectionId,
          collection.requestIds.length,
          getDefaultRequestTitle(t, nextTabIndex)
        ),
      });

      attachRequestTabToCollection(collection.id, toRequestPageTab(createdRequest));
    } catch {
    } finally {
      setCreatingRequestCollectionId(null);
    }
  };

  const canCreateExamples =
    Boolean(activeTab?.collectionId) &&
    Boolean(activeTab?.collectionId && isPersistedCollectionId(activeTab.collectionId));
  const requestIsPersisted = persistedActiveRequestId !== null;
  const activeResponseCanBeCaptured = activeTab ? canCaptureResponse(activeTab.response) : false;
  const isImportingPostmanRoot =
    importPostmanMutation.isPending && importDialogTarget?.parentCollectionId === null;
  const isImportingMarkdownRoot =
    importMarkdownMutation.isPending && importDialogTarget?.parentCollectionId === null;
  const isAnyImportPending = importPostmanMutation.isPending || importMarkdownMutation.isPending;
  const importingCollectionId = isAnyImportPending
    ? (importDialogTarget?.parentCollectionId ?? null)
    : null;
  const importingKind = isAnyImportPending ? (importDialogTarget?.kind ?? null) : null;
  const generateExamplesDialogText: GenerateExamplesDialogText = {
    title: t('collections.workbench.examples.generateDialogTitle'),
    description: t('collections.workbench.examples.generateDialogDescription'),
    countLabel: t('collections.workbench.examples.generateCountLabel'),
    countHint: t('collections.workbench.examples.generateCountHint', {
      min: MIN_AI_EXAMPLE_COUNT,
      max: MAX_AI_EXAMPLE_COUNT,
    }),
    categoriesLabel: t('collections.workbench.examples.generateCategoriesLabel'),
    categoryRequired: t('collections.workbench.examples.generateCategoryRequired'),
    instructionsLabel: t('collections.workbench.examples.generateInstructionsLabel'),
    instructionsPlaceholder: t('collections.workbench.examples.generateInstructionsPlaceholder'),
    cancel: t('common.cancel'),
    generatePreview: t('collections.workbench.examples.generatePreview'),
    categoryLabels: {
      general: t(getExampleCategoryLabelKey('general')),
      positive: t(getExampleCategoryLabelKey('positive')),
      negative: t(getExampleCategoryLabelKey('negative')),
      boundary: t(getExampleCategoryLabelKey('boundary')),
      security: t(getExampleCategoryLabelKey('security')),
    },
  };

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-bg-soft">
      <div className="border-b border-border-subtle bg-bg-canvas">
        <div className="px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <RequestTabs
                tabs={openTabs}
                activeTabId={activeTabId}
                onSelectTab={tabId => selectRequest(tabId, tabMap.get(tabId)?.collectionId ?? null)}
                onCloseTab={handleCloseTab}
                onCloseOtherTabs={handleCloseOtherTabs}
                onCloseAllTabs={handleCloseAllTabs}
                onDuplicateTab={duplicateTab}
                onCreateTab={createScratchpadRequest}
                onReorderTabs={handleReorderOpenTabs}
              />
            </div>
            <EnvironmentSwitcher
              environments={environments}
              selectedEnvironmentId={selectedEnvironmentId}
              isLoading={environmentsQuery.isLoading}
              onEnvironmentChange={setSelectedEnvironmentId}
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        <aside className="h-[42dvh] min-h-[280px] w-full shrink-0 border-b border-border-subtle bg-bg-soft xl:h-auto xl:min-h-0 xl:w-[320px] xl:border-b-0 xl:border-r">
          <CollectionsSidebar
            collections={collectionViews}
            activeCollectionId={activeCollectionId}
            activeTabId={activeTabId}
            deletingCollectionId={deletingCollectionId}
            importingCollectionId={importingCollectionId}
            importingKind={importingKind}
            isImportingAny={isAnyImportPending}
            isImportingRootPostman={isImportingPostmanRoot}
            isImportingRootMarkdown={isImportingMarkdownRoot}
            renamingCollectionId={renamingCollectionId}
            creatingRequestCollectionId={creatingRequestCollectionId}
            deletingRequestTabId={deletingRequestTabId}
            renamingRequestTabId={renamingRequestTabId}
            expandedCollectionIds={expandedCollectionIds}
            scratchpadTabs={visibleScratchpadTabs}
            isEmpty={collectionViews.length === 0 && visibleScratchpadTabs.length === 0}
            query={sidebarQuery}
            onQueryChange={setSidebarQuery}
            onCreateCollection={createCollection}
            onCreateScratchpadRequest={createScratchpadRequest}
            onImportRootPostman={() => openRootImportDialog('postman')}
            onImportRootMarkdown={() => openRootImportDialog('markdown')}
            onCreateRequest={handleCreateRequest}
            onDeleteCollection={setDeleteCollectionTarget}
            onImportCollectionPostman={collection =>
              openCollectionImportDialog(collection, 'postman')
            }
            onImportCollectionMarkdown={collection =>
              openCollectionImportDialog(collection, 'markdown')
            }
            onDeleteRequest={setDeleteRequestTarget}
            onRenameCollection={openRenameCollectionDialog}
            onRenameRequest={openRenameRequestDialog}
            onToggleCollection={toggleCollection}
            onSelectRequest={selectRequest}
          />
        </aside>

        <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6">
          {activeTab ? (
            <div className="mx-auto flex min-h-full max-w-[1600px] flex-col gap-4">
              <Card className="gap-0 rounded-xl border-border-subtle bg-bg-canvas py-0">
                <CardHeader className="gap-4 border-b border-border-subtle py-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-border-subtle bg-bg-soft text-text-main"
                        >
                          {t('collections.workbench.badges.apiRequest')}
                        </Badge>
                        {activeTab.collectionId ? (
                          <Badge variant="secondary">
                            {collections.find(
                              collection => collection.id === activeTab.collectionId
                            )?.name || t('collections.workbench.badges.collectionFallback')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {t('collections.workbench.badges.quickRequest')}
                          </Badge>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-xl tracking-normal">{activeTab.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {t('collections.workbench.runnerDescription')}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        isIcon
                        className="h-10 w-10 rounded-full"
                        onClick={handleDuplicateTab}
                        aria-label={t('collections.workbench.actions.duplicateTab')}
                        title={t('collections.workbench.actions.duplicateTab')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        isIcon
                        className="h-10 w-10 rounded-full"
                        onClick={handleSaveTab}
                        aria-label={t('collections.workbench.actions.saveTab')}
                        title={t('collections.workbench.actions.saveTab')}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 px-4 py-5 md:px-6">
                  <RequestToolbar
                    tab={activeTab}
                    onMethodChange={method => updateActiveTab(tab => ({ ...tab, method }))}
                    onUrlChange={url => updateActiveTab(tab => ({ ...tab, url }))}
                    onSend={handleSend}
                    onSave={handleSaveTab}
                    onDuplicate={handleDuplicateTab}
                  />

                  <RequestSectionTabs
                    activeSection={activeTab.activeSection}
                    onSelectSection={section =>
                      updateActiveTab(tab => ({ ...tab, activeSection: section }))
                    }
                  />

                  {activeTab.activeSection === 'examples' ? (
                    <ExamplesPanel
                      canCreateExamples={canCreateExamples}
                      requestPersisted={requestIsPersisted}
                      hasCapturableResponse={activeResponseCanBeCaptured}
                      examples={requestExamples}
                      isLoading={examplesQuery.isLoading}
                      isError={Boolean(examplesQuery.error)}
                      isRefreshing={examplesQuery.isFetching}
                      savingResponseExampleId={savingResponseExampleId}
                      defaultingExampleId={defaultingExampleId}
                      isGeneratingExamples={generateExamplesMutation.isPending}
                      isRunningExamples={isRunningExamples}
                      runningExampleId={runningExampleId}
                      runReport={exampleRunReport}
                      draftReview={exampleDraftReview}
                      isAcceptingDrafts={isAcceptingExampleDrafts}
                      onCreateExample={openCreateExampleDialog}
                      onGenerateExamples={openGenerateExamplesDialog}
                      onRunAllExamples={() => void handleRunAllExamples()}
                      onAcceptDrafts={() => void acceptSelectedExampleDrafts()}
                      onDiscardDraft={discardExampleDraft}
                      onToggleDraft={toggleExampleDraftSelection}
                      onClearDrafts={clearExampleDraftReview}
                      onRefresh={() => {
                        void examplesQuery.refetch();
                      }}
                      onViewExample={openViewExampleDialog}
                      onApplyExample={handleApplyExample}
                      onSaveLatestResponse={handleSaveLatestResponseToExample}
                      onEditExample={openEditExampleDialog}
                      onSetDefault={handleSetDefaultExample}
                      onDeleteExample={openDeleteExampleDialog}
                    />
                  ) : (
                    <RequestSectionPanel
                      key={`${activeTab.id}-${activeTab.activeSection}`}
                      tab={activeTab}
                      onTabChange={updateActiveTab}
                      onGenerateDoc={handleGenerateRequestDoc}
                      isGeneratingDoc={genRequestDocMutation.isPending}
                      generatingDocLang={generatingRequestDocLang}
                      docGenerationError={requestDocGenerationError}
                    />
                  )}
                </CardContent>
              </Card>

              {activeTab.activeSection !== 'docs' ? (
                <ResponsePanel
                  response={activeTab.response}
                  isSending={activeTab.isSending}
                  onSaveAsExample={openCreateExampleDialog}
                  canSaveAsExample={canCreateExamples && activeResponseCanBeCaptured}
                  isSavingExample={
                    createExampleMutation.isPending || saveExampleResponseMutation.isPending
                  }
                />
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex min-h-full max-w-[960px] items-center justify-center">
              <div className="w-full max-w-[680px] rounded-xl border border-dashed border-border-subtle bg-bg-soft px-8 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-border-subtle bg-bg-surface text-text-main">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <p className="mt-6 text-2xl font-medium tracking-normal text-text-main">
                  {t('collections.workbench.empty.workspaceTitle')}
                </p>
                <p className="mt-3 text-base leading-7 text-text-muted">
                  {t('collections.workbench.empty.workspaceDescription')}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button type="button" onClick={createCollection}>
                    <Plus className="h-4 w-4" />
                    {t('collections.workbench.actions.newCollection')}
                  </Button>
                  <Button type="button" variant="outline" onClick={createScratchpadRequest}>
                    <Plus className="h-4 w-4" />
                    {t('collections.workbench.actions.quickRequest')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ExampleFormDialog
        key={`${activeTab?.id ?? 'no-request'}-${isExampleDialogOpen ? 'open' : 'closed'}`}
        open={isExampleDialogOpen}
        requestLabel={activeTab ? getTabSaveLabel(activeTab) : defaultRequestTitle}
        capturesResponse={activeResponseCanBeCaptured}
        isSubmitting={createExampleMutation.isPending || saveExampleResponseMutation.isPending}
        onOpenChange={setIsExampleDialogOpen}
        onSubmit={handleCreateExample}
      />
      <GenerateExamplesDialog
        open={isGenerateExamplesDialogOpen}
        draft={generateExamplesDraft}
        text={generateExamplesDialogText}
        isSubmitting={generateExamplesMutation.isPending}
        onOpenChange={setIsGenerateExamplesDialogOpen}
        onDraftChange={setGenerateExamplesDraft}
        onSubmit={handleGenerateExamples}
      />
      <ExampleDetailDialog
        open={viewingExampleId !== null}
        example={viewingExampleId !== null ? selectedExample : null}
        isLoading={viewingExampleId !== null && exampleDetailQuery.isLoading && !selectedExample}
        isRefreshing={viewingExampleId !== null && exampleDetailQuery.isFetching}
        isError={viewingExampleId !== null && Boolean(exampleDetailQuery.error) && !selectedExample}
        onOpenChange={closeViewExampleDialog}
        onApplyExample={handleApplyExample}
        onEditExample={openEditExampleDialog}
        onDeleteExample={openDeleteExampleDialog}
      />
      <EditExampleDialog
        key={`${editingExampleId ?? 'edit-none'}-${editingExampleId !== null ? 'open' : 'closed'}`}
        open={editingExampleId !== null}
        example={editingExampleId !== null ? selectedExample : null}
        isLoading={editingExampleId !== null && exampleDetailQuery.isLoading && !selectedExample}
        isSubmitting={updateExampleMutation.isPending}
        onOpenChange={closeEditExampleDialog}
        onSubmit={handleUpdateExample}
      />
      <DeleteExampleDialog
        open={deleteExampleTarget !== null}
        exampleName={deleteExampleTarget?.name ?? ''}
        isSubmitting={deleteExampleMutation.isPending && deletingExampleId !== null}
        onOpenChange={closeDeleteExampleDialog}
        onConfirm={handleDeleteExample}
      />
      <DeleteCollectionDialog
        open={deleteCollectionTarget !== null}
        collection={deleteCollectionTarget}
        isSubmitting={deletingCollectionId !== null}
        onOpenChange={closeDeleteCollectionDialog}
        onConfirm={handleDeleteCollection}
      />
      <DeleteRequestDialog
        open={deleteRequestTarget !== null}
        request={deleteRequestTarget}
        isSubmitting={deletingRequestTabId !== null}
        onOpenChange={closeDeleteRequestDialog}
        onConfirm={handleDeleteRequest}
      />
      <RenameCollectionDialog
        open={renameDialogCollectionId !== null}
        value={renameDraftName}
        isSubmitting={renamingCollectionId !== null}
        onOpenChange={closeRenameCollectionDialog}
        onValueChange={setRenameDraftName}
        onConfirm={handleRenameCollection}
      />
      <RenameRequestDialog
        open={renameDialogRequestTabId !== null}
        value={renameRequestDraftName}
        isSubmitting={renamingRequestTabId !== null}
        onOpenChange={closeRenameRequestDialog}
        onValueChange={setRenameRequestDraftName}
        onConfirm={handleRenameRequest}
      />
      <ImportCollectionDialog
        key={`${importDialogTarget?.kind ?? 'postman'}-${importDialogTarget?.parentCollectionId ?? 'root'}-${importDialogTarget ? 'open' : 'closed'}`}
        open={importDialogTarget !== null}
        kind={importDialogTarget?.kind ?? null}
        targetLabel={importDialogTarget?.parentCollectionName ?? null}
        file={importFile}
        isSubmitting={isAnyImportPending}
        onOpenChange={closeImportDialog}
        onFileChange={setImportFile}
        onSubmit={handleImportCollection}
      />
    </main>
  );
}

function CollectionsSidebar({
  collections,
  activeCollectionId,
  activeTabId,
  deletingCollectionId,
  importingCollectionId,
  importingKind,
  isImportingAny,
  isImportingRootPostman,
  isImportingRootMarkdown,
  renamingCollectionId,
  creatingRequestCollectionId,
  deletingRequestTabId,
  renamingRequestTabId,
  expandedCollectionIds,
  scratchpadTabs,
  isEmpty,
  query,
  onQueryChange,
  onCreateCollection,
  onCreateScratchpadRequest,
  onImportRootPostman,
  onImportRootMarkdown,
  onCreateRequest,
  onDeleteCollection,
  onImportCollectionPostman,
  onImportCollectionMarkdown,
  onDeleteRequest,
  onRenameCollection,
  onRenameRequest,
  onToggleCollection,
  onSelectRequest,
}: {
  collections: Array<{ collection: CollectionNode; requests: RequestPageTab[] }>;
  activeCollectionId: string | null;
  activeTabId: string | null;
  deletingCollectionId: string | null;
  importingCollectionId: string | null;
  importingKind: ImportDialogKind | null;
  isImportingAny: boolean;
  isImportingRootPostman: boolean;
  isImportingRootMarkdown: boolean;
  renamingCollectionId: string | null;
  creatingRequestCollectionId: string | null;
  deletingRequestTabId: string | null;
  renamingRequestTabId: string | null;
  expandedCollectionIds: string[];
  scratchpadTabs: RequestPageTab[];
  isEmpty: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onCreateCollection: () => void;
  onCreateScratchpadRequest: () => void;
  onImportRootPostman: () => void;
  onImportRootMarkdown: () => void;
  onCreateRequest: (collection: CollectionNode) => Promise<void>;
  onDeleteCollection: (collection: CollectionNode) => void;
  onImportCollectionPostman: (collection: CollectionNode) => void;
  onImportCollectionMarkdown: (collection: CollectionNode) => void;
  onDeleteRequest: (request: RequestPageTab) => void;
  onRenameCollection: (collection: CollectionNode) => void;
  onRenameRequest: (request: RequestPageTab) => void;
  onToggleCollection: (collectionId: string) => void;
  onSelectRequest: (tabId: string, collectionId: string | null) => void;
}) {
  const [page, setPage] = useState(1);
  const t = useT('workspace');
  const isSearchMode = query.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(collections.length / SIDEBAR_COLLECTIONS_PAGE_SIZE));
  const currentPage = isSearchMode ? 1 : Math.min(page, totalPages);
  const canGoPrev = !isSearchMode && currentPage > 1;
  const canGoNext = !isSearchMode && currentPage < totalPages;
  const visibleCollections = useMemo(() => {
    if (isSearchMode) {
      return collections;
    }

    const startIndex = (currentPage - 1) * SIDEBAR_COLLECTIONS_PAGE_SIZE;
    return collections.slice(startIndex, startIndex + SIDEBAR_COLLECTIONS_PAGE_SIZE);
  }, [collections, currentPage, isSearchMode]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="space-y-4 p-4">
        {isEmpty ? (
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-canvas p-4">
            <p className="text-sm font-medium text-text-main">
              {t('collections.workbench.empty.sidebarTitle')}
            </p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {t('collections.workbench.empty.sidebarDescription')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setPage(1);
                  onCreateCollection();
                }}
              >
                <Plus className="h-4 w-4" />
                {t('collections.workbench.actions.newCollection')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={isImportingRootPostman}
                disabled={isImportingAny}
                onClick={onImportRootPostman}
              >
                <Upload className="h-4 w-4" />
                {t('collections.workbench.actions.importPostman')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={isImportingRootMarkdown}
                disabled={isImportingAny}
                onClick={onImportRootMarkdown}
              >
                <FileText className="h-4 w-4" />
                {t('collections.workbench.actions.importMarkdown')}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onCreateScratchpadRequest}>
                <Plus className="h-4 w-4" />
                {t('collections.workbench.actions.quickRequest')}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={event => {
                setPage(1);
                onQueryChange(event.target.value);
              }}
              placeholder={t('collections.workbench.filterPlaceholder')}
              className="pl-9"
            />
          </div>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                isIcon
                aria-label={t('collections.workbench.actions.newCollection')}
                onClick={() => {
                  setPage(1);
                  onCreateCollection();
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t('collections.workbench.actions.newCollection')}
            </TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                isIcon
                loading={isImportingRootPostman}
                disabled={isImportingAny}
                aria-label={t('collections.workbench.actions.importPostman')}
                onClick={onImportRootPostman}
              >
                <Upload className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t('collections.workbench.actions.importPostman')}
            </TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                isIcon
                loading={isImportingRootMarkdown}
                disabled={isImportingAny}
                aria-label={t('collections.workbench.actions.importMarkdown')}
                onClick={onImportRootMarkdown}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t('collections.workbench.actions.importMarkdown')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-2">
          {visibleCollections.map(({ collection, requests }) => {
            const isExpanded = expandedCollectionIds.includes(collection.id);
            const isActiveCollection = activeCollectionId === collection.id;

            return (
              <div
                key={collection.id}
                className={cn(
                  'group/collection rounded-xl border border-transparent bg-bg-canvas p-1.5 transition-colors',
                  isActiveCollection ? 'border-border-subtle bg-bg-surface' : 'hover:bg-bg-subtle'
                )}
              >
                <div className="flex items-start gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    isIcon
                    className="mt-0.5 h-8 w-8 rounded-full"
                    onClick={() => onToggleCollection(collection.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => onToggleCollection(collection.id)}
                    className="min-w-0 flex-1 rounded-xl px-1 py-0.5 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-2.5 w-2.5 rounded-full border border-border-subtle',
                          COLLECTION_COLOR_DOT_CLASS_NAMES[collection.colorTone]
                        )}
                        aria-hidden="true"
                      />
                      <p className="truncate text-sm font-medium text-text-main">
                        {collection.name}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {t('collections.workbench.requestCount', {
                        count: collection.requestIds.length,
                      })}
                    </p>
                  </button>

                  <CollectionActionsMenu
                    isFolder={collection.isFolder}
                    isCreatingRequest={creatingRequestCollectionId === collection.id}
                    isDeleting={deletingCollectionId === collection.id}
                    isImportingPostman={
                      importingCollectionId === collection.id && importingKind === 'postman'
                    }
                    isImportingMarkdown={
                      importingCollectionId === collection.id && importingKind === 'markdown'
                    }
                    isRenaming={renamingCollectionId === collection.id}
                    onCreateRequest={() => void onCreateRequest(collection)}
                    onImportPostman={() => onImportCollectionPostman(collection)}
                    onImportMarkdown={() => onImportCollectionMarkdown(collection)}
                    onRename={() => onRenameCollection(collection)}
                    onDelete={() => void onDeleteCollection(collection)}
                  />
                </div>

                {isExpanded ? (
                  <div className="mt-1.5 space-y-1 pl-10">
                    {requests.map(request => (
                      <SidebarRequestRow
                        key={request.id}
                        request={request}
                        isActive={activeTabId === request.id}
                        onSelect={() => onSelectRequest(request.id, collection.id)}
                        isDeleting={deletingRequestTabId === request.id}
                        isRenaming={renamingRequestTabId === request.id}
                        onDelete={() => void onDeleteRequest(request)}
                        onRename={() => onRenameRequest(request)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {scratchpadTabs.length > 0 ? (
            <div className="pt-4">
              <div className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                {t('collections.workbench.quickRequests')}
              </div>
              <div className="space-y-1.5">
                {scratchpadTabs.map(tab => (
                  <SidebarRequestRow
                    key={tab.id}
                    request={tab}
                    isActive={activeTabId === tab.id}
                    onSelect={() => onSelectRequest(tab.id, null)}
                    isScratchpad
                    isDeleting={deletingRequestTabId === tab.id}
                    isRenaming={renamingRequestTabId === tab.id}
                    onDelete={() => void onDeleteRequest(tab)}
                    onRename={() => onRenameRequest(tab)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!isSearchMode && totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage(currentPage => Math.max(1, currentPage - 1))}
            disabled={!canGoPrev}
          >
            {t('common.previous')}
          </Button>
          <span className="text-xs font-medium text-text-muted">
            {t('collections.workbench.pageOf', {
              page: currentPage,
              total: totalPages,
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage(currentPage => Math.min(totalPages, currentPage + 1))}
            disabled={!canGoNext}
          >
            {t('common.next')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SidebarRequestRow({
  request,
  isActive,
  onSelect,
  isScratchpad = false,
  isDeleting,
  isRenaming,
  onDelete,
  onRename,
}: {
  request: RequestPageTab;
  isActive: boolean;
  onSelect: () => void;
  isScratchpad?: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  onDelete: () => void;
  onRename: () => void;
}) {
  return (
    <div
      className={cn(
        'group/request flex items-center gap-1 rounded-xl transition-colors',
        isActive ? 'bg-bg-surface text-text-main' : 'hover:bg-bg-subtle'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 rounded-xl px-3 py-1.5 text-left"
      >
        <div className="flex items-center gap-2">
          {isScratchpad ? (
            <FolderOpen className="h-4 w-4 text-text-muted" />
          ) : (
            <MethodBadge method={request.method} compact />
          )}
          <p className="truncate text-sm font-medium">{request.title}</p>
        </div>
      </button>

      <RequestItemActionsMenu
        isDeleting={isDeleting}
        isRenaming={isRenaming}
        onDelete={onDelete}
        onRename={onRename}
      />
    </div>
  );
}

function RequestItemActionsMenu({
  isDeleting,
  isRenaming,
  onDelete,
  onRename,
}: {
  isDeleting: boolean;
  isRenaming: boolean;
  onDelete: () => void;
  onRename: () => void;
}) {
  const t = useT('workspace');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isIcon
          className="mr-1 h-7 w-7 rounded-full opacity-0 transition-opacity group-hover/request:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={t('collections.workbench.actions.openRequestActions')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-lg">
        <DropdownMenuItem disabled={isRenaming} onSelect={onRename}>
          {isRenaming
            ? t('collections.workbench.actions.renaming')
            : t('collections.workbench.actions.rename')}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={isDeleting} onSelect={onDelete}>
          {isDeleting
            ? t('collections.workbench.actions.deleting')
            : t('collections.workbench.actions.delete')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>{t('collections.workbench.actions.share')}</DropdownMenuItem>
        <DropdownMenuItem>{t('collections.workbench.actions.copyLink')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CollectionActionsMenu({
  isFolder,
  isCreatingRequest,
  isDeleting,
  isImportingPostman,
  isImportingMarkdown,
  isRenaming,
  onCreateRequest,
  onImportPostman,
  onImportMarkdown,
  onRename,
  onDelete,
}: {
  isFolder: boolean;
  isCreatingRequest: boolean;
  isDeleting: boolean;
  isImportingPostman: boolean;
  isImportingMarkdown: boolean;
  isRenaming: boolean;
  onCreateRequest: () => void;
  onImportPostman: () => void;
  onImportMarkdown: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const t = useT('workspace');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isIcon
          className="h-8 w-8 rounded-full opacity-0 transition-opacity group-hover/collection:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={t('collections.workbench.actions.openCollectionActions')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-lg">
        <DropdownMenuItem disabled={isFolder || isCreatingRequest} onSelect={onCreateRequest}>
          {isCreatingRequest
            ? t('collections.workbench.actions.creating')
            : t('collections.workbench.actions.newRequest')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!isFolder || isImportingPostman} onSelect={onImportPostman}>
          {isImportingPostman
            ? t('collections.workbench.actions.importing')
            : t('collections.workbench.actions.importPostman')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!isFolder || isImportingMarkdown} onSelect={onImportMarkdown}>
          {isImportingMarkdown
            ? t('collections.workbench.actions.importing')
            : t('collections.workbench.actions.importMarkdown')}
        </DropdownMenuItem>
        <DropdownMenuItem>{t('collections.workbench.actions.export')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isRenaming} onSelect={onRename}>
          {t('collections.workbench.actions.rename')}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={isDeleting} onSelect={onDelete}>
          {t('collections.workbench.actions.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ImportCollectionDialog({
  open,
  kind,
  targetLabel,
  file,
  isSubmitting,
  onOpenChange,
  onFileChange,
  onSubmit,
}: {
  open: boolean;
  kind: ImportDialogKind | null;
  targetLabel: string | null;
  file: File | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => Promise<void>;
}) {
  const t = useT('workspace');
  const activeKind = kind ?? 'postman';
  const isMarkdownImport = activeKind === 'markdown';
  const title = isMarkdownImport
    ? t('collections.workbench.importDialog.markdownTitle')
    : t('collections.workbench.importDialog.postmanTitle');
  const description = isMarkdownImport
    ? targetLabel
      ? t('collections.workbench.importDialog.markdownDescriptionInCollection', {
          name: targetLabel,
        })
      : t('collections.workbench.importDialog.markdownDescriptionRoot')
    : targetLabel
      ? t('collections.workbench.importDialog.postmanDescriptionInCollection', {
          name: targetLabel,
        })
      : t('collections.workbench.importDialog.postmanDescriptionRoot');
  const inputId = isMarkdownImport ? 'import-markdown-file' : 'import-postman-file';
  const accept = isMarkdownImport
    ? '.md,.markdown,text/markdown,text/plain'
    : '.json,application/json';
  const fileLabel = isMarkdownImport
    ? t('collections.workbench.importDialog.markdownFile')
    : t('collections.workbench.importDialog.collectionFile');
  const emptyStateLabel = isMarkdownImport
    ? t('collections.workbench.importDialog.markdownEmptyState')
    : t('collections.workbench.importDialog.postmanEmptyState');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={inputId}>{fileLabel}</Label>
              <Input
                id={inputId}
                type="file"
                accept={accept}
                className="h-auto cursor-pointer py-2"
                onChange={event => onFileChange(event.target.files?.[0] ?? null)}
              />
            </div>
            <p className="text-sm text-text-muted">
              {file
                ? t('collections.workbench.importDialog.selectedFile', { name: file.name })
                : emptyStateLabel}
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            disabled={!file}
            onClick={() => void onSubmit()}
          >
            {t('collections.workbench.actions.import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameCollectionDialog({
  open,
  value,
  isSubmitting,
  onOpenChange,
  onValueChange,
  onConfirm,
}: {
  open: boolean;
  value: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT('workspace');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('collections.workbench.renameCollectionDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('collections.workbench.renameCollectionDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-2">
            <Label htmlFor="rename-collection-name">
              {t('collections.workbench.renameCollectionDialog.label')}
            </Label>
            <Input
              id="rename-collection-name"
              value={value}
              onChange={event => onValueChange(event.target.value)}
              placeholder={t('collections.workbench.renameCollectionDialog.placeholder')}
              className="rounded-xl"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            disabled={!value.trim()}
            onClick={() => void onConfirm()}
          >
            {t('collections.workbench.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameRequestDialog({
  open,
  value,
  isSubmitting,
  onOpenChange,
  onValueChange,
  onConfirm,
}: {
  open: boolean;
  value: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT('workspace');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('collections.workbench.renameRequestDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('collections.workbench.renameRequestDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-2">
            <Label htmlFor="rename-request-name">
              {t('collections.workbench.renameRequestDialog.label')}
            </Label>
            <Input
              id="rename-request-name"
              value={value}
              onChange={event => onValueChange(event.target.value)}
              placeholder={t('collections.workbench.renameRequestDialog.placeholder')}
              className="rounded-xl"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            disabled={!value.trim()}
            onClick={() => void onConfirm()}
          >
            {t('collections.workbench.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCollectionDialog({
  open,
  collection,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  collection: CollectionNode | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT('workspace');
  const collectionName =
    collection?.name || t('collections.workbench.deleteCollectionDialog.fallbackName');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('collections.workbench.deleteCollectionDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('collections.workbench.deleteCollectionDialog.description', {
              name: collectionName,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 text-sm leading-6 text-text-main">
            {t('collections.workbench.deleteCollectionDialog.warning')}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={isSubmitting}
            onClick={() => void onConfirm()}
          >
            {t('collections.workbench.deleteCollectionDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRequestDialog({
  open,
  request,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  request: RequestPageTab | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT('workspace');
  const requestName = request?.title || t('collections.workbench.deleteRequestDialog.fallbackName');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('collections.workbench.deleteRequestDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('collections.workbench.deleteRequestDialog.description', {
              name: requestName,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 text-sm leading-6 text-text-main">
            {t('collections.workbench.deleteRequestDialog.warning')}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={isSubmitting}
            onClick={() => void onConfirm()}
          >
            {t('collections.workbench.deleteRequestDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExampleFormDialog({
  open,
  requestLabel,
  capturesResponse,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  requestLabel: string;
  capturesResponse: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: ExampleFormDraft) => Promise<void>;
}) {
  const t = useT('workspace');
  const [draft, setDraft] = useState<ExampleFormDraft>(() => getExampleFormDraft(requestLabel));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.name.trim()) {
      setError(t('collections.workbench.examples.nameRequired'));
      return;
    }

    setError(null);
    await onSubmit(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{t('collections.workbench.examples.saveDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('collections.workbench.examples.saveDialogDescription')}
            {capturesResponse
              ? ` ${t('collections.workbench.examples.saveDialogCapturesResponse')}`
              : ` ${t('collections.workbench.examples.saveDialogCaptureLater')}`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="request-example-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="request-example-name">
                {t('collections.workbench.examples.nameLabel')}
              </Label>
              <Input
                id="request-example-name"
                value={draft.name}
                onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                placeholder={t('collections.workbench.examples.namePlaceholder')}
                errorText={error ?? undefined}
                root
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-example-description">{t('common.description')}</Label>
              <Textarea
                id="request-example-description"
                value={draft.description}
                onChange={event =>
                  setDraft(current => ({ ...current, description: event.target.value }))
                }
                rows={5}
                placeholder={t('collections.workbench.examples.descriptionPlaceholder')}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-soft px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text-main">
                  {t('collections.workbench.examples.setDefaultTitle')}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  {t('collections.workbench.examples.setDefaultDescription')}
                </p>
              </div>
              <Switch
                checked={draft.isDefault}
                onCheckedChange={checked =>
                  setDraft(current => ({ ...current, isDefault: checked }))
                }
              />
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="request-example-form" loading={isSubmitting}>
            {t('collections.workbench.examples.saveExample')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateExamplesDialog({
  open,
  draft,
  text,
  isSubmitting,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: {
  open: boolean;
  draft: GenerateExamplesFormDraft;
  text: GenerateExamplesDialogText;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: GenerateExamplesFormDraft) => void;
  onSubmit: (draft: GenerateExamplesFormDraft) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (patch: Partial<GenerateExamplesFormDraft>) => {
    onDraftChange({ ...draft, ...patch });
  };

  const toggleCategory = (category: RequestExampleCategory) => {
    const hasCategory = draft.categories.includes(category);
    const categories = hasCategory
      ? draft.categories.filter(item => item !== category)
      : [...draft.categories, category];
    updateDraft({ categories });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.categories.length === 0) {
      setError(text.categoryRequired);
      return;
    }
    setError(null);
    await onSubmit(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="request-example-ai-generate-form" className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="request-example-ai-count">{text.countLabel}</Label>
              <Input
                id="request-example-ai-count"
                type="number"
                min={MIN_AI_EXAMPLE_COUNT}
                max={MAX_AI_EXAMPLE_COUNT}
                value={draft.count}
                onChange={event => updateDraft({ count: Number(event.target.value) })}
                root
              />
              <p className="text-xs text-text-muted">{text.countHint}</p>
            </div>

            <div className="space-y-2">
              <Label>{text.categoriesLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {AI_EXAMPLE_CATEGORY_OPTIONS.map(category => {
                  const selected = draft.categories.includes(category);
                  return (
                    <Button
                      key={category}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => toggleCategory(category)}
                    >
                      {text.categoryLabels[category]}
                    </Button>
                  );
                })}
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-example-ai-instructions">{text.instructionsLabel}</Label>
              <Textarea
                id="request-example-ai-instructions"
                value={draft.instructions}
                onChange={event => updateDraft({ instructions: event.target.value })}
                rows={5}
                maxLength={1200}
                placeholder={text.instructionsPlaceholder}
              />
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {text.cancel}
          </Button>
          <Button type="submit" form="request-example-ai-generate-form" loading={isSubmitting}>
            <Sparkles className="h-4 w-4" />
            {text.generatePreview}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditExampleDialog({
  open,
  example,
  isLoading,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  example: RequestExample | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: ExampleFormDraft) => Promise<void>;
}) {
  const t = useT('workspace');
  const [draft, setDraft] = useState<ExampleFormDraft>(() =>
    example ? toExampleFormDraft(example) : getExampleFormDraft('')
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.name.trim()) {
      setError(t('collections.workbench.examples.nameRequired'));
      return;
    }

    setError(null);
    await onSubmit(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{t('collections.workbench.examples.editDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('collections.workbench.examples.editDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {isLoading && !example ? (
            <div className="space-y-3 py-1">
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-28 animate-pulse rounded-xl bg-muted" />
              <div className="h-20 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : !example ? (
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 text-sm text-text-main">
              {t('collections.workbench.examples.loadFailed')}
            </div>
          ) : (
            <form id="request-example-edit-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="request-example-edit-name">
                  {t('collections.workbench.examples.nameLabel')}
                </Label>
                <Input
                  id="request-example-edit-name"
                  value={draft.name}
                  onChange={event =>
                    setDraft(current => ({ ...current, name: event.target.value }))
                  }
                  placeholder={t('collections.workbench.examples.namePlaceholder')}
                  errorText={error ?? undefined}
                  root
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="request-example-edit-description">{t('common.description')}</Label>
                <Textarea
                  id="request-example-edit-description"
                  value={draft.description}
                  onChange={event =>
                    setDraft(current => ({ ...current, description: event.target.value }))
                  }
                  rows={5}
                  placeholder={t('collections.workbench.examples.descriptionPlaceholder')}
                />
              </div>

              <div className="rounded-xl border border-border-subtle bg-bg-soft p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-text-main">
                      {t('collections.workbench.examples.setDefaultTitle')}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {t('collections.workbench.examples.editSetDefaultDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={draft.isDefault}
                    disabled={example.is_default}
                    onCheckedChange={checked =>
                      setDraft(current => ({ ...current, isDefault: checked }))
                    }
                  />
                </div>
                {example.is_default ? (
                  <p className="mt-3 text-xs leading-5 text-text-muted">
                    {t('collections.workbench.examples.alreadyDefault')}
                  </p>
                ) : null}
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
            form="request-example-edit-form"
            loading={isSubmitting}
            disabled={!example}
          >
            {t('common.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteExampleDialog({
  open,
  exampleName,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  exampleName: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT('workspace');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('collections.workbench.examples.deleteDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('collections.workbench.examples.deleteDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 text-sm leading-6 text-text-main">
            <span className="font-medium text-text-main">
              {exampleName || t('collections.workbench.examples.thisExample')}
            </span>{' '}
            {t('collections.workbench.examples.deleteDialogWarning')}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={isSubmitting}
            onClick={() => void onConfirm()}
          >
            {t('collections.workbench.examples.deleteExample')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExampleDetailDialog({
  open,
  example,
  isLoading,
  isRefreshing,
  isError,
  onOpenChange,
  onApplyExample,
  onEditExample,
  onDeleteExample,
}: {
  open: boolean;
  example: RequestExample | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyExample: (example: RequestExample) => void;
  onEditExample: (example: RequestExample) => void;
  onDeleteExample: (example: RequestExample) => void;
}) {
  const t = useT('workspace');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('collections.workbench.examples.detailDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('collections.workbench.examples.detailDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 overflow-y-auto">
          {isLoading && !example ? (
            <div className="space-y-4 py-1">
              <div className="h-28 animate-pulse rounded-xl bg-muted" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-44 animate-pulse rounded-xl bg-muted" />
                <div className="h-44 animate-pulse rounded-xl bg-muted" />
              </div>
              <div className="h-56 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : isError && !example ? (
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 text-sm text-text-main">
              {t('collections.workbench.examples.detailLoadFailed')}
            </div>
          ) : example ? (
            <>
              <div className="rounded-xl border border-border-subtle bg-bg-canvas p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-medium text-text-main">{example.name}</p>
                      {example.is_default ? (
                        <Badge
                          variant="outline"
                          className="border-border-subtle bg-bg-surface text-text-main"
                        >
                          {t('collections.workbench.badges.default')}
                        </Badge>
                      ) : null}
                      <Badge variant="outline">
                        {t(getExampleCategoryLabelKey(example.category))}
                      </Badge>
                      {example.source === 'ai' ? (
                        <Badge variant="outline">
                          {t('collections.workbench.examples.aiGenerated')}
                        </Badge>
                      ) : null}
                      <Badge variant="secondary">
                        {example.method} {example.url || t('collections.workbench.examples.noUrl')}
                      </Badge>
                    </div>
                    {example.description ? (
                      <p className="text-sm leading-6 text-text-muted">{example.description}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    <span>
                      {isRefreshing
                        ? t('collections.workbench.examples.refreshingDetails')
                        : t('collections.workbench.examples.updatedAt', {
                            value: formatExampleTimestamp(
                              example.updated_at,
                              t('collections.workbench.examples.unknownTime')
                            ),
                          })}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <MetricBadge
                    label={t('common.headers')}
                    value={`${example.headers?.length ?? 0}`}
                  />
                  <MetricBadge
                    label={t('collections.workbench.sections.params')}
                    value={`${example.query_params?.length ?? 0}`}
                  />
                  <MetricBadge
                    label={t('collections.workbench.sections.body')}
                    value={
                      example.body?.trim()
                        ? getBodyModeLabel(t, example.body_type)
                        : getBodyModeLabel(t, 'none')
                    }
                  />
                  <MetricBadge
                    label={t('collections.workbench.examples.authMetric')}
                    value={getAuthorizationModeLabel(t, example.auth?.type ?? 'none')}
                  />
                  <MetricBadge
                    label={t('collections.workbench.examples.assertions')}
                    value={`${example.assertions?.length ?? 0}`}
                  />
                  <MetricBadge
                    label={t('common.response')}
                    value={getExampleResponseValue(
                      t,
                      example.response_status,
                      example.response_time
                    )}
                  />
                  <MetricBadge
                    label={t('common.created')}
                    value={formatExampleTimestamp(
                      example.created_at,
                      t('collections.workbench.examples.unknownTime')
                    )}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ExampleSnapshotBlock
                  title={t('common.headers')}
                  value={formatExampleKeyValues(
                    example.headers,
                    t('collections.workbench.examples.noHeadersSaved')
                  )}
                />
                <ExampleSnapshotBlock
                  title={t('collections.workbench.examples.queryParamsTitle')}
                  value={formatExampleKeyValues(
                    example.query_params,
                    t('collections.workbench.examples.noQueryParamsSaved')
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ExampleSnapshotBlock
                  title={t('collections.workbench.examples.authMetric')}
                  value={formatExampleAuth(t, example.auth)}
                />
                <ExampleSnapshotBlock
                  title={t('collections.workbench.examples.responseHeadersTitle')}
                  value={formatExampleResponseHeaders(
                    example.response_headers,
                    t('collections.workbench.examples.noResponseHeadersCaptured')
                  )}
                />
              </div>

              <ExampleSnapshotBlock
                title={t('collections.workbench.examples.assertionsTitle')}
                value={formatExampleAssertions(
                  example.assertions,
                  t('collections.workbench.examples.noAssertionsSaved')
                )}
              />

              <ExampleSnapshotBlock
                title={t('collections.workbench.examples.requestBodyTitle')}
                value={example.body || t('collections.workbench.response.emptyBody')}
                tone={example.body?.trim() ? 'dark' : 'light'}
              />
              <ExampleSnapshotBlock
                title={t('collections.workbench.examples.responseBodyTitle')}
                value={example.response_body || t('collections.workbench.response.emptyBody')}
                tone={example.response_body?.trim() ? 'dark' : 'light'}
              />
            </>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          {example ? (
            <>
              <Button type="button" variant="destructive" onClick={() => onDeleteExample(example)}>
                {t('common.delete')}
              </Button>
              <Button type="button" variant="outline" onClick={() => onEditExample(example)}>
                {t('collections.workbench.actions.edit')}
              </Button>
              <Button type="button" onClick={() => onApplyExample(example)}>
                {t('collections.workbench.actions.applyToRequest')}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExamplesPanel({
  canCreateExamples,
  requestPersisted,
  hasCapturableResponse,
  examples,
  isLoading,
  isError,
  isRefreshing,
  savingResponseExampleId,
  defaultingExampleId,
  isGeneratingExamples,
  isRunningExamples,
  runningExampleId,
  runReport,
  draftReview,
  isAcceptingDrafts,
  onCreateExample,
  onGenerateExamples,
  onRunAllExamples,
  onAcceptDrafts,
  onDiscardDraft,
  onToggleDraft,
  onClearDrafts,
  onRefresh,
  onViewExample,
  onApplyExample,
  onSaveLatestResponse,
  onEditExample,
  onSetDefault,
  onDeleteExample,
}: {
  canCreateExamples: boolean;
  requestPersisted: boolean;
  hasCapturableResponse: boolean;
  examples: RequestExample[];
  isLoading: boolean;
  isError: boolean;
  isRefreshing: boolean;
  savingResponseExampleId: number | string | null;
  defaultingExampleId: number | string | null;
  isGeneratingExamples: boolean;
  isRunningExamples: boolean;
  runningExampleId: number | string | null;
  runReport: ExampleRunReport | null;
  draftReview: ExampleDraftReviewState | null;
  isAcceptingDrafts: boolean;
  onCreateExample: () => void;
  onGenerateExamples: () => void;
  onRunAllExamples: () => void;
  onAcceptDrafts: () => void;
  onDiscardDraft: (clientId: string) => void;
  onToggleDraft: (clientId: string) => void;
  onClearDrafts: () => void;
  onRefresh: () => void;
  onViewExample: (example: RequestExample) => void;
  onApplyExample: (example: RequestExample) => void;
  onSaveLatestResponse: (example: RequestExample) => Promise<void>;
  onEditExample: (example: RequestExample) => void;
  onSetDefault: (example: RequestExample) => Promise<void>;
  onDeleteExample: (example: RequestExample) => void;
}) {
  const t = useT('workspace');
  const getRunStatusLabel = (status: ExampleRunStatus) => {
    switch (status) {
      case 'pass':
        return t('collections.workbench.examples.runPassed');
      case 'fail':
        return t('collections.workbench.examples.runFailed');
      case 'error':
      default:
        return t('collections.workbench.examples.runErrored');
    }
  };
  const latestRunResultByExampleId = useMemo(
    () => new Map((runReport?.results ?? []).map(result => [String(result.exampleId), result])),
    [runReport]
  );
  const selectedDraftCount = draftReview?.items.filter(item => item.selected).length ?? 0;

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border-border-subtle bg-bg-canvas py-0">
        <CardHeader className="border-b border-border-subtle py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{t('common.examples')}</CardTitle>
              <CardDescription className="mt-1">
                {t('collections.workbench.examples.panelDescription')}
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onGenerateExamples}
                disabled={!canCreateExamples || isGeneratingExamples || isRunningExamples}
                loading={isGeneratingExamples}
              >
                <Sparkles className="h-4 w-4" />
                {isGeneratingExamples
                  ? t('collections.workbench.examples.generatingExamples')
                  : t('collections.workbench.examples.aiGenerate')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRunAllExamples}
                disabled={!requestPersisted || examples.length === 0 || isRunningExamples}
                loading={isRunningExamples}
              >
                <SendHorizonal className="h-4 w-4" />
                {isRunningExamples
                  ? t('collections.workbench.examples.runningAll')
                  : t('collections.workbench.examples.runAll')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={!requestPersisted || isRefreshing}
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                {t('common.refresh')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onCreateExample}
                disabled={!canCreateExamples}
              >
                <Plus className="h-4 w-4" />
                {t('collections.workbench.examples.newExample')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-5 py-5">
          {runReport ? (
            <div className="space-y-4 rounded-xl border border-border-subtle bg-bg-soft p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm font-medium text-text-main">
                    {t('collections.workbench.examples.runReportTitle')}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-text-muted">
                    {t('collections.workbench.examples.runReportDescription', {
                      total: runReport.total,
                      duration: runReport.durationMs,
                    })}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <MetricBadge
                    label={t('collections.workbench.examples.runPassed')}
                    value={`${runReport.passed}`}
                  />
                  <MetricBadge
                    label={t('collections.workbench.examples.runFailed')}
                    value={`${runReport.failed}`}
                  />
                  <MetricBadge
                    label={t('collections.workbench.examples.runErrored')}
                    value={`${runReport.errored}`}
                  />
                </div>
              </div>

              {runReport.results.length > 0 ? (
                <div className="space-y-2">
                  {runReport.results.map(result => (
                    <div
                      key={result.id}
                      className="rounded-lg border border-border-subtle bg-bg-canvas p-3"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={getExampleRunStatusClassName(result.status)}
                            >
                              {getRunStatusLabel(result.status)}
                            </Badge>
                            <p className="truncate text-sm font-medium text-text-main">
                              {result.exampleName}
                            </p>
                          </div>
                          <p className="mt-2 break-all text-xs text-text-muted">
                            {result.method}{' '}
                            {result.url || t('collections.workbench.examples.noUrl')}
                          </p>
                          {result.error ? (
                            <p className="mt-2 text-xs leading-5 text-destructive">
                              {result.error}
                            </p>
                          ) : result.responseBody ? (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-muted">
                              {result.responseBody}
                            </p>
                          ) : null}
                          {result.assertions.some(assertion => !assertion.passed) ? (
                            <p className="mt-2 text-xs leading-5 text-destructive">
                              {result.assertions.find(assertion => !assertion.passed)?.message ??
                                t('collections.workbench.examples.assertionFailed')}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <MetricBadge
                            label={t('collections.workbench.examples.expectedStatus')}
                            value={
                              result.expectedStatus === null
                                ? t('common.notSet')
                                : `${result.expectedStatus}`
                            }
                          />
                          <MetricBadge
                            label={t('collections.workbench.examples.actualStatus')}
                            value={
                              result.actualStatus === null
                                ? t('common.notSet')
                                : `${result.actualStatus}`
                            }
                          />
                          <MetricBadge
                            label={t('common.duration')}
                            value={
                              result.durationMs === null
                                ? t('common.notSet')
                                : `${result.durationMs} ms`
                            }
                          />
                          <MetricBadge
                            label={t('collections.workbench.examples.assertions')}
                            value={`${result.assertions.filter(assertion => assertion.passed).length}/${result.assertions.length}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {draftReview ? (
            <div className="space-y-4 rounded-xl border border-border-subtle bg-bg-soft p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-sm font-medium text-text-main">
                    {t('collections.workbench.examples.draftReviewTitle')}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-text-muted">
                    {t('collections.workbench.examples.draftReviewDescription', {
                      total: draftReview.items.length,
                      selected: selectedDraftCount,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onClearDrafts}
                    disabled={isAcceptingDrafts}
                  >
                    <X className="h-4 w-4" />
                    {t('collections.workbench.examples.discardAllDrafts')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={onAcceptDrafts}
                    loading={isAcceptingDrafts}
                    disabled={selectedDraftCount === 0}
                  >
                    <Save className="h-4 w-4" />
                    {t('collections.workbench.examples.acceptSelectedDrafts', {
                      count: selectedDraftCount,
                    })}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {draftReview.items.map(item => (
                  <div
                    key={item.clientId}
                    className="rounded-lg border border-border-subtle bg-bg-canvas p-3"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {t(getExampleCategoryLabelKey(item.draft.category))}
                          </Badge>
                          <p className="truncate text-sm font-medium text-text-main">
                            {item.draft.name}
                          </p>
                        </div>
                        <p className="break-all text-xs text-text-muted">
                          {item.draft.method}{' '}
                          {item.draft.url || t('collections.workbench.examples.noUrl')}
                        </p>
                        {item.draft.description ? (
                          <p className="text-sm leading-6 text-text-muted">
                            {item.draft.description}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <MetricBadge
                            label={t('collections.workbench.examples.expectedStatus')}
                            value={`${item.draft.response_status || t('common.notSet')}`}
                          />
                          <MetricBadge
                            label={t('collections.workbench.examples.assertions')}
                            value={`${item.draft.assertions?.length ?? 0}`}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant={item.selected ? 'default' : 'outline'}
                          disabled={isAcceptingDrafts}
                          onClick={() => onToggleDraft(item.clientId)}
                        >
                          {item.selected
                            ? t('collections.workbench.examples.selectedDraft')
                            : t('collections.workbench.examples.selectDraft')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isAcceptingDrafts}
                          onClick={() => onDiscardDraft(item.clientId)}
                        >
                          {t('collections.workbench.examples.discardDraft')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!canCreateExamples ? (
            <div className="rounded-xl border border-dashed border-border-subtle bg-bg-soft p-5">
              <p className="text-sm font-medium text-text-main">
                {t('collections.workbench.examples.requiresSavedRequestTitle')}
              </p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                {t('collections.workbench.examples.requiresSavedRequestDescription')}
              </p>
            </div>
          ) : !requestPersisted ? (
            <div className="rounded-xl border border-dashed border-border-subtle bg-bg-soft p-5">
              <p className="text-sm font-medium text-text-main">
                {t('collections.workbench.examples.requestNotPersistedTitle')}
              </p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                {t('collections.workbench.examples.requestNotPersistedDescription')}
              </p>
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-3">
              {[0, 1].map(item => (
                <div key={item} className="rounded-xl border border-border-subtle p-4">
                  <div className="h-5 w-48 animate-pulse rounded-full bg-muted" />
                  <div className="mt-3 h-4 w-72 animate-pulse rounded-full bg-muted" />
                  <div className="mt-5 h-10 animate-pulse rounded-xl bg-muted" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-5 text-sm text-text-main">
              {t('collections.workbench.examples.panelLoadFailed')}
            </div>
          ) : examples.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle bg-bg-soft p-5">
              <p className="text-sm font-medium text-text-main">
                {t('collections.workbench.examples.emptyTitle')}
              </p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                {t('collections.workbench.examples.emptyDescription')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {examples.map(example => (
                <div
                  key={example.id}
                  className="rounded-xl border border-border-subtle bg-bg-canvas p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-text-main">{example.name}</p>
                        {runningExampleId !== null &&
                        String(runningExampleId) === String(example.id) ? (
                          <Badge
                            variant="outline"
                            className="border-border-subtle bg-bg-soft text-text-main"
                          >
                            {t('collections.workbench.examples.running')}
                          </Badge>
                        ) : null}
                        {latestRunResultByExampleId.has(String(example.id)) ? (
                          <Badge
                            variant="outline"
                            className={getExampleRunStatusClassName(
                              latestRunResultByExampleId.get(String(example.id))?.status ?? 'error'
                            )}
                          >
                            {getRunStatusLabel(
                              latestRunResultByExampleId.get(String(example.id))?.status ?? 'error'
                            )}
                          </Badge>
                        ) : null}
                        {example.is_default ? (
                          <Badge
                            variant="outline"
                            className="border-border-subtle bg-bg-surface text-text-main"
                          >
                            {t('collections.workbench.badges.default')}
                          </Badge>
                        ) : null}
                        <Badge variant="outline">
                          {t(getExampleCategoryLabelKey(example.category))}
                        </Badge>
                        {example.source === 'ai' ? (
                          <Badge variant="outline">
                            {t('collections.workbench.examples.aiGenerated')}
                          </Badge>
                        ) : null}
                        <Badge variant="secondary">
                          {example.method}{' '}
                          {example.url || t('collections.workbench.examples.noUrl')}
                        </Badge>
                      </div>

                      {example.description ? (
                        <p className="text-sm leading-6 text-text-muted">{example.description}</p>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <MetricBadge
                          label={t('common.headers')}
                          value={`${example.headers?.length ?? 0}`}
                        />
                        <MetricBadge
                          label={t('collections.workbench.sections.params')}
                          value={`${example.query_params?.length ?? 0}`}
                        />
                        <MetricBadge
                          label={t('collections.workbench.sections.body')}
                          value={
                            example.body?.trim()
                              ? getBodyModeLabel(t, example.body_type)
                              : getBodyModeLabel(t, 'none')
                          }
                        />
                        <MetricBadge
                          label={t('common.response')}
                          value={getExampleResponseValue(
                            t,
                            example.response_status,
                            example.response_time
                          )}
                        />
                        <MetricBadge
                          label={t('collections.workbench.examples.assertions')}
                          value={`${example.assertions?.length ?? 0}`}
                        />
                        {latestRunResultByExampleId.has(String(example.id)) ? (
                          <MetricBadge
                            label={t('collections.workbench.examples.lastRun')}
                            value={
                              latestRunResultByExampleId.get(String(example.id))?.actualStatus ===
                              null
                                ? t('common.notSet')
                                : `${latestRunResultByExampleId.get(String(example.id))?.actualStatus}`
                            }
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:max-w-[460px] xl:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onViewExample(example)}
                      >
                        {t('common.view')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onApplyExample(example)}
                      >
                        <Copy className="h-4 w-4" />
                        {t('collections.workbench.actions.apply')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void onSaveLatestResponse(example)}
                        disabled={!hasCapturableResponse}
                        loading={
                          savingResponseExampleId !== null &&
                          String(savingResponseExampleId) === String(example.id)
                        }
                      >
                        <Save className="h-4 w-4" />
                        {t('collections.workbench.actions.captureLatestResponse')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void onSetDefault(example)}
                        disabled={example.is_default}
                        loading={
                          defaultingExampleId !== null &&
                          String(defaultingExampleId) === String(example.id)
                        }
                      >
                        <Star className="h-4 w-4" />
                        {t('collections.workbench.actions.setDefault')}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            isIcon
                            noScale
                            aria-label={t('collections.workbench.actions.moreActions')}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-lg">
                          <DropdownMenuItem onSelect={() => onEditExample(example)}>
                            {t('collections.workbench.actions.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onDeleteExample(example)}
                          >
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExampleSnapshotBlock({
  title,
  value,
  tone = 'light',
}: {
  title: string;
  value: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-canvas p-4">
      <p className="text-sm font-medium text-text-main">{title}</p>
      <pre
        className={cn(
          'mt-3 max-h-64 overflow-auto rounded-xl border p-4 text-xs leading-6 whitespace-pre-wrap',
          tone === 'dark'
            ? 'border-border-subtle bg-primary text-primary-foreground'
            : 'border-border-subtle bg-bg-soft text-text-main'
        )}
      >
        {value}
      </pre>
    </div>
  );
}

function RequestTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onDuplicateTab,
  onCreateTab,
  onReorderTabs,
}: {
  tabs: RequestPageTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onDuplicateTab: (tabId: string) => void;
  onCreateTab: () => void;
  onReorderTabs: (activeId: string, overId: string) => void;
}) {
  const t = useT('workspace');
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }

    onReorderTabs(String(active.id), String(over.id));
  };

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 overflow-x-auto">
        {tabs.length === 0 ? (
          <div className="flex h-10 items-center rounded-full border border-dashed border-border-subtle bg-bg-soft px-4 text-sm text-text-muted">
            {t('collections.workbench.empty.noOpenTabs')}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tabs.map(tab => tab.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex min-w-max items-center gap-2 pr-2">
                {tabs.map(tab => (
                  <SortableRequestTab
                    key={tab.id}
                    tab={tab}
                    isActive={tab.id === activeTabId}
                    openTabCount={tabs.length}
                    onSelectTab={onSelectTab}
                    onCloseTab={onCloseTab}
                    onCloseOtherTabs={onCloseOtherTabs}
                    onCloseAllTabs={onCloseAllTabs}
                    onDuplicateTab={onDuplicateTab}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-10 shrink-0 rounded-full px-3"
        onClick={onCreateTab}
      >
        <Plus className="h-4 w-4" />
        {t('collections.workbench.actions.newQuickRequest')}
      </Button>
    </div>
  );
}

function SortableRequestTab({
  tab,
  isActive,
  openTabCount,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onDuplicateTab,
}: {
  tab: RequestPageTab;
  isActive: boolean;
  openTabCount: number;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onDuplicateTab: (tabId: string) => void;
}) {
  const t = useT('workspace');
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        onContextMenu={event => {
          event.preventDefault();
          setMenuOpen(true);
        }}
        className={cn(
          'group inline-flex items-center rounded-full border pr-1 text-sm transition-colors',
          isActive
            ? 'border-border-subtle bg-bg-surface text-text-main'
            : 'border-border-subtle bg-bg-canvas text-text-muted hover:bg-bg-subtle hover:text-text-main',
          isDragging && 'z-10 opacity-85',
          'touch-none'
        )}
      >
        <button
          type="button"
          onClick={() => onSelectTab(tab.id)}
          className="inline-flex min-w-0 items-center gap-2 px-3 py-1.5"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-muted/70" />
          <span
            className={cn('h-2 w-2 rounded-full', isActive ? 'bg-primary' : 'bg-text-muted/40')}
          />
          <span className="truncate font-medium">{tab.title}</span>
        </button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={event => event.stopPropagation()}
            className={cn(
              'rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-main',
              isActive
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            )}
            aria-label={t('collections.workbench.actions.moreActions')}
            title={t('collections.workbench.actions.moreActions')}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <button
          type="button"
          onClick={() => onCloseTab(tab.id)}
          className={cn(
            'rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-main',
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          )}
          aria-label={t('collections.workbench.closeTab', { title: tab.title })}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <DropdownMenuContent align="end" className="rounded-lg">
        <DropdownMenuItem onClick={() => onCloseTab(tab.id)}>{t('common.close')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCloseOtherTabs(tab.id)} disabled={openTabCount <= 1}>
          {t('collections.workbench.actions.closeOthers')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCloseAllTabs} disabled={openTabCount === 0}>
          {t('collections.workbench.actions.closeAll')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDuplicateTab(tab.id)}>
          {t('common.duplicate')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EnvironmentSwitcher({
  environments,
  selectedEnvironmentId,
  isLoading,
  onEnvironmentChange,
}: {
  environments: WorkspaceEnvironment[];
  selectedEnvironmentId: string;
  isLoading: boolean;
  onEnvironmentChange: (value: string) => void;
}) {
  const t = useT('workspace');

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-bg-canvas px-2.5 py-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.03125rem] text-text-muted">
        {t('common.environment')}
      </span>
      <Select value={selectedEnvironmentId} onValueChange={onEnvironmentChange}>
        <SelectTrigger
          size="sm"
          className="h-7 min-w-[132px] border-0 bg-transparent px-1.5 text-sm shadow-none"
        >
          <SelectValue
            placeholder={
              isLoading
                ? t('collections.workbench.loadingEnvironments')
                : t('collections.workbench.noEnvironment')
            }
          />
        </SelectTrigger>
        <SelectContent className="min-w-[132px] rounded-lg">
          <SelectItem value="none" className="py-1 text-xs">
            {t('collections.workbench.noEnvironment')}
          </SelectItem>
          {environments.map(environment => (
            <SelectItem
              key={environment.id}
              value={String(environment.id)}
              className="py-1 text-xs"
            >
              {environment.display_name || environment.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RequestToolbar({
  tab,
  onMethodChange,
  onUrlChange,
  onSend,
  onSave,
  onDuplicate,
}: {
  tab: RequestPageTab;
  onMethodChange: (method: RequestMethod) => void;
  onUrlChange: (url: string) => void;
  onSend: () => void;
  onSave: () => void;
  onDuplicate: () => void;
}) {
  const t = useT('workspace');

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-soft p-3">
      <div className="grid gap-3 xl:grid-cols-[140px_minmax(0,1fr)_auto]">
        <Select value={tab.method} onValueChange={value => onMethodChange(value as RequestMethod)}>
          <SelectTrigger className="h-11 w-full rounded-xl border-border-subtle bg-bg-canvas font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHOD_OPTIONS.map(method => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={tab.url}
          onChange={event => onUrlChange(event.target.value)}
          placeholder={t('collections.workbench.urlPlaceholder', {
            template: DEFAULT_REQUEST_TEMPLATE,
          })}
          className="h-11 rounded-xl border-border-subtle bg-bg-canvas px-4 text-sm shadow-none"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            isIcon
            className="h-11 w-11 rounded-full"
            onClick={onSave}
            aria-label={t('collections.workbench.actions.saveTab')}
            title={t('collections.workbench.actions.saveTab')}
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            isIcon
            className="h-11 w-11 rounded-full"
            onClick={onDuplicate}
            aria-label={t('collections.workbench.actions.duplicateTab')}
            title={t('collections.workbench.actions.duplicateTab')}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full px-5"
            onClick={onSend}
            loading={tab.isSending}
          >
            <SendHorizonal className="h-4 w-4" />
            {t('collections.workbench.actions.send')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RequestSectionTabs({
  activeSection,
  onSelectSection,
}: {
  activeSection: RequestSection;
  onSelectSection: (section: RequestSection) => void;
}) {
  const t = useT('workspace');
  const moreTabActive = OVERFLOW_SECTION_ITEMS.includes(activeSection);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRIMARY_SECTION_ITEMS.map(item => (
        <button
          key={item}
          type="button"
          onClick={() => onSelectSection(item)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
            item === activeSection
              ? 'border-border-subtle bg-bg-surface text-text-main'
              : 'border-border-subtle bg-bg-canvas text-text-muted hover:bg-bg-subtle hover:text-text-main'
          )}
        >
          {getSectionIcon(item)}
          {getSectionLabel(t, item)}
        </button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
              moreTabActive
                ? 'border-border-subtle bg-bg-surface text-text-main'
                : 'border-border-subtle bg-bg-canvas text-text-muted hover:bg-bg-subtle hover:text-text-main'
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
            {t('collections.workbench.actions.moreSections')}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40 rounded-lg">
          {OVERFLOW_SECTION_ITEMS.map(item => (
            <DropdownMenuItem
              key={item}
              onClick={() => onSelectSection(item)}
              className={cn(
                activeSection === item && 'bg-accent text-accent-foreground font-medium'
              )}
            >
              {getSectionLabel(t, item)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RequestSectionPanel({
  tab,
  onTabChange,
  onGenerateDoc,
  isGeneratingDoc,
  generatingDocLang,
  docGenerationError,
}: {
  tab: RequestPageTab;
  onTabChange: (updater: (tab: RequestPageTab) => RequestPageTab) => void;
  onGenerateDoc: (lang: ApiSpecLanguage) => Promise<void>;
  isGeneratingDoc: boolean;
  generatingDocLang: ApiSpecLanguage | null;
  docGenerationError: string | null;
}) {
  const t = useT('workspace');

  switch (tab.activeSection) {
    case 'docs':
      return (
        <RequestDocsPanel
          tab={tab}
          isGenerating={isGeneratingDoc}
          generatingLang={generatingDocLang}
          generationError={docGenerationError}
          onGenerateDoc={onGenerateDoc}
          onDocSourceChange={value =>
            onTabChange(current => ({
              ...current,
              docSource: value,
            }))
          }
          onDocMarkdownChange={value =>
            onTabChange(current => ({
              ...current,
              docMarkdown: value,
            }))
          }
          onDocMarkdownZhChange={value =>
            onTabChange(current => ({
              ...current,
              docMarkdownZh: value,
            }))
          }
          onDocMarkdownEnChange={value =>
            onTabChange(current => ({
              ...current,
              docMarkdownEn: value,
            }))
          }
        />
      );
    case 'params':
      return (
        <KeyValueEditor
          title={t('collections.workbench.queryParamsTitle')}
          description={t('collections.workbench.queryParamsDescription')}
          mode={tab.paramsMode}
          rows={tab.paramsRows}
          bulkValue={tab.paramsBulk}
          onModeChange={mode =>
            onTabChange(current =>
              mode === 'bulk'
                ? {
                    ...current,
                    paramsMode: mode,
                    paramsBulk: rowsToBulkText(current.paramsRows),
                  }
                : {
                    ...current,
                    paramsMode: mode,
                    paramsRows: bulkTextToRows(current.paramsBulk),
                  }
            )
          }
          onRowsChange={rows =>
            onTabChange(current => ({
              ...current,
              paramsRows: rows,
              paramsBulk: rowsToBulkText(rows),
            }))
          }
          onBulkChange={bulkValue =>
            onTabChange(current => ({
              ...current,
              paramsBulk: bulkValue,
            }))
          }
        />
      );
    case 'authorization':
      return (
        <AuthorizationPanel
          mode={tab.authorizationMode}
          value={tab.authorizationValue}
          onModeChange={mode =>
            onTabChange(current => ({
              ...current,
              authorizationMode: mode,
            }))
          }
          onValueChange={value =>
            onTabChange(current => ({
              ...current,
              authorizationValue: value,
            }))
          }
        />
      );
    case 'headers':
      return (
        <KeyValueEditor
          title={t('common.headers')}
          description={t('collections.workbench.headersDescription')}
          mode={tab.headersMode}
          rows={tab.headersRows}
          bulkValue={tab.headersBulk}
          onModeChange={mode =>
            onTabChange(current =>
              mode === 'bulk'
                ? {
                    ...current,
                    headersMode: mode,
                    headersBulk: rowsToBulkText(current.headersRows),
                  }
                : {
                    ...current,
                    headersMode: mode,
                    headersRows: bulkTextToRows(current.headersBulk),
                  }
            )
          }
          onRowsChange={rows =>
            onTabChange(current => ({
              ...current,
              headersRows: rows,
              headersBulk: rowsToBulkText(rows),
            }))
          }
          onBulkChange={bulkValue =>
            onTabChange(current => ({
              ...current,
              headersBulk: bulkValue,
            }))
          }
        />
      );
    case 'body':
      return (
        <BodyEditor
          mode={tab.bodyMode}
          value={tab.bodyContent}
          files={tab.bodyFiles}
          binaryFile={tab.binaryFile}
          onModeChange={mode =>
            onTabChange(current => ({
              ...current,
              bodyMode: mode,
              bodyContent: getNextBodyContentForMode(mode, current.bodyMode, current.bodyContent),
            }))
          }
          onValueChange={value =>
            onTabChange(current => ({
              ...current,
              bodyContent: value,
            }))
          }
          onFilesChange={files =>
            onTabChange(current => ({
              ...current,
              bodyFiles: files,
            }))
          }
          onBinaryFileChange={file =>
            onTabChange(current => ({
              ...current,
              binaryFile: file,
            }))
          }
        />
      );
    case 'scripts':
      return (
        <ScriptsPanel
          value={tab.scripts}
          onValueChange={value =>
            onTabChange(current => ({
              ...current,
              scripts: value,
            }))
          }
        />
      );
    case 'settings':
      return (
        <SettingsPanel
          settings={tab.settings}
          onSettingChange={(key, value) =>
            onTabChange(current => ({
              ...current,
              settings: {
                ...current.settings,
                [key]: value,
              },
            }))
          }
        />
      );
    default:
      return null;
  }
}

function RequestDocsPanel({
  tab,
  isGenerating,
  generatingLang,
  generationError,
  onGenerateDoc,
  onDocSourceChange,
  onDocMarkdownChange,
  onDocMarkdownZhChange,
  onDocMarkdownEnChange,
}: {
  tab: RequestPageTab;
  isGenerating: boolean;
  generatingLang: ApiSpecLanguage | null;
  generationError: string | null;
  onGenerateDoc: (lang: ApiSpecLanguage) => Promise<void>;
  onDocSourceChange: (value: 'manual' | 'ai') => void;
  onDocMarkdownChange: (value: string) => void;
  onDocMarkdownZhChange: (value: string) => void;
  onDocMarkdownEnChange: (value: string) => void;
}) {
  const t = useT('workspace');
  const [selectedDocLanguage, setSelectedDocLanguage] = useState<RequestDocLanguage>(
    tab.docMarkdown ? 'default' : tab.docMarkdownEn ? 'en' : tab.docMarkdownZh ? 'zh' : 'default'
  );
  const [docMode, setDocMode] = useState<RequestDocMode>('preview');

  const selectedMarkdown =
    selectedDocLanguage === 'en'
      ? tab.docMarkdownEn
      : selectedDocLanguage === 'zh'
        ? tab.docMarkdownZh
        : tab.docMarkdown;
  const hasAnyMarkdown = Boolean(
    tab.docMarkdown.trim() || tab.docMarkdownEn.trim() || tab.docMarkdownZh.trim()
  );
  const selectedLanguageLabel = t(
    selectedDocLanguage === 'en'
      ? 'collections.workbench.docs.englishMarkdownLabel'
      : selectedDocLanguage === 'zh'
        ? 'collections.workbench.docs.chineseMarkdownLabel'
        : 'collections.workbench.docs.defaultMarkdownLabel'
  );
  const selectedMarkdownChangeHandler =
    selectedDocLanguage === 'en'
      ? onDocMarkdownEnChange
      : selectedDocLanguage === 'zh'
        ? onDocMarkdownZhChange
        : onDocMarkdownChange;
  const handleGenerateDoc = (lang: ApiSpecLanguage) => {
    setSelectedDocLanguage(lang);
    setDocMode('preview');
    void onGenerateDoc(lang);
  };
  const handleCopyMarkdown = async () => {
    if (!selectedMarkdown.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedMarkdown);
      toast.success(t('collections.workbench.docs.copySuccess'));
    } catch {
      toast.error(t('toasts.copyFailed'));
    }
  };

  return (
    <div className="min-h-[640px] rounded-xl border border-border-subtle bg-bg-canvas">
      <div className="flex flex-col gap-4 border-b border-border-subtle px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDocMode('preview')}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              docMode === 'preview'
                ? 'bg-bg-soft text-text-main'
                : 'text-text-muted hover:text-text-main'
            )}
          >
            {t('collections.workbench.docs.previewMode')}
          </button>
          <button
            type="button"
            onClick={() => setDocMode('edit')}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              docMode === 'edit'
                ? 'bg-bg-soft text-text-main'
                : 'text-text-muted hover:text-text-main'
            )}
          >
            {t('collections.workbench.docs.editMode')}
          </button>
          <Select
            value={selectedDocLanguage}
            onValueChange={value => setSelectedDocLanguage(value as RequestDocLanguage)}
          >
            <SelectTrigger className="h-9 w-[172px] rounded-full border-border-subtle bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                {t('collections.workbench.docs.defaultMarkdownLabel')}
              </SelectItem>
              <SelectItem value="en">
                {t('collections.workbench.docs.englishMarkdownLabel')}
              </SelectItem>
              <SelectItem value="zh">
                {t('collections.workbench.docs.chineseMarkdownLabel')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopyMarkdown()}
            disabled={!selectedMarkdown.trim()}
          >
            <Copy className="h-4 w-4" />
            {t('collections.workbench.docs.copyMarkdown')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleGenerateDoc('en')}
            disabled={isGenerating}
            loading={generatingLang === 'en'}
          >
            <Sparkles className="h-4 w-4" />
            {t('collections.workbench.docs.generateEnglish')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleGenerateDoc('zh')}
            disabled={isGenerating}
            loading={generatingLang === 'zh'}
          >
            <Sparkles className="h-4 w-4" />
            {t('collections.workbench.docs.generateChinese')}
          </Button>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        {isGenerating ? (
          <div className="rounded-md border border-border-subtle bg-bg-soft px-3 py-2 text-sm text-text-muted">
            {t('collections.workbench.docs.generating')}
          </div>
        ) : null}
        {generationError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-error-subtle px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">{t('collections.workbench.docs.generateFailed')}</div>
              <div className="mt-1 break-words text-xs leading-relaxed">{generationError}</div>
            </div>
          </div>
        ) : null}

        {!hasAnyMarkdown && docMode === 'preview' ? (
          <div className="mx-auto flex min-h-[520px] max-w-2xl flex-col items-center justify-start px-4 pt-16 text-center">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-subtle bg-bg-soft text-text-main shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex flex-col items-center gap-3 text-xl font-medium text-text-muted sm:flex-row">
              <span>{t('collections.workbench.docs.emptyTitle')}</span>
              <button
                type="button"
                onClick={() => handleGenerateDoc('en')}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-canvas px-4 py-2 text-sm font-semibold text-text-main shadow-sm transition-colors hover:bg-bg-soft disabled:pointer-events-none disabled:opacity-50"
              >
                <Sparkles className="h-5 w-5" />
                {t('collections.workbench.docs.writeWithAi')}
              </button>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-text-muted">
              {t('collections.workbench.docs.emptyDescription')}
            </p>
          </div>
        ) : docMode === 'preview' ? (
          <div className="mx-auto max-w-4xl px-2 py-8 md:px-6">
            <RequestMarkdownRenderer
              value={selectedMarkdown}
              emptyLabel={t('collections.workbench.docs.emptyLanguage', {
                language: selectedLanguageLabel,
              })}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label htmlFor="request-doc-source">{t('common.docSource')}</Label>
                <Select
                  value={tab.docSource}
                  onValueChange={value => onDocSourceChange(value as 'manual' | 'ai')}
                >
                  <SelectTrigger id="request-doc-source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{t('apiSpecsPage.docSourceManual')}</SelectItem>
                    <SelectItem value="ai">{t('apiSpecsPage.docSourceAi')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border border-border-subtle bg-bg-soft px-3 py-2 text-sm text-text-muted">
                {t('collections.workbench.docs.saveHint')}
              </div>
            </div>

            <Label htmlFor="request-doc-markdown-editor">{selectedLanguageLabel}</Label>
            <Textarea
              id="request-doc-markdown-editor"
              value={selectedMarkdown}
              onChange={event => selectedMarkdownChangeHandler(event.target.value)}
              placeholder={t('collections.workbench.docs.markdownPlaceholder')}
              rows={18}
              root
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RequestMarkdownRenderer({ value, emptyLabel }: { value: string; emptyLabel: string }) {
  if (!value.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-border-subtle bg-bg-soft p-8 text-center text-sm text-text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="text-[15px] leading-8 text-text-main">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ className, ...props }) => (
            <h1
              className={cn(
                'mb-6 mt-0 border-b border-border-subtle pb-4 text-3xl font-semibold leading-tight tracking-[-0.03em] text-text-main',
                className
              )}
              {...props}
            />
          ),
          h2: ({ className, ...props }) => (
            <h2
              className={cn(
                'mb-3 mt-10 text-2xl font-semibold leading-tight tracking-[-0.02em] text-text-main first:mt-0',
                className
              )}
              {...props}
            />
          ),
          h3: ({ className, ...props }) => (
            <h3
              className={cn(
                'mb-2 mt-7 text-lg font-semibold leading-snug text-text-main',
                className
              )}
              {...props}
            />
          ),
          p: ({ className, ...props }) => (
            <p className={cn('my-4 text-text-muted', className)} {...props} />
          ),
          a: ({ className, ...props }) => (
            <a
              className={cn(
                'font-medium text-primary underline-offset-4 hover:text-primary-deep hover:underline',
                className
              )}
              {...props}
            />
          ),
          ul: ({ className, ...props }) => (
            <ul
              className={cn('my-4 list-disc space-y-2 pl-6 text-text-muted', className)}
              {...props}
            />
          ),
          ol: ({ className, ...props }) => (
            <ol
              className={cn('my-4 list-decimal space-y-2 pl-6 text-text-muted', className)}
              {...props}
            />
          ),
          li: ({ className, ...props }) => (
            <li className={cn('pl-1 marker:text-text-muted', className)} {...props} />
          ),
          blockquote: ({ className, ...props }) => (
            <blockquote
              className={cn(
                'my-6 rounded-r-xl border-l-4 border-primary bg-bg-soft px-5 py-3 text-text-muted',
                className
              )}
              {...props}
            />
          ),
          hr: ({ className, ...props }) => (
            <hr className={cn('my-8 border-border-subtle', className)} {...props} />
          ),
          code: ({ className, children, ...props }) => {
            const isInlineCode = !className;

            if (isInlineCode) {
              return (
                <code
                  className="rounded-md bg-bg-soft px-1.5 py-0.5 font-mono text-[0.925em] text-text-main"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children, ...props }) => (
            <pre
              className="my-5 overflow-x-auto rounded-xl border border-border-subtle bg-bg-soft p-5 text-sm leading-7 text-text-main shadow-sm"
              {...props}
            >
              {children}
            </pre>
          ),
          table: ({ className, ...props }) => (
            <div className="my-6 overflow-x-auto rounded-xl border border-border-subtle shadow-sm">
              <table
                className={cn('min-w-full border-collapse text-sm text-text-main', className)}
                {...props}
              />
            </div>
          ),
          th: ({ className, ...props }) => (
            <th
              className={cn(
                'border-b border-border-subtle bg-bg-soft px-4 py-3 text-left font-semibold',
                className
              )}
              {...props}
            />
          ),
          td: ({ className, ...props }) => (
            <td
              className={cn(
                'border-t border-border-subtle px-4 py-3 align-top text-text-muted',
                className
              )}
              {...props}
            />
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}

function KeyValueEditor({
  title,
  description,
  mode,
  rows,
  bulkValue,
  onModeChange,
  onRowsChange,
  onBulkChange,
}: {
  title: string;
  description: string;
  mode: BulkMode;
  rows: KeyValueRow[];
  bulkValue: string;
  onModeChange: (mode: BulkMode) => void;
  onRowsChange: (rows: KeyValueRow[]) => void;
  onBulkChange: (value: string) => void;
}) {
  const t = useT('workspace');
  const updateRow = (rowId: string, patch: Partial<KeyValueRow>) => {
    onRowsChange(rows.map(row => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const removeRow = (rowId: string) => {
    const nextRows = rows.filter(row => row.id !== rowId);
    onRowsChange(nextRows.length > 0 ? nextRows : [createKeyValueRow()]);
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-canvas">
      <div className="flex flex-col gap-4 border-b border-border-subtle px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-medium text-text-main">{title}</h3>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border-subtle bg-bg-soft p-1">
            <button
              type="button"
              onClick={() => onModeChange('table')}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                mode === 'table'
                  ? 'bg-bg-canvas text-text-main'
                  : 'text-text-muted hover:text-text-main'
              )}
            >
              {t('collections.workbench.editors.table')}
            </button>
            <button
              type="button"
              onClick={() => onModeChange('bulk')}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                mode === 'bulk'
                  ? 'bg-bg-canvas text-text-main'
                  : 'text-text-muted hover:text-text-main'
              )}
            >
              {t('collections.workbench.editors.bulkEdit')}
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRowsChange([...rows, createKeyValueRow()])}
          >
            <Plus className="h-4 w-4" />
            {t('collections.workbench.actions.addRow')}
          </Button>
        </div>
      </div>

      {mode === 'bulk' ? (
        <div className="px-5 py-5">
          <Textarea
            value={bulkValue}
            onChange={event => onBulkChange(event.target.value)}
            rows={10}
            className="min-h-[220px] rounded-xl font-mono text-sm"
            placeholder={t('collections.workbench.editors.bulkPlaceholder')}
          />
        </div>
      ) : (
        <div className="overflow-x-auto px-5 py-5">
          <div className="min-w-[760px] space-y-3">
            <div className="grid grid-cols-[1.05fr_1.25fr_1fr_56px] gap-3 px-3 text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
              <span>{t('collections.workbench.editors.key')}</span>
              <span>{t('collections.workbench.editors.value')}</span>
              <span>{t('common.description')}</span>
              <span />
            </div>

            {rows.map(row => (
              <div key={row.id} className="grid grid-cols-[1.05fr_1.25fr_1fr_56px] gap-3">
                <Input
                  value={row.key}
                  onChange={event => updateRow(row.id, { key: event.target.value })}
                  placeholder={t('collections.workbench.editors.keyPlaceholder')}
                  className="rounded-xl"
                />
                <Input
                  value={row.value}
                  onChange={event => updateRow(row.id, { value: event.target.value })}
                  placeholder="1"
                  className="rounded-xl"
                />
                <Input
                  value={row.description}
                  onChange={event => updateRow(row.id, { description: event.target.value })}
                  placeholder={t('collections.workbench.editors.descriptionPlaceholder')}
                  className="rounded-xl"
                />
                <Button
                  type="button"
                  variant="ghost"
                  isIcon
                  className="h-9 w-9 rounded-full"
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthorizationPanel({
  mode,
  value,
  onModeChange,
  onValueChange,
}: {
  mode: AuthorizationMode;
  value: string;
  onModeChange: (mode: AuthorizationMode) => void;
  onValueChange: (value: string) => void;
}) {
  const t = useT('workspace');

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card className="rounded-xl border-border-subtle bg-bg-canvas py-0">
        <CardHeader className="border-b border-border-subtle py-5">
          <CardTitle>{t('collections.workbench.sections.authorization')}</CardTitle>
          <CardDescription>{t('collections.workbench.authorization.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="request-auth-mode">
              {t('collections.workbench.authorization.typeLabel')}
            </Label>
            <Select
              value={mode}
              onValueChange={nextValue => onModeChange(nextValue as AuthorizationMode)}
            >
              <SelectTrigger id="request-auth-mode" className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTHORIZATION_OPTIONS.map(option => (
                  <SelectItem key={option} value={option}>
                    {getAuthorizationModeLabel(t, option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border-subtle bg-bg-canvas py-0">
        <CardHeader className="border-b border-border-subtle py-5">
          <CardTitle>{t('collections.workbench.authorization.credentialsTitle')}</CardTitle>
          <CardDescription>
            {t('collections.workbench.authorization.credentialsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5 py-5">
          {mode === 'none' ? (
            <div className="rounded-xl border border-dashed border-border-subtle bg-bg-soft p-5 text-sm text-text-muted">
              {t('collections.workbench.authorization.noneDescription')}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="request-auth-value">{getAuthCredentialLabel(t, mode)}</Label>
              <Input
                id="request-auth-value"
                value={value}
                onChange={event => onValueChange(event.target.value)}
                placeholder={getAuthCredentialPlaceholder(t, mode)}
                className="rounded-xl"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BodyEditor({
  mode,
  value,
  files,
  binaryFile,
  onModeChange,
  onValueChange,
  onFilesChange,
  onBinaryFileChange,
}: {
  mode: BodyMode;
  value: string;
  files: Record<string, BodyFileValue>;
  binaryFile: BodyFileValue | null;
  onModeChange: (mode: BodyMode) => void;
  onValueChange: (value: string) => void;
  onFilesChange: (files: Record<string, BodyFileValue>) => void;
  onBinaryFileChange: (file: BodyFileValue | null) => void;
}) {
  const t = useT('workspace');
  const bodyModeIcons: Record<BodyMode, ComponentType<{ className?: string }>> = {
    json: Braces,
    raw: FileType2,
    'form-data': Upload,
    'x-www-form-urlencoded': FormInput,
    binary: Binary,
    graphql: FileCode2,
  };
  const structuredRows =
    mode === 'form-data' || mode === 'x-www-form-urlencoded'
      ? parseStructuredBodyRows(value)
      : [createKeyValueRow()];
  const graphqlValue = mode === 'graphql' ? parseGraphqlBodyValue(value) : null;
  const binaryValue = mode === 'binary' ? parseBinaryBodyValue(value) : null;
  const usesFileRows = mode === 'form-data';

  const updateStructuredRows = (nextRows: KeyValueRow[]) => {
    onValueChange(serializeStructuredBodyRows(nextRows));
  };

  const updateStructuredRow = (rowId: string, patch: Partial<KeyValueRow>) => {
    updateStructuredRows(
      structuredRows.map(row => (row.id === rowId ? { ...row, ...patch } : row))
    );
  };

  const removeStructuredRow = (rowId: string) => {
    const nextRows = structuredRows.filter(row => row.id !== rowId);
    updateStructuredRows(nextRows);

    if (files[rowId]) {
      const nextFiles = { ...files };
      delete nextFiles[rowId];
      onFilesChange(nextFiles);
    }
  };

  const handleStructuredTypeChange = (rowId: string, nextType: BodyValueType) => {
    updateStructuredRows(
      structuredRows.map(row =>
        row.id === rowId
          ? {
              ...row,
              type: nextType,
              value: nextType === 'file' ? '' : row.value,
            }
          : row
      )
    );

    if (nextType !== 'file' && files[rowId]) {
      const nextFiles = { ...files };
      delete nextFiles[rowId];
      onFilesChange(nextFiles);
    }
  };

  const handleStructuredFileSelect = async (rowId: string, file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const nextFile = await createBodyFileValue(file);
      onFilesChange({
        ...files,
        [rowId]: nextFile,
      });
      updateStructuredRow(rowId, {
        type: 'file',
        value: nextFile.name,
      });
    } catch {
      toast.error(t('collections.workbench.body.fileReadFailed'));
    }
  };

  const clearStructuredFile = (rowId: string) => {
    const nextFiles = { ...files };
    delete nextFiles[rowId];
    onFilesChange(nextFiles);
    updateStructuredRow(rowId, { value: '' });
  };

  const updateGraphqlValue = (patch: Partial<GraphqlBodyValue>) => {
    onValueChange(
      serializeGraphqlBodyValue({
        ...(graphqlValue ?? {
          query: '',
          variables_text: '',
          operation_name: '',
        }),
        ...patch,
      })
    );
  };

  const updateBinaryValue = (patch: Partial<BinaryBodyValue>) => {
    onValueChange(
      serializeBinaryBodyValue({
        ...(binaryValue ?? {
          file_name: '',
          content_type: '',
        }),
        ...patch,
      })
    );
  };

  const handleBinaryFileSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const nextFile = await createBodyFileValue(file);
      onBinaryFileChange(nextFile);
      onValueChange(
        serializeBinaryBodyValue({
          file_name: nextFile.name,
          content_type:
            nextFile.type || binaryValue?.content_type?.trim() || 'application/octet-stream',
        })
      );
    } catch {
      toast.error(t('collections.workbench.body.fileReadFailed'));
    }
  };

  const clearBinaryFile = () => {
    onBinaryFileChange(null);
    onValueChange('');
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-canvas">
      <div className="border-b border-border-subtle px-5 py-5">
        <div>
          <h3 className="text-base font-medium text-text-main">
            {t('collections.workbench.sections.body')}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {t('collections.workbench.body.description')}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {BODY_MODE_OPTIONS.map(option => {
            const Icon = bodyModeIcons[option];

            return (
              <button
                key={option}
                type="button"
                onClick={() => onModeChange(option)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                  option === mode
                    ? 'border-border-subtle bg-primary text-primary-foreground'
                    : 'border-border-subtle bg-bg-soft text-text-main hover:bg-bg-subtle'
                )}
              >
                <Icon className="h-4 w-4" />
                {getBodyModeLabel(t, option)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-5">
        {mode === 'json' || mode === 'raw' ? (
          <Textarea
            value={value}
            onChange={event => onValueChange(event.target.value)}
            rows={14}
            className="min-h-[280px] rounded-xl font-mono text-sm"
            placeholder={
              mode === 'json'
                ? DEFAULT_JSON_PLACEHOLDER
                : t('collections.workbench.body.rawPlaceholder')
            }
          />
        ) : null}

        {mode === 'form-data' || mode === 'x-www-form-urlencoded' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-text-muted">
                {mode === 'form-data'
                  ? t('collections.workbench.body.formDataHelp')
                  : t('collections.workbench.body.urlEncodedHelp')}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateStructuredRows([...structuredRows, createKeyValueRow('', '', '')])
                }
              >
                <Plus className="h-4 w-4" />
                {t('collections.workbench.actions.addRow')}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <div className={cn('space-y-3', usesFileRows ? 'min-w-[920px]' : 'min-w-[760px]')}>
                <div
                  className={cn(
                    'grid gap-3 px-3 text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted',
                    usesFileRows
                      ? 'grid-cols-[1fr_140px_1.35fr_1fr_56px]'
                      : 'grid-cols-[1.05fr_1.25fr_1fr_56px]'
                  )}
                >
                  <span>{t('collections.workbench.editors.key')}</span>
                  {usesFileRows ? (
                    <span>{t('collections.workbench.body.valueTypeLabel')}</span>
                  ) : null}
                  <span>{t('collections.workbench.editors.value')}</span>
                  <span>{t('common.description')}</span>
                  <span />
                </div>

                {structuredRows.map(row => {
                  const selectedFile = files[row.id];
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'grid gap-3',
                        usesFileRows
                          ? 'grid-cols-[1fr_140px_1.35fr_1fr_56px]'
                          : 'grid-cols-[1.05fr_1.25fr_1fr_56px]'
                      )}
                    >
                      <Input
                        value={row.key}
                        onChange={event => updateStructuredRow(row.id, { key: event.target.value })}
                        placeholder={t('collections.workbench.editors.keyPlaceholder')}
                        className="rounded-xl"
                      />

                      {usesFileRows ? (
                        <Select
                          value={row.type}
                          onValueChange={nextValue =>
                            handleStructuredTypeChange(row.id, nextValue as BodyValueType)
                          }
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">
                              {t('collections.workbench.body.textValueType')}
                            </SelectItem>
                            <SelectItem value="file">
                              {t('collections.workbench.body.fileValueType')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : null}

                      {usesFileRows && row.type === 'file' ? (
                        <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-soft px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-subtle bg-bg-canvas px-3 py-1.5 text-xs font-medium text-text-main transition-colors hover:bg-bg-subtle">
                              <Upload className="h-3.5 w-3.5" />
                              {selectedFile
                                ? t('collections.workbench.body.replaceFile')
                                : t('collections.workbench.body.selectFile')}
                              <input
                                type="file"
                                className="hidden"
                                onChange={event =>
                                  void handleStructuredFileSelect(
                                    row.id,
                                    event.target.files?.[0] ?? null
                                  )
                                }
                              />
                            </label>
                            {selectedFile ? (
                              <Badge variant="outline" className="font-normal">
                                {selectedFile.name} • {formatBodyFileSize(selectedFile.size)}
                              </Badge>
                            ) : row.value.trim() ? (
                              <Badge variant="outline" className="font-normal">
                                {row.value}
                              </Badge>
                            ) : (
                              <span className="text-sm text-text-muted">
                                {t('collections.workbench.body.noFileSelected')}
                              </span>
                            )}
                            {selectedFile || row.value.trim() ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-full px-3"
                                onClick={() => clearStructuredFile(row.id)}
                              >
                                {t('collections.workbench.body.clearFile')}
                              </Button>
                            ) : null}
                          </div>
                          <div className="text-xs text-text-muted">
                            {selectedFile
                              ? selectedFile.type ||
                                t('collections.workbench.body.binaryFallbackType')
                              : row.value.trim()
                                ? t('collections.workbench.body.reselectFile')
                                : t('collections.workbench.body.fileFieldHelp')}
                          </div>
                        </div>
                      ) : (
                        <Input
                          value={row.value}
                          onChange={event =>
                            updateStructuredRow(row.id, { value: event.target.value })
                          }
                          placeholder={
                            mode === 'form-data'
                              ? t('collections.workbench.body.formValuePlaceholder')
                              : t('collections.workbench.body.urlEncodedValuePlaceholder')
                          }
                          className="rounded-xl"
                        />
                      )}

                      <Input
                        value={row.description}
                        onChange={event =>
                          updateStructuredRow(row.id, { description: event.target.value })
                        }
                        placeholder={t('collections.workbench.editors.descriptionPlaceholder')}
                        className="rounded-xl"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        isIcon
                        className="h-9 w-9 rounded-full"
                        onClick={() => removeStructuredRow(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {mode === 'binary' && binaryValue ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-dashed border-border-subtle bg-bg-soft p-5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                  <Upload className="h-4 w-4" />
                  {binaryFile
                    ? t('collections.workbench.body.replaceFile')
                    : t('collections.workbench.body.selectBinaryFile')}
                  <input
                    type="file"
                    className="hidden"
                    onChange={event => void handleBinaryFileSelect(event.target.files?.[0] ?? null)}
                  />
                </label>
                {binaryFile ? (
                  <Badge variant="outline" className="font-normal">
                    {binaryFile.name} • {formatBodyFileSize(binaryFile.size)}
                  </Badge>
                ) : binaryValue.file_name.trim() ? (
                  <Badge variant="outline" className="font-normal">
                    {binaryValue.file_name}
                  </Badge>
                ) : (
                  <span className="text-sm text-text-muted">
                    {t('collections.workbench.body.noBinaryFileSelected')}
                  </span>
                )}
                {binaryFile || binaryValue.file_name.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3"
                    onClick={clearBinaryFile}
                  >
                    {t('collections.workbench.body.clearFile')}
                  </Button>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-text-muted">
                {binaryFile || binaryValue.file_name.trim()
                  ? t('collections.workbench.body.binaryReadyHelp')
                  : t('collections.workbench.body.binaryEmptyHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-binary-content-type">
                {t('collections.workbench.body.contentTypeLabel')}
              </Label>
              <Input
                id="request-binary-content-type"
                value={binaryValue.content_type ?? ''}
                onChange={event => updateBinaryValue({ content_type: event.target.value })}
                placeholder="application/octet-stream"
                className="rounded-xl font-mono"
              />
            </div>
          </div>
        ) : null}

        {mode === 'graphql' && graphqlValue ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="request-graphql-operation">
                {t('collections.workbench.body.operationNameLabel')}
              </Label>
              <Input
                id="request-graphql-operation"
                value={graphqlValue.operation_name ?? ''}
                onChange={event => updateGraphqlValue({ operation_name: event.target.value })}
                placeholder={t('collections.workbench.body.operationNamePlaceholder')}
                className="rounded-xl"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="request-graphql-query">
                  {t('collections.workbench.body.graphqlQueryLabel')}
                </Label>
                <Textarea
                  id="request-graphql-query"
                  value={graphqlValue.query}
                  onChange={event => updateGraphqlValue({ query: event.target.value })}
                  rows={14}
                  className="min-h-[280px] rounded-xl font-mono text-sm"
                  placeholder={DEFAULT_GRAPHQL_QUERY}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="request-graphql-variables">
                  {t('collections.workbench.body.graphqlVariablesLabel')}
                </Label>
                <Textarea
                  id="request-graphql-variables"
                  value={graphqlValue.variables_text ?? ''}
                  onChange={event => updateGraphqlValue({ variables_text: event.target.value })}
                  rows={14}
                  className="min-h-[280px] rounded-xl font-mono text-sm"
                  placeholder={DEFAULT_GRAPHQL_VARIABLES}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScriptsPanel({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const t = useT('workspace');

  return (
    <Card className="rounded-xl border-border-subtle bg-bg-canvas py-0">
      <CardHeader className="border-b border-border-subtle py-5">
        <CardTitle>{t('collections.workbench.sections.scripts')}</CardTitle>
        <CardDescription>{t('collections.workbench.scripts.description')}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 py-5">
        <Textarea
          value={value}
          onChange={event => onValueChange(event.target.value)}
          rows={14}
          className="min-h-[280px] rounded-xl font-mono text-sm"
          placeholder={t('collections.workbench.scripts.placeholder')}
        />
      </CardContent>
    </Card>
  );
}

function SettingsPanel({
  settings,
  onSettingChange,
}: {
  settings: RequestPageTab['settings'];
  onSettingChange: (key: keyof RequestPageTab['settings'], value: boolean) => void;
}) {
  const t = useT('workspace');
  const settingItems: Array<{
    key: keyof RequestPageTab['settings'];
    title: string;
    description: string;
  }> = [
    {
      key: 'followRedirects',
      title: t('collections.workbench.settings.followRedirectsTitle'),
      description: t('collections.workbench.settings.followRedirectsDescription'),
    },
    {
      key: 'strictTls',
      title: t('collections.workbench.settings.strictTlsTitle'),
      description: t('collections.workbench.settings.strictTlsDescription'),
    },
    {
      key: 'persistCookies',
      title: t('collections.workbench.settings.persistCookiesTitle'),
      description: t('collections.workbench.settings.persistCookiesDescription'),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {settingItems.map(item => (
        <Card key={item.key} className="rounded-xl border-border-subtle bg-bg-canvas py-0">
          <CardHeader className="border-b border-border-subtle py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription className="mt-1">{item.description}</CardDescription>
              </div>
              <Switch
                checked={settings[item.key]}
                onCheckedChange={checked => onSettingChange(item.key, checked)}
              />
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function ResponsePanel({
  response,
  isSending,
  onSaveAsExample,
  canSaveAsExample,
  isSavingExample,
}: {
  response: ResponseDraft;
  isSending: boolean;
  onSaveAsExample: () => void;
  canSaveAsExample: boolean;
  isSavingExample: boolean;
}) {
  const t = useT('workspace');
  const responseHeaders = Object.entries(response.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return (
    <Card className="min-h-[320px] gap-0 rounded-xl border-border-subtle bg-bg-canvas py-0">
      <CardHeader className="gap-4 border-b border-border-subtle py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-xl tracking-normal">{t('common.response')}</CardTitle>
            <CardDescription className="mt-1">
              {t('collections.workbench.response.description')}
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSaveAsExample}
              disabled={!canSaveAsExample}
              loading={isSavingExample}
            >
              <Save className="h-4 w-4" />
              {t('collections.workbench.actions.saveAsExample')}
            </Button>
            <MetricBadge
              label={t('common.status')}
              value={
                response.status !== null ? `${response.status} ${response.statusLabel}`.trim() : '-'
              }
            />
            <MetricBadge
              label={t('common.duration')}
              value={response.durationMs !== null ? `${response.durationMs} ms` : '-'}
            />
            <MetricBadge
              label={t('collections.workbench.response.size')}
              value={response.sizeBytes !== null ? `${response.sizeBytes} B` : '-'}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-[260px] flex-1 flex-col px-5 py-5">
        {isSending ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-soft text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-primary" />
            <p className="mt-4 text-sm font-medium text-text-main">
              {t('collections.workbench.response.sendingTitle')}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {t('collections.workbench.response.sendingDescription')}
            </p>
          </div>
        ) : response.error ? (
          <div className="flex flex-1 flex-col justify-center rounded-xl border border-border-subtle bg-bg-surface p-6">
            <p className="text-sm font-medium text-text-main">
              {t('collections.workbench.response.errorTitle')}
            </p>
            <p className="mt-2 text-sm leading-6 text-text-main">{response.error}</p>
          </div>
        ) : response.status === null ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-soft text-center">
            <p className="text-base font-medium text-text-main">
              {t('collections.workbench.response.emptyTitle')}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
              {t('collections.workbench.response.emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {responseHeaders ? (
              <div className="rounded-xl border border-border-subtle bg-bg-soft p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                  {t('common.headers')}
                </p>
                <pre className="overflow-auto text-xs leading-6 text-text-main">
                  {responseHeaders}
                </pre>
              </div>
            ) : null}
            <pre className="flex-1 overflow-auto rounded-xl border border-border-subtle bg-bg-soft p-5 text-sm leading-6 text-text-main">
              {response.body || t('collections.workbench.response.emptyBody')}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-border-subtle bg-bg-soft px-3 py-1.5 text-sm">
      <span className="text-text-muted">{label}: </span>
      <span className="font-medium text-text-main">{value}</span>
    </div>
  );
}

function MethodBadge({ method, compact = false }: { method: RequestMethod; compact?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium tracking-normal',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        METHOD_BADGE_STYLES[method]
      )}
    >
      {method}
    </span>
  );
}
