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
    <section id="product" className="relative overflow-hidden bg-bg-canvas py-16 sm:py-24 lg:py-[7.5rem]">
      <div className="container relative">
        <div className="flex flex-col gap-12 lg:gap-14">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center rounded-full bg-[var(--miro-surface-yellow)] px-3 py-1.5 text-[13px] font-semibold leading-[1.4] text-[var(--miro-yellow-dark)]">
              {content.badge}
            </div>

            <h1 className="figma-display-xl mx-auto mt-6 max-w-5xl text-balance text-text-main">
              {content.title}
            </h1>
            <p className="figma-body-lg mx-auto mt-6 max-w-3xl text-text-subtle">
              {content.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary">
                <Link href="/register" className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span>{content.primaryCta}</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="border-border-strong bg-transparent text-text-main"
              >
                {content.secondaryCta}
              </Button>
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-text-muted">{content.supportingNote}</p>
          </div>

          <ProductPreviewMockup variant="hero" content={content.mockup} />
        </div>
      </div>
    </section>
  );
}
