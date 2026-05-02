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
      return 'border-emerald-200 bg-emerald-500/10 text-emerald-700';
    case 'available':
      return 'border-sky-200 bg-sky-500/10 text-sky-700';
    case 'optional':
      return 'border-slate-200 bg-slate-500/10 text-slate-700';
    default:
      return 'border-amber-200 bg-amber-500/10 text-amber-700';
  }
};

export const getProjectHomeStatusAccentClassName = (tone: ProjectHomeStatusTone) => {
  switch (tone) {
    case 'ready':
      return 'bg-emerald-500/10 text-emerald-700';
    case 'available':
      return 'bg-sky-500/10 text-sky-700';
    case 'optional':
      return 'bg-slate-500/10 text-slate-700';
    default:
      return 'bg-amber-500/10 text-amber-700';
  }
};

export const getProjectHomeStatusIcon = (tone: ProjectHomeStatusTone) => STATUS_ICON_BY_TONE[tone];

export function ProjectHomeStatusBadge({
  tone,
  className,
}: {
  tone: ProjectHomeStatusTone;
  className?: string;
}) {
  const t = useT('project');
  const Icon = getProjectHomeStatusIcon(tone);

  return (
    <Badge variant="outline" className={cn(getProjectHomeStatusBadgeClassName(tone), className)}>
      <Icon className="h-3.5 w-3.5" />
      {getProjectHomeStatusLabel(t, tone)}
    </Badge>
  );
}
