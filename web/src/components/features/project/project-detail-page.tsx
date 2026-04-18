'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  FileJson2,
  FlaskConical,
  FolderKanban,
  FolderOpen,
  Globe,
  Key,
  Layers3,
  Pencil,
  ShieldCheck,
  Sparkles,
  Tags,
  Terminal,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DeleteProjectDialog,
  type ProjectFormMode,
  ProjectFormDialog,
  ProjectStatusBadge,
  resolvePlatformLabel,
} from '@/components/features/project/project-shared';
import { StatCard, StatCardSkeleton } from '@/components/features/console/dashboard-stats';
import { apiExternalBaseUrl, buildApiPath } from '@/config/api';
import {
  buildProjectApiSpecsRoute,
  buildProjectCategoriesRoute,
  buildProjectCollectionsRoute,
  buildProjectEnvironmentsRoute,
  buildProjectMembersRoute,
  buildProjectTestCasesRoute,
  ROUTES,
} from '@/constants/routes';
import {
  useDeleteProject,
  useGenerateProjectCliToken,
  useProject,
  useProjectStats,
  useUpdateProject,
} from '@/hooks/use-projects';
import type {
  ApiProject,
  GenerateProjectCliTokenResponse,
  UpdateProjectRequest,
} from '@/types/project';
import { formatDate } from '@/utils';

/**
 * 项目详情页。
 * 作用：
 * 1. 承载单个项目的详情信息和 Project Stats
 * 2. 提供编辑、删除和跳转到环境页、API 规格页、测试用例页的入口
 * 3. 替代列表页原来的 `Selected Project` 侧边面板
 */
