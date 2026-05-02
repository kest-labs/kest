'use client';

import { useQuery } from '@tanstack/react-query';
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  SendHorizonal,
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
import {
  collectionKeys,
  useCreateCollection,
  useDeleteCollection,
  useUpdateCollection,
} from '@/hooks/use-collections';
import {
  useCreateRequestExample,
  useDeleteRequestExample,
  useRequestExample,
  useRequestExamples,
  useSaveRequestExampleResponse,
  useSetDefaultRequestExample,
  useUpdateRequestExample,
} from '@/hooks/use-example';
import { useEnvironments } from '@/hooks/use-environments';
import { useCreateProjectHistory } from '@/hooks/use-histories';
import { useImportMarkdownCollection, useImportPostmanCollection } from '@/hooks/use-importer';
import { useT } from '@/i18n/client';
import { collectionService } from '@/services/collection';
import { localRunnerService } from '@/services/local-runner';
import { useCreateRequest, useDeleteRequest, useUpdateRequest } from '@/hooks/use-requests';
import { requestService } from '@/services/request';
import type { ScopedTranslations } from '@/i18n/shared';
import type { ProjectCollection, ProjectCollectionTreeNode } from '@/types/collection';
import type {
  CreateExampleRequest,
  RequestExample,
  SaveExampleResponseRequest,
  UpdateExampleRequest,
} from '@/types/example';
import type { ProjectEnvironment } from '@/types/environment';
import type { CreateHistoryRequest } from '@/types/history';
import type {
  ImportMarkdownCollectionRequest,
  ImportPostmanCollectionRequest,
} from '@/types/importer';
import type {
  CreateRequestRequest,
  ProjectRequest,
  RequestAuthConfig,
  RequestKeyValue,
  RunRequestResponse,
  UpdateRequestRequest,
} from '@/types/request';
import { cn } from '@/utils';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type RequestSection =
  | 'params'
  | 'authorization'
  | 'headers'
  | 'body'
  | 'scripts'
  | 'settings'
  | 'examples';
type BulkMode = 'table' | 'bulk';
type AuthorizationMode = 'none' | 'bearer' | 'basic' | 'api-key';
type BodyMode = 'json' | 'raw' | 'form-data';

