'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Clock3,
  FileClock,
  FileJson2,
  FlaskConical,
  Globe,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tags,
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
import { useEnvironment, useEnvironments } from '@/hooks/use-environments';
import { useProject } from '@/hooks/use-projects';
import type { ApiSpec, CreateApiSpecRequest, HttpMethod } from '@/types/api-spec';
import type { ProjectEnvironment } from '@/types/environment';
import { cn, formatDate } from '@/utils';

const MAX_MODULE_ITEMS = 500;
const EMPTY_SPECS: ApiSpec[] = [];
const EMPTY_ENVIRONMENTS: ProjectEnvironment[] = [];
const SPEC_METHOD_OPTIONS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

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
      return <PlaceholderWorkspaceSection projectId={projectId} projectName={projectName} module={module} />;
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
            headerActions={
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => setIsAICreateOpen(true)}>
                  <Sparkles className="h-4 w-4" />
                  Describe with AI
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Spec
                </Button>
              </div>
            }
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void specsQuery.refetch();

                    if (selectedItemId) {
                      void selectedSpecQuery.refetch();
                    }
                  }}
                  loading={specsQuery.isFetching || selectedSpecQuery.isFetching}
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button asChild variant="outline">
                  <Link href={`${buildProjectApiSpecsRoute(projectId)}?mode=manage`}>
                    Full manager
                  </Link>
                </Button>
                <Button type="button" onClick={() => setIsAICreateOpen(true)}>
                  <Sparkles className="h-4 w-4" />
                  AI Draft
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Spec
                </Button>
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
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);

  const environmentsQuery = useEnvironments(projectId);
  const selectedEnvironmentQuery = useEnvironment(projectId, selectedItemId ?? undefined);

  const environments = environmentsQuery.data?.items ?? EMPTY_ENVIRONMENTS;
  const filteredEnvironments = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return environments;
    }

    return environments.filter((environment) =>
      [environment.name, environment.display_name || '', environment.base_url || '']
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [deferredSearch, environments]);

  const selectedEnvironmentFromList =
    environments.find((environment) => environment.id === selectedItemId) ?? null;
  const selectedEnvironment = selectedEnvironmentQuery.data ?? selectedEnvironmentFromList;

  return (
    <WorkspaceFrame
      sidebar={
        <ResourceSidebar
          module="environments"
          title="Environments"
          description="Pick an environment to inspect base URL, headers, and variables."
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
              description="Environment records will appear here once they exist."
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
            />
          ))}
        </ResourceSidebar>
      }
      content={
        <ResourceContent
          projectId={projectId}
          projectName={projectName}
          module="environments"
          currentTitle={selectedEnvironment ? selectedEnvironment.display_name || selectedEnvironment.name : 'Module guide'}
          description={
            selectedEnvironment
              ? 'Environment detail loaded from the selected project.'
              : 'Select an environment from the middle sidebar to keep the detail surface focused and uncluttered.'
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void environmentsQuery.refetch();

                  if (selectedItemId) {
                    void selectedEnvironmentQuery.refetch();
                  }
                }}
                loading={environmentsQuery.isFetching || selectedEnvironmentQuery.isFetching}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button asChild variant="outline">
                <Link href={`${buildProjectEnvironmentsRoute(projectId)}?mode=manage`}>
                  Full manager
                </Link>
              </Button>
            </>
          }
        >
          {selectedItemId && selectedEnvironmentQuery.isLoading ? (
            <DetailSkeleton />
          ) : selectedItemId && !selectedEnvironment ? (
            <MissingDetailState
              moduleLabel="environment"
              clearHref={buildProjectEnvironmentsRoute(projectId)}
            />
          ) : !selectedEnvironment ? (
            <GuideState
              icon={Globe}
              title="Choose an environment"
              description="No environment detail is shown until you select a concrete item from the second sidebar."
              actionHref={`${buildProjectEnvironmentsRoute(projectId)}?mode=manage`}
              actionLabel="Manage environments"
            />
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
        </ResourceContent>
      }
    />
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void categoriesQuery.refetch();

                  if (selectedItemId) {
                    void selectedCategoryQuery.refetch();
                  }
                }}
                loading={categoriesQuery.isFetching || selectedCategoryQuery.isFetching}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button asChild variant="outline">
                <Link href={`${buildProjectCategoriesRoute(projectId)}?mode=manage`}>
                  Full manager
                </Link>
              </Button>
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
  indentLevel = 0,
}: {
  href: string;
  active: boolean;
  title: string;
  description: string;
  meta?: React.ReactNode;
  indentLevel?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'block rounded-2xl border px-4 py-3 transition-colors',
        active
          ? 'border-primary/30 bg-primary/10 shadow-sm'
          : 'border-transparent bg-background/70 hover:border-border/60 hover:bg-background'
      )}
      style={{ marginLeft: indentLevel > 0 ? `${indentLevel * 12}px` : undefined }}
    >
      <p className="truncate text-sm font-medium text-text-main">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">{description}</p>
      {meta ? <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">{meta}</div> : null}
    </Link>
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
