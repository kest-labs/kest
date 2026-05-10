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
  lime: 'figma-color-block-lime',
  lilac: 'figma-color-block-lilac',
  cream: 'figma-color-block-cream',
  mint: 'figma-color-block-mint',
  pink: 'figma-color-block-pink',
  coral: 'figma-color-block-coral',
  navy: 'figma-color-block-navy',
};

export function ProductStorySection({ content, reverse = false }: ProductStorySectionProps) {
  const inverse = content.blockTone === 'navy';

  return (
    <section id={content.id} className="bg-bg-canvas py-12 sm:py-16">
      <div className="container">
        <div className={cn('figma-color-block flex flex-col gap-10 lg:gap-12', blockToneClass[content.blockTone])}>
          <div className={cn('max-w-3xl', reverse ? 'xl:self-end' : '')}>
            <p className={cn('figma-eyebrow', inverse ? 'text-text-inverse' : 'text-text-main')}>
              {content.eyebrow}
            </p>
            <h2 className={cn('figma-display-lg mt-4', inverse ? 'text-text-inverse' : 'text-text-main')}>
              {content.title}
            </h2>
            <p className={cn('figma-body-lg mt-5', inverse ? 'text-text-inverse/80' : 'text-text-subtle')}>
              {content.description}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {content.points.map((point) => (
                <div
                  key={point}
                  className={cn(
                    'flex items-start gap-3 rounded-md border px-4 py-3.5',
                    inverse ? 'border-text-inverse/20 bg-text-inverse/10' : 'border-border-main bg-bg-canvas'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-6 items-center justify-center rounded-full',
                      inverse ? 'bg-text-inverse/15 text-text-inverse' : 'bg-primary text-primary-foreground'
                    )}
                  >
                    <Check className="size-3.5" />
                  </span>
                  <span className={cn('text-sm leading-6', inverse ? 'text-text-inverse' : 'text-text-main')}>
                    {point}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Button
                asChild
                size="xl"
                variant={inverse ? 'secondary' : 'default'}
                className={inverse ? 'bg-bg-canvas text-text-main hover:bg-bg-canvas/90' : ''}
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
            inverse={inverse}
            className={cn(reverse ? 'xl:self-end' : '', 'w-full')}
          />
        </div>
      </div>
    </section>
  );
}
