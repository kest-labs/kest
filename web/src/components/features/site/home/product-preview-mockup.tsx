import { Activity, Bot, CheckCircle2, Clock3, FileText, Layers3, Sparkles } from 'lucide-react';
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
 * @description Renders the software-like mockups used across the marketing homepage.
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

function HeroMockup({ content }: { content: MarketingHeroMockupContent }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.92fr_1.35fr_1fr]">
      <aside className="marketing-panel rounded-lg p-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="figma-caption text-text-muted">
              {content.sidebarTitle}
            </p>
            <p className="mt-2 text-sm font-semibold text-text-main">{content.activeProject}</p>
          </div>
          <div className="size-2.5 rounded-full bg-primary" />
        </div>

        <div className="space-y-4 text-sm text-text-subtle">
          <div>
            <p className="figma-caption mb-2 text-text-muted">
              {content.projectsLabel}
            </p>
            <div className="rounded-md border border-border-main bg-bg-canvas px-3 py-2.5 font-medium text-text-main">
              {content.activeProject}
            </div>
          </div>
          <div>
            <p className="figma-caption mb-2 text-text-muted">
              {content.flowsLabel}
            </p>
            <div className="space-y-2">
              <div className="rounded-md border border-border-main bg-bg-canvas px-3 py-2.5">
                {content.flowOne}
              </div>
              <div className="rounded-md border border-dashed border-border-main px-3 py-2.5">{content.flowTwo}</div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-md border border-border-main bg-bg-canvas px-3 py-3">
              <p className="figma-caption text-text-muted">
                {content.environmentsLabel}
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">{content.environmentValue}</p>
            </div>
            <div className="rounded-md border border-border-main bg-bg-canvas px-3 py-3">
              <p className="figma-caption text-text-muted">
                {content.teamspacesLabel}
              </p>
              <p className="mt-1 text-sm font-medium text-text-main">{content.teamValue}</p>
            </div>
          </div>
        </div>
      </aside>

      <section className="marketing-panel marketing-grid rounded-lg p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text-main">{content.workspaceTitle}</h3>
            <p className="mt-1 text-sm leading-6 text-text-subtle">{content.workspaceSubtitle}</p>
          </div>
          <div className="h-9 w-20 rounded-pill bg-block-lime" />
        </div>

        <div className="relative space-y-4">
          <div className="absolute left-5 top-7 hidden h-[70%] w-px bg-border-main md:block" />
          {[
            {
              title: content.requestOne,
              note: content.tokenForwarded,
              accent: 'bg-primary',
            },
            {
              title: content.requestTwo,
              note: content.sessionForwarded,
              accent: 'bg-emerald-500',
            },
            {
              title: content.requestThree,
              note: content.variableForwarded,
              accent: 'bg-primary',
            },
          ].map((item, index) => (
            <div key={item.title} className="relative md:pl-8">
              <div className={cn('absolute left-0 top-5 hidden size-3 rounded-full ring-4 ring-bg-canvas md:block', item.accent)} />
              <div className="rounded-md border border-border-main bg-bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-text-main">{item.title}</p>
                  <span className="figma-caption rounded-pill bg-bg-subtle px-2.5 py-1 text-text-muted">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-text-subtle">{item.note}</p>
              </div>
            </div>
          ))}
          <div className="rounded-md border border-dashed border-border-main bg-block-cream p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-text-main">
              <Sparkles className="size-4 text-text-main" />
              {content.headersForwarded}
            </p>
          </div>
        </div>
      </section>

      <aside className="marketing-panel rounded-lg p-4">
        <div className="rounded-md border border-border-main bg-bg-canvas p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text-main">{content.resultsTitle}</p>
            <span className="figma-caption rounded-pill bg-block-pink px-2.5 py-1 text-text-main">
              {content.statusLabel}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-text-main">{content.failedCheck}</p>
          <p className="mt-2 text-sm leading-6 text-text-subtle">{content.failedHint}</p>
        </div>

        <div className="mt-4 rounded-md border border-border-main bg-block-cream p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-main">
            <Bot className="size-4 text-text-main" />
            {content.aiTitle}
          </p>
          <p className="mt-3 text-sm leading-6 text-text-subtle">{content.aiReason}</p>
          <div className="mt-4 rounded-md bg-primary px-3.5 py-3 text-sm leading-6 text-primary-foreground">
            {content.aiAction}
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border-main bg-bg-canvas p-4">
          <p className="text-sm font-semibold text-text-main">{content.historyTitle}</p>
          <div className="mt-3 space-y-2.5 text-sm text-text-subtle">
            {[content.historyOne, content.historyTwo, content.historyThree].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md bg-bg-subtle px-3 py-2.5">
                <Clock3 className="size-4 text-text-muted" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
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

  return (
    <div className={cn('marketing-grid rounded-lg border p-5', inverse ? 'border-text-inverse/20 bg-text-inverse/10' : 'border-border-main bg-bg-canvas')}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('flex size-10 items-center justify-center rounded-full', inverse ? 'bg-text-inverse/15 text-text-inverse' : 'bg-bg-soft text-text-main')}>
            {TitleIcon ? <TitleIcon className="size-5" /> : null}
          </div>
          <p className={cn('text-sm font-semibold', inverse ? 'text-text-inverse' : 'text-text-main')}>{content.title}</p>
        </div>
        <div className={cn('flex items-center gap-2 rounded-pill border px-3 py-1 text-[11px] font-medium', inverse ? 'border-text-inverse/20 bg-text-inverse/10 text-text-inverse/75' : 'border-border-main bg-bg-canvas text-text-subtle')}>
          <CheckCircle2 className="size-3.5 text-emerald-500" />
          <span className="size-1.5 rounded-full bg-emerald-500" />
        </div>
      </div>

      {variant === 'flow' ? (
        <div className="grid gap-3">
          {[0, 2, 4, 6].map((start) => (
            <div key={content.lines[start]} className={cn('rounded-md border p-4', inverse ? 'border-text-inverse/20 bg-text-inverse/10' : 'border-border-main bg-bg-canvas')}>
              <div className="flex items-center gap-3">
                <div className={cn('size-2.5 rounded-full', inverse ? 'bg-text-inverse' : 'bg-primary')} />
                <p className={cn('font-medium', inverse ? 'text-text-inverse' : 'text-text-main')}>{content.lines[start]}</p>
              </div>
              <p className={cn('mt-2 pl-5 text-sm leading-6', inverse ? 'text-text-inverse/75' : 'text-text-subtle')}>{content.lines[start + 1]}</p>
            </div>
          ))}
        </div>
      ) : null}

      {variant === 'history' ? (
        <div className="space-y-3">
          {content.lines.map((line, index) => (
            <div
              key={line}
              className={cn(
                'rounded-md border px-4 py-3.5',
                inverse
                  ? 'border-text-inverse/20 bg-text-inverse/10'
                  : index === 0
                    ? 'border-border-main bg-block-pink'
                    : 'border-border-main bg-bg-canvas'
              )}
            >
              <p className={cn('text-sm leading-6', inverse ? 'text-text-inverse' : 'text-text-main')}>{line}</p>
            </div>
          ))}
        </div>
      ) : null}

      {variant === 'ai' ? (
        <div className="overflow-hidden rounded-md border border-border-strong bg-primary">
          <div className="flex items-center gap-2 border-b border-text-inverse/20 px-4 py-3 text-xs uppercase tracking-[0.24em] text-text-inverse/65">
            <Bot className="size-4 text-block-lime" />
            {content.title}
          </div>
          <div className="space-y-3 px-4 py-4 font-mono text-sm leading-6 text-text-inverse">
            {content.lines.map((line, index) => (
              <div key={line} className="flex gap-3">
                <span className="w-5 shrink-0 text-text-inverse/45">{index + 1}</span>
                <span>{line}</span>
              </div>
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
