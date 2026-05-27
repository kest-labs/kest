'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, Globe, Lock, Plus, Users } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildWorkspaceApiSpecsRoute } from '@/constants/routes';
import { useCreateWorkspace, useWorkspaces } from '@/hooks/use-workspaces';
import { useT } from '@/i18n/client';
import type {
  ApiWorkspace,
  CreateWorkspaceRequest,
  WorkspaceType,
  WorkspaceVisibility,
} from '@/types/workspace';
import { cn, formatDate } from '@/utils';

const normalizeWorkspaceSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 50);

type WorkspaceFormDraft = {
  name: string;
  slug: string;
  description: string;
  type: WorkspaceType;
  visibility: WorkspaceVisibility;
};

const DEFAULT_WORKSPACE_DRAFT: WorkspaceFormDraft = {
  name: '',
  slug: '',
  description: '',
  type: 'team',
  visibility: 'private',
};

const getVisibilityIcon = (visibility: WorkspaceVisibility) => {
  switch (visibility) {
    case 'public':
      return Globe;
    case 'team':
      return Users;
    default:
      return Lock;
  }
};

export function WorkspaceDashboardPage() {
  const t = useT('project');
  const router = useRouter();
  const workspacesQuery = useWorkspaces();
  const createWorkspaceMutation = useCreateWorkspace();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const workspaces = workspacesQuery.data ?? [];
  const sortedWorkspaces = useMemo(
    () =>
      [...workspaces].sort((left, right) => (right.created_at || '').localeCompare(left.created_at || '')),
    [workspaces]
  );

  const handleOpenWorkspace = (workspaceId: string) => {
    router.push(buildWorkspaceApiSpecsRoute(workspaceId));
  };

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-bg-soft">
      <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-6 px-4 py-5 md:px-6 lg:px-10">
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border-strong bg-bg-canvas text-text-main">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-medium text-text-main">{t('workspaceDashboard.title')}</h1>
              <p className="max-w-3xl text-sm text-text-muted">{t('workspaceDashboard.description')}</p>
            </div>
          </div>

          <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>{t('workspaceDashboard.createWorkspace')}</span>
          </Button>
        </section>

        {workspacesQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('workspaceDashboard.loadFailedTitle')}</AlertTitle>
            <AlertDescription>{t('workspaceDashboard.loadFailedDescription')}</AlertDescription>
          </Alert>
        ) : null}

        {sortedWorkspaces.length === 0 && !workspacesQuery.isLoading ? (
          <Card className="rounded-lg border-border-subtle">
            <CardHeader>
              <CardTitle>{t('workspaceDashboard.emptyTitle')}</CardTitle>
              <CardDescription>{t('workspaceDashboard.emptyDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                <span>{t('workspaceDashboard.createWorkspace')}</span>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedWorkspaces.map(workspace => {
            const VisibilityIcon = getVisibilityIcon(workspace.visibility);

            return (
              <Card key={workspace.id} className="rounded-lg border-border-subtle">
                <Link
                  href={buildWorkspaceApiSpecsRoute(workspace.id)}
                  className="flex h-full flex-col"
                >
                  <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-medium text-text-main">
                          {workspace.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-text-muted">
                          {workspace.slug}
                        </CardDescription>
                      </div>
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-canvas text-text-main">
                        <VisibilityIcon className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{t(`workspaceDashboard.type.${workspace.type}`)}</Badge>
                      <Badge variant="outline">
                        {t(`workspaceDashboard.visibility.${workspace.visibility}`)}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col justify-between gap-4">
                    <p className="text-sm text-text-muted">
                      {workspace.description || t('workspaceDashboard.noWorkspaceDescription')}
                    </p>

                    <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4 text-xs text-text-muted">
                      <span>
                        {t('common.created')}: {formatDate(workspace.created_at, 'YYYY-MM-DD')}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn('px-0 text-text-main hover:bg-transparent')}
                        onClick={(event) => {
                          event.preventDefault();
                          handleOpenWorkspace(workspace.id);
                        }}
                      >
                        {t('workspaceDashboard.openWorkspace')}
                      </Button>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </section>
      </div>

      <WorkspaceCreateDialog
        open={isCreateDialogOpen}
        isSubmitting={createWorkspaceMutation.isPending}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={async payload => {
          const workspace = await createWorkspaceMutation.mutateAsync(payload);
          setIsCreateDialogOpen(false);
          router.push(buildWorkspaceApiSpecsRoute(workspace.id));
        }}
      />
    </main>
  );
}

function WorkspaceCreateDialog({
  open,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateWorkspaceRequest) => Promise<void>;
}) {
  const t = useT('project');
  const [draft, setDraft] = useState<WorkspaceFormDraft>(DEFAULT_WORKSPACE_DRAFT);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setDraft(DEFAULT_WORKSPACE_DRAFT);
      setErrors({});
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = draft.name.trim();
    const generatedSlug = normalizeWorkspaceSlug(draft.slug || draft.name);
    const nextErrors: { name?: string; slug?: string } = {};

    if (!trimmedName) {
      nextErrors.name = t('workspaceDashboard.nameRequired');
    }

    if (!generatedSlug) {
      nextErrors.slug = t('workspaceDashboard.slugRequired');
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      name: trimmedName,
      slug: generatedSlug,
      description: draft.description.trim() || undefined,
      type: draft.type,
      visibility: draft.visibility,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{t('workspaceDashboard.createDialogTitle')}</DialogTitle>
          <DialogDescription>{t('workspaceDashboard.createDialogDescription')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="workspace-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="workspace-name">{t('common.name')}</Label>
              <Input
                id="workspace-name"
                value={draft.name}
                onChange={event =>
                  setDraft(current => ({ ...current, name: event.target.value }))
                }
                placeholder={t('workspaceDashboard.namePlaceholder')}
                errorText={errors.name}
                root
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-slug">{t('workspaceDashboard.slugLabel')}</Label>
              <Input
                id="workspace-slug"
                value={draft.slug}
                onChange={event =>
                  setDraft(current => ({ ...current, slug: normalizeWorkspaceSlug(event.target.value) }))
                }
                placeholder={t('workspaceDashboard.slugPlaceholder')}
                errorText={errors.slug}
                root
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-description">{t('common.description')}</Label>
              <Textarea
                id="workspace-description"
                value={draft.description}
                onChange={event =>
                  setDraft(current => ({ ...current, description: event.target.value }))
                }
                placeholder={t('workspaceDashboard.descriptionPlaceholder')}
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="workspace-type">{t('workspaceDashboard.typeLabel')}</Label>
                <Select
                  value={draft.type}
                  onValueChange={value =>
                    setDraft(current => ({ ...current, type: value as WorkspaceType }))
                  }
                >
                  <SelectTrigger id="workspace-type" className="w-full">
                    <SelectValue placeholder={t('workspaceDashboard.typeLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">{t('workspaceDashboard.type.personal')}</SelectItem>
                    <SelectItem value="team">{t('workspaceDashboard.type.team')}</SelectItem>
                    <SelectItem value="public">{t('workspaceDashboard.type.public')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace-visibility">{t('workspaceDashboard.visibilityLabel')}</Label>
                <Select
                  value={draft.visibility}
                  onValueChange={value =>
                    setDraft(current => ({ ...current, visibility: value as WorkspaceVisibility }))
                  }
                >
                  <SelectTrigger id="workspace-visibility" className="w-full">
                    <SelectValue placeholder={t('workspaceDashboard.visibilityLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">{t('workspaceDashboard.visibility.private')}</SelectItem>
                    <SelectItem value="team">{t('workspaceDashboard.visibility.team')}</SelectItem>
                    <SelectItem value="public">{t('workspaceDashboard.visibility.public')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="workspace-form" disabled={isSubmitting}>
            {t('workspaceDashboard.createWorkspace')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
