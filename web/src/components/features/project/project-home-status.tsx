import { CheckCircle2, CircleEllipsis, PlayCircle, Wrench, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import { cn } from '@/utils';

export type ProjectHomeStatusTone = 'ready' | 'setup' | 'available' | 'optional';

type ProjectT = ScopedTranslations<'project'>;

const STATUS_ICON_BY_TONE: Record<ProjectHomeStatusTone, LucideIcon> = {
  ready: CheckCircle2,
  setup: Wrench,
  available: PlayCircle,
  optional: CircleEllipsis,
};

export const getProjectHomeStatusLabel = (t: ProjectT, tone: ProjectHomeStatusTone) => {
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

export const getProjectHomeStatusBadgeClassName = (tone: ProjectHomeStatusTone) => {
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

export const getProjectHomeStatusAccentClassName = (tone: ProjectHomeStatusTone) => {
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

export const getProjectHomeStatusIcon = (tone: ProjectHomeStatusTone) => STATUS_ICON_BY_TONE[tone];

function ProjectHomeStatusIcon({
  tone,
  className,
}: {
  tone: ProjectHomeStatusTone;
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

export function ProjectHomeStatusBadge({
  tone,
  className,
}: {
  tone: ProjectHomeStatusTone;
  className?: string;
}) {
  const t = useT('project');

  return (
    <Badge variant="outline" className={cn(getProjectHomeStatusBadgeClassName(tone), className)}>
      <ProjectHomeStatusIcon tone={tone} className="h-3.5 w-3.5" />
      {getProjectHomeStatusLabel(t, tone)}
    </Badge>
  );
}
