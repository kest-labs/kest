import { Activity, Bot, CheckCircle2, FileText, GitBranch, Layers3, Sparkles } from 'lucide-react';
import { cn } from '@/utils';
import type {
  MarketingHeroMockupContent,
  MarketingStoryMockupContent,
  MarketingStoryVariant,
} from './types';

/**
 * @component ProductPreviewMockup
 * @category Feature
 * @status Stable
 * @description Renders Miro-style whiteboard mockups used across the marketing homepage.
 * @usage Use in the hero and alternating product sections to show context-aware flows, history, and AI diagnosis.
 * @example
 * <ProductPreviewMockup variant="hero" content={mockupContent} />
 */
export interface ProductPreviewMockupProps {
  variant: 'hero' | MarketingStoryVariant;
  content: MarketingHeroMockupContent | MarketingStoryMockupContent;
  className?: string;
  inverse?: boolean;
}

const stickyTones = [
  'bg-block-lime',
  'bg-block-pink',
  'bg-block-mint',
  'bg-block-cream',
  'bg-block-coral',
  'bg-block-lilac',
];

function BoardChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="whiteboard-mockup overflow-hidden rounded-xl border border-border-subtle bg-bg-canvas shadow-soft">
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-soft px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-block-coral" />
          <span className="size-3 rounded-full bg-block-lime" />
          <span className="size-3 rounded-full bg-block-mint" />
        </div>
        <p className="figma-caption text-text-muted">{title}</p>
        <div className="h-7 w-24 rounded-full bg-primary" />
      </div>
      {children}
    </div>
  );
}

function HeroMockup({ content }: { content: MarketingHeroMockupContent }) {
  const stickyNotes = [
    { title: content.requestOne, note: content.tokenForwarded, className: 'left-[8%] top-[14%] rotate-[-3deg]', tone: 'bg-block-lime' },
    { title: content.requestTwo, note: content.sessionForwarded, className: 'left-[36%] top-[22%] rotate-[2deg]', tone: 'bg-block-pink' },
    { title: content.requestThree, note: content.variableForwarded, className: 'right-[8%] top-[13%] rotate-[-1deg]', tone: 'bg-block-mint' },
    { title: content.headersForwarded, note: content.workspaceSubtitle, className: 'left-[16%] bottom-[17%] rotate-[2deg]', tone: 'bg-block-coral' },
    { title: content.aiTitle, note: content.aiReason, className: 'right-[14%] bottom-[12%] rotate-[-2deg]', tone: 'bg-block-cream' },
  ];

  return (
    <BoardChrome title={content.workspaceTitle}>
      <div className="relative min-h-[560px] overflow-hidden bg-bg-canvas p-5 sm:p-8">
        <div className="absolute left-1/2 top-[47%] h-px w-[70%] -translate-x-1/2 bg-border-main" />
        <div className="absolute left-[23%] top-[31%] h-[38%] w-px bg-border-main" />
        <div className="absolute right-[27%] top-[31%] h-[38%] w-px bg-border-main" />

        <div className="absolute left-8 top-8 hidden w-40 rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 md:block">
          <p className="figma-caption text-text-muted">{content.sidebarTitle}</p>
          <p className="mt-2 text-sm font-medium text-text-main">{content.activeProject}</p>
        </div>

        {stickyNotes.map((item) => (
          <article
            key={item.title}
            className={cn(
              'absolute flex min-h-36 w-[min(260px,42vw)] flex-col rounded-[1.75rem] border border-border-subtle p-5 text-text-main shadow-sm',
              item.tone,
              item.className
            )}
          >
            <p className="text-sm font-medium leading-5">{item.title}</p>
            <p className="mt-4 text-sm leading-6 text-text-subtle">{item.note}</p>
          </article>
        ))}

        <div className="absolute left-1/2 top-[47%] flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border-main bg-bg-canvas text-text-main shadow-sm">
          <Sparkles className="size-8" />
        </div>

        <div className="absolute bottom-8 left-1/2 hidden w-[min(520px,72%)] -translate-x-1/2 rounded-xl border border-border-subtle bg-bg-canvas px-5 py-4 md:block">
          <p className="figma-caption text-text-muted">{content.resultsTitle}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-main">
            <span className="rounded-full bg-[var(--miro-surface-yellow)] px-3 py-1 font-medium text-[var(--miro-yellow-dark)]">
              {content.statusLabel}
            </span>
            <span>{content.failedCheck}</span>
          </div>
        </div>
      </div>
    </BoardChrome>
  );
}

