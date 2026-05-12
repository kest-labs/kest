import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';
import { ProductPreviewMockup } from './product-preview-mockup';
import type { MarketingBlockTone, MarketingStorySectionContent } from './types';

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

const blockToneClass: Record<MarketingBlockTone, string> = {
  lime: 'bg-block-lime',
  lilac: 'bg-block-lilac',
  cream: 'bg-block-cream',
  mint: 'bg-block-mint',
  pink: 'bg-block-pink',
  coral: 'bg-block-coral',
  navy: 'bg-block-lilac',
};

export function ProductStorySection({ content, reverse = false }: ProductStorySectionProps) {
  return (
    <section id={content.id} className="bg-bg-canvas py-12 sm:py-16 lg:py-[4.5rem]">
      <div className="container">
        <div className={cn('grid items-center gap-10 lg:gap-12 xl:grid-cols-2', reverse ? 'xl:[&>*:first-child]:order-2' : '')}>
          <div className="max-w-3xl">
            <p className="figma-eyebrow text-text-main">
              {content.eyebrow}
            </p>
            <h2 className="figma-display-lg mt-4 text-text-main">
              {content.title}
            </h2>
            <p className="figma-body-lg mt-5 text-text-subtle">
              {content.description}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {content.points.map((point) => (
                <div
                  key={point}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border border-border-subtle px-4 py-3.5',
                    blockToneClass[content.blockTone]
                  )}
                >
                  <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-sm leading-6 text-text-main">
                    {point}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Button
                asChild
                size="xl"
                className="bg-primary text-primary-foreground hover:bg-primary active:bg-primary-strong"
              >
                <Link href={content.ctaHref} className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span>{content.cta}</span>
                </Link>
              </Button>
            </div>
          </div>

          <ProductPreviewMockup
            variant={content.variant}
            content={content.mockup}
            className="w-full"
          />
        </div>
      </div>
    </section>
  );
}
