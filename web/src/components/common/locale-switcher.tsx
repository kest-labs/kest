/**
 * @component LanguageSwitcher
 * @category Common
 * @status Stable
 * @description A dropdown menu for switching application language/locale.
 * @usage Place in the application header or settings for global language control.
 * @example
 * <LanguageSwitcher />
 */
'use client';

import * as React from 'react';
import { Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocale } from '@/hooks/use-locale';
import { useT } from '@/i18n/client';
import { isLocaleSwitcherEnabled, localeNames, locales } from '@/i18n';
import { cn } from '@/utils';

export function LanguageSwitcher({ showTooltip = false }: { showTooltip?: boolean }) {
  const { locale, setLocale, isPending } = useLocale();
  const t = useT();

  if (!isLocaleSwitcherEnabled) {
    return null;
  }

  return (
    <DropdownMenu>
      <Tooltip delayDuration={showTooltip ? 300 : 0}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              isIcon
              noScale
              className="h-9 w-9 rounded-md border border-border-main bg-bg-surface transition-colors hover:bg-bg-subtle"
              disabled={isPending}
              aria-label={t('common.selectLanguage')}
            >
              <Globe
                className={cn(
                  'size-4.5 text-text-main transition-transform duration-200',
                  isPending && 'animate-spin'
                )}
              />
              <span className="sr-only">{t('common.toggleLanguage')}</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {showTooltip ? (
          <TooltipContent>
            <p>{t('common.selectLanguage')}</p>
          </TooltipContent>
        ) : null}
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="w-[160px] rounded-lg border-border-main bg-bg-canvas p-1 shadow-modal animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="figma-caption px-2 py-1.5 text-text-muted">
          {t('common.selectLanguage')}
        </div>
        {locales.map(loc => (
          <DropdownMenuItem
            key={loc}
            onClick={() => setLocale(loc)}
            className={cn(
              'flex cursor-pointer items-center justify-between rounded-md px-2 py-2 transition-colors',
              locale === loc
                ? 'bg-primary font-medium text-primary-foreground'
                : 'text-text-subtle hover:bg-bg-subtle hover:text-text-main'
            )}
          >
            <span>{localeNames[loc]}</span>
            {locale === loc && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
