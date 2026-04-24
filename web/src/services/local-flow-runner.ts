import { apiExternalBaseUrl } from '@/config/api';
import { localRunnerService } from '@/services/local-runner';
import type { LocalRunnerExecuteRequest } from '@/services/local-runner';
import type {
  FlowRun,
  FlowRunStatus,
  FlowStepResult,
  FlowVariableMappingRule,
} from '@/types/flow';
import type { RunRequestResponse } from '@/types/request';

const TEMPLATE_PATTERN = /\{\{([^}]+)\}\}/g;
const INDEX_SYNTAX_PATTERN = /\[(\d+)\]/g;
const NUMBER_PATTERN = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;

type LocalFlowAssertResult = {
  expression: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  message?: string;
};

export type LocalFlowStepDefinition = {
  id: number;
  name: string;
  sort_order: number;
  method: string;
  url: string;
  headers: string;
  body: string;
  captures: string;
  asserts: string;
};

export type LocalFlowEdgeDefinition = {
  source_step_id: number;
  target_step_id: number;
  mappings: FlowVariableMappingRule[];
};

export type LocalFlowRunStepEvent = {
  run_id: number;
  step_id: number;
  step_name: string;
  status: FlowRunStatus;
  data: FlowStepResult;
};

export type LocalFlowRunRequest = {
  flowId: number;
  runId: number;
  steps: LocalFlowStepDefinition[];
  edges: LocalFlowEdgeDefinition[];
  variables?: Record<string, unknown>;
  onStepEvent?: (event: LocalFlowRunStepEvent) => void;
};

type LocalFlowExecuteRequest = (
  payload: LocalRunnerExecuteRequest
) => Promise<RunRequestResponse>;

const toTemplateValue = (value: unknown) => {
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

const stringifyResultValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return 'nil';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const resolveTemplateValue = (value: string, variables: Record<string, unknown>) =>
  value.replace(TEMPLATE_PATTERN, (match, key: string) => {
    const resolved = variables[key.trim()];
    return resolved === undefined ? match : toTemplateValue(resolved);
  });

const collectUnresolvedVariables = (...values: string[]) =>
  Array.from(
    new Set(
      values.flatMap((value) =>
        Array.from(value.matchAll(TEMPLATE_PATTERN)).map((match) => match[1].trim())
      )
    )
  ).sort();

const normalizeJsonPath = (value: string) =>
  value
    .replace(INDEX_SYNTAX_PATTERN, '.$1')
    .replaceAll('..', '.')
    .replace(/^\./, '')
    .trim();

const getJsonPathValue = (input: unknown, rawPath: string): unknown => {
  if (!rawPath.trim()) {
    return input;
  }

  const normalizedPath = normalizeJsonPath(
    rawPath.trim().startsWith('body.') ? rawPath.trim().slice(5) : rawPath.trim()
  );
  if (!normalizedPath) {
    return input;
  }

  let current: unknown = input;
  for (const part of normalizedPath.split('.')) {
    if (Array.isArray(current)) {
      const index = Number(part);
      if (!Number.isInteger(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
      continue;
    }

    return undefined;
  }

  return current;
};

const parseJsonBody = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
};

const evalNumericExpr = (expr: string): number | null => {
  const trimmed = expr.trim().replaceAll('"', '').replaceAll("'", '');
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.length % 2 === 0 || !NUMBER_PATTERN.test(parts[0])) {
    return null;
  }

  let result = Number(parts[0]);
  if (Number.isNaN(result)) {
    return null;
  }

  for (let index = 1; index < parts.length; index += 2) {
    const operator = parts[index];
    const next = parts[index + 1];
    if (!NUMBER_PATTERN.test(next)) {
      return null;
    }

    const value = Number(next);
    if (Number.isNaN(value)) {
      return null;
    }

    switch (operator) {
      case '+':
        result += value;
        break;
      case '-':
        result -= value;
        break;
      case '*':
        result *= value;
        break;
      case '/':
        if (value === 0) {
          return null;
        }
        result /= value;
        break;
      default:
        return null;
    }
  }

  return result;
};

const createFlowStepResult = ({
  id,
  runId,
  stepId,
  status,
  request = '',
  response = '',
  assertResults = '',
  durationMs = 0,
  variablesCaptured = '',
  errorMessage = '',
}: {
  id: number;
  runId: number;
  stepId: number;
  status: FlowRunStatus;
  request?: string;
  response?: string;
  assertResults?: string;
  durationMs?: number;
  variablesCaptured?: string;
  errorMessage?: string;
}): FlowStepResult => ({
  id,
  run_id: runId,
  step_id: stepId,
  status,
  request,
  response,
  assert_results: assertResults,
  duration_ms: durationMs,
  variables_captured: variablesCaptured,
  error_message: errorMessage,
  created_at: new Date().toISOString(),
});

const parseHeaders = (
  rawHeaders: string,
  variables: Record<string, unknown>
): Record<string, string> => {
  const resolved = resolveTemplateValue(rawHeaders, variables).trim();
  if (!resolved) {
    return {};
  }

  try {
    const parsed = JSON.parse(resolved) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, toTemplateValue(value)])
    );
  } catch {
    return {};
  }
};

const buildExecutableUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Request URL is required.');
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    const fallbackBase =
      apiExternalBaseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1');
    return new URL(trimmed, fallbackBase).toString();
  }
};

const parseCaptureLines = (captures: string) =>
  captures
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

const captureValue = (
  rawCapture: string,
  responseBody: unknown,
  variables: Record<string, unknown>
) => {
  const separatorIndex = rawCapture.includes('=')
    ? rawCapture.indexOf('=')
    : rawCapture.indexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  const name = rawCapture.slice(0, separatorIndex).trim();
  const path = rawCapture.slice(separatorIndex + 1).trim();
  if (!name || !path) {
    return null;
  }

  const value = getJsonPathValue(responseBody, path);
  if (value === undefined) {
    return null;
  }

  variables[name] = value;
  return [name, value] as const;
};

const evaluateAssert = ({
  assertion,
  status,
  durationMs,
  responseBody,
  variables,
}: {
  assertion: string;
  status: number;
  durationMs: number;
  responseBody: unknown;
  variables: Record<string, unknown>;
}): LocalFlowAssertResult => {
  const result: LocalFlowAssertResult = { expression: assertion, passed: false };

  if (assertion.endsWith(' not exists')) {
    const key = assertion.slice(0, -' not exists'.length).trim();
    const actual = getJsonPathValue(responseBody, key);
    result.expected = 'not exists';
    result.actual = stringifyResultValue(actual);
    result.passed = actual === undefined;
    if (!result.passed) {
      result.message = `expected body path to not exist: ${normalizeJsonPath(key)}`;
    }
    return result;
  }

  if (assertion.endsWith(' exists')) {
    const key = assertion.slice(0, -' exists'.length).trim();
    const actual = getJsonPathValue(responseBody, key);
    result.expected = 'exists';
    result.actual = stringifyResultValue(actual);
    result.passed = actual !== undefined;
    if (!result.passed) {
      result.message = `body path does not exist: ${normalizeJsonPath(key)}`;
    }
    return result;
  }

  const containsIndex = assertion.indexOf(' contains ');
  if (containsIndex !== -1) {
    const key = assertion.slice(0, containsIndex).trim();
    const expected = resolveTemplateValue(
      assertion.slice(containsIndex + ' contains '.length).trim().replace(/^["']|["']$/g, ''),
      variables
    );
    const actual = key === 'status' ? status : key === 'duration' ? durationMs : getJsonPathValue(responseBody, key);
    result.expected = expected;
    result.actual = stringifyResultValue(actual);
    result.passed = Array.isArray(actual)
      ? actual.some((item) => stringifyResultValue(item) === expected)
      : stringifyResultValue(actual).includes(expected);
    if (!result.passed) {
      result.message = `${key} does not contain "${expected}"`;
    }
    return result;
  }

  const startsWithIndex = assertion.indexOf(' startsWith ');
  if (startsWithIndex !== -1) {
    const key = assertion.slice(0, startsWithIndex).trim();
    const expected = resolveTemplateValue(
      assertion.slice(startsWithIndex + ' startsWith '.length).trim().replace(/^["']|["']$/g, ''),
      variables
    );
    const actual = key === 'status' ? status : key === 'duration' ? durationMs : getJsonPathValue(responseBody, key);
    result.expected = expected;
    result.actual = stringifyResultValue(actual);
    result.passed = stringifyResultValue(actual).startsWith(expected);
    if (!result.passed) {
      result.message = `${key} does not start with "${expected}"`;
    }
    return result;
  }

  const endsWithIndex = assertion.indexOf(' endsWith ');
  if (endsWithIndex !== -1) {
    const key = assertion.slice(0, endsWithIndex).trim();
    const expected = resolveTemplateValue(
      assertion.slice(endsWithIndex + ' endsWith '.length).trim().replace(/^["']|["']$/g, ''),
      variables
    );
    const actual = key === 'status' ? status : key === 'duration' ? durationMs : getJsonPathValue(responseBody, key);
    result.expected = expected;
    result.actual = stringifyResultValue(actual);
    result.passed = stringifyResultValue(actual).endsWith(expected);
    if (!result.passed) {
      result.message = `${key} does not end with "${expected}"`;
    }
    return result;
  }

  const lengthIndex = assertion.indexOf(' length ');
  if (lengthIndex !== -1) {
    const key = assertion.slice(0, lengthIndex).trim();
    const expectedExpr = assertion.slice(lengthIndex + ' length '.length).trim();
    const actual = getJsonPathValue(responseBody, key);
    const actualLength = Array.isArray(actual)
      ? actual.length
      : stringifyResultValue(actual).length;
    const lengthResult = evaluateAssert({
      assertion: `status ${expectedExpr}`,
      status: actualLength,
      durationMs,
      responseBody,
      variables,
    });
    return {
      ...lengthResult,
      expression: assertion,
    };
  }

  const operators = [' matches ', ' == ', ' != ', ' >= ', ' <= ', ' > ', ' < '];
  let operator = '';
  let left = '';
  let right = '';

  for (const candidate of operators) {
    const index = assertion.indexOf(candidate);
    if (index === -1) {
      continue;
    }
    operator = candidate.trim();
    left = assertion.slice(0, index).trim();
    right = assertion.slice(index + candidate.length).trim();
    break;
  }

  if (!operator) {
    for (const candidate of ['==', '!=', '>=', '<=', '>', '<']) {
      const index = assertion.indexOf(candidate);
      if (index === -1) {
        continue;
      }
      operator = candidate;
      left = assertion.slice(0, index).trim();
      right = assertion.slice(index + candidate.length).trim();
      break;
    }
  }

  if (!operator) {
    result.expected = 'valid assertion';
    result.actual = 'unknown format';
    result.message = `invalid assertion format: ${assertion}`;
    return result;
  }

  const expectedResolved = resolveTemplateValue(right, variables).replace(/^["']|["']$/g, '');
  const actualValue =
    left === 'status'
      ? status
      : left === 'duration'
        ? durationMs
        : getJsonPathValue(responseBody, left);

  if (actualValue === undefined) {
    result.expected = `${operator} ${expectedResolved}`;
    result.actual = 'nil';
    result.message = `body path not found: ${normalizeJsonPath(left)}`;
    return result;
  }

  const actualString = stringifyResultValue(actualValue);
  result.expected = expectedResolved;
  result.actual = actualString;

  if (operator === 'matches') {
    try {
      result.passed = new RegExp(expectedResolved).test(actualString);
    } catch {
      result.message = `invalid regex: ${expectedResolved}`;
      return result;
    }
  } else if (['>', '>=', '<', '<='].includes(operator)) {
    const expectedNumber = evalNumericExpr(expectedResolved);
    const actualNumber = Number(actualString);
    if (expectedNumber === null || Number.isNaN(actualNumber)) {
      result.message = `${left} mismatch`;
      return result;
    }

    switch (operator) {
      case '>':
        result.passed = actualNumber > expectedNumber;
        break;
      case '>=':
        result.passed = actualNumber >= expectedNumber;
        break;
      case '<':
        result.passed = actualNumber < expectedNumber;
        break;
      case '<=':
        result.passed = actualNumber <= expectedNumber;
        break;
    }
  } else if (operator === '!=') {
    result.passed = actualString !== expectedResolved;
  } else {
    const expectedNumber = evalNumericExpr(expectedResolved);
    if (expectedNumber !== null && !Number.isNaN(Number(actualString))) {
      result.passed = Number(actualString) === expectedNumber;
    } else {
      result.passed = actualString === expectedResolved;
    }
  }

  if (!result.passed && !result.message) {
    result.message = `${left} mismatch`;
  }

  return result;
};

const topologicalSortSteps = (
  steps: LocalFlowStepDefinition[],
  edges: LocalFlowEdgeDefinition[]
) => {
  if (edges.length === 0) {
    return [...steps].sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
  }

  const adjacency = new Map<number, number[]>();
  const inDegree = new Map<number, number>();
  const stepById = new Map(steps.map((step) => [step.id, step]));

  for (const step of steps) {
    adjacency.set(step.id, []);
    inDegree.set(step.id, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.source_step_id)?.push(edge.target_step_id);
    inDegree.set(edge.target_step_id, (inDegree.get(edge.target_step_id) ?? 0) + 1);
  }

  const queue = steps
    .filter((step) => (inDegree.get(step.id) ?? 0) === 0)
    .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)
    .map((step) => step.id);

  const ordered: LocalFlowStepDefinition[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const step = stepById.get(current);
    if (step) {
      ordered.push(step);
    }

    const nextSteps = [...(adjacency.get(current) ?? [])].sort((left, right) => {
      const leftStep = stepById.get(left);
      const rightStep = stepById.get(right);
      if (!leftStep || !rightStep) {
        return left - right;
      }
      return leftStep.sort_order - rightStep.sort_order || leftStep.id - rightStep.id;
    });

    for (const next of nextSteps) {
      const nextDegree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
      }
    }
  }

  if (ordered.length === steps.length) {
    return ordered;
  }

  const reached = new Set(ordered.map((step) => step.id));
  const disconnected = steps
    .filter((step) => !reached.has(step.id))
    .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);

  return [...ordered, ...disconnected];
};

const executeLocalFlowStep = async ({
  step,
  runId,
  stepResultId,
  variables,
  executeRequest,
}: {
  step: LocalFlowStepDefinition;
  runId: number;
  stepResultId: number;
  variables: Record<string, unknown>;
  executeRequest: LocalFlowExecuteRequest;
}) => {
  const resolvedUrl = resolveTemplateValue(step.url, variables);
  const resolvedHeaders = resolveTemplateValue(step.headers, variables);
  const resolvedBody = resolveTemplateValue(step.body, variables);
  const unresolved = collectUnresolvedVariables(resolvedUrl, resolvedHeaders, resolvedBody);

  if (unresolved.length > 0) {
    return createFlowStepResult({
      id: stepResultId,
      runId,
      stepId: step.id,
      status: 'failed',
      errorMessage: `unresolved variables: ${unresolved.join(', ')}`,
    });
  }

  let executableUrl = '';
  try {
    executableUrl = buildExecutableUrl(resolvedUrl);
  } catch (error) {
    return createFlowStepResult({
      id: stepResultId,
      runId,
      stepId: step.id,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Request URL is invalid.',
    });
  }

  const headers = parseHeaders(step.headers, variables);
  const requestInfo = JSON.stringify({
    method: step.method,
    url: executableUrl,
    headers,
    body: resolvedBody,
  });

  let response: RunRequestResponse;
  try {
    response = await executeRequest({
      method: step.method,
      url: executableUrl,
      headers,
      body: resolvedBody.trim() ? resolvedBody : undefined,
    });
  } catch (error) {
    return createFlowStepResult({
      id: stepResultId,
      runId,
      stepId: step.id,
      status: 'failed',
      request: requestInfo,
      errorMessage: error instanceof Error ? error.message : 'Local bridge request failed.',
    });
  }

  const parsedBody = parseJsonBody(response.body);
  const capturedEntries = parseCaptureLines(step.captures)
    .map((capture) => captureValue(capture, parsedBody, variables))
    .filter(Boolean) as Array<readonly [string, unknown]>;
  const captured = Object.fromEntries(capturedEntries);

  const assertResults = step.asserts
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((assertion) =>
      evaluateAssert({
        assertion,
        status: response.status,
        durationMs: response.time,
        responseBody: parsedBody,
        variables,
      })
    );

  const failedAssertions = assertResults.filter((result) => !result.passed);

  return createFlowStepResult({
    id: stepResultId,
    runId,
    stepId: step.id,
    status: failedAssertions.length === 0 ? 'passed' : 'failed',
    request: requestInfo,
    response: JSON.stringify({
      status: response.status,
      headers: response.headers,
      body: response.body,
    }),
    assertResults: JSON.stringify(assertResults),
    durationMs: response.time,
    variablesCaptured: JSON.stringify(captured),
    errorMessage: failedAssertions.map((result) => result.message || result.expression).join('; '),
  });
};

export const runLocalFlow = async (
  request: LocalFlowRunRequest,
  executeRequest: LocalFlowExecuteRequest = localRunnerService.execute
): Promise<FlowRun> => {
  const startedAt = new Date();
  const stepResults: FlowStepResult[] = [];
  const orderedSteps = topologicalSortSteps(request.steps, request.edges);
  const variables: Record<string, unknown> = { ...(request.variables ?? {}) };
  const capturedByStep = new Map<number, Record<string, unknown>>();

  for (const [index, step] of orderedSteps.entries()) {
    const executionVariables = { ...variables };

    for (const edge of request.edges) {
      if (edge.target_step_id !== step.id) {
        continue;
      }

      const upstream = capturedByStep.get(edge.source_step_id);
      if (!upstream) {
        continue;
      }

      for (const mapping of edge.mappings) {
        const sourceValue = upstream[mapping.source];
        if (sourceValue !== undefined) {
          executionVariables[mapping.target] = sourceValue;
        }
      }
    }

    request.onStepEvent?.({
      run_id: request.runId,
      step_id: step.id,
      step_name: step.name,
      status: 'running',
      data: createFlowStepResult({
        id: index + 1,
        runId: request.runId,
        stepId: step.id,
        status: 'running',
      }),
    });

    const stepResult = await executeLocalFlowStep({
      step,
      runId: request.runId,
      stepResultId: index + 1,
      variables: executionVariables,
      executeRequest,
    });

    const captured = stepResult.variables_captured
      ? (JSON.parse(stepResult.variables_captured) as Record<string, unknown>)
      : {};

    for (const [key, value] of Object.entries(captured)) {
      variables[key] = value;
    }
    capturedByStep.set(step.id, captured);
    stepResults.push(stepResult);

    request.onStepEvent?.({
      run_id: request.runId,
      step_id: step.id,
      step_name: step.name,
      status: stepResult.status,
      data: stepResult,
    });

    if (stepResult.status === 'failed') {
      break;
    }
  }

  const finishedAt = new Date();
  const status: FlowRunStatus =
    stepResults.length === 0 || stepResults.some((result) => result.status === 'failed')
      ? 'failed'
      : 'passed';

  return {
    id: request.runId,
    flow_id: request.flowId,
    status,
    triggered_by: 0,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    created_at: startedAt.toISOString(),
    updated_at: finishedAt.toISOString(),
    step_results: stepResults,
    execution_mode: 'local',
  };
};