function StoryMockup({
  content,
  variant,
  inverse = false,
}: {
  content: MarketingStoryMockupContent;
  variant: MarketingStoryVariant;
  inverse?: boolean;
}) {
  const TitleIcon = {
    flow: Layers3,
    history: Activity,
    ai: FileText,
  }[variant];

  const boardTone = inverse ? 'border-text-inverse/20 bg-text-inverse/10' : 'border-border-main bg-bg-canvas';

  return (
    <div className={cn('rounded-xl border p-5', boardTone)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('flex size-10 items-center justify-center rounded-full', inverse ? 'bg-text-inverse/15 text-text-inverse' : 'bg-bg-soft text-text-main')}>
            {TitleIcon ? <TitleIcon className="size-5" /> : null}
          </div>
          <p className={cn('text-sm font-medium', inverse ? 'text-text-inverse' : 'text-text-main')}>{content.title}</p>
        </div>
        <div className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium', inverse ? 'border-text-inverse/20 bg-text-inverse/10 text-text-inverse/75' : 'border-border-main bg-bg-canvas text-text-subtle')}>
          <CheckCircle2 className="size-3.5 text-success" />
          <span className="size-1.5 rounded-full bg-success" />
        </div>
      </div>

      {variant === 'flow' ? (
        <div className="relative grid gap-4 md:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-1/2 hidden h-px bg-border-main md:block" />
          {[0, 2, 4, 6].map((start, index) => (
            <article
              key={content.lines[start]}
              className={cn(
                'relative z-10 min-h-36 rounded-[1.75rem] border border-border-subtle p-4',
                stickyTones[index % stickyTones.length]
              )}
            >
              <GitBranch className="mb-4 size-4 text-text-main" />
              <p className="text-sm font-medium leading-5 text-text-main">{content.lines[start]}</p>
              <p className="mt-3 text-sm leading-6 text-text-subtle">{content.lines[start + 1]}</p>
            </article>
          ))}
        </div>
      ) : null}

      {variant === 'history' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {content.lines.map((line, index) => (
            <article
              key={line}
              className={cn(
                'min-h-28 rounded-[1.75rem] border p-4',
                inverse ? 'border-text-inverse/20 bg-text-inverse/10' : cn('border-border-subtle', stickyTones[index % stickyTones.length])
              )}
            >
              <p className={cn('text-sm leading-6', inverse ? 'text-text-inverse' : 'text-text-main')}>{line}</p>
            </article>
          ))}
        </div>
      ) : null}

      {variant === 'ai' ? (
        <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[1.75rem] border border-border-subtle bg-block-lilac p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-text-main">
              <Bot className="size-4 text-brand" />
              {content.title}
            </div>
            <div className="mt-5 space-y-3">
              {content.lines.slice(0, 2).map((line) => (
                <p key={line} className="rounded-xl border border-border-subtle bg-bg-canvas px-4 py-3 text-sm leading-6 text-text-main">
                  {line}
                </p>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {content.lines.slice(2).map((line, index) => (
              <article key={line} className={cn('rounded-[1.75rem] border border-border-subtle p-4 text-sm leading-6 text-text-main', stickyTones[(index + 2) % stickyTones.length])}>
                {line}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProductPreviewMockup({ variant, content, className, inverse = false }: ProductPreviewMockupProps) {
  return (
    <div className={cn('relative', className)}>
      {variant === 'hero' ? (
        <HeroMockup content={content as MarketingHeroMockupContent} />
      ) : (
        <StoryMockup content={content as MarketingStoryMockupContent} variant={variant} inverse={inverse} />
      )}
    </div>
  );
}
