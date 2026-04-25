import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';
import { ProductPreviewMockup } from './product-preview-mockup';
import type { MarketingStorySectionContent } from './types';

/**
 * @component ProductStorySection
 * @category Feature
 * @status Stable
 * @description Renders one alternating product story block with narrative copy and a targeted mockup.
 * @usage Use in a sequence to explain the main platform workflows.
 * @example
 * <ProductStorySection content={section} reverse />
 */
export interface ProductStorySectionProps {
  content: MarketingStorySectionContent;
  reverse?: boolean;
}

export function ProductStorySection({ content, reverse = false }: ProductStorySectionProps) {
  return (
    <section id={content.id} className="py-12 sm:py-16">
      <div className={cn('container flex flex-col gap-10 lg:gap-12')}>
        <div className={cn('max-w-3xl', reverse ? 'xl:self-end' : '')}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--marketing-accent-strong)]">
            {content.eyebrow}
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-text-main sm:text-5xl [font-family:var(--font-space-grotesk)]">
            {content.title}
          </h2>
          <p className="mt-5 text-lg leading-8 text-text-subtle">{content.description}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {content.points.map((point) => (
              <div
                key={point}
                className="flex items-start gap-3 rounded-[1.4rem] border border-border/70 bg-white/80 px-4 py-3.5 shadow-sm"
              >
                <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-[color:var(--marketing-accent-soft)] text-[color:var(--marketing-accent-strong)]">
                  <Check className="size-3.5" />
                </span>
                <span className="text-sm leading-6 text-text-main">{point}</span>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Button asChild size="xl" className="rounded-2xl bg-slate-950 text-white hover:bg-slate-900">
              <Link href={content.ctaHref} className="inline-flex items-center gap-2 whitespace-nowrap">
                <span>{content.cta}</span>
              </Link>
            </Button>
          </div>
        </div>

        <ProductPreviewMockup
          variant={content.variant}
          content={content.mockup}
          className={cn(reverse ? 'xl:self-end' : '', 'w-full')}
        />
      </div>
    </section>
  );
}
