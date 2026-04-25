import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProductPreviewMockup } from './product-preview-mockup';
import type { MarketingHeroContent } from './types';

/**
 * @component HeroSection
 * @category Feature
 * @status Stable
 * @description Renders the hero copy and the main product interface preview for the homepage.
 * @usage Place at the top of the marketing homepage.
 * @example
 * <HeroSection content={hero} />
 */
export interface HeroSectionProps {
  content: MarketingHeroContent;
}

export function HeroSection({ content }: HeroSectionProps) {
  return (
    <section id="product" className="relative overflow-hidden pt-14 pb-18 sm:pt-18 sm:pb-24 lg:pt-24 lg:pb-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top_left,var(--marketing-accent-glow),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.96),transparent_30%)]" />
      <div className="container relative">
        <div className="flex flex-col gap-12 lg:gap-16">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--marketing-accent-border)] bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--marketing-accent-strong)] shadow-sm">
              <span className="size-1.5 rounded-full bg-[color:var(--marketing-accent-strong)]" />
              {content.badge}
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-balance text-text-main sm:text-6xl lg:text-7xl lg:leading-[1.02] [font-family:var(--font-space-grotesk)]">
              {content.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-text-subtle sm:text-xl">
              {content.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="2xl" className="rounded-2xl border border-[color:var(--marketing-accent-strong)] bg-[color:var(--marketing-accent)] text-slate-950 shadow-[0_20px_55px_-25px_var(--marketing-accent-glow)] hover:bg-[color:var(--marketing-accent-strong)]">
                <Link href="/register" className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span>{content.primaryCta}</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="2xl"
                className="rounded-2xl border-[color:var(--marketing-accent-border)] bg-white/85 shadow-sm hover:bg-[color:var(--marketing-accent-soft)]"
              >
                {content.secondaryCta}
              </Button>
            </div>
            <p className="mt-6 text-sm leading-7 text-text-muted">{content.supportingNote}</p>
          </div>

          <ProductPreviewMockup variant="hero" content={content.mockup} />
        </div>
      </div>
    </section>
  );
}
