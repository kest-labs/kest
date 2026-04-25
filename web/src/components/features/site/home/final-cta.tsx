import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { MarketingFinalCtaContent } from './types';

/**
 * @component FinalCta
 * @category Feature
 * @status Stable
 * @description Renders the closing conversion section with a pricing-oriented anchor target.
 * @usage Use as the final conversion block on the marketing homepage.
 * @example
 * <FinalCta content={finalCta} />
 */
export interface FinalCtaProps {
  content: MarketingFinalCtaContent;
}

export function FinalCta({ content }: FinalCtaProps) {
  return (
    <section id="pricing" className="py-20 sm:py-24">
      <div className="container">
        <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--marketing-accent-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,247,237,0.98))] px-6 py-12 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.35)] sm:px-10 sm:py-14 lg:px-14">
          <div className="pointer-events-none absolute -left-16 top-0 size-44 rounded-full bg-[color:var(--marketing-accent-glow)] blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-10 size-52 rounded-full bg-[color:var(--marketing-accent-soft)] blur-3xl" />

          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--marketing-accent-strong)]">
              {content.eyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-text-main sm:text-5xl [font-family:var(--font-space-grotesk)]">
              {content.title}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-text-subtle">{content.description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="2xl" className="rounded-2xl border border-[color:var(--marketing-accent-strong)] bg-[color:var(--marketing-accent)] text-slate-950 hover:bg-[color:var(--marketing-accent-strong)]">
                <Link href="/register" className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span>{content.primaryCta}</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="2xl"
                className="rounded-2xl border-[color:var(--marketing-accent-border)] bg-white/85"
              >
                {content.secondaryCta}
              </Button>
            </div>
            <p className="mt-6 text-sm leading-7 text-text-muted">{content.pricingHint}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
