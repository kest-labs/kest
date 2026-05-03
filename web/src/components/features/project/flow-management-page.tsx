'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ChevronUp,
  FileClock,
  FolderGit2,
  Minus,
  Play,
  Plus as PlusIcon,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Share2,
  Trash2,
  Workflow,
  Copy,
} from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  buildProjectDetailRoute,
  buildProjectFlowsRoute,
  buildProjectHistoriesRoute,
} from '@/constants/routes';
import {
  useCreateFlow,
  useDeleteFlow,
  useFlow,
  useFlowRun,
  useFlowRuns,
  useFlows,
  useRunFlow,
  useSaveFlow,
} from '@/hooks/use-flows';
import { useCreateProjectHistory } from '@/hooks/use-histories';
import { useEnvironments } from '@/hooks/use-environments';
import { useIsMobile } from '@/hooks/use-mobile';
import { useProjectMemberRole } from '@/hooks/use-members';
import { useProject } from '@/hooks/use-projects';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import { flowService } from '@/services/flow';
import {
  extractFlowParameterCandidates,
  isValidFlowVariableName,
  mergeCaptureDefinitions,
  mergeVariableMappings,
  parseCaptureDefinitions,
  type FlowParameterSelection,
} from '@/utils/flow-parameter-handoff';
import {
  runLocalFlow,
  type LocalFlowEdgeDefinition,
  type LocalFlowStepDefinition,
} from '@/services/local-flow-runner';
import type { CreateHistoryRequest } from '@/types/history';
import type {
  CreateFlowRequest,
  FlowDetail,
  FlowEdge,
  FlowRun,
  FlowRunStatus,
  FlowStep,
  FlowStepResult,
  FlowVariableMappingRule,
  SaveFlowRequest,
} from '@/types/flow';
import { PROJECT_MEMBER_WRITE_ROLES } from '@/types/member';
import { cn, formatDate } from '@/utils';

const WRITE_ROLES = PROJECT_MEMBER_WRITE_ROLES;
const EMPTY_RUNS: FlowRun[] = [];
const FLOW_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
const RUN_ENVIRONMENT_DEFAULT_VALUE = '__flow-run-environment-default__';
const FLOW_HISTORY_ENTITY_TYPE = 'flow';
const HISTORY_SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
]);
type ProjectTranslator = ScopedTranslations<'project'>;

const normalizeOpaqueId = (value: string | number | null | undefined): string | null => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? String(value) : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
};

type FlowNodeData = {
  backendStepId?: string;
  clientKey: string;
  name: string;
  method: string;
  url: string;
  headers: string;
  body: string;
  captures: string;
  asserts: string;
  status: FlowRunStatus | 'idle';
  latestResult?: FlowStepResult | null;
};

type FlowCanvasNode = Node<FlowNodeData, 'http-step'>;
type FlowEdgeData = {
  backendEdgeId?: string;
  mappings: FlowVariableMappingRule[];
};
type FlowCanvasEdge = Edge<FlowEdgeData>;
type FlowNodeValidationErrors = {
  name?: string;
  method?: string;
  url?: string;
};
type FlowValidationState = {
  message: string | null;
  flowName?: string;
  nodeErrors: Record<string, FlowNodeValidationErrors>;
  edgeErrors: Record<string, string>;
};
type FlowValidationMode = 'save' | 'run';
type FlowValidationTarget =
  | { kind: 'flow' }
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string };
type FlowValidationResult = FlowValidationState & {
  isValid: boolean;
  focusTarget?: FlowValidationTarget;
};
type FlowParameterTargetOption = {
  stepId: string;
  name: string;
};
type FlowParameterHandoffPayload = {
  sourceStepId: string;
  targetStepId: string;
  selections: FlowParameterSelection[];
};
type FlowCanvasSnapshot = {
  nodes: FlowCanvasNode[];
  edges: FlowCanvasEdge[];
  flowMeta: { name: string; description: string };
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
};

const FLOW_SHORTCUT_SCOPE_SELECTOR =
  'input, textarea, select, button, [contenteditable="true"], [role="textbox"]';
const FLOW_UNDO_HISTORY_LIMIT = 50;

const getStatusBadgeClassName = (status: FlowRunStatus | 'idle') => {
  switch (status) {
    case 'running':
      return 'border-sky-200 bg-sky-500/10 text-sky-700';
    case 'passed':
      return 'border-emerald-200 bg-emerald-500/10 text-emerald-700';
    case 'failed':
      return 'border-rose-200 bg-rose-500/10 text-rose-700';
    case 'canceled':
      return 'border-amber-200 bg-amber-500/10 text-amber-700';
    case 'pending':
      return 'border-slate-200 bg-slate-500/10 text-slate-700';
    default:
      return 'border-border/60 bg-background text-text-muted';
  }
};

const getStatusLabel = (t: ProjectTranslator, status: FlowRunStatus | 'idle') => {
  switch (status) {
    case 'passed':
      return t('flowPage.statusPassed');
    case 'failed':
      return t('flowPage.statusFailed');
    case 'running':
      return t('flowPage.statusRunning');
    case 'canceled':
      return t('flowPage.statusCanceled');
    case 'pending':
      return t('flowPage.statusPending');
    default:
      return t('flowPage.statusIdle');
  }
};

const buildEdgeLabel = (mappings: FlowVariableMappingRule[], dependencyLabel = 'Dependency') => {
  if (mappings.length === 0) {
    return dependencyLabel;
  }

  const preview = mappings.slice(0, 2).map(mapping => `${mapping.source} -> ${mapping.target}`);
  if (mappings.length > 2) {
    preview.push(`+${mappings.length - 2}`);
  }

  return preview.join(', ');
};

const parseVariableMapping = (raw: string, parsed?: FlowVariableMappingRule[]) => {
  if (parsed?.length) {
    return parsed;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const value = JSON.parse(trimmed) as FlowVariableMappingRule[];
    return Array.isArray(value) ? value.filter(item => item && item.source && item.target) : [];
  } catch {
    return [];
  }
};

const stringifyVariableMapping = (mappings: FlowVariableMappingRule[]) =>
  JSON.stringify(
    mappings
      .map(mapping => ({
        source: mapping.source.trim(),
        target: mapping.target.trim(),
      }))
      .filter(mapping => mapping.source && mapping.target)
  );

const parseJsonString = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

const maskHistoryValue = (value: string) => {
  if (!value) {
    return '';
  }

  if (value.length <= 6) {
    return '****';
  }

  return `${value.slice(0, 3)}****${value.slice(-2)}`;
};

const sanitizeSensitiveHeaderValue = (value: unknown) => {
  if (typeof value === 'string') {
    return maskHistoryValue(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => (typeof item === 'string' ? maskHistoryValue(item) : item));
  }

  return value;
};

const sanitizeHistoryHeaderMap = (headers: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      HISTORY_SENSITIVE_HEADER_NAMES.has(key.trim().toLowerCase())
        ? sanitizeSensitiveHeaderValue(value)
        : value,
    ])
  );

const sanitizeFlowLogPayload = (raw?: string | null) => {
  const parsed = parseJsonString(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed;
  }

  const nextPayload = { ...(parsed as Record<string, unknown>) };
  const rawHeaders = nextPayload.headers;

  if (typeof rawHeaders === 'string') {
    const parsedHeaders = parseJsonString(rawHeaders);
    if (parsedHeaders && typeof parsedHeaders === 'object' && !Array.isArray(parsedHeaders)) {
      nextPayload.headers = sanitizeHistoryHeaderMap(parsedHeaders as Record<string, unknown>);
    }
  } else if (rawHeaders && typeof rawHeaders === 'object' && !Array.isArray(rawHeaders)) {
    nextPayload.headers = sanitizeHistoryHeaderMap(rawHeaders as Record<string, unknown>);
  }

  return nextPayload;
};

const summarizeFlowRun = (stepResults: FlowStepResult[] = []) =>
  stepResults.reduce(
    (summary, result) => {
      summary.total_steps += 1;

      switch (result.status) {
        case 'passed':
          summary.passed_steps += 1;
          break;
        case 'failed':
          summary.failed_steps += 1;
          break;
        case 'running':
          summary.running_steps += 1;
          break;
        case 'canceled':
          summary.canceled_steps += 1;
          break;
        default:
          summary.pending_steps += 1;
          break;
      }

      return summary;
    },
    {
      total_steps: 0,
      passed_steps: 0,
      failed_steps: 0,
      running_steps: 0,
      canceled_steps: 0,
      pending_steps: 0,
    }
  );

const buildFlowRunHistoryPayload = ({
  flow,
  run,
  environment,
  baseUrl,
  messages,
}: {
  flow: FlowDetail;
  run: FlowRun;
  environment: {
    id: number | string;
    name: string;
    displayName?: string;
  } | null;
  baseUrl?: string;
  messages: {
    executed: (flowName: string) => string;
    failed: (flowName: string) => string;
    canceled: (flowName: string) => string;
  };
}): CreateHistoryRequest => {
  const stepResults = run.step_results ?? [];
  const flowName = flow.name.trim() || `Flow #${flow.id}`;
  const action =
    run.status === 'failed' ? 'run_failed' : run.status === 'canceled' ? 'run_canceled' : 'run';

  return {
    entity_type: FLOW_HISTORY_ENTITY_TYPE,
    entity_id: flow.id,
    action,
    message:
      action === 'run_failed'
        ? messages.failed(flowName)
        : action === 'run_canceled'
          ? messages.canceled(flowName)
          : messages.executed(flowName),
    data: {
      flow: {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        step_count: flow.steps.length,
      },
      run: {
        id: run.id,
        flow_id: run.flow_id,
        status: run.status,
        execution_mode: run.execution_mode ?? 'server',
        triggered_by: run.triggered_by,
        started_at: run.started_at ?? null,
        finished_at: run.finished_at ?? null,
        created_at: run.created_at,
        updated_at: run.updated_at,
      },
      environment: environment
        ? {
            id: environment.id,
            name: environment.name,
            display_name: environment.displayName ?? environment.name,
            base_url: baseUrl ?? null,
          }
        : {
            id: null,
            name: null,
            display_name: null,
            base_url: baseUrl ?? null,
          },
      summary: summarizeFlowRun(stepResults),
      step_results: stepResults.map(result => ({
        id: result.id,
        step_id: result.step_id,
        status: result.status,
        duration_ms: result.duration_ms,
        request: sanitizeFlowLogPayload(result.request),
        response: sanitizeFlowLogPayload(result.response),
        assert_results: parseJsonString(result.assert_results),
        variables_captured: parseJsonString(result.variables_captured),
        error_message: result.error_message,
        created_at: result.created_at,
      })),
    },
  };
};

const buildClientKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `step-${crypto.randomUUID()}`;
  }

  return `step-${Date.now()}-${Math.round(Math.random() * 1000)}`;
};

const createEmptyValidationState = (): FlowValidationState => ({
  message: null,
  nodeErrors: {},
  edgeErrors: {},
});

const buildLocalRunId = () => `local-${Date.now()}-${Math.round(Math.random() * 1000)}`;

const cloneFlowCanvasNode = (node: FlowCanvasNode): FlowCanvasNode => ({
  ...node,
  position: {
    x: node.position.x,
    y: node.position.y,
  },
  data: {
    ...node.data,
    latestResult: node.data.latestResult ? { ...node.data.latestResult } : node.data.latestResult,
  },
});

const cloneFlowCanvasEdge = (edge: FlowCanvasEdge): FlowCanvasEdge => ({
  ...edge,
  data: edge.data
    ? {
        ...edge.data,
        mappings: (edge.data.mappings ?? []).map(mapping => ({ ...mapping })),
      }
    : edge.data,
});

const cloneFlowCanvasSnapshot = (snapshot: FlowCanvasSnapshot): FlowCanvasSnapshot => ({
  nodes: snapshot.nodes.map(cloneFlowCanvasNode),
  edges: snapshot.edges.map(cloneFlowCanvasEdge),
  flowMeta: {
    ...snapshot.flowMeta,
  },
  selectedNodeId: snapshot.selectedNodeId,
  selectedEdgeId: snapshot.selectedEdgeId,
});

const isSameFlowCanvasSnapshot = (left: FlowCanvasSnapshot, right: FlowCanvasSnapshot) =>
  JSON.stringify(left) === JSON.stringify(right);

const isEditableShortcutTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest(FLOW_SHORTCUT_SCOPE_SELECTOR));
};

