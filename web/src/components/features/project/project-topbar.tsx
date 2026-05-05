'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Command, HelpCircle, LayoutPanelTop, LogOut, Settings } from 'lucide-react';
import { LanguageSwitcher } from '@/components/common';
import {
  OPEN_COMMAND_PALETTE_EVENT,
  OPEN_HELP_CENTER_EVENT,
} from '@/components/features/project/project-onboarding-shell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ROUTES } from '@/constants/routes';
import { useLogout } from '@/hooks/use-auth';
import { useT } from '@/i18n/client';
import { useAuthStore } from '@/store/auth-store';

const buildInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'U';

export function ProjectTopbar() {
  const t = useT('project');
  const router = useRouter();
  const logout = useLogout();
  const user = useAuthStore.use.user();

  const displayName = user?.nickname || user?.username || user?.email || 'User';
  const initials = useMemo(() => buildInitials(displayName), [displayName]);

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.AUTH.LOGIN);
  };

  return (
    <header className="z-40 flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-bg-surface/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link href={ROUTES.CONSOLE.PROJECTS} className="group flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-button-primary transition-transform group-hover:scale-105">
            <LayoutPanelTop className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-text-main">KEST</p>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              noScale
              className="hidden rounded-full border-border/60 px-3 text-text-muted md:inline-flex"
              data-onboarding="command-palette"
              onClick={() => {
                window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
              }}
            >
              <Command className="h-3.5 w-3.5" />
              <span>{t('topbar.commandMenu')}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em]">
                Cmd+K
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('topbar.commandMenuHint')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              isIcon
              noScale
              className="h-9 w-9 rounded-full"
              data-onboarding="help-button"
              aria-label={t('topbar.help')}
              onClick={() => {
                window.dispatchEvent(new Event(OPEN_HELP_CENTER_EVENT));
              }}
            >
              <HelpCircle className="h-4 w-4 text-text-muted" />
              <span className="sr-only">{t('topbar.help')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('topbar.helpHint')}</p>
          </TooltipContent>
        </Tooltip>

        <LanguageSwitcher showTooltip />

        <DropdownMenu>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  isIcon
                  noScale
                  className="h-9 w-9 rounded-full"
                  aria-label={t('topbar.notifications')}
                >
                  <Bell className="h-4 w-4 text-text-muted" />
                  <span className="sr-only">{t('topbar.notifications')}</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('topbar.notifications')}</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-72 rounded-xl p-1 shadow-premium">
            <DropdownMenuLabel>{t('topbar.notifications')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-3 text-sm text-text-muted">
              {t('topbar.notificationsEmpty')}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  isIcon
                  noScale
                  className="h-9 w-9 overflow-hidden rounded-full border border-border/60"
                  aria-label={t('topbar.profile')}
                >
                  <Avatar className="h-full w-full">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="sr-only">{t('topbar.profile')}</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('topbar.profile')}</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 shadow-premium">
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
              {displayName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
              <Link href={ROUTES.CONSOLE.SETTINGS}>
                <Settings className="mr-2 h-4 w-4" />
                <span>{t('topbar.accountSettings')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg text-destructive focus:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('topbar.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