export function ProjectDetailPage({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [formMode, setFormMode] = useState<ProjectFormMode>('edit');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiProject | null>(null);
  const [generatedCliToken, setGeneratedCliToken] =
    useState<GenerateProjectCliTokenResponse | null>(null);

  const projectQuery = useProject(projectId);
  const projectStatsQuery = useProjectStats(projectId);
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const generateCliTokenMutation = useGenerateProjectCliToken();

  const project = projectQuery.data;
  const projectStats = projectStatsQuery.data;
  const cliPlatformUrl = (apiExternalBaseUrl || buildApiPath('/')).replace(/\/$/, '');
  const cliConfigCommand =
    generatedCliToken && project
      ? [
          'kest sync config \\',
          `  --platform-url '${cliPlatformUrl}' \\`,
          `  --platform-token '${generatedCliToken.token}' \\`,
          `  --project-id '${project.id}'`,
        ].join('\n')
      : '';

  // 项目详情页只支持编辑已有记录，因此固定进入 edit 模式。
  const openEditDialog = () => {
    if (!project) {
      return;
    }

    setFormMode('edit');
    setIsFormOpen(true);
  };

  // 详情页的表单只承担 PATCH 更新，不复用创建逻辑。
  const handleProjectSubmit = async (payload: UpdateProjectRequest) => {
    if (!project) {
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        id: project.id,
        data: payload,
      });
      setIsFormOpen(false);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  // 删除成功后直接返回项目列表，避免停留在已经失效的详情地址。
  const handleDeleteProject = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteProjectMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      router.replace(ROUTES.CONSOLE.PROJECTS);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleCopyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleGenerateCliToken = async () => {
    if (!project) {
      return;
    }

    try {
      const token = await generateCliTokenMutation.mutateAsync({
        id: project.id,
        data: {
          name: `${project.name} CLI sync`,
          scopes: ['spec:write'],
        },
      });
      setGeneratedCliToken(token);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  return (
    <>
      <main className="h-full min-h-0 overflow-y-auto">
        <div className="space-y-8 p-6 pt-6">
          <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-linear-to-r from-primary/10 via-cyan-500/5 to-transparent p-6 transition-colors duration-500">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0xOCAxOGgyNHYyNEgxOHoiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-50" />
            <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-3">
                <Button
                  asChild
                  variant="link"
                  className="h-auto px-0 text-sm text-muted-foreground"
                >
                  <Link href={ROUTES.CONSOLE.PROJECTS}>
                    <ArrowLeft className="h-4 w-4" />
                    Back to Projects
                  </Link>
                </Button>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">
                      {project?.name || `Project #${projectId}`}
                    </h1>
                    <FolderKanban className="h-6 w-6 text-primary" />
                  </div>
                  <p className="max-w-3xl text-sm text-text-muted">
                    Use this overview to understand the project scope, decide the next module to
                    enter, and keep sync and validation tasks tied to the same workspace.
                  </p>
                </div>

                {project ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <ProjectStatusBadge status={project.status} />
                    <Badge variant="outline">{resolvePlatformLabel(project.platform)}</Badge>
                    <Badge variant="outline" className="font-mono">
                      {project.slug}
                    </Badge>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => void projectQuery.refetch()}>
                  Refresh Detail
                </Button>
                <Button type="button" asChild>
                  <Link href={`${buildProjectApiSpecsRoute(projectId)}?ai=create`}>
                    <Sparkles className="h-4 w-4" />
                    AI Draft API
                  </Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={buildProjectCollectionsRoute(projectId)}>
                    <FolderOpen className="h-4 w-4" />
                    Collections
                  </Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={buildProjectEnvironmentsRoute(projectId)}>
                    <Globe className="h-4 w-4" />
                    Environments
                  </Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={buildProjectCategoriesRoute(projectId)}>
                    <Tags className="h-4 w-4" />
                    Categories
                  </Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={buildProjectMembersRoute(projectId)}>
                    <Users className="h-4 w-4" />
                    Members
                  </Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={buildProjectTestCasesRoute(projectId)}>
                    <FlaskConical className="h-4 w-4" />
                    Test Cases
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openEditDialog}
                  disabled={!project}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Project
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(project || null)}
                  disabled={!project}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Project
                </Button>
              </div>
            </div>
          </div>

          {projectQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : projectStats ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="API Specs"
                value={projectStats.api_spec_count}
                description="Specifications connected to this project"
                icon={FileJson2}
                variant="primary"
              />
              <StatCard
                title="Categories"
                value={projectStats.category_count}
                description="Grouping structure available in this project"
                icon={Tags}
                variant="success"
              />
              <StatCard
                title="Environments"
                value={projectStats.environment_count}
                description="Configured runtime environments"
                icon={Layers3}
                variant="warning"
              />
              <StatCard
                title="Members"
                value={projectStats.member_count}
                description="Team members with project access"
                icon={Users}
              />
            </div>
          ) : (
            <Alert>
              <AlertTitle>Stats unavailable</AlertTitle>
              <AlertDescription>
                Project stats could not be loaded from GET /v1/projects/:id/stats.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/50 shadow-premium">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle>Project Overview</CardTitle>
                <CardDescription>
                  Keep the project anchored around a simple operating sequence instead of exposing
                  internal wiring.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 pt-6">
                {!project ? (
                  <Alert>
                    <AlertTitle>Project not found</AlertTitle>
                    <AlertDescription>
                      The selected project could not be loaded. Check the project ID or your access.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="rounded-2xl border border-primary/10 bg-linear-to-br from-primary/10 via-transparent to-white p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-semibold">{project.name}</h2>
                            <ProjectStatusBadge status={project.status} />
                            <Badge variant="outline">
                              {resolvePlatformLabel(project.platform)}
                            </Badge>
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">{project.slug}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={buildProjectCollectionsRoute(project.id)}>
                              <FolderOpen className="h-3.5 w-3.5" />
                              Open Collections
                            </Link>
                          </Button>
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={buildProjectEnvironmentsRoute(project.id)}>
                              <Globe className="h-3.5 w-3.5" />
                              Open Environments
                            </Link>
                          </Button>
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={buildProjectCategoriesRoute(project.id)}>
                              <Tags className="h-3.5 w-3.5" />
                              Open Categories
                            </Link>
                          </Button>
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={buildProjectMembersRoute(project.id)}>
                              <Users className="h-3.5 w-3.5" />
                              Open Members
                            </Link>
                          </Button>
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={`${buildProjectApiSpecsRoute(project.id)}?ai=create`}>
                              <Sparkles className="h-3.5 w-3.5" />
                              AI Draft API
                            </Link>
                          </Button>
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={buildProjectTestCasesRoute(project.id)}>
                              <FlaskConical className="h-3.5 w-3.5" />
                              Open Test Cases
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Project ID
                        </div>
                        <div className="mt-2 font-mono text-sm">{project.id}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Platform
                        </div>
                        <div className="mt-2 text-sm">{resolvePlatformLabel(project.platform)}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Created At
                        </div>
                        <div className="mt-2 text-sm">
                          {formatDate(project.created_at, 'YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-3">
                      <div className="rounded-xl border bg-muted/20 p-4">
                        <div className="mb-2 text-sm font-medium text-text-main">
                          1. Define the surface
                        </div>
                        <p className="text-sm leading-6 text-text-muted">
                          Start in API Specs with AI draft so the interface inventory becomes
                          structured quickly.
                        </p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-4">
                        <div className="mb-2 text-sm font-medium text-text-main">
                          2. Prepare runtime context
                        </div>
                        <p className="text-sm leading-6 text-text-muted">
                          Use Collections for request drafts and Environments for base URLs,
                          headers, and variables.
                        </p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-4">
                        <div className="mb-2 text-sm font-medium text-text-main">
                          3. Move into validation
                        </div>
                        <p className="text-sm leading-6 text-text-muted">
                          Generate or maintain Test Cases after the spec and runtime baseline are
                          reliable.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/50 shadow-premium">
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle>Project Stats</CardTitle>
                  <CardDescription>
                    A compact health snapshot for the project surface and team footprint.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-6">
                  {projectStatsQuery.isLoading ? (
                    <div className="space-y-3">
                      <div className="h-20 animate-pulse rounded-xl bg-muted" />
                      <div className="h-20 animate-pulse rounded-xl bg-muted" />
                      <div className="h-20 animate-pulse rounded-xl bg-muted" />
                    </div>
                  ) : projectStats ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            API Specs
                          </div>
                          <div className="mt-2 text-2xl font-semibold">
                            {projectStats.api_spec_count}
                          </div>
                        </div>
                        <div className="rounded-xl border p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Categories
                          </div>
                          <div className="mt-2 text-2xl font-semibold">
                            {projectStats.category_count}
                          </div>
                        </div>
                        <div className="rounded-xl border p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Environments
                          </div>
                          <div className="mt-2 text-2xl font-semibold">
                            {projectStats.environment_count}
                          </div>
                        </div>
                        <div className="rounded-xl border p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Members
                          </div>
                          <div className="mt-2 text-2xl font-semibold">
                            {projectStats.member_count}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                          <ShieldCheck className="h-4 w-4" />
                          Usage Snapshot
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div>
                            Categories:{' '}
                            <span className="font-medium text-foreground">
                              {projectStats.category_count}
                            </span>
                          </div>
                          <div>
                            API specs per member:{' '}
                            <span className="font-medium text-foreground">
                              {projectStats.member_count > 0
                                ? (projectStats.api_spec_count / projectStats.member_count).toFixed(
                                    1
                                  )
                                : '0.0'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <Alert>
                      <AlertTitle>Stats unavailable</AlertTitle>
                      <AlertDescription>
                        The backend did not return project stats for this record.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-premium">
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle>CLI Sync</CardTitle>
                  <CardDescription>
                    Generate a project-scoped CLI token and wire `kest sync` to this workspace.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Platform URL
                      </div>
                      <div className="mt-2 break-all font-mono text-xs">{cliPlatformUrl}</div>
                    </div>
                    <div className="rounded-xl border p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Project Scope
                      </div>
                      <div className="mt-2 font-mono text-sm">{project?.id ?? projectId}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => void handleGenerateCliToken()}
                      disabled={!project || generateCliTokenMutation.isPending}
                    >
                      <Key className="h-4 w-4" />
                      {generateCliTokenMutation.isPending ? 'Generating...' : 'Generate CLI Token'}
                    </Button>
                    {generatedCliToken ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleCopyText(cliConfigCommand, 'Copied sync command')}
                      >
                        <Terminal className="h-4 w-4" />
                        Copy Sync Command
                      </Button>
                    ) : null}
                  </div>

                  {generatedCliToken ? (
                    <Alert>
                      <AlertTitle>Copy this token now</AlertTitle>
                      <AlertDescription className="space-y-4">
                        <p>
                          This is the only time the full CLI token will be shown. It is scoped to
                          this project.
                        </p>

                        <div className="rounded-xl border bg-background p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              CLI Token
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void handleCopyText(generatedCliToken.token, 'Copied CLI token')
                              }
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </Button>
                          </div>
                          <code className="block break-all text-xs">{generatedCliToken.token}</code>
                        </div>

                        <div className="rounded-xl border bg-background p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              Setup Command
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void handleCopyText(cliConfigCommand, 'Copied sync command')
                              }
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </Button>
                          </div>
                          <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                            {cliConfigCommand}
                          </pre>
                        </div>

                        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                          <div>
                            Token prefix:{' '}
                            <span className="font-mono text-foreground">
                              {generatedCliToken.token_info.token_prefix}
                            </span>
                          </div>
                          <div>
                            Scopes:{' '}
                            <span className="font-mono text-foreground">
                              {generatedCliToken.token_info.scopes.join(', ')}
                            </span>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <AlertTitle>Recommended CLI flow</AlertTitle>
                      <AlertDescription>
                        Generate a token here, then run `kest sync config` once in your project. The
                        CLI writes `platform_url`, `platform_token`, and `platform_project_id` into
                        `.kest/config.yaml`.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <ProjectFormDialog
        key={`${formMode}-${project?.id ?? projectId}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        project={project}
        isSubmitting={updateProjectMutation.isPending}
        onOpenChange={setIsFormOpen}
        onSubmit={payload => handleProjectSubmit(payload as UpdateProjectRequest)}
      />

      <DeleteProjectDialog
        open={Boolean(deleteTarget)}
        project={deleteTarget}
        isDeleting={deleteProjectMutation.isPending}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDeleteProject}
      />
    </>
  );
}

export default ProjectDetailPage;
