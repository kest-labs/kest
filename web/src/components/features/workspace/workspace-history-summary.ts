import type { WorkspaceHistory } from '@/types/history';

const REQUEST_HISTORY_ENTITY_TYPES = new Set(['request', 'cli_request']);
const RUN_HISTORY_ENTITY_TYPES = new Set(['flow', 'cli_run']);
const HTTP_METHOD_PATTERN = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^\s)）]+)/i;
const CLI_FLOW_MESSAGE_PATTERN =
  /\bCLI flow\s+(.+?)\s+(passed|failed|canceled|cancelled|completed)$/i;
const FLOW_MESSAGE_PATTERN = /^Flow\s+(.+?)\s+(passed|failed|canceled|cancelled|completed)$/i;

const getHistoryDataRecord = (history?: WorkspaceHistory | null) => {
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

const formatHistoryDuration = (value: unknown) => {
  const duration = getHistoryNumber(value);
  return duration === null ? null : `${duration}ms`;
};

const humanizeHistoryLabel = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());

const getConciseDisplayName = (value?: string | null) => {
  const name = value?.trim();
  if (!name || /^new request$/i.test(name) || name.length > 32) {
    return null;
  }

  return name;
};

const normalizeEndpointTarget = (value?: string | null) => {
  const target = value?.trim();
  if (!target) {
    return null;
  }

  try {
    const url = new URL(target);
    return `${url.pathname || '/'}${url.search}`;
  } catch {
    // Not an absolute URL; keep handling path-like and template-based values below.
  }

  const templatePrefixMatch = target.match(/^\{\{[^{}]+}}\s*(.*)$/);
  if (templatePrefixMatch?.[1]?.startsWith('/')) {
    return templatePrefixMatch[1];
  }

  return target;
};

const getPathBasename = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/[?#].*$/, '').replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : raw;
};

const getHistoryRequestRecord = (history?: WorkspaceHistory | null) => {
  if (!history || !REQUEST_HISTORY_ENTITY_TYPES.has(history.entity_type)) {
    return null;
  }

  return getHistoryNestedRecord(getHistoryDataRecord(history)?.request);
};

const getHistoryResponseRecord = (history?: WorkspaceHistory | null) => {
  if (!history || !REQUEST_HISTORY_ENTITY_TYPES.has(history.entity_type)) {
    return null;
  }

  return getHistoryNestedRecord(getHistoryDataRecord(history)?.response);
};

const getHistoryRunRecord = (history?: WorkspaceHistory | null) => {
  if (!history || !RUN_HISTORY_ENTITY_TYPES.has(history.entity_type)) {
    return null;
  }

  return getHistoryNestedRecord(getHistoryDataRecord(history)?.run);
};

const getHistorySummaryRecord = (history?: WorkspaceHistory | null) =>
  getHistoryNestedRecord(getHistoryDataRecord(history)?.summary);

const getHistoryRequestTitle = (history: WorkspaceHistory) => {
  const requestRecord = getHistoryRequestRecord(history);
  const messageMatch = history.message.match(HTTP_METHOD_PATTERN);
  const method =
    getHistoryString(requestRecord?.method)?.toUpperCase() ?? messageMatch?.[1]?.toUpperCase();
  const target =
    normalizeEndpointTarget(getHistoryString(requestRecord?.path)) ??
    normalizeEndpointTarget(getHistoryString(requestRecord?.url)) ??
    normalizeEndpointTarget(getHistoryString(requestRecord?.executed_url)) ??
    normalizeEndpointTarget(messageMatch?.[2]) ??
    getHistoryString(requestRecord?.name);

  if (!method && !target) {
    return null;
  }

  return [method, target].filter(Boolean).join(' ');
};

