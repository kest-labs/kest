import { CheckCircle2, CircleEllipsis, PlayCircle, Wrench, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import { cn } from '@/utils';

export type WorkspaceHomeStatusTone = 'ready' | 'setup' | 'available' | 'optional';

type WorkspaceT = ScopedTranslations<'workspace'>;

const STATUS_ICON_BY_TONE: Record<WorkspaceHomeStatusTone, LucideIcon> = {
  ready: CheckCircle2,
  setup: Wrench,
  available: PlayCircle,
  optional: CircleEllipsis,
};

export const getWorkspaceHomeStatusLabel = (t: WorkspaceT, tone: WorkspaceHomeStatusTone) => {
  switch (tone) {
    case 'ready':
      return t('homeStatus.ready');
    case 'setup':
      return t('homeStatus.setup');
    case 'available':
      return t('homeStatus.available');
    case 'optional':
      return t('homeStatus.optional');
    default:
      return t('homeStatus.setup');
  }
};

export const getWorkspaceHomeStatusBadgeClassName = (tone: WorkspaceHomeStatusTone) => {
  switch (tone) {
    case 'ready':
      return 'border-border-strong bg-[var(--miro-surface-yellow)] text-[var(--miro-yellow-dark)]';
    case 'available':
      return 'border-border-subtle bg-bg-surface text-text-main';
    case 'optional':
      return 'border-border-subtle bg-bg-subtle text-text-main';
    default:
      return 'border-border-subtle bg-bg-surface text-text-main';
  }
};

export const getWorkspaceHomeStatusAccentClassName = (tone: WorkspaceHomeStatusTone) => {
  switch (tone) {
    case 'ready':
      return 'border border-border-strong bg-[var(--miro-surface-yellow)] text-[var(--miro-yellow-dark)]';
    case 'available':
      return 'border border-border-subtle bg-bg-surface text-text-main';
    case 'optional':
      return 'border border-border-subtle bg-bg-subtle text-text-main';
    default:
      return 'border border-border-subtle bg-bg-surface text-text-main';
  }
};

export const getWorkspaceHomeStatusIcon = (tone: WorkspaceHomeStatusTone) => STATUS_ICON_BY_TONE[tone];

function WorkspaceHomeStatusIcon({
  tone,
  className,
}: {
  tone: WorkspaceHomeStatusTone;
  className?: string;
}) {
  switch (tone) {
    case 'ready':
      return <CheckCircle2 className={className} />;
    case 'available':
      return <PlayCircle className={className} />;
    case 'optional':
      return <CircleEllipsis className={className} />;
    default:
      return <Wrench className={className} />;
  }
}

export function WorkspaceHomeStatusBadge({
  tone,
  className,
}: {
  tone: WorkspaceHomeStatusTone;
  className?: string;
}) {
  const t = useT('workspace');

  return (
    <Badge variant="outline" className={cn(getWorkspaceHomeStatusBadgeClassName(tone), className)}>
      <WorkspaceHomeStatusIcon tone={tone} className="h-3.5 w-3.5" />
      {getWorkspaceHomeStatusLabel(t, tone)}
    </Badge>
  );
}
