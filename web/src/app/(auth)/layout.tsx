'use client';

import { PropsWithChildren } from 'react';
import { Zap, Shield, Layers, Headphones } from 'lucide-react';
import { Logo } from '@/components/ui/icons';
import { LanguageSwitcher } from '@/components/common';
import { useT } from '@/i18n/client';

/**
 * Auth layout with enhanced decorative left panel
 */
export default function AuthLayout({ children }: PropsWithChildren) {
  const t = useT();
  
  const features = [
    { icon: Zap, key: 'auth.feature1' as const },
    { icon: Shield, key: 'auth.feature2' as const },
    { icon: Layers, key: 'auth.feature3' as const },
    { icon: Headphones, key: 'auth.feature4' as const },
  ];

  return (
    <div className="grid min-h-svh bg-bg-canvas lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="hidden p-6 lg:block">
        <div className="figma-color-block figma-color-block-lilac flex min-h-full flex-col justify-between">
          <div>
            <Logo className="h-[42px] w-[129px] text-black" role="img" aria-label={t('auth.brandName')} />
          </div>

          <div className="my-16 max-w-3xl">
            <p className="figma-eyebrow text-text-main">{t('auth.heroEyebrow')}</p>
            <h1 className="figma-display-lg mt-5 text-text-main">{t('auth.heroTitle')}</h1>
            <p className="figma-body-lg mt-6 max-w-xl text-text-subtle">{t('auth.heroSubtitle')}</p>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {features.map((feature) => {
              const IconComponent = feature.icon;

              return (
                <div
                  key={feature.key}
                  className="flex items-center gap-3 rounded-md border border-border-main bg-bg-canvas p-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <IconComponent className="size-4" />
                  </div>
                  <span className="text-sm font-medium leading-5 text-text-main">{t(feature.key)}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-12 grid gap-3 xl:grid-cols-3">
            <div className="rounded-md border border-border-main bg-bg-canvas p-4">
              <p className="figma-caption text-text-main">{t('auth.insight1Title')}</p>
              <p className="mt-3 text-sm leading-6 text-text-subtle">{t('auth.insight1Description')}</p>
            </div>
            <div className="rounded-md border border-border-main bg-block-mint p-4">
              <p className="figma-caption text-text-main">{t('auth.insight2Title')}</p>
              <p className="mt-3 text-sm leading-6 text-text-subtle">{t('auth.insight2Description')}</p>
            </div>
            <div className="rounded-md border border-border-main bg-block-lime p-4">
              <p className="figma-caption text-text-main">{t('auth.insight3Title')}</p>
              <p className="mt-3 text-sm leading-6 text-text-subtle">{t('auth.insight3Description')}</p>
            </div>
          </div>

          <p className="figma-caption mt-12 text-text-muted">{t('auth.trustNote')}</p>
        </div>
      </aside>

      <main className="relative flex min-h-svh flex-col bg-bg-canvas">
        <div className="absolute top-4 right-4 z-20">
          <LanguageSwitcher />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 md:p-8">
          <div className="mb-8 flex flex-col items-center space-y-3 lg:hidden">
            <Logo className="h-10 w-[123px] text-black" role="img" aria-label={t('auth.brandName')} />
            <p className="max-w-xs text-center text-sm leading-6 text-text-subtle">
              {t('auth.heroSubtitle')}
            </p>
          </div>

          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

        <div className="shrink-0 border-t border-border-main py-5 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {t('auth.brandName')}. {t('auth.allRightsReserved')}.
        </div>
      </main>
    </div>
  );
}
