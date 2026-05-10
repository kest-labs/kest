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
    <section id="pricing" className="bg-bg-canvas py-20 sm:py-24">
      <div className="container">
        <div className="figma-color-block figma-color-block-lime">
          <div className="max-w-4xl">
            <p className="figma-eyebrow text-text-main">
              {content.eyebrow}
            </p>
            <h2 className="figma-display-lg mt-4 text-text-main">
              {content.title}
            </h2>
            <p className="figma-body-lg mt-5 max-w-3xl text-text-subtle">{content.description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="2xl">
                <Link href="/register" className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span>{content.primaryCta}</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="2xl"
                className="border-border-main bg-bg-canvas"
              >
                {content.secondaryCta}
              </Button>
            </div>
            <p className="mt-6 text-sm leading-7 text-text-subtle">{content.pricingHint}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
