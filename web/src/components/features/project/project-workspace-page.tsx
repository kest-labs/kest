'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  ArrowRight,
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
import {
  ActionMenu,
  type ActionMenuItem,
} from '@/components/features/project/action-menu';
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
import {
  PROJECT_MEMBER_WRITE_ROLES,
  type ProjectMemberRole,
} from '@/types/member';
import { cn, formatDate } from '@/utils';

const MAX_MODULE_ITEMS = 500;
const EMPTY_SPECS: ApiSpec[] = [];
const EMPTY_ENVIRONMENTS: ProjectEnvironment[] = [];
const EMPTY_HISTORIES: ProjectHistory[] = [];
const SPEC_METHOD_OPTIONS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const WRITE_ROLES = PROJECT_MEMBER_WRITE_ROLES;

const buildModuleHref = (
  projectId: number,
  module: ProjectWorkspaceModule,
  itemId?: number | null
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
  label: string
) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedValue);
  } catch {
    throw new Error(`${label} must be a valid JSON object.`);
  }

  if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed as T;
};

const toStringRecord = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)])
  ) as Record<string, string>;

const getEnvironmentFormDraft = (environment?: ProjectEnvironment | null): EnvironmentFormDraft => ({
  name: environment?.name ?? '',
  displayName: environment?.display_name ?? '',
  baseUrl: environment?.base_url ?? '',
  variables:
    environment?.variables === undefined ? '' : JSON.stringify(environment.variables, null, 2),
  headers:
    environment?.headers === undefined ? '' : JSON.stringify(environment.headers, null, 2),
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
  const [draft, setDraft] = useState<EnvironmentFormDraft>(() => getEnvironmentFormDraft(environment));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateDraft = <K extends keyof EnvironmentFormDraft>(
    key: K,
    value: EnvironmentFormDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const trimmedName = draft.name.trim();
    let variables: Record<string, unknown> | undefined;
    let headers: Record<string, string> | undefined;

    if (!trimmedName) {
      nextErrors.name = 'Environment name is required.';
    }

    try {
      variables = parseObjectJsonInput<Record<string, unknown>>(draft.variables, 'Variables');
    } catch (error) {
      nextErrors.variables = error instanceof Error ? error.message : 'Unable to parse variables.';
    }

    try {
      const parsedHeaders = parseObjectJsonInput<Record<string, unknown>>(draft.headers, 'Headers');
      headers = parsedHeaders ? toStringRecord(parsedHeaders) : undefined;
    } catch (error) {
      nextErrors.headers = error instanceof Error ? error.message : 'Unable to parse headers.';
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
          <DialogTitle>{mode === 'create' ? 'Create Environment' : 'Edit Environment'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a project-scoped environment with base URL, variables, and headers.'
              : 'Update the selected project-scoped environment.'}
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
              <AlertTitle>Unable to load environment details</AlertTitle>
              <AlertDescription>
                The selected environment details are not available yet. Close this dialog and try again.
              </AlertDescription>
            </Alert>
          ) : (
            <form id="environment-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="environment-name">Name</Label>
                  <Input
                    id="environment-name"
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                    placeholder="production"
                    errorText={errors.name}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment-display-name">Display Name</Label>
                  <Input
                    id="environment-display-name"
                    value={draft.displayName}
                    onChange={(event) => updateDraft('displayName', event.target.value)}
                    placeholder="Production"
                    root
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="environment-base-url">Base URL</Label>
                <Input
                  id="environment-base-url"
                  value={draft.baseUrl}
                  onChange={(event) => updateDraft('baseUrl', event.target.value)}
                  placeholder="https://api.example.com"
                  root
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="environment-variables">Variables JSON</Label>
                  <Textarea
                    id="environment-variables"
                    value={draft.variables}
                    onChange={(event) => updateDraft('variables', event.target.value)}
                    rows={14}
                    placeholder='{"API_URL":"https://api.example.com"}'
                    errorText={errors.variables}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment-headers">Headers JSON</Label>
                  <Textarea
                    id="environment-headers"
                    value={draft.headers}
                    onChange={(event) => updateDraft('headers', event.target.value)}
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
            Cancel
          </Button>
          <Button
            type="submit"
            form="environment-form"
            loading={isSubmitting}
            disabled={(mode === 'edit' && (isLoadingEnvironment || !environment)) || isSubmitting}
          >
            {mode === 'create' ? 'Create Environment' : 'Save Changes'}
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Delete Environment</DialogTitle>
          <DialogDescription>
            This permanently removes {environment ? `"${environment.name}"` : 'the selected environment'}.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert variant="destructive">
            <AlertTitle>Irreversible action</AlertTitle>
            <AlertDescription>
              The environment will be deleted immediately and cannot be restored.
            </AlertDescription>
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={isDeleting} onClick={() => void onConfirm()}>
            Delete Environment
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
      nextErrors.name = 'New environment name is required.';
    }

    try {
      overrideVars = parseObjectJsonInput<Record<string, unknown>>(
        draft.overrideVars,
        'Override variables'
      );
    } catch (error) {
      nextErrors.overrideVars =
        error instanceof Error ? error.message : 'Unable to parse override variables.';
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
          <DialogTitle>Duplicate Environment</DialogTitle>
          <DialogDescription>
            Create a new environment from the selected one and optionally override variables.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="environment-duplicate-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="duplicate-environment-name">New Environment Name</Label>
              <Input
                id="duplicate-environment-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="staging-copy"
                errorText={errors.name}
                root
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duplicate-environment-override-vars">Override Variables JSON</Label>
              <Textarea
                id="duplicate-environment-override-vars"
                value={draft.overrideVars}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, overrideVars: event.target.value }))
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
            Cancel
          </Button>
          <Button type="submit" form="environment-duplicate-form" loading={isSubmitting}>
            Duplicate Environment
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
}: {
  projectId: number;
  module: ProjectWorkspaceModule;
  selectedItemId?: number | null;
  autoOpenAICreate?: boolean;
}) {
  const projectQuery = useProject(projectId);
  const projectName = projectQuery.data?.name || `Project #${projectId}`;

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
          projectId={projectId}
          projectName={projectName}
          selectedItemId={selectedItemId}
        />
      );
    case 'flows':
      return <PlaceholderWorkspaceSection projectId={projectId} projectName={projectName} module={module} />;
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
  projectId: number;
  projectName: string;
  selectedItemId?: number | null;
  autoOpenAICreate?: boolean;
}) {
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

    return specs.filter((spec) =>
      [spec.method, spec.path, spec.summary, spec.description, spec.version]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSearch, specs]);

  const selectedSpecFromList = specs.find((spec) => spec.id === selectedItemId) ?? null;
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
        selectedItemId ? buildModuleHref(projectId, 'api-specs', selectedItemId) : buildProjectApiSpecsRoute(projectId)
      );
    }
  };

  const moduleActionItems: ActionMenuItem[] = [
    {
      key: 'api-specs-manager',
      label: 'Open full manager',
      icon: FileJson2,
      href: fullManagerHref,
    },
    {
      key: 'api-specs-refresh',
      label: isRefreshing ? 'Refreshing...' : 'Refresh',
      icon: RefreshCw,
      disabled: isRefreshing,
      onSelect: handleRefresh,
    },
    {
      key: 'api-specs-ai-draft',
      label: 'AI Draft',
      icon: Sparkles,
      onSelect: () => setIsAICreateOpen(true),
    },
    {
      key: 'api-specs-create',
      label: 'Add Spec',
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
            title="API Specs"
            description="Select a spec to load its details into the content area."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Filter API specs"
            count={filteredSpecs.length}
            loading={specsQuery.isLoading}
            error={specsQuery.error}
            emptyState={
              <SidebarEmptyState
                icon={FileJson2}
                title="No API specs"
                description="Start with an AI draft or create the first spec manually."
              />
            }
          >
            {filteredSpecs.map((spec) => (
              <ResourceListItem
                key={spec.id}
                href={buildModuleHref(projectId, 'api-specs', spec.id)}
                active={spec.id === selectedSpec?.id}
                title={`${spec.method} ${spec.path}`}
                description={spec.summary || spec.description || 'No summary provided'}
                meta={
                  <>
                    <Badge variant="outline">{spec.version}</Badge>
                    <span>{spec.examples?.length ?? 0} examples</span>
                  </>
                }
                actionsMenu={
                  <ActionMenu
                    items={[
                      {
                        key: `spec-open-${spec.id}`,
                        label: 'Open',
                        icon: ArrowRight,
                        href: buildModuleHref(projectId, 'api-specs', spec.id),
                      },
                      {
                        key: `spec-manager-${spec.id}`,
                        label: 'Open in full manager',
                        icon: FileJson2,
                        href: `${fullManagerHref}&item=${spec.id}`,
                      },
                    ]}
                    ariaLabel={`Open actions for ${spec.method} ${spec.path}`}
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
            currentTitle={selectedSpec ? `${selectedSpec.method} ${selectedSpec.path}` : 'Module guide'}
            description={
              selectedSpec
                ? 'Spec detail loaded from the current project-scoped API.'
                : 'API Specs is the default project workspace module. Choose a spec in the middle sidebar to inspect its content.'
            }
            actions={
              <>
                <Button type="button" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Spec
                </Button>
                <ActionMenu
                  items={moduleActionItems}
                  ariaLabel="Open API spec workspace actions"
                  triggerVariant="outline"
                />
              </>
            }
          >
            {selectedItemId && selectedSpecQuery.isLoading ? (
              <DetailSkeleton />
            ) : selectedItemId && !selectedSpec ? (
              <MissingDetailState moduleLabel="API spec" clearHref={buildProjectApiSpecsRoute(projectId)} />
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
                          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            {selectedSpec.method}
                          </Badge>
                          <Badge variant="outline">{selectedSpec.version}</Badge>
                          {selectedSpec.is_public ? <Badge>Public</Badge> : <Badge variant="secondary">Private</Badge>}
                        </div>
                        <div>
                          <CardTitle className="text-2xl tracking-tight">{selectedSpec.path}</CardTitle>
                          <CardDescription className="mt-2 max-w-4xl leading-6">
                            {selectedSpec.summary || selectedSpec.description || 'No description provided for this spec.'}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <InfoBadge label="Category" value={selectedSpec.category_id ? `#${selectedSpec.category_id}` : 'Unassigned'} />
                        <InfoBadge label="Examples" value={selectedSpec.examples?.length ?? 0} />
                        <InfoBadge label="Responses" value={Object.keys(selectedSpec.responses || {}).length} />
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle>Spec summary</CardTitle>
                      <CardDescription>Core metadata for the selected API spec.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <DetailField label="Created">{formatDate(selectedSpec.created_at, 'YYYY-MM-DD HH:mm')}</DetailField>
                      <DetailField label="Updated">{formatDate(selectedSpec.updated_at, 'YYYY-MM-DD HH:mm')}</DetailField>
                      <DetailField label="Request parameters">
                        {selectedSpec.parameters?.length ?? 0}
                      </DetailField>
                      <DetailField label="Request body">
                        {selectedSpec.request_body ? 'Available' : 'Not defined'}
                      </DetailField>
                      <DetailField label="Doc source">{selectedSpec.doc_source || 'Unknown'}</DetailField>
                      <DetailField label="Tags">
                        {selectedSpec.tags.length > 0 ? selectedSpec.tags.join(', ') : 'No tags'}
                      </DetailField>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle>Documentation snapshot</CardTitle>
                      <CardDescription>
                        Latest markdown fragment stored for this API spec.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {docPreview ? (
                        <pre className="max-h-[420px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
                          {docPreview}
                        </pre>
                      ) : (
                        <GuideState
                          icon={Clock3}
                          title="Documentation not generated"
                          description="No markdown documentation is attached to the selected spec yet."
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <JsonCard title="Request body schema" value={selectedSpec.request_body} />
                  <JsonCard title="Responses" value={selectedSpec.responses} />
                  <JsonCard title="Parameters" value={selectedSpec.parameters} />
                  <JsonCard title="Examples" value={selectedSpec.examples} />
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
        onCreateDraft={(payload) => createAIDraftMutation.mutateAsync(payload)}
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

function CollectionsWorkspaceSection({
  projectId,
}: {
  projectId: number;
}) {
  return <ApiRequestWorkbench projectId={projectId} />;
}

function EnvironmentsWorkspaceSection({
  projectId,
  projectName,
  selectedItemId,
}: {
  projectId: number;
  projectName: string;
  selectedItemId?: number | null;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [formMode, setFormMode] = useState<EnvironmentFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectEnvironment | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectEnvironment | null>(null);
  const [suppressedSelectedEnvironmentId, setSuppressedSelectedEnvironmentId] = useState<number | null>(
    null
  );
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

    return environments.filter((environment) =>
      [environment.name, environment.display_name || '', environment.base_url || '']
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [normalizedSearch, environments]);

  const selectedEnvironmentFromList =
    environments.find((environment) => environment.id === effectiveSelectedItemId) ?? null;
  const selectedEnvironment = selectedEnvironmentQuery.data ?? selectedEnvironmentFromList;
  const currentRole = memberRoleQuery.data?.role;
  const canWrite = currentRole ? WRITE_ROLES.includes(currentRole) : false;
  const totalEnvironments =
    environmentsQuery.data?.total ?? projectStatsQuery.data?.environment_count ?? environments.length;
  const withBaseUrlCount = environments.filter((environment) => Boolean(environment.base_url?.trim())).length;
  const withVariablesCount = environments.filter(
    (environment) => Object.keys(environment.variables || {}).length > 0
  ).length;
  const withHeadersCount = environments.filter(
    (environment) => Object.keys(environment.headers || {}).length > 0
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

  const openEditDialog = (environmentId: number) => {
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
      label: isRefreshing ? 'Refreshing...' : 'Refresh',
      icon: RefreshCw,
      disabled: isRefreshing,
      onSelect: () => void handleRefresh(),
    },
    {
      key: 'environments-api-specs',
      label: 'API Specs',
      icon: FileJson2,
      href: buildProjectApiSpecsRoute(projectId),
      separatorBefore: selectedEnvironment ? true : undefined,
    },
    {
      key: 'environments-categories',
      label: 'Categories',
      icon: Tags,
      href: buildProjectCategoriesRoute(projectId),
    },
    {
      key: 'environments-test-cases',
      label: 'Test Cases',
      icon: FlaskConical,
      href: buildProjectTestCasesRoute(projectId),
    },
  ];

  if (selectedEnvironment) {
    workspaceActionItems.splice(1, 0, {
      key: 'environments-duplicate',
      label: 'Duplicate',
      icon: Boxes,
      disabled: !canWrite,
      onSelect: () => setDuplicateTarget(selectedEnvironment),
    });
    workspaceActionItems.splice(2, 0, {
      key: 'environments-delete',
      label: 'Delete',
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
            title="Environments"
            description="Pick an environment to inspect and manage base URL, headers, and variables."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Filter environments"
            count={filteredEnvironments.length}
            loading={environmentsQuery.isLoading}
            error={environmentsQuery.error}
            emptyState={
              <SidebarEmptyState
                icon={Globe}
                title="No environments"
                description="Create the first environment to define project-scoped runtime settings."
              />
            }
          >
            {filteredEnvironments.map((environment) => (
              <ResourceListItem
                key={environment.id}
                href={buildModuleHref(projectId, 'environments', environment.id)}
                active={environment.id === selectedEnvironment?.id}
                title={environment.display_name || environment.name}
                description={environment.base_url || 'Base URL not configured'}
                meta={
                  <>
                    <span>{Object.keys(environment.variables || {}).length} vars</span>
                    <span>{Object.keys(environment.headers || {}).length} headers</span>
                  </>
                }
                actionsMenu={
                  <ActionMenu
                    items={[
                      {
                        key: `environment-open-${environment.id}`,
                        label: 'Open',
                        icon: ArrowRight,
                        href: buildModuleHref(projectId, 'environments', environment.id),
                      },
                      {
                        key: `environment-edit-${environment.id}`,
                        label: 'Edit',
                        icon: Pencil,
                        disabled: !canWrite,
                        onSelect: () => openEditDialog(environment.id),
                      },
                      {
                        key: `environment-duplicate-${environment.id}`,
                        label: 'Duplicate',
                        icon: Boxes,
                        disabled: !canWrite,
                        onSelect: () => setDuplicateTarget(environment),
                      },
                      {
                        key: `environment-delete-${environment.id}`,
                        label: 'Delete',
                        icon: Trash2,
                        destructive: true,
                        disabled: !canWrite,
                        onSelect: () => setDeleteTarget(environment),
                      },
                    ]}
                    ariaLabel={`Open actions for ${environment.name}`}
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
                : 'Environment workspace'
            }
            description={
              selectedEnvironment
                ? 'Environment detail loaded from the selected project.'
                : 'Create project-scoped environments here, or pick one from the sidebar to inspect and edit it.'
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
                    Edit
                  </Button>
                ) : null}
                <Button type="button" onClick={openCreateDialog} disabled={!canWrite}>
                  <Plus className="h-4 w-4" />
                  Create Environment
                </Button>
                <ActionMenu
                  items={workspaceActionItems}
                  ariaLabel="Open environment workspace actions"
                  triggerVariant="outline"
                />
              </>
            }
          >
            <div className="space-y-6">
              {!canWrite && memberRoleQuery.isSuccess ? (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Read-only access</AlertTitle>
                  <AlertDescription>
                    Your current role is <strong>{getRoleLabel(currentRole)}</strong>. You can inspect
                    environments, but create, edit, duplicate, and delete actions are disabled.
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
                    title="Total environments"
                    value={totalEnvironments}
                    description="All project-scoped environment records"
                    icon={Globe}
                    variant="primary"
                  />
                  <StatCard
                    title="With base URL"
                    value={withBaseUrlCount}
                    description="Environments ready to target a concrete host"
                    icon={ShieldCheck}
                    variant="success"
                  />
                  <StatCard
                    title="With variables"
                    value={withVariablesCount}
                    description="Environments carrying variables payload"
                    icon={Boxes}
                    variant="warning"
                  />
                  <StatCard
                    title="With headers"
                    value={withHeadersCount}
                    description={
                      normalizedSearch
                        ? `Search filtered by "${normalizedSearch}"`
                        : 'Environments carrying request headers'
                    }
                    icon={Tags}
                  />
                </div>
              )}

              {effectiveSelectedItemId && selectedEnvironmentQuery.isLoading ? (
                <DetailSkeleton />
              ) : effectiveSelectedItemId && !selectedEnvironment ? (
                <MissingDetailState
                  moduleLabel="environment"
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
                        <p className="text-lg font-semibold text-text-main">No environments yet</p>
                        <p className="max-w-2xl text-sm leading-6 text-text-muted">
                          Create the first project environment to store base URLs, reusable headers, and
                          variables for your requests and tests.
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        <Button type="button" onClick={openCreateDialog} disabled={!canWrite}>
                          <Plus className="h-4 w-4" />
                          Create Environment
                        </Button>
                        <Button asChild variant="outline">
                          <Link href={buildProjectApiSpecsRoute(projectId)}>
                            Open API Specs
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    <Card className="border-border/60">
                      <CardHeader>
                        <CardTitle>Environment overview</CardTitle>
                        <CardDescription>
                          The old standalone manager is collapsed into this content area. Choose an
                          environment from the sidebar, or create a new one from here.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-3">
                        <Button type="button" onClick={openCreateDialog} disabled={!canWrite}>
                          <Plus className="h-4 w-4" />
                          Create Environment
                        </Button>
                        <Button asChild variant="outline">
                          <Link href={buildProjectTestCasesRoute(projectId)}>
                            Open Test Cases
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>

                    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                      <Card className="border-border/60">
                        <CardHeader>
                          <CardTitle>
                            {normalizedSearch ? 'Matching environments' : 'Available environments'}
                          </CardTitle>
                          <CardDescription>
                            Quick links for the environments currently visible in the sidebar.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {listPreview.length === 0 ? (
                            <GuideState
                              icon={Globe}
                              title="No matching environments"
                              description="Try a broader search term or clear the current filter."
                            />
                          ) : (
                            listPreview.map((environment) => (
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
                                      {environment.base_url || 'Base URL not configured'}
                                    </p>
                                  </div>
                                  <Badge variant="outline">{environment.name}</Badge>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
                                  <span>{Object.keys(environment.variables || {}).length} vars</span>
                                  <span>{Object.keys(environment.headers || {}).length} headers</span>
                                  <span>{formatDate(environment.updated_at, 'YYYY-MM-DD HH:mm')}</span>
                                </div>
                              </Link>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-border/60">
                        <CardHeader>
                          <CardTitle>Environment API surface</CardTitle>
                          <CardDescription>
                            Project-scoped endpoints used by this workspace for environment CRUD.
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
                            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                              Environment
                            </Badge>
                            <Badge variant="outline">{selectedEnvironment.name}</Badge>
                          </div>
                          <div>
                            <CardTitle className="text-2xl tracking-tight">
                              {selectedEnvironment.display_name || selectedEnvironment.name}
                            </CardTitle>
                            <CardDescription className="mt-2">
                              {selectedEnvironment.base_url || 'Base URL is not configured yet.'}
                            </CardDescription>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <InfoBadge
                            label="Variables"
                            value={Object.keys(selectedEnvironment.variables || {}).length}
                          />
                          <InfoBadge
                            label="Headers"
                            value={Object.keys(selectedEnvironment.headers || {}).length}
                          />
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <Card className="border-border/60">
                      <CardHeader>
                        <CardTitle>Environment metadata</CardTitle>
                        <CardDescription>Core identity and timestamps for this environment.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <DetailField label="System name">{selectedEnvironment.name}</DetailField>
                        <DetailField label="Display name">
                          {selectedEnvironment.display_name || 'Not set'}
                        </DetailField>
                        <DetailField label="Created">
                          {formatDate(selectedEnvironment.created_at, 'YYYY-MM-DD HH:mm')}
                        </DetailField>
                        <DetailField label="Updated">
                          {formatDate(selectedEnvironment.updated_at, 'YYYY-MM-DD HH:mm')}
                        </DetailField>
                      </CardContent>
                    </Card>

                    <JsonCard title="Headers" value={selectedEnvironment.headers} />
                  </div>

                  <JsonCard title="Variables" value={selectedEnvironment.variables} />
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
        environment={formMode === 'edit' ? editingEnvironmentQuery.data ?? null : null}
        isLoadingEnvironment={formMode === 'edit' && editingEnvironmentQuery.isLoading}
        isSubmitting={createEnvironmentMutation.isPending || updateEnvironmentMutation.isPending}
        onOpenChange={(open) => {
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
        onOpenChange={(open) => {
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
        onOpenChange={(open) => {
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
  projectId: number;
  projectName: string;
  selectedItemId?: number | null;
}) {
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

    return flatCategories.filter((category) =>
      [category.name, category.description || '', category.parent_name || '']
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSearch, flatCategories]);

  const selectedCategoryFromList =
    flatCategories.find((category) => category.id === selectedItemId) ?? null;
  const selectedCategory = selectedCategoryQuery.data ?? selectedCategoryFromList;
  const selectedCategoryTreeNode = findProjectCategory(categoriesQuery.data?.items, selectedCategory?.id);
  const childCategories = selectedCategoryTreeNode?.children ?? [];
  const fullManagerHref = `${buildProjectCategoriesRoute(projectId)}?mode=manage`;
  const refreshActionItems: ActionMenuItem[] = [
    {
      key: 'categories-refresh',
      label: categoriesQuery.isFetching || selectedCategoryQuery.isFetching ? 'Refreshing...' : 'Refresh',
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
          title="Categories"
          description="Use the second sidebar to browse the category hierarchy."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Filter categories"
          count={filteredCategories.length}
          loading={categoriesQuery.isLoading}
          error={categoriesQuery.error}
          emptyState={
            <SidebarEmptyState
              icon={Tags}
              title="No categories"
              description="Categories will appear here once the project taxonomy is created."
            />
          }
        >
          {filteredCategories.map((category) => (
            <ResourceListItem
              key={category.id}
              href={buildModuleHref(projectId, 'categories', category.id)}
              active={category.id === selectedCategory?.id}
              title={category.name}
              description={category.description || 'No description provided'}
              indentLevel={Math.min(category.depth, 4)}
              meta={
                <>
                  <span>Order {category.sort_order}</span>
                  {category.test_cases_count ? <span>{category.test_cases_count} tests</span> : null}
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
          currentTitle={selectedCategory ? selectedCategory.name : 'Module guide'}
          description={
            selectedCategory
              ? 'Category detail loaded from the selected project taxonomy.'
              : 'Select a category to inspect hierarchy and metadata.'
          }
          actions={
            <>
              <Button asChild variant="outline">
                <Link href={fullManagerHref}>
                  Full manager
                </Link>
              </Button>
              <ActionMenu
                items={refreshActionItems}
                ariaLabel="Open category workspace actions"
                triggerVariant="outline"
              />
            </>
          }
        >
          {selectedItemId && selectedCategoryQuery.isLoading ? (
            <DetailSkeleton />
          ) : selectedItemId && !selectedCategory ? (
            <MissingDetailState moduleLabel="category" clearHref={buildProjectCategoriesRoute(projectId)} />
          ) : !selectedCategory ? (
            <GuideState
              icon={Tags}
              title="Choose a category"
              description="Categories only render in the content area after a concrete category is selected."
              actionHref={`${buildProjectCategoriesRoute(projectId)}?mode=manage`}
              actionLabel="Manage categories"
            />
          ) : (
            <div className="space-y-6">
              <Card className="border-border/60">
                <CardHeader>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          Category
                        </Badge>
                        {selectedCategory.parent_id ? (
                          <Badge variant="outline">Parent #{selectedCategory.parent_id}</Badge>
                        ) : (
                          <Badge variant="secondary">Root</Badge>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-2xl tracking-tight">{selectedCategory.name}</CardTitle>
                        <CardDescription className="mt-2 max-w-3xl leading-6">
                          {selectedCategory.description || 'No description has been written for this category yet.'}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <InfoBadge label="Children" value={childCategories.length} />
                      <InfoBadge label="Sort order" value={selectedCategory.sort_order} />
                      <InfoBadge label="Tests" value={selectedCategory.test_cases_count ?? 0} />
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle>Category metadata</CardTitle>
                    <CardDescription>Hierarchy, timestamps, and linkages for this node.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <DetailField label="Parent">
                      {selectedCategory.parent_name || (selectedCategory.parent_id ? `#${selectedCategory.parent_id}` : 'Root category')}
                    </DetailField>
                    <DetailField label="Created">
                      {formatDate(selectedCategory.created_at, 'YYYY-MM-DD HH:mm')}
                    </DetailField>
                    <DetailField label="Updated">
                      {formatDate(selectedCategory.updated_at, 'YYYY-MM-DD HH:mm')}
                    </DetailField>
                    <DetailField label="Project ID">{selectedCategory.project_id}</DetailField>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle>Child categories</CardTitle>
                    <CardDescription>Direct descendants of the selected category.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {childCategories.length === 0 ? (
                      <GuideState
                        icon={Layers3}
                        title="No child categories"
                        description="This category currently acts as a leaf node in the project hierarchy."
                      />
                    ) : (
                      childCategories.map((child) => (
                        <div
                          key={child.id}
                          className="rounded-2xl border border-border/60 bg-background/70 p-4"
                        >
                          <p className="text-sm font-medium">{child.name}</p>
                          <p className="mt-1 text-xs text-text-muted">
                            {child.description || 'No description provided'}
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
}: {
  projectId: number;
  projectName: string;
  selectedItemId?: number | null;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const deferredSearch = useDeferredValue(searchQuery);

  const historiesQuery = useProjectHistories({
    projectId,
    page: 1,
    pageSize: MAX_MODULE_ITEMS,
    entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
  });
  const selectedHistoryQuery = useProjectHistory(projectId, selectedItemId ?? undefined);

  const histories = historiesQuery.data?.items ?? EMPTY_HISTORIES;
  const entityTypeOptions = useMemo(
    () => Array.from(new Set(histories.map((history) => history.entity_type).filter(Boolean))).sort(),
    [histories]
  );
  const filteredHistories = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return histories;
    }

    return histories.filter((history) =>
      [
        history.message || '',
        history.action,
        history.entity_type,
        String(history.id),
        String(history.entity_id),
        String(history.user_id),
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSearch, histories]);

  const selectedHistoryFromList = histories.find((history) => history.id === selectedItemId) ?? null;
  const selectedHistory = selectedHistoryQuery.data ?? selectedHistoryFromList;
  const isFiltered = entityTypeFilter !== 'all' || deferredSearch.trim().length > 0;
  const refreshActionItems: ActionMenuItem[] = [
    {
      key: 'histories-refresh',
      label: historiesQuery.isFetching || selectedHistoryQuery.isFetching ? 'Refreshing...' : 'Refresh',
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
          title="History"
          description="Inspect persisted project activity, entity snapshots, and recorded diffs."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search history"
          count={filteredHistories.length}
          loading={historiesQuery.isLoading}
          error={historiesQuery.error}
          headerActions={
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entity types</SelectItem>
                {entityTypeOptions.map((entityType) => (
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
              title={isFiltered ? 'No matching history' : 'No history yet'}
              description={
                isFiltered
                  ? 'Try a different keyword or entity type filter.'
                  : 'History records will appear here once project activity is being recorded.'
              }
            />
          }
        >
          {filteredHistories.map((history) => (
            <ResourceListItem
              key={history.id}
              href={buildModuleHref(projectId, 'histories', history.id)}
              active={history.id === selectedHistory?.id}
              title={`${history.entity_type} #${history.entity_id}`}
              description={
                history.message ||
                `${history.action} recorded for ${history.entity_type} #${history.entity_id}`
              }
              meta={
                <>
                  <Badge variant="outline">{history.action}</Badge>
                  <span>User #{history.user_id}</span>
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
            selectedHistory
              ? `${selectedHistory.entity_type} #${selectedHistory.entity_id}`
              : 'Project history'
          }
          description={
            selectedHistory
              ? 'History detail loaded from the selected project-scoped record.'
              : 'Select a history record in the sidebar to inspect its snapshot and recorded diff.'
          }
          actions={
            <ActionMenu
              items={refreshActionItems}
              ariaLabel="Open history workspace actions"
              triggerVariant="outline"
            />
          }
        >
          {selectedItemId && selectedHistoryQuery.isLoading ? (
            <DetailSkeleton />
          ) : selectedItemId && !selectedHistory ? (
            <MissingDetailState
              moduleLabel="history record"
              clearHref={buildProjectHistoriesRoute(projectId)}
            />
          ) : historiesQuery.isLoading ? (
            <DetailSkeleton />
          ) : histories.length === 0 ? (
            <GuideState
              icon={FileClock}
              title={isFiltered ? 'No matching history record' : 'No history recorded'}
              description={
                isFiltered
                  ? 'No history records matched the current filters. Clear the filter or try a broader search.'
                  : 'This project does not have any persisted history records yet.'
              }
            />
          ) : !selectedHistory ? (
            <GuideState
              icon={FileClock}
              title="Choose a history record"
              description="The content area stays focused on a single history record. Pick one from the sidebar to inspect the stored snapshot and diff."
            />
          ) : (
            <div className="space-y-6">
              <Card className="border-border/60">
                <CardHeader>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          {selectedHistory.entity_type}
                        </Badge>
                        <Badge variant="outline">{selectedHistory.action}</Badge>
                        <Badge variant="secondary">Record #{selectedHistory.id}</Badge>
                      </div>
                      <div>
                        <CardTitle className="text-2xl tracking-tight">
                          {selectedHistory.entity_type} #{selectedHistory.entity_id}
                        </CardTitle>
                        <CardDescription className="mt-2 max-w-4xl leading-6">
                          {selectedHistory.message || 'No message was recorded for this history entry.'}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <InfoBadge label="User" value={`#${selectedHistory.user_id}`} />
                      <InfoBadge
                        label="Created"
                        value={formatDate(selectedHistory.created_at, 'YYYY-MM-DD HH:mm')}
                      />
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle>History metadata</CardTitle>
                    <CardDescription>Core fields captured for the selected history record.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <DetailField label="Record ID">{selectedHistory.id}</DetailField>
                    <DetailField label="Project ID">{selectedHistory.project_id}</DetailField>
                    <DetailField label="Entity type">{selectedHistory.entity_type}</DetailField>
                    <DetailField label="Entity ID">{selectedHistory.entity_id}</DetailField>
                    <DetailField label="Action">{selectedHistory.action}</DetailField>
                    <DetailField label="User ID">{selectedHistory.user_id}</DetailField>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle>Recorded note</CardTitle>
                    <CardDescription>Optional message attached to this history entry.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm leading-6 text-text-muted">
                      {selectedHistory.message || 'No message recorded.'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <JsonCard title="Snapshot data" value={selectedHistory.data} />
                <JsonCard title="Diff" value={selectedHistory.diff} />
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
  projectId: number;
  projectName: string;
  module: ProjectWorkspaceModule;
}) {
  const moduleMeta = getProjectWorkspaceModuleMeta(module);
  const Icon = moduleMeta.icon;
  const isHistoryModule = module === 'histories';

  return (
    <WorkspaceFrame
      sidebar={
        <ResourceSidebar
          module={module}
          title={moduleMeta.label}
          description={moduleMeta.description}
          count={0}
          loading={false}
          error={null}
          emptyState={
            <SidebarEmptyState
              icon={moduleMeta.icon}
              title={`${moduleMeta.label} placeholder`}
              description={`The ${moduleMeta.label.toLowerCase()} integration is not wired yet, so the second sidebar intentionally stays empty.`}
            />
          }
        />
      }
      content={
        <ResourceContent
          projectId={projectId}
          projectName={projectName}
          module={module}
          currentTitle={`${moduleMeta.label} placeholder`}
          description={`The new information architecture already includes ${moduleMeta.label.toLowerCase()}, even though the API layer is still pending.`}
          actions={
            isHistoryModule ? (
              <Button asChild variant="outline">
                <Link href={buildProjectTestCasesRoute(projectId)}>
                  Open legacy test cases
                </Link>
              </Button>
            ) : null
          }
        >
          <GuideState
            icon={Icon}
            title={`${moduleMeta.label} is not connected yet`}
            description={
              isHistoryModule
                ? 'History data is not mounted in the current frontend. Until that lands, the existing test case route remains accessible as a legacy operational surface.'
                : 'This module is intentionally scaffolded as a placeholder so the workspace hierarchy is complete before backend support arrives.'
            }
            actionHref={isHistoryModule ? buildProjectTestCasesRoute(projectId) : undefined}
            actionLabel={isHistoryModule ? 'Open legacy test cases' : undefined}
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
  const moduleMeta = getProjectWorkspaceModuleMeta(module);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-border/60 bg-bg-surface/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                {moduleMeta.shortLabel}
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
              onChange={(event) => onSearchChange(event.target.value)}
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
            <AlertTitle>Unable to load module list</AlertTitle>
            <AlertDescription>
              The second sidebar could not load its project-scoped items.
            </AlertDescription>
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
          {meta ? <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">{meta}</div> : null}
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
  projectId: number;
  projectName: string;
  module: ProjectWorkspaceModule;
  currentTitle: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const moduleMeta = getProjectWorkspaceModuleMeta(module);

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="space-y-4 border-b border-border/60 bg-bg-surface/70 px-4 py-4 md:px-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/project">Projects</Link>
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
              <BreadcrumbPage>{moduleMeta.label}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                {moduleMeta.label}
              </Badge>
              <p className="text-sm text-text-muted">Content area</p>
            </div>
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
            <Link href={actionHref}>
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
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
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-6 py-8">
        <div className="flex flex-col items-start gap-4 rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-semibold tracking-tight text-text-main">
              Describe the API, let AI draft the spec
            </p>
            <p className="max-w-3xl text-sm leading-6 text-text-muted">
              Keep the primary flow simple: describe the endpoint in plain language, review the draft,
              then create the formal spec and move straight into generated test cases.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={onOpenAICreate}>
              <Sparkles className="h-4 w-4" />
              Describe with AI
            </Button>
            <Button type="button" variant="outline" onClick={onOpenManualCreate}>
              <Plus className="h-4 w-4" />
              Add Spec Manually
            </Button>
            <Button asChild variant="ghost">
              <Link href={managerHref}>
                Full manager
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
            <p className="text-sm font-semibold text-text-main">1. Capture intent</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Start from a sentence, method, and path instead of a long manual form.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
            <p className="text-sm font-semibold text-text-main">2. Review the draft</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              AI uses project conventions to propose parameters, request body, and responses.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
            <p className="text-sm font-semibold text-text-main">3. Move into testing</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Once the spec exists, switch to test cases and generate coverage from the same source of truth.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link href={testCasesHref}>
                Open Test Cases
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
  return (
    <GuideState
      icon={FileClock}
      title={`${moduleLabel} not found`}
      description={`The selected ${moduleLabel} could not be resolved. It may have been removed or the current item id is no longer valid.`}
      actionHref={clearHref}
      actionLabel="Clear selection"
    />
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-text-main">{children}</p>
    </div>
  );
}

function InfoBadge({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm">
      <span className="text-text-muted">{label}: </span>
      <span className="font-medium text-text-main">{value}</span>
    </div>
  );
}

function JsonCard({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[420px] overflow-auto rounded-2xl border border-border/60 bg-background/80 p-4 text-xs leading-6 text-text-muted">
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
    .map((tag) => tag.trim())
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
  const [draft, setDraft] = useState<CreateApiSpecDraft>(() => getCreateApiSpecDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateDraft = <K extends keyof CreateApiSpecDraft>(
    key: K,
    value: CreateApiSpecDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPath = draft.path.trim();
    const trimmedVersion = draft.version.trim();
    const trimmedSummary = draft.summary.trim();
    const trimmedDescription = draft.description.trim();
    const nextErrors: Record<string, string> = {};

    if (!trimmedPath) {
      nextErrors.path = 'Path is required.';
    }

    if (!trimmedVersion) {
      nextErrors.version = 'Version is required.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      method: draft.method,
      path: trimmedPath,
      version: trimmedVersion,
      category_id: draft.categoryId ? Number(draft.categoryId) : undefined,
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
        <DialogTitle>Create API Spec</DialogTitle>
        <DialogDescription>
          Add a new API spec directly from the workspace sidebar without leaving the current layout.
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <form id="create-api-spec-form" className="space-y-5 py-1" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-spec-method">Method</Label>
              <Select
                value={draft.method}
                onValueChange={(value) => updateDraft('method', value as HttpMethod)}
              >
                <SelectTrigger id="workspace-spec-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEC_METHOD_OPTIONS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="workspace-spec-path">Path</Label>
              <Input
                id="workspace-spec-path"
                value={draft.path}
                onChange={(event) => updateDraft('path', event.target.value)}
                placeholder="/api/v1/orders"
                errorText={errors.path}
                root
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-spec-version">Version</Label>
              <Input
                id="workspace-spec-version"
                value={draft.version}
                onChange={(event) => updateDraft('version', event.target.value)}
                placeholder="1.0.0"
                errorText={errors.version}
                root
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workspace-spec-category">Category</Label>
              <Select
                value={draft.categoryId || 'none'}
                onValueChange={(value) => updateDraft('categoryId', value === 'none' ? '' : value)}
              >
                <SelectTrigger id="workspace-spec-category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-spec-tags">Tags</Label>
              <Input
                id="workspace-spec-tags"
                value={draft.tags}
                onChange={(event) => updateDraft('tags', event.target.value)}
                placeholder="auth, user, public"
                root
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-spec-summary">Summary</Label>
            <Input
              id="workspace-spec-summary"
              value={draft.summary}
              onChange={(event) => updateDraft('summary', event.target.value)}
              placeholder="Short summary of the endpoint"
              root
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-spec-description">Description</Label>
            <Textarea
              id="workspace-spec-description"
              value={draft.description}
              onChange={(event) => updateDraft('description', event.target.value)}
              placeholder="Describe the purpose and constraints of this API."
              rows={6}
              root
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="workspace-spec-public">Public spec</Label>
              <p className="text-xs text-text-muted">
                Control whether this spec is exposed as a public-facing definition.
              </p>
            </div>
            <Switch
              id="workspace-spec-public"
              checked={draft.isPublic}
              onCheckedChange={(checked) => updateDraft('isPublic', checked)}
            />
          </div>
        </form>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" form="create-api-spec-form" loading={isSubmitting}>
          Create Spec
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
