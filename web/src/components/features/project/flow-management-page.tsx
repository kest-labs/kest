'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
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
  FileClock,
  FolderGit2,
  PanelLeft,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  Trash2,
  Workflow,
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
import { buildProjectFlowsRoute, buildProjectDetailRoute } from '@/constants/routes';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { useProjectMemberRole } from '@/hooks/use-members';
import { useProject } from '@/hooks/use-projects';
import { useT } from '@/i18n/client';
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

type FlowNodeData = {
  backendStepId?: number;
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
  backendEdgeId?: number;
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
  stepId: number;
  name: string;
};
type FlowParameterHandoffPayload = {
  sourceStepId: number;
  targetStepId: number;
  selections: FlowParameterSelection[];
};

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

const getStatusLabel = (status: FlowRunStatus | 'idle') => {
  switch (status) {
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'running':
      return 'Running';
    case 'canceled':
      return 'Canceled';
    case 'pending':
      return 'Pending';
    default:
      return 'Idle';
  }
};

const getMethodBadgeClassName = (method: string) => {
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
      return 'border-border/60 bg-background text-text-muted';
  }
};

const buildEdgeLabel = (mappings: FlowVariableMappingRule[]) => {
  if (mappings.length === 0) {
    return 'Dependency';
  }

  const preview = mappings.slice(0, 2).map((mapping) => `${mapping.source} -> ${mapping.target}`);
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
    return Array.isArray(value)
      ? value.filter((item) => item && item.source && item.target)
      : [];
  } catch {
    return [];
  }
};

