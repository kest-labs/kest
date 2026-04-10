'use client';

import { useQuery } from '@tanstack/react-query';
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  SendHorizonal,
  Trash2,
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
  useCreateCollection,
  useDeleteCollection,
  useUpdateCollection,
} from '@/hooks/use-collections';
import { collectionService } from '@/services/collection';
import { useCreateRequest, useDeleteRequest, useUpdateRequest } from '@/hooks/use-requests';
import { requestService } from '@/services/request';
import type { ProjectCollection, ProjectCollectionTreeNode } from '@/types/collection';
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
type RequestSection = 'params' | 'authorization' | 'headers' | 'body' | 'scripts' | 'settings';
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

const METHOD_OPTIONS: RequestMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const ENVIRONMENT_OPTIONS = ['development', 'staging', 'production'] as const;
const SECTION_ITEMS: Array<{ value: RequestSection; label: string }> = [
  { value: 'params', label: 'Params' },
  { value: 'authorization', label: 'Authorization' },
  { value: 'headers', label: 'Headers' },
  { value: 'body', label: 'Body' },
  { value: 'scripts', label: 'Scripts' },
  { value: 'settings', label: 'Settings' },
];
const BODY_MODE_OPTIONS: BodyMode[] = ['json', 'raw', 'form-data'];
const AUTHORIZATION_OPTIONS: AuthorizationMode[] = ['none', 'bearer', 'basic', 'api-key'];
const COLLECTION_COLORS = ['#2563eb', '#0f766e', '#ea580c', '#7c3aed', '#dc2626'];
const METHOD_BADGE_STYLES: Record<RequestMethod, string> = {
  GET: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  POST: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  PUT: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  PATCH: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  DELETE: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

const createLocalId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

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
    nextOpenTabIds[currentIndex] ??
    nextOpenTabIds[currentIndex - 1] ??
    nextOpenTabIds[0] ??
    null
  );
};

const DEFAULT_NEW_REQUEST_TITLE = 'New Request';
const DEFAULT_NEW_REQUEST_URL = '';
// The API requires a non-empty URL for persisted requests, but the workbench allows blank
// draft URLs before a request is runnable. We store an `.invalid` placeholder and map it
// back to an empty field in the UI.
const PERSISTED_DRAFT_URL_PLACEHOLDER = 'https://placeholder.invalid';
const WORKBENCH_PAGE_SIZE = 100;

const isPersistedCollectionId = (value: string) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0;
};