const initializeHistoryStacks = (
  undoStackRef: React.RefObject<FlowCanvasSnapshot[]>,
  redoStackRef: React.RefObject<FlowCanvasSnapshot[]>,
  setHistoryVersion: React.Dispatch<React.SetStateAction<number>>,
  snapshot: FlowCanvasSnapshot
) => {
  undoStackRef.current = [cloneFlowCanvasSnapshot(snapshot)];
  redoStackRef.current = [];
  setHistoryVersion(current => current + 1);
};

const getCanvasNodeLabel = (t: ProjectTranslator, node: FlowCanvasNode, index?: number) => {
  const name = node.data.name.trim();
  if (name) {
    return name;
  }
  if (typeof index === 'number') {
    return t('flowPage.stepLabel', { index: index + 1 });
  }
  return t('flowPage.unnamedStep');
};

const getFlowNodeUrlPreview = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const templateBaseMatch = trimmed.match(/^\{\{[^}]+\}\}(.*)$/);
  if (templateBaseMatch?.[1]) {
    const preview = templateBaseMatch[1].trim();
    return preview || '/';
  }

  try {
    const parsed =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? new URL(trimmed)
        : new URL(trimmed, 'http://kest.local');
    const preview = `${parsed.pathname}${parsed.search}`.trim();
    return preview || '/';
  } catch {
    return trimmed.replace(/^https?:\/\/[^/]+/i, '') || trimmed;
  }
};

const getStepNodeBaseId = (step: FlowStep) => {
  if (typeof step.client_key === 'string') {
    const trimmed = step.client_key.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return `step-${step.id}`;
};

const collectNodeStatus = (
  step: FlowStep,
  run: FlowRun | null | undefined,
  liveStepResults: Record<string, FlowStepResult>
): { status: FlowRunStatus | 'idle'; latestResult?: FlowStepResult | null } => {
  const liveResult = liveStepResults[step.id];
  if (liveResult) {
    return { status: liveResult.status, latestResult: liveResult };
  }

  const runResult = run?.step_results?.find(item => item.step_id === step.id) ?? null;
  if (runResult) {
    return { status: runResult.status, latestResult: runResult };
  }

  return { status: 'idle', latestResult: null };
};

const createCanvasNode = (
  step: FlowStep,
  nodeId: string,
  run: FlowRun | null | undefined,
  liveStepResults: Record<string, FlowStepResult>
): FlowCanvasNode => {
  const status = collectNodeStatus(step, run, liveStepResults);
  return {
    id: nodeId,
    type: 'http-step',
    position: { x: step.position_x, y: step.position_y },
    data: {
      backendStepId: step.id,
      clientKey: nodeId,
      name: step.name,
      method: step.method,
      url: step.url,
      headers: step.headers,
      body: step.body,
      captures: step.captures,
      asserts: step.asserts,
      status: status.status,
      latestResult: status.latestResult,
    },
  };
};

const createCanvasEdge = (
  edge: FlowEdge,
  stepNodeIds: Map<string, string>,
  t: ProjectTranslator
): FlowCanvasEdge | null => {
  const source = stepNodeIds.get(edge.source_step_id);
  const target = stepNodeIds.get(edge.target_step_id);

  if (!source || !target || source === target) {
    return null;
  }

  const mappings = parseVariableMapping(edge.variable_mapping, edge.variable_mapping_rules);

  return {
    id: `edge-${edge.id}`,
    source,
    target,
    markerEnd: { type: MarkerType.ArrowClosed, color: 'currentColor' },
    label: buildEdgeLabel(mappings, t('flowPage.inspector.dependencyLabel')),
    labelStyle: { fontSize: 11, fontWeight: 600 },
    data: {
      backendEdgeId: edge.id,
      mappings,
    },
  };
};

const buildCanvasGraph = (
  steps: FlowStep[],
  edges: FlowEdge[],
  run: FlowRun | null | undefined,
  liveStepResults: Record<string, FlowStepResult>,
  t: ProjectTranslator
) => {
  const usedNodeIds = new Set<string>();
  const stepNodeIds = new Map<string, string>();

  const canvasNodes = steps.map(step => {
    const rawKey = getStepNodeBaseId(step);
    let nodeId = rawKey;

    if (usedNodeIds.has(nodeId)) {
      nodeId = `step-${step.id}`;
    }
    if (usedNodeIds.has(nodeId)) {
      let suffix = 2;
      let candidate = `${nodeId}-${suffix}`;
      while (usedNodeIds.has(candidate)) {
        suffix += 1;
        candidate = `${nodeId}-${suffix}`;
      }
      nodeId = candidate;
    }

    usedNodeIds.add(nodeId);
    stepNodeIds.set(step.id, nodeId);
    return createCanvasNode(step, nodeId, run, liveStepResults);
  });

  const canvasEdges: FlowCanvasEdge[] = [];
  let droppedInvalidEdgeCount = 0;

  for (const edge of edges) {
    const canvasEdge = createCanvasEdge(edge, stepNodeIds, t);
    if (!canvasEdge) {
      droppedInvalidEdgeCount += 1;
      continue;
    }

    canvasEdges.push(canvasEdge);
  }

  return {
    nodes: canvasNodes,
    edges: canvasEdges,
    droppedInvalidEdgeCount,
  };
};

const applyRunStateToCanvasNodes = (
  currentNodes: FlowCanvasNode[],
  run: FlowRun | null | undefined,
  liveStepResults: Record<string, FlowStepResult>
): FlowCanvasNode[] =>
  currentNodes.map((node): FlowCanvasNode => {
    const backendStepId = node.data.backendStepId;
    if (!backendStepId) {
      return {
        ...node,
        data: {
          ...node.data,
          status: 'idle' as const,
          latestResult: null,
        },
      };
    }

    const liveResult = liveStepResults[backendStepId];
    const runResult = run?.step_results?.find(item => item.step_id === backendStepId) ?? null;
    const latestResult = liveResult ?? runResult ?? null;
    const status: FlowRunStatus | 'idle' = latestResult?.status ?? 'idle';

    return {
      ...node,
      data: {
        ...node.data,
        status,
        latestResult,
      },
    };
  });

const mergeSavedGraphIntoCanvas = (
  currentNodes: FlowCanvasNode[],
  currentEdges: FlowCanvasEdge[],
  saved: FlowDetail,
  run: FlowRun | null | undefined,
  liveStepResults: Record<string, FlowStepResult>,
  t: ProjectTranslator
) => {
  const savedStepsByClientKey = new Map<string, FlowStep>();
  for (const step of saved.steps) {
    savedStepsByClientKey.set(getStepNodeBaseId(step), step);
  }

  const savedEdgesByNodePair = new Map<string, FlowEdge>();
  for (const edge of saved.edges) {
    const sourceStep = saved.steps.find(step => step.id === edge.source_step_id);
    const targetStep = saved.steps.find(step => step.id === edge.target_step_id);
    if (!sourceStep || !targetStep) {
      continue;
    }

    savedEdgesByNodePair.set(
      `${getStepNodeBaseId(sourceStep)}->${getStepNodeBaseId(targetStep)}`,
      edge
    );
  }

  const nextNodes = currentNodes.map(node => {
    const savedStep = savedStepsByClientKey.get(node.id);
    if (!savedStep) {
      return node;
    }

    const status = collectNodeStatus(savedStep, run, liveStepResults);
    return {
      ...node,
      position: { x: savedStep.position_x, y: savedStep.position_y },
      data: {
        ...node.data,
        backendStepId: savedStep.id,
        name: savedStep.name,
        method: savedStep.method,
        url: savedStep.url,
        headers: savedStep.headers,
        body: savedStep.body,
        captures: savedStep.captures,
        asserts: savedStep.asserts,
        status: status.status,
        latestResult: status.latestResult,
      },
    };
  });

  const nextEdges = currentEdges.map(edge => {
    const savedEdge = savedEdgesByNodePair.get(`${edge.source}->${edge.target}`);
    if (!savedEdge) {
      return edge;
    }

    const mappings = parseVariableMapping(
      savedEdge.variable_mapping,
      savedEdge.variable_mapping_rules
    );
    return {
      ...edge,
      id: `edge-${savedEdge.id}`,
      label: buildEdgeLabel(mappings, t('flowPage.inspector.dependencyLabel')),
      data: {
        backendEdgeId: savedEdge.id,
        mappings,
      },
    };
  });

  return {
    nodes: nextNodes,
    edges: nextEdges,
  };
};

const serializeFlow = (
  meta: { name: string; description: string },
  nodes: FlowCanvasNode[],
  edges: FlowCanvasEdge[]
): SaveFlowRequest => ({
  name: meta.name.trim(),
  description: meta.description.trim(),
  steps: nodes.map((node, index) => ({
    client_key: node.id,
    name: node.data.name.trim(),
    sort_order: index,
    method: node.data.method.trim(),
    url: node.data.url.trim(),
    headers: node.data.headers,
    body: node.data.body,
    captures: node.data.captures,
    asserts: node.data.asserts,
    position_x: node.position.x,
    position_y: node.position.y,
  })),
  edges: edges.map(edge => ({
    source_client_key: edge.source,
    target_client_key: edge.target,
    variable_mapping: stringifyVariableMapping(edge.data?.mappings ?? []),
  })),
});

const buildLocalFlowExecutionGraph = (
  detail: FlowDetail
): {
  steps: LocalFlowStepDefinition[];
  edges: LocalFlowEdgeDefinition[];
} => ({
  steps: detail.steps.map(step => ({
    id: step.id,
    name: step.name.trim(),
    sort_order: step.sort_order,
    method: step.method.trim(),
    url: step.url.trim(),
    headers: step.headers,
    body: step.body,
    captures: step.captures,
    asserts: step.asserts,
  })),
  edges: detail.edges.map(edge => ({
    source_step_id: edge.source_step_id,
    target_step_id: edge.target_step_id,
    mappings: parseVariableMapping(edge.variable_mapping, edge.variable_mapping_rules),
  })),
});

const validateFlowDraft = (
  t: ProjectTranslator,
  meta: { name: string; description: string },
  nodes: FlowCanvasNode[],
  edges: FlowCanvasEdge[],
  mode: FlowValidationMode
): FlowValidationResult => {
  const nodeErrors: Record<string, FlowNodeValidationErrors> = {};
  const edgeErrors: Record<string, string> = {};
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const seenNodeIds = new Set<string>();
  let flowName: string | undefined;
  let message: string | null = null;
  let focusTarget: FlowValidationTarget | undefined;

  const setFirstIssue = (nextMessage: string, target: FlowValidationTarget) => {
    if (message) {
      return;
    }

    message = nextMessage;
    focusTarget = target;
  };

  if (!meta.name.trim()) {
    flowName = t('flowPage.validation.nameRequired');
    setFirstIssue(
      mode === 'run'
        ? t('flowPage.validation.nameBeforeRun')
        : t('flowPage.validation.nameBeforeSave'),
      { kind: 'flow' }
    );
  }

  if (mode === 'run' && nodes.length === 0) {
    setFirstIssue(t('flowPage.validation.addStepBeforeRun'), { kind: 'flow' });
  }

  for (const [index, node] of nodes.entries()) {
    const label = getCanvasNodeLabel(t, node, index);
    const errors: FlowNodeValidationErrors = {};

    if (!node.id.trim()) {
      errors.name = t('flowPage.validation.stepKeyRequired');
    } else if (seenNodeIds.has(node.id)) {
      errors.name = t('flowPage.validation.duplicateStepKey');
    } else {
      seenNodeIds.add(node.id);
    }

    if (!node.data.name.trim()) {
      errors.name = errors.name ?? t('flowPage.validation.stepNameRequired');
    }
    if (!node.data.method.trim()) {
      errors.method = t('flowPage.validation.httpMethodRequired');
    }
    if (!node.data.url.trim()) {
      errors.url = t('flowPage.validation.requestUrlRequired');
    }

    if (errors.name || errors.method || errors.url) {
      nodeErrors[node.id] = errors;
      setFirstIssue(`${label}: ${errors.url ?? errors.method ?? errors.name}`, {
        kind: 'node',
        id: node.id,
      });
    }

    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    let edgeError = '';

    if (!edge.source || !edge.target) {
      edgeError = t('flowPage.validation.connectionEndpointsMissing');
    } else if (edge.source === edge.target) {
      edgeError = t('flowPage.validation.selfConnection');
    } else if (!nodeById.has(edge.source)) {
      edgeError = t('flowPage.validation.upstreamMissing');
    } else if (!nodeById.has(edge.target)) {
      edgeError = t('flowPage.validation.downstreamMissing');
    } else if (
      (edge.data?.mappings ?? []).some(mapping => !mapping.source.trim() || !mapping.target.trim())
    ) {
      edgeError = t('flowPage.validation.emptyMappings');
    }

    if (edgeError) {
      edgeErrors[edge.id] = edgeError;
      const sourceName =
        edge.source && nodeById.has(edge.source)
          ? getCanvasNodeLabel(t, nodeById.get(edge.source)!)
          : t('flowPage.validation.unknownSource');
      const targetName =
        edge.target && nodeById.has(edge.target)
          ? getCanvasNodeLabel(t, nodeById.get(edge.target)!)
          : t('flowPage.validation.unknownTarget');
      setFirstIssue(`${sourceName} -> ${targetName}: ${edgeError}`, {
        kind: 'edge',
        id: edge.id,
      });
      continue;
    }

    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  if (!message && nodes.length > 0) {
    const queue = Array.from(inDegree.entries())
      .filter(([, degree]) => degree === 0)
      .map(([nodeId]) => nodeId);
    let visited = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      visited += 1;

      for (const next of adjacency.get(current) ?? []) {
        const nextDegree = (inDegree.get(next) ?? 0) - 1;
        inDegree.set(next, nextDegree);
        if (nextDegree === 0) {
          queue.push(next);
        }
      }
    }

    if (visited !== nodes.length) {
      setFirstIssue(t('flowPage.validation.cycle'), { kind: 'flow' });
    }
  }

  return {
    isValid: !message,
    message,
    flowName,
    nodeErrors,
    edgeErrors,
    focusTarget,
  };
};

const buildEdge = (
  source: string,
  target: string,
  mappings: FlowVariableMappingRule[] = [],
  dependencyLabel = 'Dependency'
): FlowCanvasEdge => ({
  id: `edge-${source}-${target}-${Date.now()}`,
  source,
  target,
  label: buildEdgeLabel(mappings, dependencyLabel),
  markerEnd: { type: MarkerType.ArrowClosed, color: 'currentColor' },
  labelStyle: { fontSize: 11, fontWeight: 600 },
  data: { mappings },
});

const createsCycle = (nodes: FlowCanvasNode[], edges: FlowCanvasEdge[], next: Connection) => {
  if (!next.source || !next.target) {
    return false;
  }

  if (next.source === next.target) {
    return true;
  }

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const current = adjacency.get(edge.source) ?? [];
    current.push(edge.target);
    adjacency.set(edge.source, current);
  }
  const sourceTargets = adjacency.get(next.source) ?? [];
  sourceTargets.push(next.target);
  adjacency.set(next.source, sourceTargets);

  const stack = [next.target];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }
    if (current === next.source) {
      return true;
    }
    visited.add(current);
    for (const target of adjacency.get(current) ?? []) {
      stack.push(target);
    }
  }

  return false;
};

