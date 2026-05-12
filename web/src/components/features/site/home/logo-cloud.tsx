import type { MarketingLogoItem } from './types';
import { cn } from '@/utils';

/**
 * @component LogoCloud
 * @category Feature
 * @status Stable
 * @description Shows muted logo placeholders to communicate trust and product maturity.
 * @usage Use below the hero section on the marketing homepage.
 * @example
 * <LogoCloud title="Built for modern API teams" logos={logos} />
 */
export interface LogoCloudProps {
  title: string;
  logos: MarketingLogoItem[];
}

const logoToneClass: Record<NonNullable<MarketingLogoItem['tone']>, string> = {
  ink: 'text-text-main',
  blue: 'text-brand',
  teal: 'text-[var(--miro-moss-dark)]',
  coral: 'text-[var(--miro-coral-dark)]',
  yellow: 'text-[var(--miro-yellow-dark)]',
};

export function LogoCloud({ title, logos }: LogoCloudProps) {
  return (
    <section className="border-y border-border-main bg-bg-canvas py-8 text-text-main">
      <div className="container">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
          <p className="figma-caption shrink-0 text-text-muted">
            {title}
          </p>
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            {logos.map((logo) => (
              <div
                key={logo.name}
                className={cn(
                  'flex min-h-[100px] items-center justify-center bg-transparent px-3 text-center text-base font-medium leading-none tracking-normal',
                  logoToneClass[logo.tone ?? 'ink']
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-current" />
                  {logo.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