interface KeyValueRow {
  id: string;
  key: string;
  value: string;
  description: string;
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

interface RequestPageTab {
  id: string;
  title: string;
  collectionId: string | null;
  method: RequestMethod;
  url: string;
  pathParams: Record<string, string>;
  activeSection: RequestSection;
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
  color: string;
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

interface ImportDialogTarget {
  kind: ImportDialogKind;
  parentCollectionId: string | null;
  parentCollectionName: string | null;
}

type ImportDialogKind = 'postman' | 'markdown';
type ProjectTranslationFn = ScopedTranslations<'project'>;
const METHOD_OPTIONS: RequestMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const SECTION_ITEMS: RequestSection[] = [
  'params',
  'authorization',
  'headers',
  'body',
  'scripts',
  'settings',
  'examples',
];
const BODY_MODE_OPTIONS: BodyMode[] = ['json', 'raw', 'form-data'];
const AUTHORIZATION_OPTIONS: AuthorizationMode[] = ['none', 'bearer', 'basic', 'api-key'];
const COLLECTION_COLORS = ['#2563eb', '#0f766e', '#ea580c', '#7c3aed', '#dc2626'];
const REQUEST_TEMPLATE_PATTERN = /\{\{([^}]+)\}\}/g;
const METHOD_BADGE_STYLES: Record<RequestMethod, string> = {
  GET: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  POST: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  PUT: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  PATCH: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  DELETE: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

const createLocalId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

const DEFAULT_REQUEST_TEMPLATE = '{{base_url}}/path';

const getDefaultRequestTitle = (t: ProjectTranslationFn, index: number) =>
  index === 1
    ? t('collections.workbench.defaultRequestTitle')
    : t('collections.workbench.defaultRequestTitleWithIndex', { index });

const getDefaultCollectionName = (t: ProjectTranslationFn, index: number) =>
  t('collections.workbench.defaultCollectionName', { index });

const getSectionLabel = (t: ProjectTranslationFn, section: RequestSection) =>
  t(`collections.workbench.sections.${section}`);

const getBodyModeLabel = (
  t: ProjectTranslationFn,
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
    case 'none':
    case undefined:
    case null:
    default:
      return mode ? String(mode) : t('collections.workbench.authModes.none');
  }
};

const getAuthorizationModeLabel = (
  t: ProjectTranslationFn,
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

const getApiKeyLocationLabel = (t: ProjectTranslationFn, location?: string | null) => {
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

const getAuthCredentialLabel = (t: ProjectTranslationFn, mode: AuthorizationMode) => {
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

const getAuthCredentialPlaceholder = (t: ProjectTranslationFn, mode: AuthorizationMode) => {
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
  t: ProjectTranslationFn,
  responseStatus: number,
  responseTime: number
) =>
  responseStatus > 0
    ? t('collections.workbench.examples.responseCaptured', {
        status: responseStatus,
        time: responseTime,
      })
    : t('collections.workbench.examples.notCaptured');

const createKeyValueRow = (key = '', value = '', description = ''): KeyValueRow => ({
  id: createLocalId('kv'),
  key,
  value,
  description,
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

const toScriptsValue = (request: ProjectRequest) =>
  [request.pre_request, request.test].filter(Boolean).join('\n\n');

const toRequestPageTab = (request: ProjectRequest): RequestPageTab => {
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
    paramsRows,
    paramsBulk: rowsToBulkText(paramsRows),
    authorizationMode: toAuthorizationMode(request.auth),
    authorizationValue: toAuthorizationValue(request.auth),
    headersRows,
    headersBulk: rowsToBulkText(headersRows),
    bodyMode: toBodyMode(request.body_type),
    bodyContent: request.body,
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
  bodyContent: overrides.bodyContent ?? copy?.defaultBodyContent ?? '{\n  "ping": "hello"\n}',
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

const formatExampleAuth = (t: ProjectTranslationFn, auth?: RequestAuthConfig | null) => {
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
  request: ProjectRequest;
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

const buildExecutionVariables = (environment?: ProjectEnvironment | null) => {
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
  environment: ProjectEnvironment | null | undefined,
  t: ProjectTranslationFn
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
  request: ProjectRequest,
  environment: ProjectEnvironment | null | undefined,
  t: ProjectTranslationFn
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
  request: ProjectRequest,
  environment: ProjectEnvironment | null | undefined,
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

  if (request.body.trim() && request.body_type === 'json' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (request.body.trim() && request.body_type === 'text' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/plain');
  }

  return headers;
};

const buildDirectRequestBody = (
  request: ProjectRequest,
  environment?: ProjectEnvironment | null
) => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  const resolvedBody = resolveTemplateValue(request.body, buildExecutionVariables(environment));
  return resolvedBody.trim() ? resolvedBody : undefined;
};

const flattenCollectionTree = (nodes: ProjectCollectionTreeNode[]): ProjectCollectionTreeNode[] =>
  nodes.flatMap(node => [node, ...flattenCollectionTree(node.children ?? [])]);

const sortCollectionTreeNodes = (nodes: ProjectCollectionTreeNode[]) => {
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
  collections: ProjectCollection[]
): ProjectCollectionTreeNode[] => {
  const uniqueCollections = Array.from(
    new Map(collections.map(collection => [String(collection.id), collection])).values()
  );
  const nodeMap = new Map<string, ProjectCollectionTreeNode>();
  const rootNodes: ProjectCollectionTreeNode[] = [];

  uniqueCollections.forEach(collection => {
    nodeMap.set(String(collection.id), {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      project_id: collection.project_id,
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

const fetchAllProjectCollections = async (
  projectId: number | string
): Promise<ProjectCollectionTreeNode[]> => {
  const items: ProjectCollection[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await collectionService.list({
      projectId,
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
  projectId: number | string,
  collectionId: number | string
): Promise<ProjectRequest[]> => {
  const items: ProjectRequest[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await requestService.list({
      projectId,
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
  treeNodes: ProjectCollectionTreeNode[],
  requestsByCollectionId: Record<string, ProjectRequest[]>
): InitialWorkbenchState => {
  const flattenedCollections = flattenCollectionTree(treeNodes);
  const collections: CollectionNode[] = flattenedCollections.map((collection, index) => ({
    id: String(collection.id),
    name: collection.name,
    color: COLLECTION_COLORS[index % COLLECTION_COLORS.length],
    isFolder: collection.is_folder,
    requestIds: (requestsByCollectionId[String(collection.id)] ?? []).map(
      request => `request-${request.id}`
    ),
  }));
  const tabs = flattenedCollections.flatMap(collection =>
    (requestsByCollectionId[String(collection.id)] ?? []).map(request => toRequestPageTab(request))
  );
  const firstTab = tabs[0] ?? null;

  return {
    tabs,
    collections,
    activeTabId: firstTab?.id ?? null,
    openTabIds: firstTab ? [firstTab.id] : [],
    activeCollectionId: firstTab?.collectionId ?? collections[0]?.id ?? null,
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
        color: currentCollection?.color ?? collection.color,
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
      collection.color === other.color &&
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

export function ApiRequestWorkbench({ projectId }: { projectId: number | string }) {
  const t = useT('project');
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
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [creatingRequestCollectionId, setCreatingRequestCollectionId] = useState<string | null>(
    null
  );
  const [deletingRequestTabId, setDeletingRequestTabId] = useState<string | null>(null);
  const [renamingRequestTabId, setRenamingRequestTabId] = useState<string | null>(null);
  const [renameDialogCollectionId, setRenameDialogCollectionId] = useState<string | null>(null);
  const [renameDraftName, setRenameDraftName] = useState('');
  const [renameDialogRequestTabId, setRenameDialogRequestTabId] = useState<string | null>(null);
  const [renameRequestDraftName, setRenameRequestDraftName] = useState('');
  const [importDialogTarget, setImportDialogTarget] = useState<ImportDialogTarget | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isExampleDialogOpen, setIsExampleDialogOpen] = useState(false);
  const [viewingExampleId, setViewingExampleId] = useState<number | string | null>(null);
  const [editingExampleId, setEditingExampleId] = useState<number | string | null>(null);
  const [deleteExampleTarget, setDeleteExampleTarget] = useState<RequestExample | null>(null);
  const [savingResponseExampleId, setSavingResponseExampleId] = useState<number | string | null>(
    null
  );
  const [defaultingExampleId, setDefaultingExampleId] = useState<number | string | null>(null);
  const [deletingExampleId, setDeletingExampleId] = useState<number | string | null>(null);
  const createCollectionMutation = useCreateCollection(projectId);
  const deleteCollectionMutation = useDeleteCollection(projectId);
  const updateCollectionMutation = useUpdateCollection(projectId);
  const importPostmanMutation = useImportPostmanCollection(projectId);
  const importMarkdownMutation = useImportMarkdownCollection(projectId);
  const environmentsQuery = useEnvironments(projectId);
  const createRequestMutation = useCreateRequest(projectId);
  const updateRequestMutation = useUpdateRequest(projectId);
  const deleteRequestMutation = useDeleteRequest(projectId);
  const createHistoryMutation = useCreateProjectHistory(projectId);
  const createExampleMutation = useCreateRequestExample(projectId);
  const updateExampleMutation = useUpdateRequestExample(projectId);
  const deleteExampleMutation = useDeleteRequestExample(projectId);
  const saveExampleResponseMutation = useSaveRequestExampleResponse(projectId);
  const setDefaultExampleMutation = useSetDefaultRequestExample(projectId);
  const collectionTreeQuery = useQuery({
    queryKey: collectionKeys.workbenchTree(projectId),
    queryFn: () => fetchAllProjectCollections(projectId),
    enabled: Boolean(projectId),
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
      'project',
      projectId,
      'workbench-requests',
      persistedRequestCollectionIds,
    ],
    queryFn: async () => {
      const entries = await Promise.all(
        persistedRequestCollectionIds.map(async collectionId => {
          try {
            const requests = await fetchAllCollectionRequests(projectId, collectionId);
            return [collectionId, requests] as const;
          } catch {
            return [collectionId, []] as const;
          }
        })
      );

      return Object.fromEntries(entries) as Record<string, ProjectRequest[]>;
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
          projectId,
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
          projectId,
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
    const treeNodes = await fetchAllProjectCollections(projectId);
    const flattenedCollections = flattenCollectionTree(treeNodes);
    const requestEntries = await Promise.all(
      flattenedCollections
        .filter(collection => !collection.is_folder)
        .map(async collection => {
          try {
            const requests = await fetchAllCollectionRequests(projectId, collection.id);
            return [collection.id, requests] as const;
          } catch {
            return [collection.id, []] as const;
          }
        })
    );
    const requestsByCollectionId = Object.fromEntries(requestEntries) as Record<
      string,
      ProjectRequest[]
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
  }, [projectId, updateCollections]);

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
      pre_request: scripts.pre_request,
      test: scripts.test,
    };
  };

  const buildTransientRequestFromTab = (tab: RequestPageTab): ProjectRequest => {
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
      pre_request: scripts.pre_request,
      test: scripts.test,
      sort_order: 0,
      created_at: '',
      updated_at: '',
    };
  };

  const syncPersistedRequestInWorkbench = (
    sourceTabId: string,
    persistedRequest: ProjectRequest,
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
        projectId,
        persistedCollectionId,
        persistedRequestId,
        buildUpdatePayloadFromTab(tab, options.name)
      );
    }

    const targetCollection = collections.find(collection => collection.id === tab.collectionId);
    return requestService.create(
      projectId,
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
    if (createCollectionMutation.isPending) {
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
        color: COLLECTION_COLORS[(collectionNumber - 1) % COLLECTION_COLORS.length],
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
        await importMarkdownMutation.mutateAsync(payload as ImportMarkdownCollectionRequest);
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

  const handleDeleteCollection = async (collection: CollectionNode) => {
    if (deletingCollectionId) {
      return;
    }

    setDeletingCollectionId(collection.id);

    try {
      if (isPersistedCollectionId(collection.id)) {
        await deleteCollectionMutation.mutateAsync(collection.id);
      }

      removeCollectionFromWorkbench(collection.id);
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

    const duplicatedTab: RequestPageTab = {
      ...activeTab,
      id: createLocalId('request-tab'),
      title: t('collections.workbench.copyTitle', { title: activeTab.title }),
      response: createEmptyResponse(),
      isSending: false,
      paramsRows: activeTab.paramsRows.map(row => ({ ...row, id: createLocalId('kv') })),
      headersRows: activeTab.headersRows.map(row => ({ ...row, id: createLocalId('kv') })),
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

  const handleSend = async () => {
    if (!activeTab) {
      return;
    }

    const tabSnapshot = activeTab;
    let tabId = activeTab.id;
    let persistedRequest: ProjectRequest | null = null;
    let runnableRequest: ProjectRequest | null = null;
    let executableUrl = '';
    let executableHeaders: Record<string, string> = {};
    let executableBody: string | undefined;

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
      executableBody = buildDirectRequestBody(runnableRequest, selectedEnvironment);
      const response = await localRunnerService.execute({
        method: runnableRequest.method,
        url: executableUrl,
        headers: executableHeaders,
        body: executableBody,
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
              requestBody: executableBody,
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
          executableBody = buildDirectRequestBody(persistedRequest, selectedEnvironment);
        }

        void createHistoryMutation
          .mutateAsync(
            buildRequestRunHistoryPayload({
              request: persistedRequest,
              executedUrl: executableUrl,
              requestHeaders: executableHeaders,
              requestBody: executableBody,
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

  const handleDeleteRequest = async (request: RequestPageTab) => {
    if (deletingRequestTabId) {
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

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,251,0.98))]">
      <div className="border-b border-border/60 bg-white/80 backdrop-blur">
        <div className="px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <RequestTabs
                tabs={openTabs}
                activeTabId={activeTabId}
                onSelectTab={tabId => selectRequest(tabId, tabMap.get(tabId)?.collectionId ?? null)}
                onCloseTab={handleCloseTab}
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
        <aside className="h-[42dvh] min-h-[280px] w-full shrink-0 border-b border-border/60 bg-white/82 backdrop-blur xl:h-auto xl:min-h-0 xl:w-[320px] xl:border-b-0 xl:border-r">
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
            onDeleteCollection={handleDeleteCollection}
            onImportCollectionPostman={collection =>
              openCollectionImportDialog(collection, 'postman')
            }
            onImportCollectionMarkdown={collection =>
              openCollectionImportDialog(collection, 'markdown')
            }
            onDeleteRequest={handleDeleteRequest}
            onRenameCollection={openRenameCollectionDialog}
            onRenameRequest={openRenameRequestDialog}
            onToggleCollection={toggleCollection}
            onSelectRequest={selectRequest}
          />
        </aside>

        <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6">
          {activeTab ? (
            <div className="mx-auto flex min-h-full max-w-[1600px] flex-col gap-4">
              <Card className="gap-0 rounded-[28px] border-border/60 bg-white/90 py-0 shadow-[0_12px_44px_rgba(15,23,42,0.08)]">
                <CardHeader className="gap-4 border-b border-border/60 py-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-primary/20 bg-primary/10 text-primary"
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
                        <CardTitle className="text-xl tracking-tight">{activeTab.title}</CardTitle>
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
                        className="h-10 w-10 rounded-2xl"
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
                        className="h-10 w-10 rounded-2xl"
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
                      onCreateExample={openCreateExampleDialog}
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
                    />
                  )}
                </CardContent>
              </Card>

              <ResponsePanel
                response={activeTab.response}
                isSending={activeTab.isSending}
                onSaveAsExample={openCreateExampleDialog}
                canSaveAsExample={canCreateExamples && activeResponseCanBeCaptured}
                isSavingExample={
                  createExampleMutation.isPending || saveExampleResponseMutation.isPending
                }
              />
            </div>
          ) : (
            <div className="mx-auto flex min-h-full max-w-[960px] items-center justify-center">
              <div className="w-full max-w-[680px] rounded-[28px] border border-dashed border-border/70 bg-white/72 px-8 py-16 text-center shadow-[0_20px_80px_rgba(15,23,42,0.05)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <p className="mt-6 text-2xl font-semibold tracking-tight text-text-main">
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
  onDeleteRequest: (request: RequestPageTab) => Promise<void>;
  onRenameCollection: (collection: CollectionNode) => void;
  onRenameRequest: (request: RequestPageTab) => void;
  onToggleCollection: (collectionId: string) => void;
  onSelectRequest: (tabId: string, collectionId: string | null) => void;
}) {
  const [page, setPage] = useState(1);
  const t = useT('project');
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
          <div className="rounded-[24px] border border-dashed border-border/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-text-main">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            isIcon
            onClick={() => {
              setPage(1);
              onCreateCollection();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            isIcon
            loading={isImportingRootPostman}
            disabled={isImportingAny}
            onClick={onImportRootPostman}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            isIcon
            loading={isImportingRootMarkdown}
            disabled={isImportingAny}
            onClick={onImportRootMarkdown}
          >
            <FileText className="h-4 w-4" />
          </Button>
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
                  'group/collection rounded-[18px] border border-transparent bg-white/55 p-1.5 transition-colors',
                  isActiveCollection ? 'bg-primary/5' : 'hover:bg-white/80'
                )}
              >
                <div className="flex items-start gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    isIcon
                    className="mt-0.5 h-8 w-8 rounded-xl"
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
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: collection.color }}
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
              <div className="mb-2 px-2 text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
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
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
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
        isActive ? 'bg-primary/10 text-text-main' : 'hover:bg-white/80'
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
  const t = useT('project');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isIcon
          className="mr-1 h-7 w-7 rounded-lg opacity-0 transition-opacity group-hover/request:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={t('collections.workbench.actions.openRequestActions')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl">
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
  const t = useT('project');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isIcon
          className="h-8 w-8 rounded-xl opacity-0 transition-opacity group-hover/collection:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={t('collections.workbench.actions.openCollectionActions')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl">
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
  const t = useT('project');
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
  const t = useT('project');

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
              className="rounded-2xl"
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
  const t = useT('project');

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
              className="rounded-2xl"
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
  const t = useT('project');
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

            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-slate-50/80 px-4 py-3">
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
  const t = useT('project');
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
              <div className="h-10 animate-pulse rounded-2xl bg-muted" />
              <div className="h-28 animate-pulse rounded-2xl bg-muted" />
              <div className="h-20 animate-pulse rounded-[24px] bg-muted" />
            </div>
          ) : !example ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">
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

              <div className="rounded-[24px] border border-border/60 bg-slate-50/80 p-4">
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
  const t = useT('project');

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
          <div className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-4 text-sm leading-6 text-rose-700">
            <span className="font-medium text-rose-800">
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
  const t = useT('project');

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
              <div className="h-28 animate-pulse rounded-[24px] bg-muted" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-44 animate-pulse rounded-[24px] bg-muted" />
                <div className="h-44 animate-pulse rounded-[24px] bg-muted" />
              </div>
              <div className="h-56 animate-pulse rounded-[24px] bg-muted" />
            </div>
          ) : isError && !example ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">
              {t('collections.workbench.examples.detailLoadFailed')}
            </div>
          ) : example ? (
            <>
              <div className="rounded-[24px] border border-border/60 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-text-main">{example.name}</p>
                      {example.is_default ? (
                        <Badge
                          variant="outline"
                          className="border-primary/20 bg-primary/10 text-primary"
                        >
                          {t('collections.workbench.badges.default')}
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
  onCreateExample,
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
  onCreateExample: () => void;
  onRefresh: () => void;
  onViewExample: (example: RequestExample) => void;
  onApplyExample: (example: RequestExample) => void;
  onSaveLatestResponse: (example: RequestExample) => Promise<void>;
  onEditExample: (example: RequestExample) => void;
  onSetDefault: (example: RequestExample) => Promise<void>;
  onDeleteExample: (example: RequestExample) => void;
}) {
  const t = useT('project');

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-white/85 py-0 shadow-sm">
        <CardHeader className="border-b border-border/60 py-5">
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
          {!canCreateExamples ? (
            <div className="rounded-[24px] border border-dashed border-border/70 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold text-text-main">
                {t('collections.workbench.examples.requiresSavedRequestTitle')}
              </p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                {t('collections.workbench.examples.requiresSavedRequestDescription')}
              </p>
            </div>
          ) : !requestPersisted ? (
            <div className="rounded-[24px] border border-dashed border-border/70 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold text-text-main">
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
                <div key={item} className="rounded-[24px] border border-border/60 p-4">
                  <div className="h-5 w-48 animate-pulse rounded-full bg-muted" />
                  <div className="mt-3 h-4 w-72 animate-pulse rounded-full bg-muted" />
                  <div className="mt-5 h-10 animate-pulse rounded-2xl bg-muted" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-5 text-sm text-rose-700">
              {t('collections.workbench.examples.panelLoadFailed')}
            </div>
          ) : examples.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border/70 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold text-text-main">
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
                  className="rounded-[24px] border border-border/60 bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-text-main">{example.name}</p>
                        {example.is_default ? (
                          <Badge
                            variant="outline"
                            className="border-primary/20 bg-primary/10 text-primary"
                          >
                            {t('collections.workbench.badges.default')}
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
                        <DropdownMenuContent align="end" className="w-40 rounded-xl">
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
    <div className="rounded-[24px] border border-border/60 bg-white/90 p-4 shadow-sm">
      <p className="text-sm font-medium text-text-main">{title}</p>
      <pre
        className={cn(
          'mt-3 max-h-64 overflow-auto rounded-[20px] border p-4 text-xs leading-6 whitespace-pre-wrap',
          tone === 'dark'
            ? 'border-slate-900/70 bg-slate-950/95 text-slate-100'
            : 'border-border/60 bg-slate-50/80 text-slate-700'
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
}: {
  tabs: RequestPageTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}) {
  const t = useT('project');

  if (tabs.length === 0) {
    return (
      <div className="flex h-10 items-center rounded-xl border border-dashed border-border/60 bg-white/55 px-4 text-sm text-text-muted">
        {t('collections.workbench.empty.noOpenTabs')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 pr-2">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={cn(
              'group inline-flex items-center rounded-xl border pr-1 text-sm transition-all',
              tab.id === activeTabId
                ? 'border-primary/30 bg-primary/10 text-text-main shadow-sm'
                : 'border-border/60 bg-white/75 text-text-muted hover:border-border hover:bg-white hover:text-text-main'
            )}
          >
            <button
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className="inline-flex min-w-0 items-center gap-2 px-3 py-1.5"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  tab.id === activeTabId ? 'bg-primary' : 'bg-text-muted/40'
                )}
              />
              <span className="truncate font-medium">{tab.title}</span>
            </button>
            <button
              type="button"
              onClick={() => onCloseTab(tab.id)}
              className={cn(
                'rounded-lg p-1 text-text-muted transition-colors hover:bg-black/5 hover:text-text-main',
                tab.id === activeTabId
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
              )}
              aria-label={t('collections.workbench.closeTab', { title: tab.title })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnvironmentSwitcher({
  environments,
  selectedEnvironmentId,
  isLoading,
  onEnvironmentChange,
}: {
  environments: ProjectEnvironment[];
  selectedEnvironmentId: string;
  isLoading: boolean;
  onEnvironmentChange: (value: string) => void;
}) {
  const t = useT('project');

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border/60 bg-white/85 px-2.5 py-1 shadow-sm">
      <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted">
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
        <SelectContent className="min-w-[132px] rounded-xl">
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
  const t = useT('project');

  return (
    <div className="rounded-[24px] border border-border/60 bg-slate-50/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="grid gap-3 xl:grid-cols-[140px_minmax(0,1fr)_auto]">
        <Select value={tab.method} onValueChange={value => onMethodChange(value as RequestMethod)}>
          <SelectTrigger className="h-11 w-full rounded-2xl border-border/70 bg-white font-semibold">
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
          className="h-11 rounded-2xl border-border/70 bg-white px-4 text-sm shadow-none"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            isIcon
            className="h-11 w-11 rounded-2xl"
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
            className="h-11 w-11 rounded-2xl"
            onClick={onDuplicate}
            aria-label={t('collections.workbench.actions.duplicateTab')}
            title={t('collections.workbench.actions.duplicateTab')}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            className="h-11 rounded-2xl px-5"
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
  const t = useT('project');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {SECTION_ITEMS.map(item => (
        <button
          key={item}
          type="button"
          onClick={() => onSelectSection(item)}
          className={cn(
            'rounded-full border px-3 py-2 text-sm font-medium transition-colors',
            item === activeSection
              ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
              : 'border-border/60 bg-white/70 text-text-muted hover:border-border hover:bg-white hover:text-text-main'
          )}
        >
          {getSectionLabel(t, item)}
        </button>
      ))}
    </div>
  );
}

function RequestSectionPanel({
  tab,
  onTabChange,
}: {
  tab: RequestPageTab;
  onTabChange: (updater: (tab: RequestPageTab) => RequestPageTab) => void;
}) {
  const t = useT('project');

  switch (tab.activeSection) {
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
          onModeChange={mode =>
            onTabChange(current => ({
              ...current,
              bodyMode: mode,
            }))
          }
          onValueChange={value =>
            onTabChange(current => ({
              ...current,
              bodyContent: value,
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
  const t = useT('project');
  const updateRow = (rowId: string, patch: Partial<KeyValueRow>) => {
    onRowsChange(rows.map(row => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const removeRow = (rowId: string) => {
    const nextRows = rows.filter(row => row.id !== rowId);
    onRowsChange(nextRows.length > 0 ? nextRows : [createKeyValueRow()]);
  };

  return (
    <div className="rounded-[24px] border border-border/60 bg-white/85 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-main">{title}</h3>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border/60 bg-slate-50/80 p-1">
            <button
              type="button"
              onClick={() => onModeChange('table')}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                mode === 'table'
                  ? 'bg-white text-text-main shadow-sm'
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
                  ? 'bg-white text-text-main shadow-sm'
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
            className="min-h-[220px] rounded-2xl font-mono text-sm"
            placeholder={t('collections.workbench.editors.bulkPlaceholder')}
          />
        </div>
      ) : (
        <div className="overflow-x-auto px-5 py-5">
          <div className="min-w-[760px] space-y-3">
            <div className="grid grid-cols-[1.05fr_1.25fr_1fr_56px] gap-3 px-3 text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
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
                  className="rounded-2xl"
                />
                <Input
                  value={row.value}
                  onChange={event => updateRow(row.id, { value: event.target.value })}
                  placeholder="1"
                  className="rounded-2xl"
                />
                <Input
                  value={row.description}
                  onChange={event => updateRow(row.id, { description: event.target.value })}
                  placeholder={t('collections.workbench.editors.descriptionPlaceholder')}
                  className="rounded-2xl"
                />
                <Button
                  type="button"
                  variant="ghost"
                  isIcon
                  className="h-9 w-9 rounded-2xl"
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
  const t = useT('project');

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card className="border-border/60 bg-white/85 py-0 shadow-sm">
        <CardHeader className="border-b border-border/60 py-5">
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
              <SelectTrigger id="request-auth-mode" className="rounded-2xl">
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

      <Card className="border-border/60 bg-white/85 py-0 shadow-sm">
        <CardHeader className="border-b border-border/60 py-5">
          <CardTitle>{t('collections.workbench.authorization.credentialsTitle')}</CardTitle>
          <CardDescription>
            {t('collections.workbench.authorization.credentialsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5 py-5">
          {mode === 'none' ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-slate-50/80 p-5 text-sm text-text-muted">
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
                className="rounded-2xl"
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
  onModeChange,
  onValueChange,
}: {
  mode: BodyMode;
  value: string;
  onModeChange: (mode: BodyMode) => void;
  onValueChange: (value: string) => void;
}) {
  const t = useT('project');

  return (
    <div className="rounded-[24px] border border-border/60 bg-white/85 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-main">
            {t('collections.workbench.sections.body')}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {t('collections.workbench.body.description')}
          </p>
        </div>

        <div className="inline-flex rounded-full border border-border/60 bg-slate-50/80 p-1">
          {BODY_MODE_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => onModeChange(option)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                option === mode
                  ? 'bg-white text-text-main shadow-sm'
                  : 'text-text-muted hover:text-text-main'
              )}
            >
              {getBodyModeLabel(t, option)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5">
        <Textarea
          value={value}
          onChange={event => onValueChange(event.target.value)}
          rows={14}
          className="min-h-[280px] rounded-2xl font-mono text-sm"
          placeholder={
            mode === 'form-data' ? t('collections.workbench.body.formDataPlaceholder') : '{\n  \n}'
          }
        />
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
  const t = useT('project');

  return (
    <Card className="border-border/60 bg-white/85 py-0 shadow-sm">
      <CardHeader className="border-b border-border/60 py-5">
        <CardTitle>{t('collections.workbench.sections.scripts')}</CardTitle>
        <CardDescription>{t('collections.workbench.scripts.description')}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 py-5">
        <Textarea
          value={value}
          onChange={event => onValueChange(event.target.value)}
          rows={14}
          className="min-h-[280px] rounded-2xl font-mono text-sm"
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
  const t = useT('project');
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
        <Card key={item.key} className="border-border/60 bg-white/85 py-0 shadow-sm">
          <CardHeader className="border-b border-border/60 py-5">
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
  const t = useT('project');
  const responseHeaders = Object.entries(response.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return (
    <Card className="min-h-[320px] gap-0 rounded-[28px] border-border/60 bg-white/90 py-0 shadow-[0_12px_44px_rgba(15,23,42,0.06)]">
      <CardHeader className="gap-4 border-b border-border/60 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-xl tracking-tight">{t('common.response')}</CardTitle>
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
          <div className="flex flex-1 flex-col items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-slate-50/80 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <p className="mt-4 text-sm font-medium text-text-main">
              {t('collections.workbench.response.sendingTitle')}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {t('collections.workbench.response.sendingDescription')}
            </p>
          </div>
        ) : response.error ? (
          <div className="flex flex-1 flex-col justify-center rounded-[24px] border border-rose-200 bg-rose-50/70 p-6">
            <p className="text-sm font-semibold text-rose-700">
              {t('collections.workbench.response.errorTitle')}
            </p>
            <p className="mt-2 text-sm leading-6 text-rose-600">{response.error}</p>
          </div>
        ) : response.status === null ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-slate-50/80 text-center">
            <p className="text-base font-semibold text-text-main">
              {t('collections.workbench.response.emptyTitle')}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
              {t('collections.workbench.response.emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {responseHeaders ? (
              <div className="rounded-[24px] border border-border/60 bg-slate-100/90 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                  {t('common.headers')}
                </p>
                <pre className="overflow-auto text-xs leading-6 text-slate-700">
                  {responseHeaders}
                </pre>
              </div>
            ) : null}
            <pre className="flex-1 overflow-auto rounded-[24px] border border-border/60 bg-slate-950/95 p-5 text-sm leading-6 text-slate-100">
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
    <div className="rounded-full border border-border/60 bg-slate-50/80 px-3 py-1.5 text-sm">
      <span className="text-text-muted">{label}: </span>
      <span className="font-medium text-text-main">{value}</span>
    </div>
  );
}

function MethodBadge({ method, compact = false }: { method: RequestMethod; compact?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold tracking-[0.14em]',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        METHOD_BADGE_STYLES[method]
      )}
    >
      {method}
    </span>
  );
}
