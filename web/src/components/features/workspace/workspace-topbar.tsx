'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import { LanguageSwitcher } from '@/components/common';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/icons';
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

export function WorkspaceTopbar() {
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
    <header className="z-40 flex h-16 shrink-0 items-center justify-between border-b border-border-main bg-bg-canvas px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link href={ROUTES.CONSOLE.WORKSPACES} className="group flex items-center" aria-label="KEST">
          <Logo className="h-8 w-[99px] shrink-0 text-black" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher showTooltip />

        <DropdownMenu>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  isIcon
                  noScale
                  className="h-9 w-9 overflow-hidden rounded-md border border-border-strong bg-bg-canvas hover:bg-bg-soft"
                  aria-label={t('topbar.profile')}
                >
                  <Avatar className="h-full w-full">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
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
          <DropdownMenuContent align="end" className="w-56 rounded-lg border-border-subtle bg-bg-canvas p-1">
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
              {displayName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer rounded-md">
              <Link href={ROUTES.CONSOLE.SETTINGS}>
                <Settings className="mr-2 h-4 w-4" />
                <span>{t('topbar.accountSettings')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-md text-destructive focus:bg-destructive/10"
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