const getHistoryFlowTitle = (history: WorkspaceHistory) => {
  const dataRecord = getHistoryDataRecord(history);
  const flowRecord = getHistoryNestedRecord(dataRecord?.flow);
  const runRecord = getHistoryRunRecord(history);
  const flowName = getHistoryString(flowRecord?.name);
  const sourceName =
    getHistoryString(runRecord?.source_name) ??
    getPathBasename(getHistoryString(runRecord?.source_path)) ??
    getPathBasename(history.message.match(CLI_FLOW_MESSAGE_PATTERN)?.[1]) ??
    history.message.match(FLOW_MESSAGE_PATTERN)?.[1]?.trim();

  return flowName ?? sourceName ?? null;
};

const getCompactHistoryMessage = (history: WorkspaceHistory) => {
  const message = getHistoryString(history.message);
  if (!message) {
    return null;
  }

  return message.replace(/\s+/g, ' ');
};

export const getHistorySidebarTitle = (history: WorkspaceHistory) =>
  getHistoryRequestTitle(history) ??
  getHistoryFlowTitle(history) ??
  getCompactHistoryMessage(history) ??
  humanizeHistoryLabel(history.entity_type);

export const getHistorySidebarStatus = (history: WorkspaceHistory) => {
  const responseStatus = getHistoryNumber(getHistoryResponseRecord(history)?.status);
  if (responseStatus !== null) {
    return String(responseStatus);
  }

  const runStatus = getHistoryString(getHistoryRunRecord(history)?.status);
  if (runStatus) {
    return runStatus;
  }

  if (history.action && history.action !== 'run') {
    return humanizeHistoryLabel(history.action).toLowerCase();
  }

  return null;
};

export const getHistorySidebarDuration = (history: WorkspaceHistory) => {
  const responseRecord = getHistoryResponseRecord(history);
  const requestDuration =
    formatHistoryDuration(responseRecord?.duration_ms) ?? formatHistoryDuration(responseRecord?.time);
  if (requestDuration) {
    return requestDuration;
  }

  const runRecord = getHistoryRunRecord(history);
  return (
    formatHistoryDuration(runRecord?.total_duration_ms) ??
    formatHistoryDuration(runRecord?.duration_ms)
  );
};

export const getHistorySidebarStepSummary = (history: WorkspaceHistory) => {
  const runRecord = getHistoryRunRecord(history);
  const summaryRecord = getHistorySummaryRecord(history);
  const totalSteps =
    getHistoryNumber(runRecord?.total_steps) ?? getHistoryNumber(summaryRecord?.total_steps);
  const passedSteps =
    getHistoryNumber(runRecord?.passed_steps) ?? getHistoryNumber(summaryRecord?.passed_steps);

  if (totalSteps === null) {
    return null;
  }

  return passedSteps === null ? String(totalSteps) : `${passedSteps}/${totalSteps}`;
};

export const getHistorySidebarDescription = (history: WorkspaceHistory) => {
  if (REQUEST_HISTORY_ENTITY_TYPES.has(history.entity_type)) {
    const requestRecord = getHistoryRequestRecord(history);
    const requestName = getConciseDisplayName(getHistoryString(requestRecord?.name));
    const environment =
      getHistoryString(requestRecord?.environment) ??
      getHistoryString(getHistoryNestedRecord(getHistoryDataRecord(history)?.runner)?.mode);
    const parts = [requestName, environment].filter((value): value is string => Boolean(value));

    return (
      parts.join(' · ') || getCompactHistoryMessage(history) || humanizeHistoryLabel(history.action)
    );
  }

  if (RUN_HISTORY_ENTITY_TYPES.has(history.entity_type)) {
    return history.source === 'cli' ? 'CLI flow' : 'Flow run';
  }

  return getCompactHistoryMessage(history) || humanizeHistoryLabel(history.action || history.entity_type);
};

export const getHistorySidebarSearchTerms = (history: WorkspaceHistory) =>
  [
    getHistorySidebarTitle(history),
    getHistorySidebarDescription(history),
    getHistorySidebarStatus(history),
    getHistorySidebarDuration(history),
    getHistorySidebarStepSummary(history),
    history.message,
    history.action,
    history.entity_type,
    String(history.id),
    String(history.entity_id),
    String(history.user_id),
  ].filter((value): value is string => Boolean(value));