const getPersistedRequestId = (value: string) => {
  if (!value.startsWith('request-')) {
    return null;
  }

  const numericValue = Number(value.slice('request-'.length));
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
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
    ? rows.map((row) => createKeyValueRow(row.key, row.value, row.description ?? ''))
    : [createKeyValueRow()];

const toScriptsValue = (request: ProjectRequest) =>
  [request.pre_request, request.test].filter(Boolean).join('\n\n');

const toRequestPageTab = (request: ProjectRequest): RequestPageTab => {
  const paramsRows = toKeyValueRows(request.query_params);
  const headersRows = toKeyValueRows(request.headers);
  const method = toRequestMethod(request.method);

  return createRequestPageTab(request.id, {
    id: `request-${request.id}`,
    title: request.name,
    collectionId: String(request.collection_id),
    method,
    url:
      request.url === PERSISTED_DRAFT_URL_PLACEHOLDER ? DEFAULT_NEW_REQUEST_URL : request.url || '',
    activeSection:
      method === 'POST' || method === 'PUT' || method === 'PATCH' ? 'body' : 'params',
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
  overrides: Partial<RequestPageTab> = {}
): RequestPageTab => ({
  id: overrides.id ?? createLocalId('request-tab'),
  title: overrides.title ?? (index === 1 ? 'New Request' : `New Request ${index}`),
  collectionId: overrides.collectionId ?? null,
  method: overrides.method ?? 'GET',
  url: overrides.url ?? DEFAULT_NEW_REQUEST_URL,
  activeSection: overrides.activeSection ?? 'params',
  paramsMode: overrides.paramsMode ?? 'table',
  paramsRows: overrides.paramsRows ?? [createKeyValueRow()],
  paramsBulk: overrides.paramsBulk ?? '',
  authorizationMode: overrides.authorizationMode ?? 'none',
  authorizationValue: overrides.authorizationValue ?? '',
  headersMode: overrides.headersMode ?? 'table',
  headersRows:
    overrides.headersRows ?? [createKeyValueRow('Accept', 'application/json', 'Default header')],
  headersBulk: overrides.headersBulk ?? 'Accept: application/json',
  bodyMode: overrides.bodyMode ?? 'json',
  bodyContent: overrides.bodyContent ?? '{\n  "ping": "hello"\n}',
  scripts:
    overrides.scripts ??
    "// Inspect the response here\npm.test('status should be 200', () => true);",
  settings:
    overrides.settings ?? {
      followRedirects: true,
      strictTls: false,
      persistCookies: false,
    },
  response: overrides.response ?? createEmptyResponse(),
  isSending: overrides.isSending ?? false,
});

const rowsToBulkText = (rows: KeyValueRow[]) =>
  rows
    .filter((row) => row.key.trim() || row.value.trim() || row.description.trim())
    .map((row) => `${row.key}: ${row.value}${row.description ? ` # ${row.description}` : ''}`)
    .join('\n');

const bulkTextToRows = (value: string) => {
  const rows = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
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

const byteLength = (value: string) =>
  typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(value).length : value.length;

const encodeBase64 = (value: string) => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(value);
  }

  throw new Error('Base64 encoding is not available in this browser context.');
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

const toRequestKeyValues = (mode: BulkMode, rows: KeyValueRow[], bulkValue: string): RequestKeyValue[] =>
  (mode === 'bulk' ? bulkTextToRows(bulkValue) : rows)
    .filter((row) => row.key.trim())
    .map((row) => ({
      key: row.key.trim(),
      value: row.value,
      enabled: true,
      description: row.description.trim() || undefined,
    }));

const toRequestAuthConfig = (
  mode: AuthorizationMode,
  value: string
): RequestAuthConfig | null => {
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

const isEnabledRequestKeyValue = (row: RequestKeyValue) => row.enabled !== false && row.key.trim().length > 0;

const headersToObject = (headers: Headers) =>
  Object.fromEntries(Array.from(headers.entries()));

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

const buildExecutableRequestUrl = (request: ProjectRequest) => {
  const resolvedUrl = applyPathParamsToUrl(request.url, request.path_params ?? {});
  const targetUrl = new URL(resolvedUrl);

  request.query_params
    .filter(isEnabledRequestKeyValue)
    .forEach((queryParam) => {
      targetUrl.searchParams.append(queryParam.key.trim(), queryParam.value);
    });

  if (request.auth?.type === 'api-key') {
    const apiKeyLocation = request.auth.api_key?.add_to ?? request.auth.api_key?.in;
    if (
      apiKeyLocation === 'query' &&
      request.auth.api_key?.key?.trim() &&
      request.auth.api_key.value
    ) {
      targetUrl.searchParams.set(request.auth.api_key.key.trim(), request.auth.api_key.value);
    }
  }

  return targetUrl.toString();
};

const buildDirectRequestHeaders = (request: ProjectRequest) => {
  const headers = new Headers();

  request.headers
    .filter(isEnabledRequestKeyValue)
    .forEach((header) => {
      headers.set(header.key.trim(), header.value);
    });

  if (request.auth?.type === 'bearer' && request.auth.bearer?.token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${request.auth.bearer.token}`);
  }

  if (request.auth?.type === 'basic' && request.auth.basic && !headers.has('Authorization')) {
    headers.set(
      'Authorization',
      `Basic ${encodeBase64(`${request.auth.basic.username}:${request.auth.basic.password}`)}`
    );
  }

  if (request.auth?.type === 'api-key') {
    const apiKeyLocation = request.auth.api_key?.add_to ?? request.auth.api_key?.in;
    if (
      apiKeyLocation !== 'query' &&
      request.auth.api_key?.key?.trim() &&
      request.auth.api_key.value
    ) {
      headers.set(request.auth.api_key.key.trim(), request.auth.api_key.value);
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

const buildDirectRequestBody = (request: ProjectRequest) => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  return request.body.trim() ? request.body : undefined;
};

const executeRequestInBrowser = async (
  request: ProjectRequest,
  settings: RequestPageTab['settings']
): Promise<RunRequestResponse> => {
  const targetUrl = buildExecutableRequestUrl(request);
  const targetOrigin = new URL(targetUrl).origin;
  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const isCrossOrigin = Boolean(currentOrigin) && currentOrigin !== targetOrigin;
  const requestHeaders = buildDirectRequestHeaders(request);
  const requestBody = buildDirectRequestBody(request);
  const startedAt =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: requestHeaders,
      body: requestBody,
      redirect: settings.followRedirects ? 'follow' : 'manual',
      credentials: settings.persistCookies ? 'include' : 'same-origin',
    });
    const responseBody = await response.text();
    const finishedAt =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const responseHeaders = headersToObject(response.headers);

    return {
      status: response.status,
      status_text: response.statusText || `${response.status}`,
      headers: responseHeaders,
      body: responseBody,
      time: Math.max(0, Math.round(finishedAt - startedAt)),
      size:
        Number(response.headers.get('content-length') ?? '') ||
        byteLength(responseBody),
    };
  } catch (error) {
    if (error instanceof TypeError) {
      if (isCrossOrigin && settings.persistCookies) {
        throw new Error(
          'Direct browser request failed. This is a cross-origin request with cookie credentials enabled. Disable Persist cookies, or configure the target API to allow this exact origin and credentials in CORS.'
        );
      }

      throw new Error(
        'Direct browser request failed. The target may not allow CORS from this origin, or the request was blocked by the browser network policy.'
      );
    }

    throw error;
  }
};

const flattenCollectionTree = (nodes: ProjectCollectionTreeNode[]): ProjectCollectionTreeNode[] =>
  nodes.flatMap((node) => [node, ...flattenCollectionTree(node.children ?? [])]);

const sortCollectionTreeNodes = (nodes: ProjectCollectionTreeNode[]) => {
  nodes.sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.id - right.id;
  });

  nodes.forEach((node) => {
    if (node.children?.length) {
      sortCollectionTreeNodes(node.children);
    }
  });
};

const buildCollectionTreeFromList = (
  collections: ProjectCollection[]
): ProjectCollectionTreeNode[] => {
  const nodeMap = new Map<number, ProjectCollectionTreeNode>();
  const rootNodes: ProjectCollectionTreeNode[] = [];

  collections.forEach((collection) => {
    nodeMap.set(collection.id, {
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

  collections.forEach((collection) => {
    const node = nodeMap.get(collection.id);
    if (!node) {
      return;
    }

    if (collection.parent_id == null) {
      rootNodes.push(node);
      return;
    }

    const parentNode = nodeMap.get(collection.parent_id);
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
  projectId: number
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

  return buildCollectionTreeFromList(items);
};

const fetchAllCollectionRequests = async (
  projectId: number,
  collectionId: number
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
  requestsByCollectionId: Record<number, ProjectRequest[]>
): InitialWorkbenchState => {
  const flattenedCollections = flattenCollectionTree(treeNodes);
  const collections: CollectionNode[] = flattenedCollections.map((collection, index) => ({
    id: String(collection.id),
    name: collection.name,
    color: COLLECTION_COLORS[index % COLLECTION_COLORS.length],
    requestIds: (requestsByCollectionId[collection.id] ?? []).map((request) => `request-${request.id}`),
  }));
  const tabs = flattenedCollections.flatMap((collection) =>
    (requestsByCollectionId[collection.id] ?? []).map((request) => toRequestPageTab(request))
  );
  const firstTab = tabs[0] ?? null;

  return {
    tabs,
    collections,
    activeTabId: firstTab?.id ?? null,
    openTabIds: firstTab ? [firstTab.id] : [],
    activeCollectionId: firstTab?.collectionId ?? collections[0]?.id ?? null,
    expandedCollectionIds: collections.map((collection) => collection.id),
    nextTabIndex: tabs.length + 1,
  };
};

const mergeServerCollections = (
  currentCollections: CollectionNode[],
  serverCollections: CollectionNode[]
) => {
  const currentById = new Map(currentCollections.map((collection) => [collection.id, collection]));
  const serverIds = new Set(serverCollections.map((collection) => collection.id));
  const localOnlyCollections = currentCollections.filter(
    (collection) => !serverIds.has(collection.id) && !isPersistedCollectionId(collection.id)
  );

  return [
    ...serverCollections.map((collection) => {
      const currentCollection = currentById.get(collection.id);
      const localOnlyRequestIds =
        currentCollection?.requestIds.filter(
          (requestId) => getPersistedRequestId(requestId) === null
        ) ?? [];

      return {
        ...collection,
        color: currentCollection?.color ?? collection.color,
        requestIds: Array.from(new Set([...localOnlyRequestIds, ...collection.requestIds])),
      };
    }),
    ...localOnlyCollections,
  ];
};

const mergeServerTabs = (currentTabs: RequestPageTab[], serverTabs: RequestPageTab[]) => {
  const serverIds = new Set(serverTabs.map((tab) => tab.id));
  const localOnlyTabs = currentTabs.filter(
    (tab) => !serverIds.has(tab.id) && getPersistedRequestId(tab.id) === null
  );

  return [...serverTabs, ...localOnlyTabs];
};

const mergeExpandedCollectionIds = (currentIds: string[], serverIds: string[]) => {
  if (currentIds.length === 0) {
    return serverIds;
  }

  return Array.from(new Set([...serverIds, ...currentIds]));
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
      tab.url === other.url
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

export function ApiRequestWorkbench({
  projectId,
}: {
  projectId: number;
}) {
  const initialState = useMemo(() => getInitialWorkbenchState(), []);
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
  const [environment, setEnvironment] =
    useState<(typeof ENVIRONMENT_OPTIONS)[number]>('development');
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
  const createCollectionMutation = useCreateCollection(projectId);
  const deleteCollectionMutation = useDeleteCollection(projectId);
  const updateCollectionMutation = useUpdateCollection(projectId);
  const createRequestMutation = useCreateRequest(projectId);
  const updateRequestMutation = useUpdateRequest(projectId);
  const deleteRequestMutation = useDeleteRequest(projectId);
  const collectionTreeQuery = useQuery({
    queryKey: ['collections', 'project', projectId, 'workbench-tree'],
    queryFn: () => fetchAllProjectCollections(projectId),
    enabled: Number.isInteger(projectId) && projectId > 0,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });

  const deferredSidebarQuery = useDeferredValue(sidebarQuery);
  const serverCollections = useMemo(
    () => flattenCollectionTree(collectionTreeQuery.data ?? []),
    [collectionTreeQuery.data]
  );
  const persistedCollectionIds = useMemo(
    () => serverCollections.map((collection) => collection.id),
    [serverCollections]
  );
  const collectionRequestsQuery = useQuery({
    queryKey: ['collections', 'project', projectId, 'workbench-requests', persistedCollectionIds],
    queryFn: async () => {
      const entries = await Promise.all(
        persistedCollectionIds.map(async (collectionId) => {
          try {
            const requests = await fetchAllCollectionRequests(projectId, collectionId);
            return [collectionId, requests] as const;
          } catch {
            return [collectionId, []] as const;
          }
        })
      );

      return Object.fromEntries(entries) as Record<number, ProjectRequest[]>;
    },
    enabled: collectionTreeQuery.isSuccess && persistedCollectionIds.length > 0,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });

  const tabMap = useMemo(() => new Map(tabs.map((tab) => [tab.id, tab])), [tabs]);
  const openTabs = useMemo(
    () =>
      openTabIds
        .map((tabId) => tabMap.get(tabId))
        .filter((tab): tab is RequestPageTab => Boolean(tab)),
    [openTabIds, tabMap]
  );
  const activeTab = useMemo(
    () => (activeTabId ? tabMap.get(activeTabId) ?? null : openTabs[0] ?? null),
    [activeTabId, openTabs, tabMap]
  );
  const scratchpadTabs = useMemo(
    () => tabs.filter((tab) => !tab.collectionId),
    [tabs]
  );

  const collectionViews = useMemo(() => {
    const normalizedQuery = deferredSidebarQuery.trim().toLowerCase();

    return collections.reduce<Array<{ collection: CollectionNode; requests: RequestPageTab[] }>>(
      (accumulator, collection) => {
        const requests = collection.requestIds
          .map((requestId) => tabMap.get(requestId))
          .filter((request): request is RequestPageTab => Boolean(request));

        if (!normalizedQuery) {
          accumulator.push({ collection, requests });
          return accumulator;
        }

        const collectionMatches = collection.name.toLowerCase().includes(normalizedQuery);
        const requestMatches = requests.filter((request) =>
          [request.title, request.url, request.method]
            .some((value) => value.toLowerCase().includes(normalizedQuery))
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

    return scratchpadTabs.filter((tab) =>
      [tab.title, tab.url, tab.method].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [deferredSidebarQuery, scratchpadTabs]);

  const updateTab = (tabId: string, updater: (tab: RequestPageTab) => RequestPageTab) => {
    setTabs((current) => current.map((tab) => (tab.id === tabId ? updater(tab) : tab)));
  };

  useEffect(() => {
    if (!collectionTreeQuery.isSuccess) {
      return;
    }

    const nextCollections = buildWorkbenchStateFromServer(
      serverCollections,
      collectionRequestsQuery.data ?? {}
    ).collections;

    setCollections((current) => {
      const mergedCollections = mergeServerCollections(current, nextCollections);
      return areCollectionNodesEqual(current, mergedCollections) ? current : mergedCollections;
    });
    setActiveCollectionId((current) => current ?? nextCollections[0]?.id ?? null);
    setExpandedCollectionIds((current) => {
      const mergedIds = mergeExpandedCollectionIds(
        current,
        nextCollections.map((collection) => collection.id)
      );
      return areStringArraysEqual(current, mergedIds) ? current : mergedIds;
    });
  }, [
    collectionRequestsQuery.data,
    collectionTreeQuery.isSuccess,
    serverCollections,
  ]);

  useEffect(() => {
    const hasPersistedRequestTabs = tabs.some((tab) => getPersistedRequestId(tab.id) !== null);

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

    setTabs((current) => {
      const mergedTabs = mergeServerTabs(current, nextState.tabs);
      return areTabsEquivalent(current, mergedTabs) ? current : mergedTabs;
    });
    setOpenTabIds((current) => {
      if (current.length > 0) {
        return current;
      }

      return areStringArraysEqual(current, nextState.openTabIds) ? current : nextState.openTabIds;
    });
    setActiveTabId((current) => current ?? nextState.activeTabId);
    setActiveCollectionId((current) => current ?? nextState.activeCollectionId);
    setExpandedCollectionIds((current) => {
      const mergedIds = mergeExpandedCollectionIds(current, nextState.expandedCollectionIds);
      return areStringArraysEqual(current, mergedIds) ? current : mergedIds;
    });
    setNextTabIndex((current) => Math.max(current, nextState.nextTabIndex));
  }, [
    collectionRequestsQuery.data,
    collectionRequestsQuery.isSuccess,
    collectionTreeQuery.isSuccess,
    serverCollections,
    tabs,
  ]);

  const updateActiveTab = (updater: (tab: RequestPageTab) => RequestPageTab) => {
    if (!activeTab) {
      return;
    }

    updateTab(activeTab.id, updater);
  };

  const buildCreatePayloadFromTab = (
    tab: RequestPageTab,
    collectionId: number,
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
      path_params: {},
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
      path_params: {},
      body: tab.bodyContent,
      body_type: requestBodyTypeFromMode(tab.bodyMode, tab.bodyContent),
      auth: toRequestAuthConfig(tab.authorizationMode, tab.authorizationValue),
      pre_request: scripts.pre_request,
      test: scripts.test,
    };
  };

  const syncPersistedRequestInWorkbench = (
    sourceTabId: string,
    persistedRequest: ProjectRequest,
    overrides: Partial<Pick<RequestPageTab, 'isSending' | 'response'>> = {}
  ) => {
    const nextTab = toRequestPageTab(persistedRequest);

    setTabs((current) =>
      current.map((tab) =>
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
      setCollections((current) =>
        current.map((collection) =>
          collection.requestIds.includes(sourceTabId)
            ? {
                ...collection,
                requestIds: collection.requestIds.map((requestId) =>
                  requestId === sourceTabId ? nextTab.id : requestId
                ),
              }
            : collection
        )
      );
      setOpenTabIds((current) =>
        current.map((requestId) => (requestId === sourceTabId ? nextTab.id : requestId))
      );
      setActiveTabId((current) => (current === sourceTabId ? nextTab.id : current));
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
    const persistedCollectionId = tab.collectionId ? Number(tab.collectionId) : null;

    if (
      !persistedCollectionId ||
      !Number.isInteger(persistedCollectionId) ||
      persistedCollectionId <= 0
    ) {
      throw new Error('Move this request into a saved collection before sending it.');
    }

    if (options.requireRunnableUrl) {
      if (!tab.url.trim()) {
        throw new Error('Enter a request URL before sending.');
      }

      try {
        new URL(tab.url);
      } catch {
        throw new Error('The URL is not valid. Try a value like https://localhost:3000/health.');
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

    const targetCollection = collections.find((collection) => collection.id === tab.collectionId);
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

  const createCollection = async () => {
    if (createCollectionMutation.isPending) {
      return;
    }

    try {
      const collectionNumber = collections.length + 1;
      const createdCollection = await createCollectionMutation.mutateAsync({
        name: `New Collection ${collectionNumber}`,
        description: '',
        is_folder: false,
        sort_order: collections.length,
      });
      const nextCollection: CollectionNode = {
        id: String(createdCollection.id),
        name: createdCollection.name,
        color: COLLECTION_COLORS[(collectionNumber - 1) % COLLECTION_COLORS.length],
        requestIds: [],
      };

      setCollections((current) => [nextCollection, ...current]);
      setExpandedCollectionIds((current) =>
        current.includes(nextCollection.id) ? current : [nextCollection.id, ...current]
      );
      setActiveCollectionId(nextCollection.id);
    } catch {}
  };

  const removeCollectionFromWorkbench = (collectionId: string) => {
    const targetCollection = collections.find((collection) => collection.id === collectionId);
    if (!targetCollection) {
      return;
    }

    const removedTabIds = new Set(targetCollection.requestIds);
    const remainingCollections = collections.filter((collection) => collection.id !== collectionId);
    const remainingTabs = tabs.filter((tab) => tab.collectionId !== collectionId);
    const nextOpenTabIds = openTabIds.filter((tabId) => !removedTabIds.has(tabId));
    const nextActiveTabId = resolveNextActiveTabId(openTabIds, nextOpenTabIds, activeTabId);

    startTransition(() => {
      setCollections(remainingCollections);
      setTabs(remainingTabs);
      setOpenTabIds(nextOpenTabIds);
      setExpandedCollectionIds((current) => current.filter((id) => id !== collectionId));
      setActiveCollectionId((current) =>
        current === collectionId ? remainingCollections[0]?.id ?? null : current
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
      const persistedCollectionId = Number(collection.id);

      if (Number.isInteger(persistedCollectionId) && persistedCollectionId > 0) {
        await deleteCollectionMutation.mutateAsync(persistedCollectionId);
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
      (collection) => collection.id === renameDialogCollectionId
    );
    if (!targetCollection) {
      closeRenameCollectionDialog(false);
      return;
    }

    setRenamingCollectionId(targetCollection.id);

    try {
      const persistedCollectionId = Number(targetCollection.id);

      if (Number.isInteger(persistedCollectionId) && persistedCollectionId > 0) {
        await updateCollectionMutation.mutateAsync({
          collectionId: persistedCollectionId,
          data: { name: nextName },
        });
      }

      startTransition(() => {
        setCollections((current) =>
          current.map((collection) =>
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
    setExpandedCollectionIds((current) =>
      current.includes(collectionId)
        ? current.filter((id) => id !== collectionId)
        : [...current, collectionId]
    );
  };

  const selectRequest = (tabId: string, collectionId: string | null) => {
    setActiveTabId(tabId);
    setOpenTabIds((current) => (current.includes(tabId) ? current : [...current, tabId]));

    if (collectionId) {
      setActiveCollectionId(collectionId);
      setExpandedCollectionIds((current) =>
        current.includes(collectionId) ? current : [...current, collectionId]
      );
    }
  };

  const renameRequestInWorkbench = (tabId: string, nextName: string) => {
    startTransition(() => {
      setTabs((current) =>
        current.map((tab) => (tab.id === tabId ? { ...tab, title: nextName } : tab))
      );
    });
  };

  const removeRequestFromWorkbench = (tabId: string) => {
    const nextOpenTabIds = openTabIds.filter((id) => id !== tabId);
    const nextActiveTabId = resolveNextActiveTabId(openTabIds, nextOpenTabIds, activeTabId);

    startTransition(() => {
      setTabs((current) => current.filter((tab) => tab.id !== tabId));
      setCollections((current) =>
        current.map((collection) =>
          collection.requestIds.includes(tabId)
            ? {
                ...collection,
                requestIds: collection.requestIds.filter((requestId) => requestId !== tabId),
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
      title: `${activeTab.title} Copy`,
      response: createEmptyResponse(),
      isSending: false,
      paramsRows: activeTab.paramsRows.map((row) => ({ ...row, id: createLocalId('kv') })),
      headersRows: activeTab.headersRows.map((row) => ({ ...row, id: createLocalId('kv') })),
    };

    startTransition(() => {
      setTabs((current) => [...current, duplicatedTab]);
      setOpenTabIds((current) => [...current, duplicatedTab.id]);

      if (duplicatedTab.collectionId) {
        setCollections((current) =>
          current.map((collection) =>
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
      setNextTabIndex((current) => current + 1);
    });
  };

  const handleSaveTab = async () => {
    if (!activeTab) {
      return;
    }

    const nextName = getTabSaveLabel(activeTab);
    const tabSnapshot = {
      ...activeTab,
      title: nextName,
    };

    updateTab(activeTab.id, (tab) => ({
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

    updateTab(tabId, (tab) => ({
      ...tab,
      isSending: true,
      response: {
        ...tab.response,
        error: null,
      },
    }));

    try {
      const persistedRequest = await persistTabRequest(tabSnapshot, {
        requireRunnableUrl: true,
      });
      tabId = syncPersistedRequestInWorkbench(tabId, persistedRequest, {
        isSending: true,
      });

      const response = await executeRequestInBrowser(persistedRequest, tabSnapshot.settings);

      updateTab(tabId, (tab) => ({
        ...tab,
        isSending: false,
        response: toResponseDraft(response),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send request.';

      updateTab(tabId, (tab) => ({
        ...tab,
        isSending: false,
        response: {
          ...createEmptyResponse(),
          error: message,
        },
      }));
    }
  };

  const attachRequestTabToCollection = (collectionId: string, tab: RequestPageTab) => {
    startTransition(() => {
      setTabs((current) => [...current, tab]);
      setOpenTabIds((current) => [...current, tab.id]);
      setCollections((current) =>
        current.map((collection) =>
          collection.id === collectionId
            ? {
                ...collection,
                requestIds: [tab.id, ...collection.requestIds],
              }
            : collection
        )
      );
      setExpandedCollectionIds((current) =>
        current.includes(collectionId) ? current : [...current, collectionId]
      );
      setActiveCollectionId(collectionId);
      setActiveTabId(tab.id);
      setNextTabIndex((current) => current + 1);
    });
  };

  const handleCloseTab = (tabId: string) => {
    const nextOpenTabIds = openTabIds.filter((id) => id !== tabId);
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

    const targetRequest = tabs.find((tab) => tab.id === renameDialogRequestTabId);
    if (!targetRequest) {
      closeRenameRequestDialog(false);
      return;
    }

    setRenamingRequestTabId(targetRequest.id);

    try {
      const persistedCollectionId = targetRequest.collectionId
        ? Number(targetRequest.collectionId)
        : null;
      const persistedRequestId = getPersistedRequestId(targetRequest.id);

      if (
        persistedCollectionId &&
        Number.isInteger(persistedCollectionId) &&
        persistedCollectionId > 0 &&
        persistedRequestId
      ) {
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
      const persistedCollectionId = request.collectionId ? Number(request.collectionId) : null;
      const persistedRequestId = getPersistedRequestId(request.id);

      if (
        persistedCollectionId &&
        Number.isInteger(persistedCollectionId) &&
        persistedCollectionId > 0 &&
        persistedRequestId
      ) {
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

    const localTab = createRequestPageTab(nextTabIndex, {
      title: DEFAULT_NEW_REQUEST_TITLE,
      collectionId: collection.id,
      url: DEFAULT_NEW_REQUEST_URL,
    });

    if (!isPersistedCollectionId(collection.id)) {
      attachRequestTabToCollection(collection.id, localTab);
      return;
    }

    setCreatingRequestCollectionId(collection.id);

    try {
      const persistedCollectionId = Number(collection.id);
      const createdRequest = await createRequestMutation.mutateAsync({
        collectionId: persistedCollectionId,
        data: buildCreatePayloadFromTab(
          localTab,
          persistedCollectionId,
          collection.requestIds.length,
          DEFAULT_NEW_REQUEST_TITLE
        ),
      });

      attachRequestTabToCollection(collection.id, toRequestPageTab(createdRequest));
    } catch {
    } finally {
      setCreatingRequestCollectionId(null);
    }
  };

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,251,0.98))]">
      <div className="border-b border-border/60 bg-white/80 backdrop-blur">
        <div className="px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <RequestTabs
                tabs={openTabs}
                activeTabId={activeTabId}
                onSelectTab={(tabId) => selectRequest(tabId, tabMap.get(tabId)?.collectionId ?? null)}
                onCloseTab={handleCloseTab}
              />
            </div>
            <EnvironmentSwitcher
              environment={environment}
              onEnvironmentChange={(value) =>
                setEnvironment(value as (typeof ENVIRONMENT_OPTIONS)[number])
              }
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden xl:flex-row xl:flex">
        <aside className="w-full shrink-0 border-b border-border/60 bg-white/82 backdrop-blur xl:w-[320px] xl:border-b-0 xl:border-r">
          <CollectionsSidebar
            collections={collectionViews}
            activeCollectionId={activeCollectionId}
            activeTabId={activeTabId}
            deletingCollectionId={deletingCollectionId}
            renamingCollectionId={renamingCollectionId}
            creatingRequestCollectionId={creatingRequestCollectionId}
            deletingRequestTabId={deletingRequestTabId}
            renamingRequestTabId={renamingRequestTabId}
            expandedCollectionIds={expandedCollectionIds}
            scratchpadTabs={visibleScratchpadTabs}
            query={sidebarQuery}
            onQueryChange={setSidebarQuery}
            onCreateCollection={createCollection}
            onCreateRequest={handleCreateRequest}
            onDeleteCollection={handleDeleteCollection}
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
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          API Request
                        </Badge>
                        {activeTab.collectionId ? (
                          <Badge variant="secondary">
                            {collections.find((collection) => collection.id === activeTab.collectionId)?.name || 'Collection'}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Scratchpad</Badge>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-xl tracking-tight">{activeTab.title}</CardTitle>
                        <CardDescription className="mt-1">
                          Execute collection requests directly from your browser and inspect the live response locally.
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
                        aria-label="Duplicate tab"
                        title="Duplicate tab"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        isIcon
                        className="h-10 w-10 rounded-2xl"
                        onClick={handleSaveTab}
                        aria-label="Save tab"
                        title="Save tab"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 px-4 py-5 md:px-6">
                  <RequestToolbar
                    tab={activeTab}
                    onMethodChange={(method) => updateActiveTab((tab) => ({ ...tab, method }))}
                    onUrlChange={(url) => updateActiveTab((tab) => ({ ...tab, url }))}
                    onSend={handleSend}
                    onSave={handleSaveTab}
                    onDuplicate={handleDuplicateTab}
                  />

                  <RequestSectionTabs
                    activeSection={activeTab.activeSection}
                    onSelectSection={(section) =>
                      updateActiveTab((tab) => ({ ...tab, activeSection: section }))
                    }
                  />

                  <RequestSectionPanel
                    tab={activeTab}
                    onTabChange={updateActiveTab}
                  />
                </CardContent>
              </Card>

              <ResponsePanel response={activeTab.response} isSending={activeTab.isSending} />
            </div>
          ) : (
            <div className="mx-auto flex min-h-full max-w-[960px] items-center justify-center">
              <div className="px-6 py-16 text-center">
                <p className="text-2xl font-medium tracking-tight text-text-muted">
                  没有窗口打开
                </p>
                <p className="mt-3 text-base text-text-muted">
                  从左侧 Collection 选择一个 request 重新打开，或创建一个新的 request。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

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
    </main>
  );
}

function CollectionsSidebar({
  collections,
  activeCollectionId,
  activeTabId,
  deletingCollectionId,
  renamingCollectionId,
  creatingRequestCollectionId,
  deletingRequestTabId,
  renamingRequestTabId,
  expandedCollectionIds,
  scratchpadTabs,
  query,
  onQueryChange,
  onCreateCollection,
  onCreateRequest,
  onDeleteCollection,
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
  renamingCollectionId: string | null;
  creatingRequestCollectionId: string | null;
  deletingRequestTabId: string | null;
  renamingRequestTabId: string | null;
  expandedCollectionIds: string[];
  scratchpadTabs: RequestPageTab[];
  query: string;
  onQueryChange: (value: string) => void;
  onCreateCollection: () => void;
  onCreateRequest: (collection: CollectionNode) => Promise<void>;
  onDeleteCollection: (collection: CollectionNode) => void;
  onDeleteRequest: (request: RequestPageTab) => Promise<void>;
  onRenameCollection: (collection: CollectionNode) => void;
  onRenameRequest: (request: RequestPageTab) => void;
  onToggleCollection: (collectionId: string) => void;
  onSelectRequest: (tabId: string, collectionId: string | null) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Filter collections or requests"
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" size="sm" isIcon onClick={onCreateCollection}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-2">
          {collections.map(({ collection, requests }) => {
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
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
                      <p className="truncate text-sm font-medium text-text-main">{collection.name}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {collection.requestIds.length} requests
                    </p>
                  </button>

                  <CollectionActionsMenu
                    isCreatingRequest={creatingRequestCollectionId === collection.id}
                    isDeleting={deletingCollectionId === collection.id}
                    isRenaming={renamingCollectionId === collection.id}
                    onCreateRequest={() => void onCreateRequest(collection)}
                    onRename={() => onRenameCollection(collection)}
                    onDelete={() => void onDeleteCollection(collection)}
                  />
                </div>

                {isExpanded ? (
                  <div className="mt-1.5 space-y-1 pl-10">
                    {requests.map((request) => (
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
                Scratchpad
              </div>
              <div className="space-y-1.5">
                {scratchpadTabs.map((tab) => (
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isIcon
          className="mr-1 h-7 w-7 rounded-lg opacity-0 transition-opacity group-hover/request:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label="Open request actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl">
        <DropdownMenuItem disabled={isRenaming} onSelect={onRename}>
          {isRenaming ? 'Renaming...' : 'Rename'}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={isDeleting} onSelect={onDelete}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Share</DropdownMenuItem>
        <DropdownMenuItem>Copy link</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CollectionActionsMenu({
  isCreatingRequest,
  isDeleting,
  isRenaming,
  onCreateRequest,
  onRename,
  onDelete,
}: {
  isCreatingRequest: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  onCreateRequest: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isIcon
          className="h-8 w-8 rounded-xl opacity-0 transition-opacity group-hover/collection:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label="Open collection actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl">
        <DropdownMenuItem disabled={isCreatingRequest} onSelect={onCreateRequest}>
          {isCreatingRequest ? 'Creating...' : 'New request'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Import</DropdownMenuItem>
        <DropdownMenuItem>Export</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isRenaming} onSelect={onRename}>
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={isDeleting} onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Rename Collection</DialogTitle>
          <DialogDescription>
            Update the collection name and sync it to the backend when a persisted collection ID is
            available.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-2">
            <Label htmlFor="rename-collection-name">Collection name</Label>
            <Input
              id="rename-collection-name"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="Enter collection name"
              className="rounded-2xl"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            disabled={!value.trim()}
            onClick={() => void onConfirm()}
          >
            Save
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Rename Request</DialogTitle>
          <DialogDescription>
            Update the request name and sync it to the backend when this request already has a
            persisted ID.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-2">
            <Label htmlFor="rename-request-name">Request name</Label>
            <Input
              id="rename-request-name"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="Enter request name"
              className="rounded-2xl"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            disabled={!value.trim()}
            onClick={() => void onConfirm()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  if (tabs.length === 0) {
    return (
      <div className="flex h-10 items-center rounded-xl border border-dashed border-border/60 bg-white/55 px-4 text-sm text-text-muted">
        没有窗口打开
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 pr-2">
        {tabs.map((tab) => (
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
              aria-label={`Close ${tab.title}`}
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
  environment,
  onEnvironmentChange,
}: {
  environment: (typeof ENVIRONMENT_OPTIONS)[number];
  onEnvironmentChange: (value: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border/60 bg-white/85 px-2.5 py-1 shadow-sm">
      <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted">
        Environment
      </span>
      <Select value={environment} onValueChange={onEnvironmentChange}>
        <SelectTrigger
          size="sm"
          className="h-7 min-w-[132px] border-0 bg-transparent px-1.5 text-sm shadow-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[132px] rounded-xl">
          {ENVIRONMENT_OPTIONS.map((option) => (
            <SelectItem key={option} value={option} className="py-1 text-xs">
              {option}
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
  return (
    <div className="rounded-[24px] border border-border/60 bg-slate-50/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="grid gap-3 xl:grid-cols-[140px_minmax(0,1fr)_auto]">
        <Select value={tab.method} onValueChange={(value) => onMethodChange(value as RequestMethod)}>
          <SelectTrigger className="h-11 w-full rounded-2xl border-border/70 bg-white font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHOD_OPTIONS.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={tab.url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="Paste API URL"
          className="h-11 rounded-2xl border-border/70 bg-white px-4 text-sm shadow-none"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            isIcon
            className="h-11 w-11 rounded-2xl"
            onClick={onSave}
            aria-label="Save tab"
            title="Save tab"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            isIcon
            className="h-11 w-11 rounded-2xl"
            onClick={onDuplicate}
            aria-label="Duplicate tab"
            title="Duplicate tab"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button type="button" className="h-11 rounded-2xl px-5" onClick={onSend} loading={tab.isSending}>
            <SendHorizonal className="h-4 w-4" />
            Send
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SECTION_ITEMS.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onSelectSection(item.value)}
          className={cn(
            'rounded-full border px-3 py-2 text-sm font-medium transition-colors',
            item.value === activeSection
              ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
              : 'border-border/60 bg-white/70 text-text-muted hover:border-border hover:bg-white hover:text-text-main'
          )}
        >
          {item.label}
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
  switch (tab.activeSection) {
    case 'params':
      return (
        <KeyValueEditor
          title="Query Params"
          description="Edit structured query parameters or switch to bulk mode for quick pasting."
          mode={tab.paramsMode}
          rows={tab.paramsRows}
          bulkValue={tab.paramsBulk}
          onModeChange={(mode) =>
            onTabChange((current) =>
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
          onRowsChange={(rows) =>
            onTabChange((current) => ({
              ...current,
              paramsRows: rows,
              paramsBulk: rowsToBulkText(rows),
            }))
          }
          onBulkChange={(bulkValue) =>
            onTabChange((current) => ({
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
          onModeChange={(mode) =>
            onTabChange((current) => ({
              ...current,
              authorizationMode: mode,
            }))
          }
          onValueChange={(value) =>
            onTabChange((current) => ({
              ...current,
              authorizationValue: value,
            }))
          }
        />
      );
    case 'headers':
      return (
        <KeyValueEditor
          title="Headers"
          description="Manage request headers with a table view or bulk input."
          mode={tab.headersMode}
          rows={tab.headersRows}
          bulkValue={tab.headersBulk}
          onModeChange={(mode) =>
            onTabChange((current) =>
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
          onRowsChange={(rows) =>
            onTabChange((current) => ({
              ...current,
              headersRows: rows,
              headersBulk: rowsToBulkText(rows),
            }))
          }
          onBulkChange={(bulkValue) =>
            onTabChange((current) => ({
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
          onModeChange={(mode) =>
            onTabChange((current) => ({
              ...current,
              bodyMode: mode,
            }))
          }
          onValueChange={(value) =>
            onTabChange((current) => ({
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
          onValueChange={(value) =>
            onTabChange((current) => ({
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
            onTabChange((current) => ({
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
  const updateRow = (rowId: string, patch: Partial<KeyValueRow>) => {
    onRowsChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const removeRow = (rowId: string) => {
    const nextRows = rows.filter((row) => row.id !== rowId);
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
              Table
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
              Bulk Edit
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRowsChange([...rows, createKeyValueRow()])}
          >
            <Plus className="h-4 w-4" />
            Add row
          </Button>
        </div>
      </div>

      {mode === 'bulk' ? (
        <div className="px-5 py-5">
          <Textarea
            value={bulkValue}
            onChange={(event) => onBulkChange(event.target.value)}
            rows={10}
            className="min-h-[220px] rounded-2xl font-mono text-sm"
            placeholder="key: value # description"
          />
        </div>
      ) : (
        <div className="overflow-x-auto px-5 py-5">
          <div className="min-w-[760px] space-y-3">
            <div className="grid grid-cols-[1.05fr_1.25fr_1fr_56px] gap-3 px-3 text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
              <span>Key</span>
              <span>Value</span>
              <span>Description</span>
              <span />
            </div>

            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1.05fr_1.25fr_1fr_56px] gap-3">
                <Input
                  value={row.key}
                  onChange={(event) => updateRow(row.id, { key: event.target.value })}
                  placeholder="page"
                  className="rounded-2xl"
                />
                <Input
                  value={row.value}
                  onChange={(event) => updateRow(row.id, { value: event.target.value })}
                  placeholder="1"
                  className="rounded-2xl"
                />
                <Input
                  value={row.description}
                  onChange={(event) => updateRow(row.id, { description: event.target.value })}
                  placeholder="Optional note"
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
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card className="border-border/60 bg-white/85 py-0 shadow-sm">
        <CardHeader className="border-b border-border/60 py-5">
          <CardTitle>Authorization</CardTitle>
          <CardDescription>Choose how this request should authenticate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="request-auth-mode">Auth type</Label>
            <Select value={mode} onValueChange={(nextValue) => onModeChange(nextValue as AuthorizationMode)}>
              <SelectTrigger id="request-auth-mode" className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTHORIZATION_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-white/85 py-0 shadow-sm">
        <CardHeader className="border-b border-border/60 py-5">
          <CardTitle>Credentials</CardTitle>
          <CardDescription>Provide the credential value that should be sent with the request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5 py-5">
          {mode === 'none' ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-slate-50/80 p-5 text-sm text-text-muted">
              This request currently sends without authentication.
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="request-auth-value">
                {mode === 'basic' ? 'Username:Password' : mode === 'api-key' ? 'API key' : 'Token'}
              </Label>
              <Input
                id="request-auth-value"
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder={mode === 'basic' ? 'user:secret' : 'Paste credential value'}
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
  return (
    <div className="rounded-[24px] border border-border/60 bg-white/85 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-main">Body</h3>
          <p className="mt-1 text-sm text-text-muted">
            Choose a body mode and edit the payload in a large code-friendly area.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-border/60 bg-slate-50/80 p-1">
          {BODY_MODE_OPTIONS.map((option) => (
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
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5">
        <Textarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          rows={14}
          className="min-h-[280px] rounded-2xl font-mono text-sm"
          placeholder={mode === 'form-data' ? 'field=value' : '{\n  \n}'}
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
  return (
    <Card className="border-border/60 bg-white/85 py-0 shadow-sm">
      <CardHeader className="border-b border-border/60 py-5">
        <CardTitle>Scripts</CardTitle>
        <CardDescription>Use this area for pre-request or post-response scripting logic.</CardDescription>
      </CardHeader>
      <CardContent className="px-5 py-5">
        <Textarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          rows={14}
          className="min-h-[280px] rounded-2xl font-mono text-sm"
          placeholder="// Write request scripts here"
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
  const settingItems: Array<{
    key: keyof RequestPageTab['settings'];
    title: string;
    description: string;
  }> = [
    {
      key: 'followRedirects',
      title: 'Follow redirects',
      description: 'Keep request execution aligned with browser-like redirect behavior.',
    },
    {
      key: 'strictTls',
      title: 'Strict TLS validation',
      description: 'Control certificate verification once the runner supports stricter transport options.',
    },
    {
      key: 'persistCookies',
      title: 'Persist cookies',
      description: 'Enable only for cookie-based sessions. Cross-origin cookie requests need explicit CORS allow-origin and allow-credentials support.',
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {settingItems.map((item) => (
        <Card key={item.key} className="border-border/60 bg-white/85 py-0 shadow-sm">
          <CardHeader className="border-b border-border/60 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription className="mt-1">{item.description}</CardDescription>
              </div>
              <Switch
                checked={settings[item.key]}
                onCheckedChange={(checked) => onSettingChange(item.key, checked)}
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
}: {
  response: ResponseDraft;
  isSending: boolean;
}) {
  const responseHeaders = Object.entries(response.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return (
    <Card className="min-h-[320px] gap-0 rounded-[28px] border-border/60 bg-white/90 py-0 shadow-[0_12px_44px_rgba(15,23,42,0.06)]">
      <CardHeader className="gap-4 border-b border-border/60 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-xl tracking-tight">Response</CardTitle>
            <CardDescription className="mt-1">
              Inspect the latest real response payload, headers, timing, and status details.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <MetricBadge
              label="Status"
              value={response.status !== null ? `${response.status} ${response.statusLabel}`.trim() : '-'}
            />
            <MetricBadge
              label="Time"
              value={response.durationMs !== null ? `${response.durationMs} ms` : '-'}
            />
            <MetricBadge
              label="Size"
              value={response.sizeBytes !== null ? `${response.sizeBytes} B` : '-'}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-[260px] flex-1 flex-col px-5 py-5">
        {isSending ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-slate-50/80 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <p className="mt-4 text-sm font-medium text-text-main">Sending request...</p>
            <p className="mt-1 text-sm text-text-muted">
              The response panel updates as soon as the browser receives the target API response.
            </p>
          </div>
        ) : response.error ? (
          <div className="flex flex-1 flex-col justify-center rounded-[24px] border border-rose-200 bg-rose-50/70 p-6">
            <p className="text-sm font-semibold text-rose-700">Unable to send request</p>
            <p className="mt-2 text-sm leading-6 text-rose-600">{response.error}</p>
          </div>
        ) : response.status === null ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-slate-50/80 text-center">
            <p className="text-base font-semibold text-text-main">Click Send to get a response</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
              Once you trigger the request, this panel will render the latest response body, headers, and browser transport metadata.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {responseHeaders ? (
              <div className="rounded-[24px] border border-border/60 bg-slate-100/90 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Headers
                </p>
                <pre className="overflow-auto text-xs leading-6 text-slate-700">{responseHeaders}</pre>
              </div>
            ) : null}
            <pre className="flex-1 overflow-auto rounded-[24px] border border-border/60 bg-slate-950/95 p-5 text-sm leading-6 text-slate-100">
              {response.body || '(empty body)'}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-border/60 bg-slate-50/80 px-3 py-1.5 text-sm">
      <span className="text-text-muted">{label}: </span>
      <span className="font-medium text-text-main">{value}</span>
    </div>
  );
}

function MethodBadge({
  method,
  compact = false,
}: {
  method: RequestMethod;
  compact?: boolean;
}) {
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
