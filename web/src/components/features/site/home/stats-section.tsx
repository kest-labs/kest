import type { MarketingStatsContent } from './types';

/**
 * @component StatsSection
 * @category Feature
 * @status Stable
 * @description Highlights the value metrics and engineering outcomes of the platform.
 * @usage Use near the end of the marketing homepage before the final CTA.
 * @example
 * <StatsSection content={stats} />
 */
export interface StatsSectionProps {
  content: MarketingStatsContent;
}

export function StatsSection({ content }: StatsSectionProps) {
  return (
    <section className="bg-bg-canvas py-20 sm:py-24">
      <div className="container">
        <div>
          <div className="max-w-4xl">
            <p className="figma-eyebrow text-text-main">
              {content.eyebrow}
            </p>
            <h2 className="figma-display-lg mt-4 text-text-main">
              {content.title}
            </h2>
            <p className="figma-body-lg mt-5 max-w-3xl text-text-subtle">{content.description}</p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {content.items.map((item) => (
              <article key={item.label} className="rounded-xl border border-border-subtle bg-transparent p-5">
                <p className="text-[4rem] font-medium leading-[1.1] tracking-[-0.09375rem] text-text-main">
                  {item.value}
                </p>
                <p className="figma-caption mt-3 text-text-main">
                  {item.label}
                </p>
                <p className="mt-4 text-sm leading-7 text-text-subtle">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
