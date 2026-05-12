import Link from 'next/link';
import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';
import type { MarketingPricingContent, MarketingPricingTier } from './types';

export interface PricingSectionProps {
  content: MarketingPricingContent;
}

function PricingTierCard({ tier }: { tier: MarketingPricingTier }) {
  return (
    <article
      className={cn(
        'flex min-h-full flex-col rounded-xl border p-8',
        tier.enterprise
          ? 'border-primary bg-primary text-primary-foreground'
          : tier.featured
            ? 'border-2 border-brand bg-block-lilac text-text-main'
            : 'border-border-main bg-bg-canvas text-text-main'
      )}
    >
      <div className="flex min-h-[7.5rem] flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className={cn('figma-subhead', tier.enterprise ? 'text-primary-foreground' : 'text-text-main')}>
            {tier.name}
          </h3>
          {tier.badge ? (
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[13px] font-semibold leading-[1.4]',
                tier.enterprise
                  ? 'bg-[var(--miro-surface-yellow)] text-[var(--miro-yellow-dark)]'
                  : 'bg-[var(--miro-surface-yellow)] text-[var(--miro-yellow-dark)]'
              )}
            >
              {tier.badge}
            </span>
          ) : null}
        </div>
        <p className={cn('mt-3 text-sm leading-6', tier.enterprise ? 'text-primary-foreground/75' : 'text-text-subtle')}>
          {tier.description}
        </p>
      </div>

      <div className="mt-6">
        <p className={cn('text-4xl font-medium leading-none', tier.enterprise ? 'text-primary-foreground' : 'text-text-main')}>
          {tier.price}
        </p>
        <p className={cn('figma-caption mt-2', tier.enterprise ? 'text-primary-foreground/65' : 'text-text-muted')}>
          {tier.cadence}
        </p>
      </div>

      <Button
        asChild
        className={cn(
          'mt-6 w-full',
          tier.enterprise ? 'bg-bg-canvas text-text-main hover:bg-bg-canvas' : ''
        )}
        variant={tier.enterprise ? 'default' : tier.featured ? 'default' : 'outline'}
      >
        <Link href="/register">{tier.cta}</Link>
      </Button>

      <ul className="mt-6 space-y-3 text-sm">
        {tier.features.map(feature => (
          <li key={feature} className="flex gap-2">
            <Check className={cn('mt-0.5 size-4 shrink-0', tier.enterprise ? 'text-highlight' : 'text-success')} />
            <span className={tier.enterprise ? 'text-primary-foreground/80' : 'text-text-subtle'}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PricingSection({ content }: PricingSectionProps) {
  return (
    <section id="pricing" className="bg-bg-canvas py-20 sm:py-24 lg:py-28">
      <div className="container">
        <div className="max-w-4xl">
          <p className="figma-eyebrow text-text-main">{content.eyebrow}</p>
          <h2 className="figma-display-lg mt-4 text-text-main">{content.title}</h2>
          <p className="figma-body-lg mt-5 max-w-3xl text-text-subtle">{content.description}</p>
        </div>

        <div className="mt-8 inline-flex rounded-full bg-bg-surface p-1">
          <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {content.monthlyLabel}
          </span>
          <span className="px-4 py-2 text-sm font-medium text-text-main">
            {content.annualLabel}
          </span>
          <span className="rounded-sm bg-highlight px-1.5 py-0.5 text-[13px] font-semibold leading-[1.4] text-text-main">
            {content.discountLabel}
          </span>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.tiers.map(tier => (
            <PricingTierCard key={tier.name} tier={tier} />
          ))}
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-border-main bg-bg-canvas">
          <div className="border-b border-border-subtle bg-bg-soft px-5 py-4">
            <h3 className="figma-subhead text-text-main">{content.comparisonTitle}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  {['', 'Free', 'Starter', 'Business', 'Enterprise'].map(label => (
                    <th key={label || 'feature'} className="px-5 py-3 text-left font-medium text-text-muted">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.comparisonRows.map(row => (
                  <Fragment key={`${row.section ?? 'row'}-${row.feature}`}>
                    {row.section ? (
                      <tr className="border-b border-border-subtle bg-bg-surface">
                        <td colSpan={5} className="px-5 py-3 text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.03125rem] text-text-main">
                          {row.section}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-b border-border-subtle last:border-b-0">
                      <td className="px-5 py-4 font-medium text-text-main">{row.feature}</td>
                      <td className="px-5 py-4 text-text-subtle">{row.free}</td>
                      <td className="px-5 py-4 text-text-subtle">{row.starter}</td>
                      <td className="px-5 py-4 text-text-subtle">{row.business}</td>
                      <td className="px-5 py-4 text-text-subtle">{row.enterprise}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
