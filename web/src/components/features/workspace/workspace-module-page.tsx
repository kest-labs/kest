'use client';

import Link from 'next/link';
import { AlertCircle, Boxes, ChevronRight, RefreshCcw } from 'lucide-react';
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
import { getProjectModuleCopy } from '@/components/features/project/project-i18n';
import { useWorkspace } from '@/hooks/use-workspaces';
import { useT } from '@/i18n/client';
import { formatDate } from '@/utils';
import { buildWorkspaceDashboardRoute } from '@/constants/routes';
import {
  buildWorkspaceRoute,
  getWorkspaceModuleMeta,
  type WorkspaceModule,
} from './workspace-navigation';

export function WorkspaceModulePage({
  workspaceId,
  module,
}: {
  workspaceId: string;
  module: WorkspaceModule;
}) {
  const t = useT('project');
  const workspaceQuery = useWorkspace(workspaceId);
  const moduleMeta = getWorkspaceModuleMeta(module);
  const moduleLabel = getProjectModuleCopy(t, moduleMeta.i18nKey, 'label');
  const moduleDescription = getProjectModuleCopy(t, moduleMeta.i18nKey, 'description');
  const workspace = workspaceQuery.data;
  const Icon = moduleMeta.icon;

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-bg-soft">
      <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-6 px-4 py-5 md:px-6 lg:px-10">
        <div className="space-y-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={buildWorkspaceDashboardRoute()}>{t('common.workspaces')}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{workspace?.name || workspaceId}</BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{moduleLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border-strong bg-bg-canvas text-text-main">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-medium text-text-main">{moduleLabel}</h1>
                <p className="max-w-3xl text-sm text-text-muted">{moduleDescription}</p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void workspaceQuery.refetch();
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              <span>{t('common.refresh')}</span>
            </Button>
          </div>
        </div>

        {workspaceQuery.isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('workspaceDashboard.loadWorkspaceFailedTitle')}</AlertTitle>
            <AlertDescription>{t('workspaceDashboard.loadWorkspaceFailedDescription')}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          <Card className="rounded-lg border-border-subtle">
            <CardHeader>
              <CardTitle>{t('workspaceDashboard.routeReadyTitle')}</CardTitle>
              <CardDescription>{t('workspaceDashboard.routeReadyDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border-subtle bg-bg-canvas p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-text-main">
                  <Boxes className="h-4 w-4" />
                  <span>{workspace?.name || t('workspaceDashboard.loadingWorkspace')}</span>
                </div>
                <div className="mt-2 text-sm text-text-muted">
                  {workspace?.description || t('workspaceDashboard.noWorkspaceDescription')}
                </div>
              </div>

              <Alert>
                <AlertTitle>{t('workspaceDashboard.nextStageTitle')}</AlertTitle>
                <AlertDescription>{t('workspaceDashboard.nextStageDescription')}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-border-subtle">
            <CardHeader>
              <CardTitle>{t('workspaceDashboard.workspaceSnapshotTitle')}</CardTitle>
              <CardDescription>{t('workspaceDashboard.workspaceSnapshotDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label={t('common.workspace')} value={workspace?.name || workspaceId} />
              <DetailRow label="Slug" value={workspace?.slug || t('common.notSet')} />
              <DetailRow
                label={t('workspaceDashboard.typeLabel')}
                value={workspace ? t(`workspaceDashboard.type.${workspace.type}`) : t('common.notSet')}
              />
              <DetailRow
                label={t('workspaceDashboard.visibilityLabel')}
                value={
                  workspace ? t(`workspaceDashboard.visibility.${workspace.visibility}`) : t('common.notSet')
                }
              />
              <DetailRow
                label={t('common.created')}
                value={workspace?.created_at ? formatDate(workspace.created_at, 'YYYY-MM-DD HH:mm') : t('common.notSet')}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="outline">{moduleLabel}</Badge>
                <Badge variant="outline">{workspace?.type ? t(`workspaceDashboard.type.${workspace.type}`) : t('workspaceDashboard.loadingBadge')}</Badge>
              </div>
              <div className="pt-2">
                <Button asChild variant="outline" className="w-full justify-center">
                  <Link href={buildWorkspaceRoute(workspaceId, 'api-specs')}>
                    {t('workspaceDashboard.returnToDefaultModule')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-3 last:border-b-0 last:pb-0">
      <span className="text-text-muted">{label}</span>
      <span className="text-right text-text-main">{value}</span>
    </div>
  );
}
