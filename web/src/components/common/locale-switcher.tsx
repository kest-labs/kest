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
              className="h-9 w-9 rounded-full transition-colors hover:bg-muted/50"
              disabled={isPending}
              aria-label={t('common.selectLanguage')}
            >
              <Globe
                className={cn(
                  'size-4.5 text-text-muted transition-transform duration-300',
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
        className="w-[160px] rounded-xl border-border/50 p-1 shadow-premium animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
          {t('common.selectLanguage')}
        </div>
        {locales.map(loc => (
          <DropdownMenuItem
            key={loc}
            onClick={() => setLocale(loc)}
            className={cn(
              'flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 transition-colors',
              locale === loc
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-text-subtle hover:bg-muted/50'
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
