'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { buildWorkspaceApiSpecsRoute } from '@/constants/routes';
import { useT } from '@/i18n/client';
import type {
  ApiWorkspace,
  CreateWorkspaceRequest,
  WorkspacePlatform,
  WorkspaceStatus,
  UpdateWorkspaceRequest,
} from '@/types/workspace';

// 工作区平台选项。
// 作用：统一维护工作区表单可选的平台枚举与展示文案。
export const PLATFORM_OPTIONS: Array<{ value: WorkspacePlatform; label: string }> = [
  { value: 'go', label: 'Go' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'csharp', label: 'C#' },
];

export type WorkspaceFormMode = 'create' | 'edit';

interface WorkspaceFormDraft {
  name: string;
  slug: string;
  platform: string;
  status: `${WorkspaceStatus}`;
}

// 工作区表单默认值生成器。
// 作用：根据传入工作区生成创建/编辑弹窗的初始草稿。
const getDefaultDraft = (workspace?: ApiWorkspace | null): WorkspaceFormDraft => ({
  name: workspace?.name ?? '',
  slug: workspace?.slug ?? '',
  platform: workspace?.platform ?? '',
  status: String(workspace?.status ?? 1) as `${WorkspaceStatus}`,
});

export const resolvePlatformLabel = (platform: string) =>
  PLATFORM_OPTIONS.find(option => option.value === platform)?.label || '';

export function WorkspaceRestrictedAccessState({
  workspaceId,
  title,
  description,
}: {
  workspaceId: number | string;
  title: string;
  description: string;
}) {
  const t = useT('workspace');

  return (
    <main className="min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto">
      <div className="p-4 md:p-6">
        <Alert className="max-w-2xl">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>
            <p>{description}</p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link href={buildWorkspaceApiSpecsRoute(workspaceId)}>
                  {t('modules.apiSpecs.label')}
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

// 工作区状态文案解析器。
// 作用：把数字状态转换成界面可读的标签文本。
const resolveStatusLabel = (status: number, activeLabel: string, inactiveLabel: string) =>
  status === 1 ? activeLabel : inactiveLabel;

/**
 * 工作区状态徽章。
 * 作用：统一展示工作区启用/停用状态，避免多个页面各自维护文案与颜色。
 */
export function WorkspaceStatusBadge({ status }: { status: WorkspaceStatus }) {
  const t = useT('workspace');
  return (
    <Badge variant={status === 1 ? 'default' : 'secondary'}>
      {resolveStatusLabel(status, t('workspaceForm.active'), t('workspaceForm.inactive'))}
    </Badge>
  );
}

/**
 * 工作区表单弹窗。
 * 作用：
 * 1. 在创建模式下收集新工作区字段，调用 `POST /v1/workspaces`
 * 2. 在编辑模式下修改已有工作区字段，调用 `PATCH /v1/workspaces/:id`
 */
export function WorkspaceFormDialog({
  open,
  mode,
  workspace,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: WorkspaceFormMode;
  workspace?: ApiWorkspace | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateWorkspaceRequest | UpdateWorkspaceRequest) => Promise<void>;
}) {
  const formKey = `${mode}-${workspace?.id ?? 'new'}-${open ? 'open' : 'closed'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WorkspaceFormDialogBody
        key={formKey}
        mode={mode}
        workspace={workspace}
        isSubmitting={isSubmitting}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}

function WorkspaceFormDialogBody({
  mode,
  workspace,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  mode: WorkspaceFormMode;
  workspace?: ApiWorkspace | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateWorkspaceRequest | UpdateWorkspaceRequest) => Promise<void>;
}) {
  const t = useT('workspace');
  const [draft, setDraft] = useState<WorkspaceFormDraft>(() => getDefaultDraft(workspace));
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: { name?: string; slug?: string } = {};
    const trimmedName = draft.name.trim();
    const trimmedSlug = draft.slug.trim();

    if (!trimmedName) {
      nextErrors.name = t('workspaceForm.workspaceNameRequired');
    }

    if (trimmedSlug.length > 50) {
      nextErrors.slug = t('workspaceForm.slugTooLong');
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (mode === 'create') {
      await onSubmit({
        name: trimmedName,
        slug: trimmedSlug || undefined,
        platform: (draft.platform || undefined) as WorkspacePlatform | undefined,
      });
      return;
    }

    await onSubmit({
      name: trimmedName,
      platform: (draft.platform || undefined) as WorkspacePlatform | undefined,
      status: Number(draft.status) as WorkspaceStatus,
    });
  };

  return (
    <DialogContent size="default">
      <DialogHeader>
        <DialogTitle>
          {mode === 'create' ? t('workspaceForm.createTitle') : t('workspaceForm.editTitle')}
        </DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? t('workspaceForm.createDescription')
            : t('workspaceForm.editDescription')}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <form id="workspace-form" onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">{t('workspaceForm.nameLabel')}</Label>
            <Input
              id="workspace-name"
              value={draft.name}
              onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
              placeholder={t('workspaceForm.namePlaceholder')}
              errorText={errors.name}
              root
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-slug">{t('workspaceForm.slugLabel')}</Label>
            <Input
              id="workspace-slug"
              value={draft.slug}
              onChange={event => setDraft(current => ({ ...current, slug: event.target.value }))}
              placeholder={mode === 'create' ? t('workspaceForm.slugPlaceholder') : ''}
              readOnly={mode === 'edit'}
              disabled={mode === 'edit'}
              errorText={errors.slug}
              root
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-platform">{t('workspaceForm.platformLabel')}</Label>
            <Select
              value={draft.platform || 'none'}
              onValueChange={value =>
                setDraft(current => ({ ...current, platform: value === 'none' ? '' : value }))
              }
            >
              <SelectTrigger id="workspace-platform" className="w-full">
                <SelectValue placeholder={t('workspaceForm.selectPlatform')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('workspaceForm.notSet')}</SelectItem>
                {PLATFORM_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'edit' ? (
            <div className="space-y-2">
              <Label htmlFor="workspace-status">{t('workspaceForm.statusLabel')}</Label>
              <Select
                value={draft.status}
                onValueChange={value =>
                  setDraft(current => ({ ...current, status: value as `${WorkspaceStatus}` }))
                }
              >
                <SelectTrigger id="workspace-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('workspaceForm.active')}</SelectItem>
                  <SelectItem value="0">{t('workspaceForm.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </form>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form="workspace-form" loading={isSubmitting}>
          {mode === 'create' ? t('workspaceForm.createButton') : t('workspaceForm.saveButton')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * 工作区删除确认弹窗。
 * 作用：
 * 1. 明确提示用户删除是不可逆操作
 * 2. 在用户确认后触发 `DELETE /v1/workspaces/:id`
 */
export function DeleteWorkspaceDialog({
  open,
  workspace,
  isDeleting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  workspace?: ApiWorkspace | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT('workspace');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('workspaceForm.deleteTitle')}</DialogTitle>
          <DialogDescription>
            {workspace
              ? t('workspaceForm.deleteDescriptionWithName', { name: workspace.name })
              : t('workspaceForm.deleteDescriptionFallback')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Alert variant="destructive">
            <AlertTitle>{t('workspaceForm.deleteWarningTitle')}</AlertTitle>
            <AlertDescription>{t('workspaceForm.deleteWarningDescription')}</AlertDescription>
          </Alert>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={isDeleting}
            onClick={() => void onConfirm()}
          >
            {t('workspaceForm.deleteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