const stringifyVariableMapping = (mappings: FlowVariableMappingRule[]) =>
  JSON.stringify(
    mappings
      .map((mapping) => ({
        source: mapping.source.trim(),
        target: mapping.target.trim(),
      }))
      .filter((mapping) => mapping.source && mapping.target)
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

const buildLocalRunId = () => -Date.now() - Math.round(Math.random() * 1000);

const getCanvasNodeLabel = (node: FlowCanvasNode, index?: number) => {
  const name = node.data.name.trim();
  if (name) {
    return name;
  }
  if (typeof index === 'number') {
    return `Step ${index + 1}`;
  }
  return 'Unnamed step';
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
  liveStepResults: Record<number, FlowStepResult>
): { status: FlowRunStatus | 'idle'; latestResult?: FlowStepResult | null } => {
  const liveResult = liveStepResults[step.id];
  if (liveResult) {
    return { status: liveResult.status, latestResult: liveResult };
  }

  const runResult = run?.step_results?.find((item) => item.step_id === step.id) ?? null;
  if (runResult) {
    return { status: runResult.status, latestResult: runResult };
  }

  return { status: 'idle', latestResult: null };
};

const createCanvasNode = (
  step: FlowStep,
  nodeId: string,
  run: FlowRun | null | undefined,
  liveStepResults: Record<number, FlowStepResult>
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

const createCanvasEdge = (edge: FlowEdge, stepNodeIds: Map<number, string>): FlowCanvasEdge | null => {
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
    label: buildEdgeLabel(mappings),
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
  liveStepResults: Record<number, FlowStepResult>
) => {
  const usedNodeIds = new Set<string>();
  const stepNodeIds = new Map<number, string>();

  const canvasNodes = steps.map((step) => {
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
    const canvasEdge = createCanvasEdge(edge, stepNodeIds);
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
  liveStepResults: Record<number, FlowStepResult>
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
    const runResult = run?.step_results?.find((item) => item.step_id === backendStepId) ?? null;
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
  liveStepResults: Record<number, FlowStepResult>
) => {
  const savedStepsByClientKey = new Map<string, FlowStep>();
  for (const step of saved.steps) {
    savedStepsByClientKey.set(getStepNodeBaseId(step), step);
  }

  const savedEdgesByNodePair = new Map<string, FlowEdge>();
  for (const edge of saved.edges) {
    const sourceStep = saved.steps.find((step) => step.id === edge.source_step_id);
    const targetStep = saved.steps.find((step) => step.id === edge.target_step_id);
    if (!sourceStep || !targetStep) {
      continue;
    }

    savedEdgesByNodePair.set(
      `${getStepNodeBaseId(sourceStep)}->${getStepNodeBaseId(targetStep)}`,
      edge
    );
  }

  const nextNodes = currentNodes.map((node) => {
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

  const nextEdges = currentEdges.map((edge) => {
    const savedEdge = savedEdgesByNodePair.get(`${edge.source}->${edge.target}`);
    if (!savedEdge) {
      return edge;
    }

    const mappings = parseVariableMapping(savedEdge.variable_mapping, savedEdge.variable_mapping_rules);
    return {
      ...edge,
      id: `edge-${savedEdge.id}`,
      label: buildEdgeLabel(mappings),
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
  edges: edges.map((edge) => ({
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
  steps: detail.steps.map((step) => ({
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
  edges: detail.edges.map((edge) => ({
    source_step_id: edge.source_step_id,
    target_step_id: edge.target_step_id,
    mappings: parseVariableMapping(edge.variable_mapping, edge.variable_mapping_rules),
  })),
});

const validateFlowDraft = (
  meta: { name: string; description: string },
  nodes: FlowCanvasNode[],
  edges: FlowCanvasEdge[],
  mode: FlowValidationMode
): FlowValidationResult => {
  const nodeErrors: Record<string, FlowNodeValidationErrors> = {};
  const edgeErrors: Record<string, string> = {};
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
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
    flowName = 'Flow name is required.';
    setFirstIssue(
      mode === 'run'
        ? 'Name this flow before running it.'
        : 'Name this flow before saving it.',
      { kind: 'flow' }
    );
  }

  if (mode === 'run' && nodes.length === 0) {
    setFirstIssue('Add at least one step before running this flow.', { kind: 'flow' });
  }

  for (const [index, node] of nodes.entries()) {
    const label = getCanvasNodeLabel(node, index);
    const errors: FlowNodeValidationErrors = {};

    if (!node.id.trim()) {
      errors.name = 'Step key is required.';
    } else if (seenNodeIds.has(node.id)) {
      errors.name = 'Duplicate step key detected.';
    } else {
      seenNodeIds.add(node.id);
    }

    if (!node.data.name.trim()) {
      errors.name = errors.name ?? 'Step name is required.';
    }
    if (!node.data.method.trim()) {
      errors.method = 'HTTP method is required.';
    }
    if (!node.data.url.trim()) {
      errors.url = 'Request URL is required.';
    }

    if (errors.name || errors.method || errors.url) {
      nodeErrors[node.id] = errors;
      setFirstIssue(
        `${label}: ${errors.url ?? errors.method ?? errors.name}`,
        { kind: 'node', id: node.id }
      );
    }

    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    let edgeError = '';

    if (!edge.source || !edge.target) {
      edgeError = 'Connection endpoints are missing.';
    } else if (edge.source === edge.target) {
      edgeError = 'A step cannot connect to itself.';
    } else if (!nodeById.has(edge.source)) {
      edgeError = 'The upstream step no longer exists.';
    } else if (!nodeById.has(edge.target)) {
      edgeError = 'The downstream step no longer exists.';
    } else if ((edge.data?.mappings ?? []).some((mapping) => !mapping.source.trim() || !mapping.target.trim())) {
      edgeError = 'Complete or remove empty mapping rows.';
    }

    if (edgeError) {
      edgeErrors[edge.id] = edgeError;
      const sourceName = edge.source && nodeById.has(edge.source)
        ? getCanvasNodeLabel(nodeById.get(edge.source)!)
        : 'Unknown source';
      const targetName = edge.target && nodeById.has(edge.target)
        ? getCanvasNodeLabel(nodeById.get(edge.target)!)
        : 'Unknown target';
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
      setFirstIssue('Flow edges cannot form cycles.', { kind: 'flow' });
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
  mappings: FlowVariableMappingRule[] = []
): FlowCanvasEdge => ({
  id: `edge-${source}-${target}-${Date.now()}`,
  source,
  target,
  label: buildEdgeLabel(mappings),
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
  const flowData = data as FlowNodeData;

  return (
    <div
      className={cn(
        'w-[260px] rounded-3xl border bg-background/95 p-4 shadow-lg transition-colors',
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
          <p className="truncate text-sm font-semibold text-text-main">
            {flowData.name || 'Untitled step'}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">
            {flowData.url || 'Configure request URL'}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn('shrink-0', getStatusBadgeClassName(flowData.status))}
        >
          {getStatusLabel(flowData.status)}
        </Badge>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Badge variant="outline" className={getMethodBadgeClassName(flowData.method)}>
          {flowData.method}
        </Badge>
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
          {flowData.clientKey}
        </p>
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
          <DialogDescription>
            {t('flowPage.createDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="create-flow-form" className="space-y-5 py-1" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="create-flow-name">{t('common.name')}</Label>
              <Input
                id="create-flow-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
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
                onChange={(event) => setDescription(event.target.value)}
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
  stepOptions: Array<{ id: number; name: string }>;
  selectedRunId: number | null;
  onSelectRun: (runId: number) => void;
  onSelectRunStep: (stepId: number) => void;
  selectedStepResult: FlowStepResult | null;
  getParameterTargetOptions: (sourceStepId: number) => FlowParameterTargetOption[];
  onPassParameters: (payload: FlowParameterHandoffPayload) => void;
}) {
  if (selectedNode) {
    const selectedNodeErrors = nodeErrors[selectedNode.id] ?? {};
    const captureDefinitions = parseCaptureDefinitions(selectedNode.data.captures);
    return (
      <div className="space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Step inspector</CardTitle>
            <CardDescription>Configure the selected HTTP request node.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="request" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="captures">Captures</TabsTrigger>
                <TabsTrigger value="asserts">Asserts</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="step-name">Name</Label>
                  <Input
                    id="step-name"
                    value={selectedNode.data.name}
                    disabled={!canEdit}
                    onChange={(event) => onNodeChange(selectedNode.id, { name: event.target.value })}
                    errorText={selectedNodeErrors.name}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-method">Method</Label>
                  <Select
                    value={selectedNode.data.method}
                    disabled={!canEdit}
                    onValueChange={(value) => onNodeChange(selectedNode.id, { method: value })}
                  >
                    <SelectTrigger id="step-method" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOW_METHOD_OPTIONS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedNodeErrors.method ? (
                    <p className="text-xs font-medium text-destructive">{selectedNodeErrors.method}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-url">URL</Label>
                  <Input
                    id="step-url"
                    value={selectedNode.data.url}
                    disabled={!canEdit}
                    onChange={(event) => onNodeChange(selectedNode.id, { url: event.target.value })}
                    placeholder="/v1/login"
                    errorText={selectedNodeErrors.url}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-headers">Headers (JSON)</Label>
                  <Textarea
                    id="step-headers"
                    value={selectedNode.data.headers}
                    disabled={!canEdit}
                    onChange={(event) => onNodeChange(selectedNode.id, { headers: event.target.value })}
                    placeholder='{"Authorization":"Bearer {{token}}"}'
                    rows={6}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step-body">Body</Label>
                  <Textarea
                    id="step-body"
                    value={selectedNode.data.body}
                    disabled={!canEdit}
                    onChange={(event) => onNodeChange(selectedNode.id, { body: event.target.value })}
                    placeholder='{"email":"demo@example.com"}'
                    rows={8}
                    root
                  />
                </div>
              </TabsContent>
              <TabsContent value="captures" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-text-main">Output variables</p>
                    <p className="mt-1 text-xs leading-5 text-text-muted">
                      Variables generated from response fields and available to connected downstream steps.
                    </p>
                  </div>
                  {captureDefinitions.length === 0 ? (
                    <Alert>
                      <AlertTitle>No output variables</AlertTitle>
                      <AlertDescription>
                        Run this step, then use Pass parameters from the response log to create captures.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      {captureDefinitions.map((capture) => (
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
                    Advanced Captures DSL
                  </summary>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="step-captures">Captures DSL</Label>
                    <Textarea
                      id="step-captures"
                      value={selectedNode.data.captures}
                      disabled={!canEdit}
                      onChange={(event) => onNodeChange(selectedNode.id, { captures: event.target.value })}
                      placeholder={'token: data.access_token\nuserId: data.user.id'}
                      rows={12}
                      root
                    />
                  </div>
                </details>
              </TabsContent>
              <TabsContent value="asserts" className="space-y-2">
                <Label htmlFor="step-asserts">Asserts DSL</Label>
                <Textarea
                  id="step-asserts"
                  value={selectedNode.data.asserts}
                  disabled={!canEdit}
                  onChange={(event) => onNodeChange(selectedNode.id, { asserts: event.target.value })}
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
            <CardTitle>Edge mappings</CardTitle>
            <CardDescription>Move captured variables from the upstream step into the downstream step scope.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedEdgeError ? (
              <Alert variant="destructive">
                <AlertTitle>Fix this connection</AlertTitle>
                <AlertDescription>{selectedEdgeError}</AlertDescription>
              </Alert>
            ) : null}
            <Tabs defaultValue="mappings" className="space-y-4">
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="mappings">Mappings</TabsTrigger>
              </TabsList>
              <TabsContent value="mappings" className="space-y-4">
                {mappings.length === 0 ? (
                  <Alert>
                    <AlertTitle>No mappings yet</AlertTitle>
                    <AlertDescription>
                      Add at least one mapping so the downstream step can reference upstream captures.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-3">
                  {mappings.map((mapping, index) => (
                    <div key={`${selectedEdge.id}-${index}`} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2">
                      <Input
                        value={mapping.source}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const nextMappings = mappings.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, source: event.target.value } : item
                          );
                          onEdgeMappingsChange(selectedEdge.id, nextMappings);
                        }}
                        placeholder="token"
                        root
                      />
                      <div className="flex items-center justify-center text-sm text-text-muted">-&gt;</div>
                      <Input
                        value={mapping.target}
                        disabled={!canEdit}
                        onChange={(event) => {
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
                  Add mapping
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
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Flow settings</CardTitle>
          <CardDescription>Update the graph metadata and review recent runs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="flow-name">Name</Label>
            <Input
              id="flow-name"
              value={flowName}
              disabled={!canEdit}
              onChange={(event) => onFlowMetaChange('name', event.target.value)}
              errorText={flowNameError}
              root
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flow-description">Description</Label>
            <Textarea
              id="flow-description"
              value={flowDescription}
              disabled={!canEdit}
              onChange={(event) => onFlowMetaChange('description', event.target.value)}
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
}: {
  runs: FlowRun[];
  selectedRun: FlowRun | null;
  isRunDetailsLoading: boolean;
  stepOptions: Array<{ id: number; name: string }>;
  selectedRunId: number | null;
  onSelectRun: (runId: number) => void;
  onSelectRunStep: (stepId: number) => void;
  selectedStepResult: FlowStepResult | null;
  canEdit: boolean;
  getParameterTargetOptions: (sourceStepId: number) => FlowParameterTargetOption[];
  onPassParameters: (payload: FlowParameterHandoffPayload) => void;
}) {
  const [activeStepId, setActiveStepId] = useState<number | null>(null);
  const [handoffStepResult, setHandoffStepResult] = useState<FlowStepResult | null>(null);

  const stepNameById = useMemo(
    () => new Map(stepOptions.map((step) => [step.id, step.name])),
    [stepOptions]
  );

  const defaultStepId = useMemo(() => {
    const stepResults = selectedRun?.step_results ?? [];
    return (
      stepResults.find((result) => result.status === 'failed')?.step_id ??
      stepResults.find((result) => result.status === 'running')?.step_id ??
      stepResults[0]?.step_id ??
      null
    );
  }, [selectedRun?.step_results]);

  const activeRunStepResult =
    selectedStepResult ??
    selectedRun?.step_results?.find((result) => result.step_id === (activeStepId ?? defaultStepId)) ??
    selectedRun?.step_results?.[0] ??
    null;
  const activeParameterCandidates = useMemo(
    () => extractFlowParameterCandidates(activeRunStepResult?.response),
    [activeRunStepResult?.response]
  );
  const activeTargetOptions = useMemo(
    () => activeRunStepResult ? getParameterTargetOptions(activeRunStepResult.step_id) : [],
    [activeRunStepResult, getParameterTargetOptions]
  );

  const completedCount =
    selectedRun?.step_results?.filter((result) => result.status === 'passed').length ?? 0;

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Run history</CardTitle>
          <CardDescription>Select a local or server run to overlay status and inspect step results.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <Alert>
              <AlertTitle>No runs yet</AlertTitle>
              <AlertDescription>Save the flow, then start the first run from the toolbar.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
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
                        {run.execution_mode === 'local' ? 'Local Run' : 'Run'} #{Math.abs(run.id)}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">{formatDate(run.created_at)}</p>
                    </div>
                    <Badge variant="outline" className={getStatusBadgeClassName(run.status)}>
                      {getStatusLabel(run.status)}
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
            <CardTitle>Run log</CardTitle>
            <CardDescription>
              Inspect each step for {selectedRun.execution_mode === 'local' ? 'local run' : 'run'} #
              {Math.abs(selectedRun.id)} and jump back to the canvas node when needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <ResultField label="Status">
                <Badge variant="outline" className={getStatusBadgeClassName(selectedRun.status)}>
                  {getStatusLabel(selectedRun.status)}
                </Badge>
              </ResultField>
              <ResultField label="Started">
                {selectedRun.started_at ? formatDate(selectedRun.started_at) : 'Not started'}
              </ResultField>
              <ResultField label="Completed Steps">
                {completedCount} / {selectedRun.step_results?.length ?? 0}
              </ResultField>
            </div>

            {isRunDetailsLoading && !selectedRun.step_results?.length ? (
              <Alert>
                <AlertTitle>Loading run details</AlertTitle>
                <AlertDescription>Fetching step-level request and response logs for this run.</AlertDescription>
              </Alert>
            ) : null}

            {!isRunDetailsLoading && !selectedRun.step_results?.length ? (
              <Alert>
                <AlertTitle>No step logs yet</AlertTitle>
                <AlertDescription>This run has not produced step-level logs yet.</AlertDescription>
              </Alert>
            ) : null}

            {selectedRun.step_results?.length ? (
              <div className="space-y-3">
                {selectedRun.step_results.map((result) => {
                  const isActive = activeRunStepResult?.step_id === result.step_id;
                  const stepName = stepNameById.get(result.step_id) ?? `Step #${result.step_id}`;

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
                            Step ID {result.step_id}
                            {result.error_message ? ` · ${result.error_message}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-text-muted">{result.duration_ms} ms</span>
                          <Badge variant="outline" className={getStatusBadgeClassName(result.status)}>
                            {getStatusLabel(result.status)}
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
                        {stepNameById.get(activeRunStepResult.step_id) ?? `Step #${activeRunStepResult.step_id}`}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Detailed request, response, assert results, and captured variables.
                      </p>
                    </div>
                    <Badge variant="outline" className={getStatusBadgeClassName(activeRunStepResult.status)}>
                      {getStatusLabel(activeRunStepResult.status)}
                    </Badge>
                  </div>

                  <ResultField label="Duration">{activeRunStepResult.duration_ms} ms</ResultField>
                  <ResultJsonCard title="Request" value={parseJsonString(activeRunStepResult.request)} />
                  <ResultJsonCard
                    title="Response"
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
                              ? 'No downstream step can receive parameters from this step'
                              : 'Pass response fields to another step'
                          }
                          onClick={() => setHandoffStepResult(activeRunStepResult)}
                        >
                          <Share2 className="h-4 w-4" />
                          Pass parameters
                        </Button>
                      ) : null
                    }
                  />
                  <ResultJsonCard
                    title="Assert results"
                    value={parseJsonString(activeRunStepResult.assert_results)}
                  />
                  <ResultJsonCard
                    title="Captured variables"
                    value={parseJsonString(activeRunStepResult.variables_captured)}
                  />
                  {activeRunStepResult.error_message ? (
                    <Alert>
                      <AlertTitle>Failure detail</AlertTitle>
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
            ? stepNameById.get(handoffStepResult.step_id) ?? `Step #${handoffStepResult.step_id}`
            : ''
        }
        candidates={extractFlowParameterCandidates(handoffStepResult?.response)}
        targetOptions={handoffStepResult ? getParameterTargetOptions(handoffStepResult.step_id) : []}
        onOpenChange={(open) => {
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
  onSubmit: (targetStepId: number, selections: FlowParameterSelection[]) => void;
}) {
  const [targetStepId, setTargetStepId] = useState(
    targetOptions[0]?.stepId ? String(targetOptions[0].stepId) : ''
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [variableNames, setVariableNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      candidates.map((candidate) => [candidate.id, candidate.defaultVariableName])
    )
  );

  const selectedCandidates = candidates.filter((candidate) => selectedIds.has(candidate.id));
  const selectedVariables = selectedCandidates.map((candidate) => ({
    capturePath: candidate.capturePath,
    variableName: variableNames[candidate.id]?.trim() ?? '',
  }));
  const hasInvalidVariable = selectedVariables.some(
    (selection) => !isValidFlowVariableName(selection.variableName)
  );
  const canSubmit = Boolean(targetStepId) && selectedVariables.length > 0 && !hasInvalidVariable;

  const toggleCandidate = (candidateId: string, checked: boolean) => {
    setSelectedIds((current) => {
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
          <DialogTitle>Pass parameters</DialogTitle>
          <DialogDescription>
            Select response fields from {sourceStepName || 'this step'} and expose them to a downstream step.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="handoff-target-step">Target step</Label>
              <Select value={targetStepId} onValueChange={setTargetStepId}>
                <SelectTrigger id="handoff-target-step" className="w-full">
                  <SelectValue placeholder="Select downstream step" />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((option) => (
                    <SelectItem key={option.stepId} value={String(option.stepId)}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ResultField label="Selected">{selectedCandidates.length} fields</ResultField>
          </div>

          {targetOptions.length === 0 ? (
            <Alert>
              <AlertTitle>No available target step</AlertTitle>
              <AlertDescription>
                Add another step or remove cyclic connections before passing parameters from this response.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Response path</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="min-w-[180px]">Variable</TableHead>
                  <TableHead>Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => {
                  const variableName = variableNames[candidate.id] ?? candidate.defaultVariableName;
                  const isSelected = selectedIds.has(candidate.id);
                  const isInvalid = isSelected && !isValidFlowVariableName(variableName);

                  return (
                    <TableRow key={candidate.id} data-state={isSelected ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleCandidate(candidate.id, checked === true)}
                          aria-label={`Select ${candidate.displayPath}`}
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
                          onChange={(event) =>
                            setVariableNames((current) => ({
                              ...current,
                              [candidate.id]: event.target.value,
                            }))
                          }
                          errorText={isInvalid ? 'Use letters, numbers, or underscore.' : undefined}
                          root
                        />
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-text-muted">
                        {candidate.preview || 'null'}
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
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(Number(targetStepId), selectedVariables)}
          >
            <Share2 className="h-4 w-4" />
            Apply handoff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
  projectId: number;
  selectedItemId?: number | null;
}) {
  const t = useT('project');
  const router = useRouter();
  const isMobile = useIsMobile();
  const projectQuery = useProject(projectId);
  const projectName = projectQuery.data?.name || `Project #${projectId}`;
  const memberRoleQuery = useProjectMemberRole(projectId);
  const flowListQuery = useFlows(projectId);
  const createFlowMutation = useCreateFlow(projectId);
  const deleteFlowMutation = useDeleteFlow(projectId);
  const saveFlowMutation = useSaveFlow(projectId);
  const runFlowMutation = useRunFlow(projectId);

  const [searchValue, setSearchValue] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(selectedItemId ?? null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [localRuns, setLocalRuns] = useState<FlowRun[]>([]);
  const [flowMeta, setFlowMeta] = useState({ name: '', description: '' });
  const [dirty, setDirty] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [liveStepResults, setLiveStepResults] = useState<Record<number, FlowStepResult>>({});
  const [validationState, setValidationState] = useState<FlowValidationState>(() =>
    createEmptyValidationState()
  );
  const [isLocalRunPending, setIsLocalRunPending] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<FlowCanvasNode, FlowCanvasEdge> | null>(
    null
  );
  const deferredSearch = useDeferredValue(searchValue);
  const streamAbortRef = useRef<AbortController | null>(null);
  const skipNextHydrationRef = useRef(false);
  const previousFlowIdRef = useRef<number | null>(selectedItemId ?? null);

  const [nodes, setNodes] = useState<FlowCanvasNode[]>([]);
  const [edges, setEdges] = useState<FlowCanvasEdge[]>([]);

  useEffect(() => {
    setSelectedFlowId(selectedItemId ?? null);
  }, [selectedItemId]);

  const selectedFlowQuery = useFlow(projectId, selectedFlowId ?? undefined);
  const flowRunsQuery = useFlowRuns(projectId, selectedFlowId ?? undefined);

  const backendRuns = flowRunsQuery.data?.items ?? EMPTY_RUNS;
  const runs = useMemo(() => [...localRuns, ...backendRuns], [backendRuns, localRuns]);
  const latestRun = runs[0] ?? null;
  const effectiveRunId = selectedRunId ?? latestRun?.id ?? null;
  const selectedLocalRun = effectiveRunId
    ? localRuns.find((run) => run.id === effectiveRunId) ?? null
    : null;
  const selectedRunQuery = useFlowRun(
    projectId,
    selectedFlowId ?? undefined,
    selectedLocalRun ? undefined : effectiveRunId ?? undefined
  );
  const selectedRun = selectedLocalRun ?? selectedRunQuery.data ?? latestRun;

  const canEdit = WRITE_ROLES.includes(memberRoleQuery.data?.role ?? 'read');
  const flows = flowListQuery.data?.items ?? [];
  const showFlowSidebar = isMobile || !isSidebarCollapsed;
  const filteredFlows = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) {
      return flows;
    }

    return flows.filter((flow) =>
      [flow.name, flow.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [deferredSearch, flows]);

  useEffect(() => {
    const detail = selectedFlowQuery.data;
    if (!detail) {
      return;
    }
    if (skipNextHydrationRef.current) {
      skipNextHydrationRef.current = false;
      return;
    }

    const canvasGraph = buildCanvasGraph(detail.steps, detail.edges, selectedRun, liveStepResults);
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
  }, [selectedFlowQuery.data?.updated_at]);

  useEffect(() => {
    if (!selectedFlowQuery.data) {
      return;
    }

    setNodes((current) => applyRunStateToCanvasNodes(current, selectedRun, liveStepResults));
  }, [liveStepResults, selectedFlowQuery.data, selectedRun?.id]);

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
    }
  }, [selectedFlowId]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const stepOptions = nodes.flatMap((node) =>
    node.data.backendStepId
      ? [{ id: node.data.backendStepId, name: node.data.name || `Step #${node.data.backendStepId}` }]
      : []
  );
  const selectedStepResult = selectedNode?.data.backendStepId
    ? liveStepResults[selectedNode.data.backendStepId] ??
      selectedRun?.step_results?.find((item) => item.step_id === selectedNode.data.backendStepId) ??
      null
    : null;

  const clearValidationState = () => {
    setValidationState(createEmptyValidationState());
  };

  const focusValidationTarget = (target?: FlowValidationTarget) => {
    if (!target) {
      return;
    }

    setInspectorOpen(true);
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

  const navigateToFlow = (flowId: number | null) => {
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

  const handleDeleteFlow = async (flowId: number, flowName: string) => {
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
    if (changes.some((change) => change.type !== 'select')) {
      setDirty(true);
      clearValidationState();
    }
    setNodes((current) => applyNodeChanges(changes, current));
  };

  const handleEdgesChange = (changes: EdgeChange<FlowCanvasEdge>[]) => {
    if (changes.some((change) => change.type !== 'select')) {
      setDirty(true);
      clearValidationState();
    }
    setEdges((current) => applyEdgeChanges(changes, current));
  };

  const handleNodesDelete = (deletedNodes: FlowCanvasNode[]) => {
    setEdges((current) =>
      current.filter(
        (edge) => !deletedNodes.some((node) => node.id === edge.source || node.id === edge.target)
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

    setEdges((current) => addEdge(buildEdge(connection.source!, connection.target!), current) as FlowCanvasEdge[]);
    setDirty(true);
    clearValidationState();
  };

  const handleNodeChange = (nodeId: string, patch: Partial<FlowNodeData>) => {
    setNodes((current) =>
      current.map((node) =>
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
    setEdges((current) =>
      current.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              label: buildEdgeLabel(mappings),
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

  const getParameterTargetOptions = (sourceStepId: number): FlowParameterTargetOption[] => {
    const sourceNode = nodes.find((node) => node.data.backendStepId === sourceStepId);
    if (!sourceNode) {
      return [];
    }

    return nodes
      .filter((node) => node.data.backendStepId && node.data.backendStepId !== sourceStepId)
      .filter((node) =>
        !createsCycle(nodes, edges, {
          source: sourceNode.id,
          target: node.id,
          sourceHandle: null,
          targetHandle: null,
        })
      )
      .map((node) => ({
        stepId: node.data.backendStepId!,
        name: node.data.name || `Step #${node.data.backendStepId}`,
      }));
  };

  const handlePassParameters = ({
    sourceStepId,
    targetStepId,
    selections,
  }: FlowParameterHandoffPayload) => {
    const cleanSelections = selections.filter(
      (selection) =>
        selection.capturePath.trim() && isValidFlowVariableName(selection.variableName.trim())
    );
    if (cleanSelections.length === 0) {
      return;
    }

    const sourceNode = nodes.find((node) => node.data.backendStepId === sourceStepId);
    const targetNode = nodes.find((node) => node.data.backendStepId === targetStepId);
    if (!sourceNode || !targetNode) {
      setValidationState((current) => ({
        ...current,
        message: 'Unable to pass parameters because one of the selected steps no longer exists.',
      }));
      return;
    }

    if (
      !edges.some((edge) => edge.source === sourceNode.id && edge.target === targetNode.id) &&
      createsCycle(nodes, edges, {
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle: null,
        targetHandle: null,
      })
    ) {
      setValidationState((current) => ({
        ...current,
        message: 'Unable to pass parameters because this connection would create a cycle.',
      }));
      return;
    }

    setNodes((current) =>
      current.map((node) =>
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

    setEdges((current) => {
      const existingEdge = current.find(
        (edge) => edge.source === sourceNode.id && edge.target === targetNode.id
      );
      const nextMappings = mergeVariableMappings(existingEdge?.data?.mappings ?? [], cleanSelections);

      if (existingEdge) {
        return current.map((edge) =>
          edge.id === existingEdge.id
            ? {
                ...edge,
                label: buildEdgeLabel(nextMappings),
                data: {
                  ...edge.data,
                  mappings: nextMappings,
                },
              }
            : edge
        );
      }

      return [...current, buildEdge(sourceNode.id, targetNode.id, nextMappings)];
    });

    setDirty(true);
    clearValidationState();
  };

  const handleFlowMetaChange = (key: 'name' | 'description', value: string) => {
    setFlowMeta((current) => ({
      ...current,
      [key]: value,
    }));
    setDirty(true);
    clearValidationState();
  };

  const handleSelectRunStep = (stepId: number) => {
    const node = nodes.find((item) => item.data.backendStepId === stepId);
    if (!node) {
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setInspectorOpen(true);
  };

  const handleAddStep = () => {
    if (!selectedFlowId) {
      return;
    }

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
        name: `Step ${nodes.length + 1}`,
        method: 'GET',
        url: '',
        headers: '',
        body: '',
        captures: '',
        asserts: '',
        status: 'idle',
        latestResult: null,
      },
    };

    setNodes((current) => [...current, nextNode]);
    setSelectedNodeId(nextNode.id);
    setSelectedEdgeId(null);
    setInspectorOpen(true);
    setDirty(true);
    clearValidationState();
  };

  const saveCurrentFlow = async () => {
    if (!selectedFlowId) {
      return null;
    }

    const validation = validateFlowDraft(flowMeta, nodes, edges, 'save');
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
      const mergedGraph = mergeSavedGraphIntoCanvas(nodes, edges, saved, selectedRun, liveStepResults);
      setNodes(mergedGraph.nodes);
      setEdges(mergedGraph.edges);
      setDirty(false);
      return saved;
    } catch (error) {
      setValidationState((current) => ({
        ...current,
        message:
          error instanceof Error ? error.message : 'Failed to save this flow. Review the current graph and try again.',
      }));
      return null;
    }
  };

  const finalizeRun = async (runId: number) => {
    await Promise.all([
      flowRunsQuery.refetch(),
      selectedRunQuery.refetch(),
    ]);
    setSelectedRunId(runId);
  };

  const pollRunUntilSettled = async (runId: number) => {
    if (!selectedFlowId) {
      return;
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const run = await flowService.getRun(projectId, selectedFlowId, runId);
      if (run.step_results) {
        const nextResults = Object.fromEntries(run.step_results.map((result) => [result.step_id, result]));
        setLiveStepResults(nextResults);
      }
      if (run.status !== 'pending' && run.status !== 'running') {
        await finalizeRun(runId);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  };

  const streamRun = async (runId: number) => {
    if (!selectedFlowId) {
      return;
    }

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      await flowService.streamRun(projectId, selectedFlowId, runId, {
        signal: controller.signal,
        onStep: (event) => {
          const stepResult = event.data;
          if (!stepResult) {
            return;
          }
          setLiveStepResults((current) => ({
            ...current,
            [stepResult.step_id]: stepResult,
          }));
        },
        onDone: () => {
          void finalizeRun(runId);
        },
      });
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      await pollRunUntilSettled(runId);
    }
  };

  const handleRunServer = async () => {
    if (!selectedFlowId) {
      return;
    }

    const validation = validateFlowDraft(flowMeta, nodes, edges, 'run');
    if (!validation.isValid) {
      applyValidationResult(validation);
      return;
    }

    clearValidationState();

    try {
      if (dirty) {
        const saved = await saveCurrentFlow();
        if (!saved) {
          return;
        }
      }

      setLiveStepResults({});
      const run = await runFlowMutation.mutateAsync(selectedFlowId);
      setSelectedRunId(run.id);
      await streamRun(run.id);
    } catch (error) {
      setValidationState((current) => ({
        ...current,
        message:
          error instanceof Error ? error.message : 'Failed to start this flow run. Review the current graph and try again.',
      }));
    }
  };

  const handleRunLocal = async () => {
    if (!selectedFlowId) {
      return;
    }

    const validation = validateFlowDraft(flowMeta, nodes, edges, 'run');
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
        throw new Error('Load this flow again before starting a local run.');
      }

      const runId = buildLocalRunId();
      const startedAt = new Date().toISOString();
      const localRun: FlowRun = {
        id: runId,
        flow_id: selectedFlowId,
        status: 'running',
        execution_mode: 'local',
        triggered_by: 0,
        started_at: startedAt,
        finished_at: null,
        created_at: startedAt,
        updated_at: startedAt,
        step_results: [],
      };

      const graph = buildLocalFlowExecutionGraph(savedFlow);
      setIsLocalRunPending(true);
      setSelectedRunId(runId);
      setLocalRuns((current) => [localRun, ...current.filter((run) => run.id !== runId)]);
      setLiveStepResults({});

      const completedRun = await runLocalFlow({
        flowId: selectedFlowId,
        runId,
        steps: graph.steps,
        edges: graph.edges,
        onStepEvent: (event) => {
          setLiveStepResults((current) => ({
            ...current,
            [event.step_id]: event.data,
          }));

          setLocalRuns((current) =>
            current.map((run) => {
              if (run.id !== runId) {
                return run;
              }

              const previousStepResults = run.step_results ?? [];
              const hasExistingStepResult = previousStepResults.some(
                (item) => item.step_id === event.step_id
              );
              const nextStepResults = hasExistingStepResult
                ? previousStepResults.map((item) =>
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

      setLocalRuns((current) => [
        completedRun,
        ...current.filter((run) => run.id !== runId),
      ]);
    } catch (error) {
      setValidationState((current) => ({
        ...current,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to start this local flow run. Review the current graph and try again.',
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
            <p className="text-sm leading-6 text-text-muted">
              {t('flowPage.sidebarDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isMobile ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                isIcon
                aria-label={t('flowPage.hideSidebar')}
                title={t('flowPage.hideSidebar')}
                onClick={() => setIsSidebarCollapsed(true)}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => setIsCreateOpen(true)} disabled={!canEdit}>
              <Plus className="h-4 w-4" />
              {t('flowPage.create')}
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
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
            {filteredFlows.map((flow) => (
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
                      <Badge variant="outline">{t('flowPage.stepCount', { count: flow.step_count ?? 0 })}</Badge>
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
          <p className="text-sm leading-6 text-text-muted">
            {t('flowPage.notFoundDescription')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={buildProjectFlowsRoute(projectId)}>
            {t('common.clearSelection')}
          </Link>
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-bg-surface/70 px-4 py-4 md:px-6">
        <Button type="button" variant="outline" onClick={() => void saveCurrentFlow()} disabled={!canEdit || !dirty} loading={saveFlowMutation.isPending}>
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
        <Button type="button" variant="outline" onClick={handleAddStep} disabled={!canEdit || !selectedFlowId}>
          <Plus className="h-4 w-4" />
          {t('flowPage.addStep')}
        </Button>
        <Button type="button" variant="outline" onClick={() => reactFlowInstance?.fitView({ padding: 0.16 })} disabled={!selectedFlowId}>
          {t('flowPage.fitView')}
        </Button>
        <Button type="button" variant="outline" onClick={handleRefresh} disabled={flowListQuery.isFetching || selectedFlowQuery.isFetching}>
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

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.85),rgba(248,250,252,0.98))]">
          <div className="h-full min-h-[540px] p-4 md:p-6">
            <div className="h-full overflow-hidden rounded-[32px] border border-border/60 bg-background/85 shadow-premium">
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
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                  setInspectorOpen(true);
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                  setInspectorOpen(true);
                }}
                deleteKeyCode={['Backspace', 'Delete']}
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
                <Controls />
              </ReactFlow>
            </div>
          </div>
        </div>

        <aside className="hidden w-[380px] shrink-0 border-l border-border/60 bg-bg-surface/70 xl:block">
          <div className="h-full overflow-y-auto p-4">
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
            />
          </div>
        </aside>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex h-full min-h-0 flex-col lg:flex-row lg:overflow-hidden">
        {showFlowSidebar ? flowSidebar : null}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
                {!isMobile && isSidebarCollapsed ? (
                  <Button type="button" variant="outline" onClick={() => setIsSidebarCollapsed(false)}>
                    <PanelLeft className="h-4 w-4" />
                    {t('flowPage.showSidebar')}
                  </Button>
                ) : null}
                <Button type="button" onClick={() => setIsCreateOpen(true)} disabled={!canEdit}>
                  <Plus className="h-4 w-4" />
                  {t('flowPage.newFlow')}
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">{editorContent}</div>
        </main>
      </div>

      <CreateFlowDialog
        key={isCreateOpen ? 'create-flow-open' : 'create-flow-closed'}
        open={isCreateOpen}
        isSubmitting={createFlowMutation.isPending}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateFlow}
      />

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
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </>
  );
}