const HttpStepNode = ({ data, selected }: NodeProps) => {
  const t = useT('project');
  const flowData = data as FlowNodeData;
  const name = flowData.name.trim() || t('flowPage.unnamedStep');
  const requestPreview = getFlowNodeUrlPreview(flowData.url);

  return (
    <div
      className={cn(
        'w-[240px] rounded-3xl border bg-background/95 p-4 shadow-lg transition-colors',
        selected ? 'border-primary/40 ring-2 ring-primary/20' : 'border-border/60'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-main">{name}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">
            {requestPreview
              ? `${flowData.method} ${requestPreview}`
              : `${flowData.method} ${t('flowPage.configureRequestUrl')}`}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn('shrink-0', getStatusBadgeClassName(flowData.status))}
        >
          {getStatusLabel(t, flowData.status)}
        </Badge>
      </div>
    </div>
  );
};

const nodeTypes = {
  'http-step': HttpStepNode,
};

function CreateFlowDialog({
  open,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateFlowRequest) => Promise<void>;
}) {
  const t = useT('project');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('flowPage.nameRequired'));
      return;
    }

    await onSubmit({
      name: trimmedName,
      description: description.trim() || undefined,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setName('');
      setDescription('');
      setError('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{t('flowPage.createDialogTitle')}</DialogTitle>
          <DialogDescription>{t('flowPage.createDialogDescription')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="create-flow-form" className="space-y-5 py-1" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="create-flow-name">{t('common.name')}</Label>
              <Input
                id="create-flow-name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder={t('flowPage.namePlaceholder')}
                errorText={error || undefined}
                root
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-flow-description">{t('common.description')}</Label>
              <Textarea
                id="create-flow-description"
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder={t('flowPage.descriptionPlaceholder')}
                rows={6}
                root
              />
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-flow-form" loading={isSubmitting}>
            {t('flowPage.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FlowInspector({
  flowName,
  flowDescription,
  flowNameError,
  onFlowMetaChange,
  selectedNode,
  selectedEdge,
  nodeErrors,
  edgeErrors,
  onNodeChange,
  onEdgeMappingsChange,
  canEdit,
  runs,
  selectedRun,
  isRunDetailsLoading,
  stepOptions,
  selectedRunId,
  onSelectRun,
  onSelectRunStep,
  selectedStepResult,
  getParameterTargetOptions,
  onPassParameters,
  historyHref,
}: {
  flowName: string;
  flowDescription: string;
  flowNameError?: string;
  onFlowMetaChange: (key: 'name' | 'description', value: string) => void;
  selectedNode: FlowCanvasNode | null;
  selectedEdge: FlowCanvasEdge | null;
  nodeErrors: Record<string, FlowNodeValidationErrors>;
  edgeErrors: Record<string, string>;
  onNodeChange: (nodeId: string, patch: Partial<FlowNodeData>) => void;
  onEdgeMappingsChange: (edgeId: string, mappings: FlowVariableMappingRule[]) => void;
  canEdit: boolean;
  runs: FlowRun[];
  selectedRun: FlowRun | null;
  isRunDetailsLoading: boolean;
  stepOptions: Array<{ id: string; name: string }>;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onSelectRunStep: (stepId: string) => void;
  selectedStepResult: FlowStepResult | null;
  getParameterTargetOptions: (sourceStepId: string) => FlowParameterTargetOption[];
  onPassParameters: (payload: FlowParameterHandoffPayload) => void;
  historyHref: string;
}) {
  const t = useT('project');
  if (selectedNode) {
    const selectedNodeErrors = nodeErrors[selectedNode.id] ?? {};
    const captureDefinitions = parseCaptureDefinitions(selectedNode.data.captures);
    return (
      <div className="space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>{t('flowPage.inspector.stepTitle')}</CardTitle>
            <CardDescription>{t('flowPage.inspector.stepDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="request" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="request">{t('flowPage.inspector.requestTab')}</TabsTrigger>
                <TabsTrigger value="captures">{t('flowPage.inspector.capturesTab')}</TabsTrigger>
                <TabsTrigger value="asserts">{t('flowPage.inspector.assertsTab')}</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="step-name">{t('common.name')}</Label>
                  <Input
                    id="step-name"
                    value={selectedNode.data.name}
                    disabled={!canEdit}
                    onChange={event => onNodeChange(selectedNode.id, { name: event.target.value })}
                    errorText={selectedNodeErrors.name}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-method">{t('common.method')}</Label>
                  <Select
                    value={selectedNode.data.method}
                    disabled={!canEdit}
                    onValueChange={value => onNodeChange(selectedNode.id, { method: value })}
                  >
                    <SelectTrigger id="step-method" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOW_METHOD_OPTIONS.map(method => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedNodeErrors.method ? (
                    <p className="text-xs font-medium text-destructive">
                      {selectedNodeErrors.method}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-url">{t('flowPage.inspector.urlLabel')}</Label>
                  <Input
                    id="step-url"
                    value={selectedNode.data.url}
                    disabled={!canEdit}
                    onChange={event => onNodeChange(selectedNode.id, { url: event.target.value })}
                    placeholder="/v1/login"
                    errorText={selectedNodeErrors.url}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-headers">{t('flowPage.inspector.headersJsonLabel')}</Label>
                  <Textarea
                    id="step-headers"
                    value={selectedNode.data.headers}
                    disabled={!canEdit}
                    onChange={event =>
                      onNodeChange(selectedNode.id, { headers: event.target.value })
                    }
                    placeholder='{"Authorization":"Bearer {{token}}"}'
                    rows={6}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-body">{t('common.requestBody')}</Label>
                  <Textarea
                    id="step-body"
                    value={selectedNode.data.body}
                    disabled={!canEdit}
                    onChange={event => onNodeChange(selectedNode.id, { body: event.target.value })}
                    placeholder='{"email":"demo@example.com"}'
                    rows={8}
                    root
                  />
                </div>
                <details className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-text-main">
                    {t('flowPage.inspector.advancedTitle')}
                  </summary>
                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="step-client-key">
                        {t('flowPage.inspector.canvasNodeKeyLabel')}
                      </Label>
                      <Input
                        id="step-client-key"
                        value={selectedNode.data.clientKey}
                        readOnly
                        className="font-mono text-xs"
                        root
                      />
                    </div>
                    {selectedNode.data.backendStepId ? (
                      <div className="space-y-2">
                        <Label htmlFor="step-backend-id">
                          {t('flowPage.inspector.savedStepIdLabel')}
                        </Label>
                        <Input
                          id="step-backend-id"
                          value={selectedNode.data.backendStepId}
                          readOnly
                          className="font-mono text-xs"
                          root
                        />
                      </div>
                    ) : null}
                  </div>
                </details>
              </TabsContent>
              <TabsContent value="captures" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-text-main">
                      {t('flowPage.inspector.outputVariablesTitle')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-text-muted">
                      {t('flowPage.inspector.outputVariablesDescription')}
                    </p>
                  </div>
                  {captureDefinitions.length === 0 ? (
                    <Alert>
                      <AlertTitle>{t('flowPage.inspector.noOutputVariablesTitle')}</AlertTitle>
                      <AlertDescription>
                        {t('flowPage.inspector.noOutputVariablesDescription')}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      {captureDefinitions.map(capture => (
                        <div
                          key={`${capture.variableName}-${capture.path}`}
                          className="rounded-2xl border border-border/60 bg-background/70 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <Badge variant="outline">{capture.variableName}</Badge>
                            <code className="truncate text-xs text-text-muted">{capture.path}</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <details className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-text-main">
                    {t('flowPage.inspector.advancedCapturesTitle')}
                  </summary>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="step-captures">
                      {t('flowPage.inspector.capturesDslLabel')}
                    </Label>
                    <Textarea
                      id="step-captures"
                      value={selectedNode.data.captures}
                      disabled={!canEdit}
                      onChange={event =>
                        onNodeChange(selectedNode.id, { captures: event.target.value })
                      }
                      placeholder={'token: data.access_token\nuserId: data.user.id'}
                      rows={12}
                      root
                    />
                  </div>
                </details>
              </TabsContent>
              <TabsContent value="asserts" className="space-y-2">
                <Label htmlFor="step-asserts">{t('flowPage.inspector.assertsTab')} DSL</Label>
                <Textarea
                  id="step-asserts"
                  value={selectedNode.data.asserts}
                  disabled={!canEdit}
                  onChange={event => onNodeChange(selectedNode.id, { asserts: event.target.value })}
                  placeholder={'status == 200\nbody.data.access_token exists'}
                  rows={12}
                  root
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <RunHistoryPanel
          runs={runs}
          selectedRun={selectedRun}
          isRunDetailsLoading={isRunDetailsLoading}
          stepOptions={stepOptions}
          selectedRunId={selectedRunId}
          onSelectRun={onSelectRun}
          onSelectRunStep={onSelectRunStep}
          selectedStepResult={selectedStepResult}
          canEdit={canEdit}
          getParameterTargetOptions={getParameterTargetOptions}
          onPassParameters={onPassParameters}
          historyHref={historyHref}
        />
      </div>
    );
  }

  if (selectedEdge) {
    const mappings = selectedEdge.data?.mappings ?? [];
    const selectedEdgeError = edgeErrors[selectedEdge.id];
    return (
      <div className="space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>{t('flowPage.inspector.edgeMappingsTitle')}</CardTitle>
            <CardDescription>{t('flowPage.inspector.edgeMappingsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedEdgeError ? (
              <Alert variant="destructive">
                <AlertTitle>{t('flowPage.inspector.fixConnectionTitle')}</AlertTitle>
                <AlertDescription>{selectedEdgeError}</AlertDescription>
              </Alert>
            ) : null}
            <Tabs defaultValue="mappings" className="space-y-4">
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="mappings">{t('flowPage.inspector.mappingsTab')}</TabsTrigger>
              </TabsList>
              <TabsContent value="mappings" className="space-y-4">
                {mappings.length === 0 ? (
                  <Alert>
                    <AlertTitle>{t('flowPage.inspector.noMappingsTitle')}</AlertTitle>
                    <AlertDescription>
                      {t('flowPage.inspector.noMappingsDescription')}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-3">
                  {mappings.map((mapping, index) => (
                    <div
                      key={`${selectedEdge.id}-${index}`}
                      className="grid grid-cols-[1fr_auto_1fr_auto] gap-2"
                    >
                      <Input
                        value={mapping.source}
                        disabled={!canEdit}
                        onChange={event => {
                          const nextMappings = mappings.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, source: event.target.value } : item
                          );
                          onEdgeMappingsChange(selectedEdge.id, nextMappings);
                        }}
                        placeholder="token"
                        root
                      />
                      <div className="flex items-center justify-center text-sm text-text-muted">
                        -&gt;
                      </div>
                      <Input
                        value={mapping.target}
                        disabled={!canEdit}
                        onChange={event => {
                          const nextMappings = mappings.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, target: event.target.value } : item
                          );
                          onEdgeMappingsChange(selectedEdge.id, nextMappings);
                        }}
                        placeholder="authToken"
                        root
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canEdit}
                        onClick={() =>
                          onEdgeMappingsChange(
                            selectedEdge.id,
                            mappings.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!canEdit}
                  onClick={() =>
                    onEdgeMappingsChange(selectedEdge.id, [...mappings, { source: '', target: '' }])
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t('flowPage.inspector.addMapping')}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <RunHistoryPanel
          runs={runs}
          selectedRun={selectedRun}
          isRunDetailsLoading={isRunDetailsLoading}
          stepOptions={stepOptions}
          selectedRunId={selectedRunId}
          onSelectRun={onSelectRun}
          onSelectRunStep={onSelectRunStep}
          selectedStepResult={null}
          canEdit={canEdit}
          getParameterTargetOptions={getParameterTargetOptions}
          onPassParameters={onPassParameters}
          historyHref={historyHref}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>{t('flowPage.inspector.flowSettingsTitle')}</CardTitle>
          <CardDescription>{t('flowPage.inspector.flowSettingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="flow-name">{t('common.name')}</Label>
            <Input
              id="flow-name"
              value={flowName}
              disabled={!canEdit}
              onChange={event => onFlowMetaChange('name', event.target.value)}
              errorText={flowNameError}
              root
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flow-description">{t('common.description')}</Label>
            <Textarea
              id="flow-description"
              value={flowDescription}
              disabled={!canEdit}
              onChange={event => onFlowMetaChange('description', event.target.value)}
              rows={8}
              root
            />
          </div>
        </CardContent>
      </Card>

      <RunHistoryPanel
        runs={runs}
        selectedRun={selectedRun}
        isRunDetailsLoading={isRunDetailsLoading}
        stepOptions={stepOptions}
        selectedRunId={selectedRunId}
        onSelectRun={onSelectRun}
        onSelectRunStep={onSelectRunStep}
        selectedStepResult={null}
        canEdit={canEdit}
        getParameterTargetOptions={getParameterTargetOptions}
        onPassParameters={onPassParameters}
        historyHref={historyHref}
      />
    </div>
  );
}

function RunHistoryPanel({
  runs,
  selectedRun,
  isRunDetailsLoading,
  stepOptions,
  selectedRunId,
  onSelectRun,
  onSelectRunStep,
  selectedStepResult,
  canEdit,
  getParameterTargetOptions,
  onPassParameters,
  historyHref,
}: {
  runs: FlowRun[];
  selectedRun: FlowRun | null;
  isRunDetailsLoading: boolean;
  stepOptions: Array<{ id: string; name: string }>;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onSelectRunStep: (stepId: string) => void;
  selectedStepResult: FlowStepResult | null;
  canEdit: boolean;
  getParameterTargetOptions: (sourceStepId: string) => FlowParameterTargetOption[];
  onPassParameters: (payload: FlowParameterHandoffPayload) => void;
  historyHref: string;
}) {
  const t = useT('project');
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [handoffStepResult, setHandoffStepResult] = useState<FlowStepResult | null>(null);

  const stepNameById = useMemo(
    () => new Map(stepOptions.map(step => [step.id, step.name])),
    [stepOptions]
  );

  const defaultStepId = useMemo(() => {
    const stepResults = selectedRun?.step_results ?? [];
    return (
      stepResults.find(result => result.status === 'failed')?.step_id ??
      stepResults.find(result => result.status === 'running')?.step_id ??
      stepResults[0]?.step_id ??
      null
    );
  }, [selectedRun?.step_results]);

  const activeRunStepResult =
    selectedStepResult ??
    selectedRun?.step_results?.find(result => result.step_id === (activeStepId ?? defaultStepId)) ??
    selectedRun?.step_results?.[0] ??
    null;
  const activeParameterCandidates = useMemo(
    () => extractFlowParameterCandidates(activeRunStepResult?.response),
    [activeRunStepResult?.response]
  );
  const activeTargetOptions = useMemo(
    () => (activeRunStepResult ? getParameterTargetOptions(activeRunStepResult.step_id) : []),
    [activeRunStepResult, getParameterTargetOptions]
  );

  const completedCount =
    selectedRun?.step_results?.filter(result => result.status === 'passed').length ?? 0;

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>{t('flowPage.historyPanelTitle')}</CardTitle>
              <CardDescription>{t('flowPage.historyPanelDescription')}</CardDescription>
            </div>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href={historyHref}>{t('flowPage.openHistory')}</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <Alert>
              <AlertTitle>{t('flowPage.runHistory.emptyTitle')}</AlertTitle>
              <AlertDescription>{t('flowPage.runHistory.emptyDescription')}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {runs.map(run => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => onSelectRun(run.id)}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                    selectedRunId === run.id
                      ? 'border-primary/30 bg-primary/10'
                      : 'border-border/60 bg-background/60 hover:bg-background'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text-main">
                        {run.execution_mode === 'local'
                          ? t('flowPage.runHistory.localRunLabel', { id: run.id })
                          : t('flowPage.runHistory.runLabel', { id: run.id })}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">{formatDate(run.created_at)}</p>
                    </div>
                    <Badge variant="outline" className={getStatusBadgeClassName(run.status)}>
                      {getStatusLabel(t, run.status)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRun ? (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>{t('flowPage.runHistory.runLogTitle')}</CardTitle>
            <CardDescription>
              {selectedRun.execution_mode === 'local'
                ? t('flowPage.runHistory.runLogDescriptionLocal', { id: selectedRun.id })
                : t('flowPage.runHistory.runLogDescriptionServer', { id: selectedRun.id })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <ResultField label={t('flowPage.runHistory.statusLabel')}>
                <Badge variant="outline" className={getStatusBadgeClassName(selectedRun.status)}>
                  {getStatusLabel(t, selectedRun.status)}
                </Badge>
              </ResultField>
              <ResultField label={t('flowPage.runHistory.startedLabel')}>
                {selectedRun.started_at
                  ? formatDate(selectedRun.started_at)
                  : t('flowPage.runHistory.notStarted')}
              </ResultField>
              <ResultField label={t('flowPage.runHistory.completedStepsLabel')}>
                {completedCount} / {selectedRun.step_results?.length ?? 0}
              </ResultField>
            </div>

            {isRunDetailsLoading && !selectedRun.step_results?.length ? (
              <Alert>
                <AlertTitle>{t('flowPage.runHistory.loadingDetailsTitle')}</AlertTitle>
                <AlertDescription>
                  {t('flowPage.runHistory.loadingDetailsDescription')}
                </AlertDescription>
              </Alert>
            ) : null}

            {!isRunDetailsLoading && !selectedRun.step_results?.length ? (
              <Alert>
                <AlertTitle>{t('flowPage.runHistory.noStepLogsTitle')}</AlertTitle>
                <AlertDescription>
                  {t('flowPage.runHistory.noStepLogsDescription')}
                </AlertDescription>
              </Alert>
            ) : null}

            {selectedRun.step_results?.length ? (
              <div className="space-y-3">
                {selectedRun.step_results.map(result => {
                  const isActive = activeRunStepResult?.step_id === result.step_id;
                  const stepName =
                    stepNameById.get(result.step_id) ??
                    t('flowPage.stepNumberLabel', { id: result.step_id });

                  return (
                    <button
                      key={`${selectedRun.id}-${result.step_id}`}
                      type="button"
                      onClick={() => {
                        setActiveStepId(result.step_id);
                        onSelectRunStep(result.step_id);
                      }}
                      className={cn(
                        'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                        isActive
                          ? 'border-primary/30 bg-primary/10'
                          : 'border-border/60 bg-background/60 hover:bg-background'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-main">{stepName}</p>
                          <p className="mt-1 truncate text-xs text-text-muted">
                            {t('flowPage.runHistory.stepIdLabel', { id: result.step_id })}
                            {result.error_message ? ` · ${result.error_message}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-text-muted">{result.duration_ms} ms</span>
                          <Badge
                            variant="outline"
                            className={getStatusBadgeClassName(result.status)}
                          >
                            {getStatusLabel(t, result.status)}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {activeRunStepResult ? (
              <>
                <Separator className="my-2" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-main">
                        {stepNameById.get(activeRunStepResult.step_id) ??
                          t('flowPage.stepNumberLabel', { id: activeRunStepResult.step_id })}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {t('flowPage.runHistory.detailDescription')}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={getStatusBadgeClassName(activeRunStepResult.status)}
                    >
                      {getStatusLabel(t, activeRunStepResult.status)}
                    </Badge>
                  </div>

                  <ResultField label={t('flowPage.runHistory.durationLabel')}>
                    {activeRunStepResult.duration_ms} ms
                  </ResultField>
                  <ResultJsonCard
                    title={t('flowPage.runHistory.requestTitle')}
                    value={parseJsonString(activeRunStepResult.request)}
                  />
                  <ResultJsonCard
                    title={t('flowPage.runHistory.responseTitle')}
                    value={parseJsonString(activeRunStepResult.response)}
                    action={
                      activeParameterCandidates.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canEdit || activeTargetOptions.length === 0}
                          title={
                            activeTargetOptions.length === 0
                              ? t('flowPage.runHistory.passParametersDisabled')
                              : t('flowPage.runHistory.passParametersEnabled')
                          }
                          onClick={() => setHandoffStepResult(activeRunStepResult)}
                        >
                          <Share2 className="h-4 w-4" />
                          {t('flowPage.runHistory.passParameters')}
                        </Button>
                      ) : null
                    }
                  />
                  <ResultJsonCard
                    title={t('flowPage.runHistory.assertResults')}
                    value={parseJsonString(activeRunStepResult.assert_results)}
                  />
                  <ResultJsonCard
                    title={t('flowPage.runHistory.capturedVariables')}
                    value={parseJsonString(activeRunStepResult.variables_captured)}
                  />
                  {activeRunStepResult.error_message ? (
                    <Alert>
                      <AlertTitle>{t('flowPage.runHistory.failureDetail')}</AlertTitle>
                      <AlertDescription>{activeRunStepResult.error_message}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <FlowParameterHandoffDialog
        key={handoffStepResult ? `${handoffStepResult.id}-${handoffStepResult.step_id}` : 'closed'}
        open={handoffStepResult !== null}
        sourceStepName={
          handoffStepResult
            ? (stepNameById.get(handoffStepResult.step_id) ??
              t('flowPage.stepNumberLabel', { id: handoffStepResult.step_id }))
            : ''
        }
        candidates={extractFlowParameterCandidates(handoffStepResult?.response)}
        targetOptions={
          handoffStepResult ? getParameterTargetOptions(handoffStepResult.step_id) : []
        }
        onOpenChange={open => {
          if (!open) {
            setHandoffStepResult(null);
          }
        }}
        onSubmit={(targetStepId, selections) => {
          if (!handoffStepResult) {
            return;
          }
          onPassParameters({
            sourceStepId: handoffStepResult.step_id,
            targetStepId,
            selections,
          });
          setHandoffStepResult(null);
        }}
      />
    </div>
  );
}

function FlowParameterHandoffDialog({
  open,
  sourceStepName,
  candidates,
  targetOptions,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  sourceStepName: string;
  candidates: ReturnType<typeof extractFlowParameterCandidates>;
  targetOptions: FlowParameterTargetOption[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (targetStepId: string, selections: FlowParameterSelection[]) => void;
}) {
  const t = useT('project');
  const [targetStepId, setTargetStepId] = useState(
    targetOptions[0]?.stepId ? String(targetOptions[0].stepId) : ''
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [variableNames, setVariableNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidates.map(candidate => [candidate.id, candidate.defaultVariableName]))
  );

  const selectedCandidates = candidates.filter(candidate => selectedIds.has(candidate.id));
  const selectedVariables = selectedCandidates.map(candidate => ({
    capturePath: candidate.capturePath,
    variableName: variableNames[candidate.id]?.trim() ?? '',
  }));
  const hasInvalidVariable = selectedVariables.some(
    selection => !isValidFlowVariableName(selection.variableName)
  );
  const canSubmit = Boolean(targetStepId) && selectedVariables.length > 0 && !hasInvalidVariable;

  const toggleCandidate = (candidateId: string, checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (checked) {
        next.add(candidateId);
      } else {
        next.delete(candidateId);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t('flowPage.handoffDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('flowPage.handoffDialog.description', {
              source: sourceStepName || t('flowPage.handoffDialog.currentStep'),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="handoff-target-step">
                {t('flowPage.handoffDialog.targetStepLabel')}
              </Label>
              <Select value={targetStepId} onValueChange={setTargetStepId}>
                <SelectTrigger id="handoff-target-step" className="w-full">
                  <SelectValue placeholder={t('flowPage.handoffDialog.targetStepPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map(option => (
                    <SelectItem key={option.stepId} value={String(option.stepId)}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ResultField label={t('flowPage.handoffDialog.selectedLabel')}>
              {t('flowPage.handoffDialog.selectedCount', {
                count: selectedCandidates.length,
              })}
            </ResultField>
          </div>

          {targetOptions.length === 0 ? (
            <Alert>
              <AlertTitle>{t('flowPage.handoffDialog.noAvailableTargetTitle')}</AlertTitle>
              <AlertDescription>
                {t('flowPage.handoffDialog.noAvailableTargetDescription')}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>{t('flowPage.handoffDialog.responsePath')}</TableHead>
                  <TableHead className="w-24">{t('flowPage.handoffDialog.type')}</TableHead>
                  <TableHead className="min-w-[180px]">
                    {t('flowPage.handoffDialog.variable')}
                  </TableHead>
                  <TableHead>{t('flowPage.handoffDialog.preview')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map(candidate => {
                  const variableName = variableNames[candidate.id] ?? candidate.defaultVariableName;
                  const isSelected = selectedIds.has(candidate.id);
                  const isInvalid = isSelected && !isValidFlowVariableName(variableName);

                  return (
                    <TableRow key={candidate.id} data-state={isSelected ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={checked =>
                            toggleCandidate(candidate.id, checked === true)
                          }
                          aria-label={t('flowPage.handoffDialog.selectCandidate', {
                            path: candidate.displayPath,
                          })}
                        />
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <code className="block truncate rounded bg-muted px-2 py-1 text-xs">
                          {candidate.displayPath}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{candidate.valueType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={variableName}
                          disabled={!isSelected}
                          onChange={event =>
                            setVariableNames(current => ({
                              ...current,
                              [candidate.id]: event.target.value,
                            }))
                          }
                          errorText={
                            isInvalid ? t('flowPage.handoffDialog.invalidVariable') : undefined
                          }
                          root
                        />
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-text-muted">
                        {candidate.preview || t('flowPage.handoffDialog.noPreview')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(targetStepId, selectedVariables)}
          >
            <Share2 className="h-4 w-4" />
            {t('flowPage.handoffDialog.applyAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <div className="mt-2 text-sm text-text-main">{children}</div>
    </div>
  );
}

function ResultJsonCard({
  title,
  value,
  action,
}: {
  title: string;
  value: unknown;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[280px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

export function ProjectFlowManagementPage({
  projectId,
  selectedItemId,
}: {
  projectId: number | string;
  selectedItemId?: string | number | null;
}) {
  const t = useT('project');
  const router = useRouter();
  const isMobile = useIsMobile();
  const projectQuery = useProject(projectId);
  const projectName = projectQuery.data?.name || t('flowPage.projectFallback', { id: projectId });
  const memberRoleQuery = useProjectMemberRole(projectId);
  const flowListQuery = useFlows(projectId);
  const environmentsQuery = useEnvironments(projectId);
  const createFlowMutation = useCreateFlow(projectId);
  const deleteFlowMutation = useDeleteFlow(projectId);
  const saveFlowMutation = useSaveFlow(projectId);
  const runFlowMutation = useRunFlow(projectId);
  const createHistoryMutation = useCreateProjectHistory(projectId);

  const [searchValue, setSearchValue] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() =>
    normalizeOpaqueId(selectedItemId)
  );
  const [selectedRunEnvironmentId, setSelectedRunEnvironmentId] = useState<number | string | null>(
    null
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [localRuns, setLocalRuns] = useState<FlowRun[]>([]);
  const [flowMeta, setFlowMeta] = useState({ name: '', description: '' });
  const [dirty, setDirty] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [isDesktopInspectorCollapsed, setIsDesktopInspectorCollapsed] = useState(false);
  const [liveStepResults, setLiveStepResults] = useState<Record<string, FlowStepResult>>({});
  const [validationState, setValidationState] = useState<FlowValidationState>(() =>
    createEmptyValidationState()
  );
  const [isLocalRunPending, setIsLocalRunPending] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isCanvasToolsOpen, setIsCanvasToolsOpen] = useState(false);
  const [, setHistoryVersion] = useState(0);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<
    FlowCanvasNode,
    FlowCanvasEdge
  > | null>(null);
  const deferredSearch = useDeferredValue(searchValue);
  const streamAbortRef = useRef<AbortController | null>(null);
  const skipNextHydrationRef = useRef(false);
  const previousFlowIdRef = useRef<string | null>(normalizeOpaqueId(selectedItemId));
  const persistedRunHistoryKeysRef = useRef<Set<string>>(new Set());
  const persistingRunHistoryKeysRef = useRef<Set<string>>(new Set());
  const undoStackRef = useRef<FlowCanvasSnapshot[]>([]);
  const redoStackRef = useRef<FlowCanvasSnapshot[]>([]);

  const [nodes, setNodes] = useState<FlowCanvasNode[]>([]);
  const [edges, setEdges] = useState<FlowCanvasEdge[]>([]);

  useEffect(() => {
    setSelectedFlowId(normalizeOpaqueId(selectedItemId));
  }, [selectedItemId]);

  const selectedFlowQuery = useFlow(projectId, selectedFlowId ?? undefined);
  const flowRunsQuery = useFlowRuns(projectId, selectedFlowId ?? undefined);

  const backendRuns = flowRunsQuery.data?.items ?? EMPTY_RUNS;
  const runs = useMemo(() => [...localRuns, ...backendRuns], [backendRuns, localRuns]);
  const latestRun = runs[0] ?? null;
  const effectiveRunId = selectedRunId ?? latestRun?.id ?? null;
  const selectedLocalRun = effectiveRunId
    ? (localRuns.find(run => run.id === effectiveRunId) ?? null)
    : null;
  const selectedRunQuery = useFlowRun(
    projectId,
    selectedFlowId ?? undefined,
    selectedLocalRun ? undefined : (effectiveRunId ?? undefined)
  );
  const selectedRun = selectedLocalRun ?? selectedRunQuery.data ?? latestRun;

  const canEdit = WRITE_ROLES.includes(memberRoleQuery.data?.role ?? 'read');
  const flows = flowListQuery.data?.items;
  const runEnvironments = useMemo(
    () =>
      (environmentsQuery.data?.items ?? []).filter(
        environment =>
          typeof environment.base_url === 'string' && environment.base_url.trim().length > 0
      ),
    [environmentsQuery.data?.items]
  );
  const selectedRunEnvironment = useMemo(
    () =>
      selectedRunEnvironmentId === null
        ? null
        : (runEnvironments.find(environment => environment.id === selectedRunEnvironmentId) ??
          null),
    [runEnvironments, selectedRunEnvironmentId]
  );
  const selectedRunBaseUrl = selectedRunEnvironment?.base_url?.trim() || undefined;
  const flowHistoryHref = `${buildProjectHistoriesRoute(projectId)}?entityType=${FLOW_HISTORY_ENTITY_TYPE}`;
  const showFlowSidebar = isMobile || !isSidebarCollapsed;
  const filteredFlows = useMemo(() => {
    const allFlows = flows ?? [];
    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) {
      return allFlows;
    }

    return allFlows.filter(flow =>
      [flow.name, flow.description]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(keyword))
    );
  }, [deferredSearch, flows]);

  useEffect(() => {
    if (runEnvironments.length === 0) {
      setSelectedRunEnvironmentId(null);
      return;
    }
    if (
      selectedRunEnvironmentId !== null &&
      runEnvironments.some(environment => environment.id === selectedRunEnvironmentId)
    ) {
      return;
    }
    setSelectedRunEnvironmentId(runEnvironments[0].id);
  }, [runEnvironments, selectedRunEnvironmentId]);

  // This hydration path should only react to backend flow revisions, not local run state changes.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const detail = selectedFlowQuery.data;
    if (!detail) {
      return;
    }
    if (skipNextHydrationRef.current) {
      skipNextHydrationRef.current = false;
      return;
    }

    const canvasGraph = buildCanvasGraph(
      detail.steps,
      detail.edges,
      selectedRun,
      liveStepResults,
      t
    );
    setFlowMeta({
      name: detail.name,
      description: detail.description,
    });
    setNodes(canvasGraph.nodes);
    setEdges(canvasGraph.edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setDirty(canvasGraph.droppedInvalidEdgeCount > 0);
    setLiveStepResults({});
    setValidationState(createEmptyValidationState());
    initializeHistoryStacks(undoStackRef, redoStackRef, setHistoryVersion, {
      nodes: canvasGraph.nodes,
      edges: canvasGraph.edges,
      flowMeta: {
        name: detail.name,
        description: detail.description,
      },
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  }, [selectedFlowQuery.data?.updated_at]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!selectedFlowQuery.data) {
      return;
    }

    setNodes(current => applyRunStateToCanvasNodes(current, selectedRun, liveStepResults));
  }, [liveStepResults, selectedFlowQuery.data, selectedRun]);

  useEffect(() => {
    if (previousFlowIdRef.current === selectedFlowId) {
      return;
    }

    previousFlowIdRef.current = selectedFlowId;
    setSelectedRunId(null);
    setLocalRuns([]);
    setLiveStepResults({});
    setValidationState(createEmptyValidationState());
  }, [selectedFlowId]);

  useEffect(() => {
    if (!selectedFlowId) {
      setSelectedRunId(null);
      setLocalRuns([]);
      setLiveStepResults({});
      setValidationState(createEmptyValidationState());
      initializeHistoryStacks(undoStackRef, redoStackRef, setHistoryVersion, {
        nodes: [],
        edges: [],
        flowMeta: { name: '', description: '' },
        selectedNodeId: null,
        selectedEdgeId: null,
      });
    }
  }, [selectedFlowId]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const handleCanvasKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!selectedFlowId) {
      return;
    }

    const metaOrCtrl = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const editableTarget = isEditableShortcutTarget(event.target);

    if (key === '?' && !metaOrCtrl && !event.altKey) {
      if (editableTarget) {
        return;
      }

      event.preventDefault();
      setIsShortcutHelpOpen(true);
      return;
    }

    if (editableTarget) {
      return;
    }

    if (metaOrCtrl && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
      return;
    }

    if ((metaOrCtrl && key === 'z' && event.shiftKey) || (metaOrCtrl && key === 'y')) {
      event.preventDefault();
      handleRedo();
      return;
    }

    if (metaOrCtrl && key === 'd') {
      event.preventDefault();
      handleDuplicateSelection();
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && !metaOrCtrl) {
      event.preventDefault();
      handleDeleteSelection();
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleCanvasKeyDown);
    return () => window.removeEventListener('keydown', handleCanvasKeyDown);
  }, []);

  const selectedNode = nodes.find(node => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find(edge => edge.id === selectedEdgeId) ?? null;
  const selectedNodes = useMemo(() => nodes.filter(node => node.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter(edge => edge.selected), [edges]);
  const canDeleteSelection = selectedNodes.length > 0 || selectedEdges.length > 0;
  const canDuplicateSelection = selectedNodes.length > 0;
  const canUndo = undoStackRef.current.length > 1;
  const canRedo = redoStackRef.current.length > 0;
  const stepOptions = nodes.flatMap(node =>
    node.data.backendStepId
      ? [
          {
            id: node.data.backendStepId,
            name: node.data.name || t('flowPage.stepNumberLabel', { id: node.data.backendStepId }),
          },
        ]
      : []
  );
  const selectedStepResult = selectedNode?.data.backendStepId
    ? (liveStepResults[selectedNode.data.backendStepId] ??
      selectedRun?.step_results?.find(item => item.step_id === selectedNode.data.backendStepId) ??
      null)
    : null;

  const clearValidationState = () => {
    setValidationState(createEmptyValidationState());
  };

  const buildCurrentSnapshot = (): FlowCanvasSnapshot => ({
    nodes: nodes.map(cloneFlowCanvasNode),
    edges: edges.map(cloneFlowCanvasEdge),
    flowMeta: {
      ...flowMeta,
    },
    selectedNodeId,
    selectedEdgeId,
  });

  const applySnapshot = (snapshot: FlowCanvasSnapshot) => {
    setNodes(snapshot.nodes.map(cloneFlowCanvasNode));
    setEdges(snapshot.edges.map(cloneFlowCanvasEdge));
    setFlowMeta({
      ...snapshot.flowMeta,
    });
    setSelectedNodeId(snapshot.selectedNodeId);
    setSelectedEdgeId(snapshot.selectedEdgeId);
    setDirty(true);
    clearValidationState();
  };

  const pushHistorySnapshot = (snapshot?: FlowCanvasSnapshot) => {
    const nextSnapshot = cloneFlowCanvasSnapshot(snapshot ?? buildCurrentSnapshot());
    const previousSnapshot = undoStackRef.current.at(-1);

    if (previousSnapshot && isSameFlowCanvasSnapshot(previousSnapshot, nextSnapshot)) {
      return;
    }

    undoStackRef.current = [...undoStackRef.current, nextSnapshot].slice(-FLOW_UNDO_HISTORY_LIMIT);
    redoStackRef.current = [];
    setHistoryVersion(current => current + 1);
  };

  const resetHistoryStacks = (snapshot?: FlowCanvasSnapshot) => {
    const nextSnapshot = cloneFlowCanvasSnapshot(snapshot ?? buildCurrentSnapshot());
    initializeHistoryStacks(undoStackRef, redoStackRef, setHistoryVersion, nextSnapshot);
  };

  const openInspectorPanel = () => {
    setInspectorOpen(true);
    setIsDesktopInspectorCollapsed(false);
  };

  const focusValidationTarget = (target?: FlowValidationTarget) => {
    if (!target) {
      return;
    }

    openInspectorPanel();
    if (target.kind === 'node') {
      setSelectedNodeId(target.id);
      setSelectedEdgeId(null);
      return;
    }
    if (target.kind === 'edge') {
      setSelectedEdgeId(target.id);
      setSelectedNodeId(null);
      return;
    }
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const applyValidationResult = (result: FlowValidationResult) => {
    setValidationState({
      message: result.message,
      flowName: result.flowName,
      nodeErrors: result.nodeErrors,
      edgeErrors: result.edgeErrors,
    });
    focusValidationTarget(result.focusTarget);
  };

  const navigateToFlow = (flowId: string | null) => {
    setSelectedFlowId(flowId);
    setSelectedRunId(null);
    setLocalRuns([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setLiveStepResults({});
    setValidationState(createEmptyValidationState());
    const baseHref = buildProjectFlowsRoute(projectId);
    router.replace(flowId ? `${baseHref}?item=${flowId}` : baseHref);
  };

  const handleCreateFlow = async (payload: CreateFlowRequest) => {
    try {
      const createdFlow = await createFlowMutation.mutateAsync(payload);
      setIsCreateOpen(false);
      navigateToFlow(createdFlow.id);
    } catch {
      // Global error handler surfaces API failure details.
    }
  };

  const handleDeleteFlow = async (flowId: string, flowName: string) => {
    if (!window.confirm(t('toasts.flowDeleteConfirm', { name: flowName }))) {
      return;
    }

    try {
      await deleteFlowMutation.mutateAsync(flowId);
      if (selectedFlowId === flowId) {
        navigateToFlow(null);
      } else {
        void flowListQuery.refetch();
      }
    } catch {
      // Global error handler surfaces API failure details.
    }
  };

  const handleNodesChange = (changes: NodeChange<FlowCanvasNode>[]) => {
    if (changes.some(change => change.type !== 'select')) {
      setDirty(true);
      clearValidationState();
    }
    setNodes(current => applyNodeChanges(changes, current));
  };

  const handleEdgesChange = (changes: EdgeChange<FlowCanvasEdge>[]) => {
    if (changes.some(change => change.type !== 'select')) {
      setDirty(true);
      clearValidationState();
    }
    setEdges(current => applyEdgeChanges(changes, current));
  };

  const handleNodesDelete = (deletedNodes: FlowCanvasNode[]) => {
    setEdges(current =>
      current.filter(
        edge => !deletedNodes.some(node => node.id === edge.source || node.id === edge.target)
      )
    );
    setDirty(true);
    clearValidationState();
  };

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) {
      return;
    }

    if (connection.source === connection.target) {
      return;
    }
    if (createsCycle(nodes, edges, connection)) {
      return;
    }

    pushHistorySnapshot();

    setEdges(
      current =>
        addEdge(
          buildEdge(
            connection.source!,
            connection.target!,
            [],
            t('flowPage.inspector.dependencyLabel')
          ),
          current
        ) as FlowCanvasEdge[]
    );
    setDirty(true);
    clearValidationState();
  };

  const handleNodeDragStart = () => {
    pushHistorySnapshot();
  };

  const handleNodeChange = (nodeId: string, patch: Partial<FlowNodeData>) => {
    setNodes(current =>
      current.map(node =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...patch,
              },
            }
          : node
      )
    );
    setDirty(true);
    clearValidationState();
  };

  const handleEdgeMappingsChange = (edgeId: string, mappings: FlowVariableMappingRule[]) => {
    setEdges(current =>
      current.map(edge =>
        edge.id === edgeId
          ? {
              ...edge,
              label: buildEdgeLabel(mappings, t('flowPage.inspector.dependencyLabel')),
              data: {
                ...edge.data,
                mappings,
              },
            }
          : edge
      )
    );
    setDirty(true);
    clearValidationState();
  };

  const getParameterTargetOptions = (sourceStepId: string): FlowParameterTargetOption[] => {
    const sourceNode = nodes.find(node => node.data.backendStepId === sourceStepId);
    if (!sourceNode) {
      return [];
    }

    return nodes
      .filter(node => node.data.backendStepId && node.data.backendStepId !== sourceStepId)
      .filter(
        node =>
          !createsCycle(nodes, edges, {
            source: sourceNode.id,
            target: node.id,
            sourceHandle: null,
            targetHandle: null,
          })
      )
      .map(node => {
        const backendStepId = node.data.backendStepId!;
        return {
          stepId: backendStepId,
          name: node.data.name || t('flowPage.stepNumberLabel', { id: backendStepId }),
        };
      });
  };

  const handlePassParameters = ({
    sourceStepId,
    targetStepId,
    selections,
  }: FlowParameterHandoffPayload) => {
    const cleanSelections = selections.filter(
      selection =>
        selection.capturePath.trim() && isValidFlowVariableName(selection.variableName.trim())
    );
    if (cleanSelections.length === 0) {
      return;
    }

    const sourceNode = nodes.find(node => node.data.backendStepId === sourceStepId);
    const targetNode = nodes.find(node => node.data.backendStepId === targetStepId);
    if (!sourceNode || !targetNode) {
      setValidationState(current => ({
        ...current,
        message: t('flowPage.validation.passParametersMissing'),
      }));
      return;
    }

    if (
      !edges.some(edge => edge.source === sourceNode.id && edge.target === targetNode.id) &&
      createsCycle(nodes, edges, {
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle: null,
        targetHandle: null,
      })
    ) {
      setValidationState(current => ({
        ...current,
        message: t('flowPage.validation.passParametersCycle'),
      }));
      return;
    }

    setNodes(current =>
      current.map(node =>
        node.id === sourceNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                captures: mergeCaptureDefinitions(node.data.captures, cleanSelections),
              },
            }
          : node
      )
    );

    setEdges(current => {
      const existingEdge = current.find(
        edge => edge.source === sourceNode.id && edge.target === targetNode.id
      );
      const nextMappings = mergeVariableMappings(
        existingEdge?.data?.mappings ?? [],
        cleanSelections
      );

      if (existingEdge) {
        return current.map(edge =>
          edge.id === existingEdge.id
            ? {
                ...edge,
                label: buildEdgeLabel(nextMappings, t('flowPage.inspector.dependencyLabel')),
                data: {
                  ...edge.data,
                  mappings: nextMappings,
                },
              }
            : edge
        );
      }

      return [
        ...current,
        buildEdge(
          sourceNode.id,
          targetNode.id,
          nextMappings,
          t('flowPage.inspector.dependencyLabel')
        ),
      ];
    });

    setDirty(true);
    clearValidationState();
  };

  const handleFlowMetaChange = (key: 'name' | 'description', value: string) => {
    setFlowMeta(current => ({
      ...current,
      [key]: value,
    }));
    setDirty(true);
    clearValidationState();
  };

  const handleSelectRunStep = (stepId: string) => {
    const node = nodes.find(item => item.data.backendStepId === stepId);
    if (!node) {
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    openInspectorPanel();
  };

  const handleDeleteSelection = () => {
    if (!canDeleteSelection) {
      return;
    }

    pushHistorySnapshot();

    const deletedNodeIds = new Set(selectedNodes.map(node => node.id));
    setNodes(current => current.filter(node => !node.selected));
    setEdges(current =>
      current.filter(
        edge =>
          !edge.selected && !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target)
      )
    );
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setDirty(true);
    clearValidationState();
  };

  const handleDuplicateSelection = () => {
    if (!canDuplicateSelection) {
      return;
    }

    pushHistorySnapshot();

    const duplicationOffset = {
      x: 64,
      y: 48,
    };
    const duplicateNodeIdMap = new Map<string, string>();
    const duplicatedNodes = selectedNodes.map(node => {
      const nextId = buildClientKey();
      duplicateNodeIdMap.set(node.id, nextId);

      return {
        ...cloneFlowCanvasNode(node),
        id: nextId,
        selected: true,
        position: {
          x: node.position.x + duplicationOffset.x,
          y: node.position.y + duplicationOffset.y,
        },
        data: {
          ...node.data,
          backendStepId: undefined,
          clientKey: nextId,
          status: 'idle',
          latestResult: null,
        },
      } satisfies FlowCanvasNode;
    });

    const duplicatedEdges = edges
      .filter(edge => duplicateNodeIdMap.has(edge.source) && duplicateNodeIdMap.has(edge.target))
      .map(edge =>
        buildEdge(
          duplicateNodeIdMap.get(edge.source)!,
          duplicateNodeIdMap.get(edge.target)!,
          (edge.data?.mappings ?? []).map(mapping => ({ ...mapping })),
          t('flowPage.inspector.dependencyLabel')
        )
      );

    setNodes(current => [
      ...current.map(node => ({
        ...node,
        selected: false,
      })),
      ...duplicatedNodes,
    ]);
    setEdges(current => [
      ...current.map(edge => ({
        ...edge,
        selected: false,
      })),
      ...duplicatedEdges,
    ]);
    setSelectedNodeId(duplicatedNodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    openInspectorPanel();
    setDirty(true);
    clearValidationState();
  };

  const handleUndo = () => {
    if (undoStackRef.current.length <= 1) {
      return;
    }

    const currentSnapshot = undoStackRef.current.at(-1);
    const previousSnapshot = undoStackRef.current.at(-2);
    if (!currentSnapshot || !previousSnapshot) {
      return;
    }

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, cloneFlowCanvasSnapshot(currentSnapshot)];
    setHistoryVersion(current => current + 1);
    applySnapshot(previousSnapshot);
  };

  const handleRedo = () => {
    const nextSnapshot = redoStackRef.current.at(-1);
    if (!nextSnapshot) {
      return;
    }

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, cloneFlowCanvasSnapshot(nextSnapshot)];
    setHistoryVersion(current => current + 1);
    applySnapshot(nextSnapshot);
  };

  const handleCanvasZoomIn = () => {
    void reactFlowInstance?.zoomIn({ duration: 180 });
  };

  const handleCanvasZoomOut = () => {
    void reactFlowInstance?.zoomOut({ duration: 180 });
  };

  const handleCanvasFitView = () => {
    void reactFlowInstance?.fitView({ padding: 0.16, duration: 220 });
  };

  const handleAddStep = () => {
    if (!selectedFlowId) {
      return;
    }

    pushHistorySnapshot();

    const clientKey = buildClientKey();
    const nextNode: FlowCanvasNode = {
      id: clientKey,
      type: 'http-step',
      position: {
        x: 60 + nodes.length * 40,
        y: 60 + nodes.length * 24,
      },
      data: {
        clientKey,
        name: t('flowPage.stepLabel', { index: nodes.length + 1 }),
        method: 'GET',
        url: '',
        headers: '',
        body: '',
        captures: '',
        asserts: '',
        status: 'idle',
        latestResult: null,
      },
      selected: true,
    };

    setNodes(current => [
      ...current.map(node => ({
        ...node,
        selected: false,
      })),
      nextNode,
    ]);
    setSelectedNodeId(nextNode.id);
    setSelectedEdgeId(null);
    openInspectorPanel();
    setDirty(true);
    clearValidationState();
  };

  const saveCurrentFlow = async () => {
    if (!selectedFlowId) {
      return null;
    }

    const validation = validateFlowDraft(t, flowMeta, nodes, edges, 'save');
    if (!validation.isValid) {
      applyValidationResult(validation);
      return null;
    }

    clearValidationState();

    try {
      const saved = await saveFlowMutation.mutateAsync({
        flowId: selectedFlowId,
        data: serializeFlow(flowMeta, nodes, edges),
      });
      skipNextHydrationRef.current = true;
      setFlowMeta({
        name: saved.name,
        description: saved.description,
      });
      const mergedGraph = mergeSavedGraphIntoCanvas(
        nodes,
        edges,
        saved,
        selectedRun,
        liveStepResults,
        t
      );
      setNodes(mergedGraph.nodes);
      setEdges(mergedGraph.edges);
      setDirty(false);
      resetHistoryStacks({
        nodes: mergedGraph.nodes,
        edges: mergedGraph.edges,
        flowMeta: {
          name: saved.name,
          description: saved.description,
        },
        selectedNodeId,
        selectedEdgeId,
      });
      return saved;
    } catch (error) {
      setValidationState(current => ({
        ...current,
        message: error instanceof Error ? error.message : t('flowPage.validation.saveFailed'),
      }));
      return null;
    }
  };

  const persistFlowRunHistory = async (flow: FlowDetail, run: FlowRun) => {
    if (run.status === 'pending' || run.status === 'running') {
      return null;
    }

    const historyKey = `${run.execution_mode ?? 'server'}:${String(run.id)}`;
    if (
      persistedRunHistoryKeysRef.current.has(historyKey) ||
      persistingRunHistoryKeysRef.current.has(historyKey)
    ) {
      return null;
    }

    persistingRunHistoryKeysRef.current.add(historyKey);

    try {
      const history = await createHistoryMutation.mutateAsync(
        buildFlowRunHistoryPayload({
          flow,
          run,
          environment: selectedRunEnvironment
            ? {
                id: selectedRunEnvironment.id,
                name: selectedRunEnvironment.name,
                displayName: selectedRunEnvironment.display_name,
              }
            : null,
          baseUrl: selectedRunBaseUrl,
          messages: {
            executed: flowName => t('flowPage.historyExecuted', { name: flowName }),
            failed: flowName => t('flowPage.historyFailed', { name: flowName }),
            canceled: flowName => t('flowPage.historyCanceled', { name: flowName }),
          },
        })
      );
      persistedRunHistoryKeysRef.current.add(historyKey);
      return history;
    } catch {
      return null;
    } finally {
      persistingRunHistoryKeysRef.current.delete(historyKey);
    }
  };

  const finalizeRun = async (runId: string) => {
    if (!selectedFlowId) {
      return null;
    }

    const run = await flowService.getRun(projectId, selectedFlowId, runId);
    if (run.step_results) {
      const nextResults = Object.fromEntries(
        run.step_results.map(result => [result.step_id, result])
      );
      setLiveStepResults(nextResults);
    }

    await Promise.all([flowRunsQuery.refetch(), selectedRunQuery.refetch()]);
    setSelectedRunId(runId);
    return run;
  };

  const pollRunUntilSettled = async (runId: string) => {
    if (!selectedFlowId) {
      return null;
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const run = await flowService.getRun(projectId, selectedFlowId, runId);
      if (run.step_results) {
        const nextResults = Object.fromEntries(
          run.step_results.map(result => [result.step_id, result])
        );
        setLiveStepResults(nextResults);
      }
      if (run.status !== 'pending' && run.status !== 'running') {
        return finalizeRun(runId);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return null;
  };

  const streamRun = async (runId: string, baseUrl?: string) => {
    if (!selectedFlowId) {
      return null;
    }

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      await flowService.streamRun(projectId, selectedFlowId, runId, {
        signal: controller.signal,
        baseUrl,
        onStep: event => {
          const stepResult = event.data;
          if (!stepResult) {
            return;
          }
          setLiveStepResults(current => ({
            ...current,
            [stepResult.step_id]: stepResult,
          }));
        },
        onDone: () => {},
      });

      const finalizedRun = await finalizeRun(runId);
      if (finalizedRun?.status === 'pending' || finalizedRun?.status === 'running') {
        return pollRunUntilSettled(runId);
      }

      return finalizedRun;
    } catch {
      if (controller.signal.aborted) {
        return null;
      }
      return pollRunUntilSettled(runId);
    }
  };

  const handleRunServer = async () => {
    if (!selectedFlowId) {
      return;
    }

    const validation = validateFlowDraft(t, flowMeta, nodes, edges, 'run');
    if (!validation.isValid) {
      applyValidationResult(validation);
      return;
    }

    clearValidationState();

    try {
      let savedFlow = selectedFlowQuery.data ?? null;
      if (dirty) {
        savedFlow = await saveCurrentFlow();
        if (!savedFlow) {
          return;
        }
      }

      if (!savedFlow) {
        throw new Error(t('flowPage.validation.reloadBeforeRun'));
      }

      setLiveStepResults({});
      const run = await runFlowMutation.mutateAsync(selectedFlowId);
      setSelectedRunId(run.id);
      const completedRun = await streamRun(run.id, selectedRunBaseUrl);
      if (completedRun) {
        void persistFlowRunHistory(savedFlow, completedRun);
      }
    } catch (error) {
      setValidationState(current => ({
        ...current,
        message: error instanceof Error ? error.message : t('flowPage.validation.startRunFailed'),
      }));
    }
  };

  const handleRunLocal = async () => {
    if (!selectedFlowId) {
      return;
    }

    const validation = validateFlowDraft(t, flowMeta, nodes, edges, 'run');
    if (!validation.isValid) {
      applyValidationResult(validation);
      return;
    }

    clearValidationState();
    streamAbortRef.current?.abort();

    try {
      let savedFlow = selectedFlowQuery.data ?? null;
      if (dirty) {
        savedFlow = await saveCurrentFlow();
        if (!savedFlow) {
          return;
        }
      }

      if (!savedFlow) {
        throw new Error(t('flowPage.validation.reloadBeforeLocalRun'));
      }

      const runId = buildLocalRunId();
      const startedAt = new Date().toISOString();
      const localRun: FlowRun = {
        id: runId,
        flow_id: selectedFlowId,
        status: 'running',
        execution_mode: 'local',
        triggered_by: '',
        started_at: startedAt,
        finished_at: null,
        created_at: startedAt,
        updated_at: startedAt,
        step_results: [],
      };

      const graph = buildLocalFlowExecutionGraph(savedFlow);
      setIsLocalRunPending(true);
      setSelectedRunId(runId);
      setLocalRuns(current => [localRun, ...current.filter(run => run.id !== runId)]);
      setLiveStepResults({});

      const completedRun = await runLocalFlow({
        flowId: selectedFlowId,
        runId,
        steps: graph.steps,
        edges: graph.edges,
        baseUrl: selectedRunBaseUrl,
        onStepEvent: event => {
          setLiveStepResults(current => ({
            ...current,
            [event.step_id]: event.data,
          }));

          setLocalRuns(current =>
            current.map(run => {
              if (run.id !== runId) {
                return run;
              }

              const previousStepResults = run.step_results ?? [];
              const hasExistingStepResult = previousStepResults.some(
                item => item.step_id === event.step_id
              );
              const nextStepResults = hasExistingStepResult
                ? previousStepResults.map(item =>
                    item.step_id === event.step_id ? event.data : item
                  )
                : [...previousStepResults, event.data];

              return {
                ...run,
                status: event.status === 'running' ? 'running' : run.status,
                updated_at: new Date().toISOString(),
                step_results: nextStepResults,
              };
            })
          );
        },
      });

      setLocalRuns(current => [completedRun, ...current.filter(run => run.id !== runId)]);
      void persistFlowRunHistory(savedFlow, completedRun);
    } catch (error) {
      setValidationState(current => ({
        ...current,
        message:
          error instanceof Error ? error.message : t('flowPage.validation.startLocalRunFailed'),
      }));
    } finally {
      setIsLocalRunPending(false);
    }
  };

  const handleRefresh = () => {
    void Promise.all([
      flowListQuery.refetch(),
      selectedFlowQuery.refetch(),
      flowRunsQuery.refetch(),
      selectedLocalRun || effectiveRunId === null ? Promise.resolve() : selectedRunQuery.refetch(),
    ]);
  };

  const flowSidebar = (
    <aside className="flex w-full shrink-0 flex-col border-b border-border/60 bg-bg-surface/70 lg:h-full lg:w-[320px] lg:border-r lg:border-b-0">
      <div className="space-y-4 border-b border-border/60 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-main">{t('modules.flows.label')}</p>
            <p className="text-sm leading-6 text-text-muted">{t('flowPage.sidebarDescription')}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isMobile ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                isIcon
                aria-label={t('flowPage.collapseFlowItems')}
                title={t('flowPage.collapseFlowItems')}
                onClick={() => setIsSidebarCollapsed(true)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              disabled={!canEdit}
            >
              <Plus className="h-4 w-4" />
              {t('flowPage.create')}
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={searchValue}
            onChange={event => setSearchValue(event.target.value)}
            placeholder={t('flowPage.filterPlaceholder')}
            className="pl-9"
            root
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {flowListQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        ) : flowListQuery.error ? (
          <Alert>
            <AlertTitle>{t('flowPage.loadFailedTitle')}</AlertTitle>
            <AlertDescription>{t('flowPage.loadFailedDescription')}</AlertDescription>
          </Alert>
        ) : filteredFlows.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="space-y-4 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <FolderGit2 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-text-main">{t('flowPage.emptyTitle')}</p>
                <p className="text-sm leading-6 text-text-muted">
                  {t('flowPage.emptyDescription')}
                </p>
              </div>
              <Button type="button" onClick={() => setIsCreateOpen(true)} disabled={!canEdit}>
                <Plus className="h-4 w-4" />
                {t('flowPage.create')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredFlows.map(flow => (
              <div
                key={flow.id}
                className={cn(
                  'rounded-3xl border px-4 py-3 transition-colors',
                  selectedFlowId === flow.id
                    ? 'border-primary/30 bg-primary/10'
                    : 'border-border/60 bg-background/70 hover:bg-background'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => navigateToFlow(flow.id)}
                  >
                    <p className="truncate text-sm font-semibold text-text-main">{flow.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">
                      {flow.description || t('common.noDescriptionProvided')}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
                      <Badge variant="outline">
                        {t('flowPage.stepCount', { count: flow.step_count ?? 0 })}
                      </Badge>
                      <span>{formatDate(flow.updated_at)}</span>
                    </div>
                  </button>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      isIcon
                      onClick={() => handleDeleteFlow(flow.id, flow.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );

  const editorContent = selectedFlowQuery.isLoading ? (
    <div className="space-y-6">
      <div className="h-36 animate-pulse rounded-3xl bg-muted" />
      <div className="h-[420px] animate-pulse rounded-3xl bg-muted" />
    </div>
  ) : selectedFlowId && !selectedFlowQuery.data ? (
    <Card className="border-dashed border-border/60">
      <CardContent className="space-y-4 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <FileClock className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-text-main">{t('flowPage.notFoundTitle')}</p>
          <p className="text-sm leading-6 text-text-muted">{t('flowPage.notFoundDescription')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={buildProjectFlowsRoute(projectId)}>{t('common.clearSelection')}</Link>
        </Button>
      </CardContent>
    </Card>
  ) : !selectedFlowId ? (
    <Card className="border-dashed border-border/60">
      <CardContent className="space-y-4 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Workflow className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-text-main">{t('flowPage.selectTitle')}</p>
          <p className="text-sm leading-6 text-text-muted">
            {showFlowSidebar
              ? t('flowPage.selectDescriptionWithSidebar')
              : t('flowPage.selectDescriptionCollapsed')}
          </p>
        </div>
      </CardContent>
    </Card>
  ) : (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-bg-surface/70 px-4 py-4 md:px-6">
        <Select
          value={
            selectedRunEnvironmentId === null
              ? RUN_ENVIRONMENT_DEFAULT_VALUE
              : String(selectedRunEnvironmentId)
          }
          onValueChange={value => {
            if (value === RUN_ENVIRONMENT_DEFAULT_VALUE) {
              setSelectedRunEnvironmentId(null);
              return;
            }
            setSelectedRunEnvironmentId(value);
          }}
          disabled={environmentsQuery.isLoading}
        >
          <SelectTrigger
            className="w-[320px]"
            aria-label={t('flowPage.runEnvironment')}
            title={selectedRunBaseUrl ?? t('flowPage.runEnvironmentDefault')}
          >
            <SelectValue placeholder={t('flowPage.runEnvironmentDefault')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={RUN_ENVIRONMENT_DEFAULT_VALUE}>
              {t('flowPage.runEnvironmentDefault')}
            </SelectItem>
            {runEnvironments.map(environment => (
              <SelectItem key={environment.id} value={String(environment.id)}>
                {(environment.display_name || environment.name).trim()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRunBaseUrl ? (
          <Badge variant="outline" className="max-w-[320px] truncate">
            {selectedRunBaseUrl}
          </Badge>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => void saveCurrentFlow()}
          disabled={!canEdit || !dirty}
          loading={saveFlowMutation.isPending}
        >
          <Save className="h-4 w-4" />
          {t('common.saveChanges')}
        </Button>
        <Button
          type="button"
          onClick={() => void handleRunLocal()}
          disabled={!canEdit || !selectedFlowId}
          loading={isLocalRunPending}
        >
          <Play className="h-4 w-4" />
          {t('flowPage.runLocal')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleRunServer()}
          disabled={!canEdit || !selectedFlowId}
          loading={runFlowMutation.isPending}
        >
          <Play className="h-4 w-4" />
          {t('flowPage.runServer')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleAddStep}
          disabled={!canEdit || !selectedFlowId}
        >
          <Plus className="h-4 w-4" />
          {t('flowPage.addStep')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={flowListQuery.isFetching || selectedFlowQuery.isFetching}
        >
          <RefreshCw className="h-4 w-4" />
          {t('common.refresh')}
        </Button>
        {isMobile ? (
          <Button type="button" variant="outline" onClick={() => setInspectorOpen(true)}>
            {t('flowPage.details')}
          </Button>
        ) : null}
        {dirty ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-500/10 text-amber-700">
            {t('flowPage.unsaved')}
          </Badge>
        ) : (
          <Badge variant="outline">{t('flowPage.saved')}</Badge>
        )}
      </div>

      {validationState.message ? (
        <div className="border-b border-border/60 px-4 py-4 md:px-6">
          <Alert variant="destructive">
            <AlertTitle>{t('flowPage.validationTitle')}</AlertTitle>
            <AlertDescription>{validationState.message}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="flex flex-col xl:min-h-0 xl:flex-1 xl:flex-row">
        <div className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.85),rgba(248,250,252,0.98))]">
          <div className="min-h-[720px] p-4 md:p-6">
            <div className="h-[min(72vh,960px)] min-h-[720px] overflow-hidden rounded-[32px] border border-border/60 bg-background/85 shadow-premium">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                onInit={setReactFlowInstance}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onNodesDelete={handleNodesDelete}
                onConnect={handleConnect}
                onNodeDragStart={handleNodeDragStart}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                  openInspectorPanel();
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                  openInspectorPanel();
                }}
                deleteKeyCode={null}
                minZoom={0.2}
                defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
              >
                <Background
                  id="flow-grid-minor"
                  variant={BackgroundVariant.Lines}
                  gap={24}
                  lineWidth={1}
                  color="rgba(148, 163, 184, 0.12)"
                />
                <Background
                  id="flow-grid-major"
                  variant={BackgroundVariant.Lines}
                  gap={120}
                  lineWidth={1.2}
                  color="rgba(100, 116, 139, 0.22)"
                />
                <Panel position="top-right" className="!m-4 flex max-w-[min(90vw,360px)] flex-col items-end gap-3">
                  {isCanvasToolsOpen ? (
                    <div className="w-[min(90vw,320px)] rounded-[28px] border border-border/60 bg-background/92 p-3 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                            {t('flowPage.canvasToolsLabel')}
                          </p>
                          <p className="mt-1 text-sm text-text-main">
                            {t('flowPage.canvasToolsDescription')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                isIcon
                                aria-label={t('flowPage.shortcutsTitle')}
                                onClick={() => setIsShortcutHelpOpen(true)}
                              >
                                <CircleHelp className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {t('flowPage.shortcutsHint')}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                isIcon
                                aria-label={t('flowPage.closeCanvasTools')}
                                onClick={() => setIsCanvasToolsOpen(false)}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {t('flowPage.closeCanvasTools')}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleRunLocal()}
                          disabled={!canEdit || !selectedFlowId}
                          loading={isLocalRunPending}
                        >
                          <Play className="h-4 w-4" />
                          {t('flowPage.runAll')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRunServer()}
                          disabled={!canEdit || !selectedFlowId}
                          loading={runFlowMutation.isPending}
                        >
                          <Play className="h-4 w-4" />
                          {t('flowPage.runServer')}
                        </Button>
                      </div>

                      <Separator className="my-3" />

                      <div className="grid grid-cols-4 gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              isIcon
                              onClick={handleCanvasZoomIn}
                              disabled={!selectedFlowId}
                              aria-label={t('flowPage.zoomIn')}
                            >
                              <PlusIcon className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {t('flowPage.zoomIn')}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              isIcon
                              onClick={handleCanvasZoomOut}
                              disabled={!selectedFlowId}
                              aria-label={t('flowPage.zoomOut')}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {t('flowPage.zoomOut')}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              isIcon
                              onClick={handleCanvasFitView}
                              disabled={!selectedFlowId}
                              aria-label={t('flowPage.fitView')}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {t('flowPage.fitView')}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              isIcon
                              onClick={handleDuplicateSelection}
                              disabled={!canEdit || !canDuplicateSelection}
                              aria-label={t('flowPage.duplicateSelection')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {t('flowPage.duplicateSelection')}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              isIcon
                              onClick={handleDeleteSelection}
                              disabled={!canEdit || !canDeleteSelection}
                              aria-label={t('common.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {t('common.delete')}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              isIcon
                              onClick={handleUndo}
                              disabled={!canEdit || !canUndo}
                              aria-label={t('flowPage.undo')}
                            >
                              <Redo2 className="h-4 w-4 rotate-180" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {t('flowPage.undo')}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              isIcon
                              onClick={handleRedo}
                              disabled={!canEdit || !canRedo}
                              aria-label={t('flowPage.redo')}
                            >
                              <Redo2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {t('flowPage.redo')}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="lg"
                          isIcon
                          aria-label={t('flowPage.openCanvasTools')}
                          className="h-14 w-14 rounded-full border border-primary/20 bg-primary text-primary-foreground shadow-[0_20px_45px_-22px_rgba(14,165,233,0.75)]"
                          onClick={() => setIsCanvasToolsOpen(true)}
                        >
                          <CircleHelp className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        {t('flowPage.openCanvasTools')}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </Panel>
              </ReactFlow>
            </div>
          </div>
        </div>

        {isDesktopInspectorCollapsed ? (
          <aside className="hidden w-[72px] shrink-0 border-l border-border/60 bg-bg-surface/70 xl:flex xl:flex-col xl:items-center xl:justify-start xl:py-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isIcon
                  aria-label={t('flowPage.openFlowSettings')}
                  onClick={() => setIsDesktopInspectorCollapsed(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {t('flowPage.openFlowSettings')}
              </TooltipContent>
            </Tooltip>
          </aside>
        ) : (
          <aside className="hidden w-[380px] shrink-0 border-l border-border/60 bg-bg-surface/70 xl:block">
            <div className="flex items-center justify-end border-b border-border/60 px-4 py-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    isIcon
                    aria-label={t('flowPage.closeFlowSettings')}
                    onClick={() => setIsDesktopInspectorCollapsed(true)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {t('flowPage.closeFlowSettings')}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="max-h-[calc(72vh-57px)] min-h-[320px] overflow-y-auto p-4">
              <FlowInspector
                flowName={flowMeta.name}
                flowDescription={flowMeta.description}
                flowNameError={validationState.flowName}
                onFlowMetaChange={handleFlowMetaChange}
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                nodeErrors={validationState.nodeErrors}
                edgeErrors={validationState.edgeErrors}
                onNodeChange={handleNodeChange}
                onEdgeMappingsChange={handleEdgeMappingsChange}
                canEdit={canEdit}
                runs={runs}
                selectedRun={selectedRun}
                isRunDetailsLoading={selectedRunQuery.isLoading || selectedRunQuery.isFetching}
                stepOptions={stepOptions}
                selectedRunId={effectiveRunId}
                onSelectRun={setSelectedRunId}
                onSelectRunStep={handleSelectRunStep}
                selectedStepResult={selectedStepResult}
                getParameterTargetOptions={getParameterTargetOptions}
                onPassParameters={handlePassParameters}
                historyHref={flowHistoryHref}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex min-h-full flex-col lg:flex-row">
        {showFlowSidebar ? (
          flowSidebar
        ) : !isMobile ? (
          <aside className="hidden w-[72px] shrink-0 border-r border-border/60 bg-bg-surface/70 lg:flex lg:flex-col lg:items-center lg:justify-start lg:py-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isIcon
                  aria-label={t('flowPage.expandFlowItems')}
                  onClick={() => setIsSidebarCollapsed(false)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {t('flowPage.expandFlowItems')}
              </TooltipContent>
            </Tooltip>
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">
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
                  <BreadcrumbPage>{t('modules.flows.label')}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  {t('modules.flows.label')}
                </Badge>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {selectedFlowQuery.data?.name || t('flowPage.heroTitleFallback')}
                  </h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-text-muted">
                    {t('flowPage.heroDescription')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4" />
                  {t('common.refresh')}
                </Button>
                <Button type="button" onClick={() => setIsCreateOpen(true)} disabled={!canEdit}>
                  <Plus className="h-4 w-4" />
                  {t('flowPage.create')}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1">{editorContent}</div>
        </main>
      </div>

      <CreateFlowDialog
        key={isCreateOpen ? 'create-flow-open' : 'create-flow-closed'}
        open={isCreateOpen}
        isSubmitting={createFlowMutation.isPending}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateFlow}
      />

      <Dialog open={isShortcutHelpOpen} onOpenChange={setIsShortcutHelpOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>{t('flowPage.shortcutsTitle')}</DialogTitle>
            <DialogDescription>{t('flowPage.shortcutsDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-sm font-semibold text-text-main">
                  {t('flowPage.deleteSelection')}
                </p>
                <p className="mt-2 font-mono text-xs text-text-muted">
                  {t('flowPage.shortcutDelete')}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-sm font-semibold text-text-main">{t('flowPage.undo')}</p>
                <p className="mt-2 font-mono text-xs text-text-muted">
                  {t('flowPage.shortcutUndo')}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-sm font-semibold text-text-main">
                  {t('flowPage.duplicateSelection')}
                </p>
                <p className="mt-2 font-mono text-xs text-text-muted">
                  {t('flowPage.shortcutDuplicate')}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-sm font-semibold text-text-main">
                  {t('flowPage.openShortcuts')}
                </p>
                <p className="mt-2 font-mono text-xs text-text-muted">
                  {t('flowPage.shortcutOpenHelp')}
                </p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsShortcutHelpOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isMobile && selectedFlowId ? (
        <Drawer open={inspectorOpen} onOpenChange={setInspectorOpen} direction="right">
          <DrawerContent className="max-w-full">
            <DrawerHeader>
              <DrawerTitle>{t('flowPage.drawerTitle')}</DrawerTitle>
              <DrawerDescription>{t('flowPage.drawerDescription')}</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <FlowInspector
                flowName={flowMeta.name}
                flowDescription={flowMeta.description}
                flowNameError={validationState.flowName}
                onFlowMetaChange={handleFlowMetaChange}
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                nodeErrors={validationState.nodeErrors}
                edgeErrors={validationState.edgeErrors}
                onNodeChange={handleNodeChange}
                onEdgeMappingsChange={handleEdgeMappingsChange}
                canEdit={canEdit}
                runs={runs}
                selectedRun={selectedRun}
                isRunDetailsLoading={selectedRunQuery.isLoading || selectedRunQuery.isFetching}
                stepOptions={stepOptions}
                selectedRunId={effectiveRunId}
                onSelectRun={setSelectedRunId}
                onSelectRunStep={handleSelectRunStep}
                selectedStepResult={selectedStepResult}
                getParameterTargetOptions={getParameterTargetOptions}
                onPassParameters={handlePassParameters}
                historyHref={flowHistoryHref}
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </>
  );
}
