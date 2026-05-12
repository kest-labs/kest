'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import {
  Bell,
  FolderKanban,
  LogOut,
  User,
} from 'lucide-react';
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
import { LanguageSwitcher } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useLogout } from '@/hooks/use-auth';
import { useT } from '@/i18n/client';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils';

type NavTitleKey =
  | 'nav.projects'
  | 'nav.profile';

interface NavItem {
  titleKey: NavTitleKey;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const buildInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'U';

/**
 * 控制台通用外壳组件。
 * 作用：
 * 1. 统一提供控制台顶部导航、侧边栏和用户菜单
 * 2. 让 `/console`、`/project` 等受保护页面共享同一套后台布局
 * 3. 集中维护控制台导航项，避免多个页面布局重复拷贝
 */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const logout = useLogout();
  const user = useAuthStore.use.user();

  const displayName = user?.nickname || user?.username || user?.email || 'User';
  const initials = useMemo(() => buildInitials(displayName), [displayName]);

  const mainNavItems: NavItem[] = [
    {
      titleKey: 'nav.projects',
      href: ROUTES.CONSOLE.PROJECTS,
      icon: FolderKanban,
    },
  ];

  const secondaryNavItems: NavItem[] = [
    {
      titleKey: 'nav.profile',
      href: ROUTES.CONSOLE.PROFILE,
      icon: User,
    },
  ];

  const isRouteActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.AUTH.LOGIN);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-canvas text-text-main">
      <header className="z-50 flex h-16 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-canvas px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Link href={ROUTES.SITE.HOME} className="group flex items-center" aria-label={t.console('shell.title')}>
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
                    className="h-9 w-9 rounded-full border border-border-strong bg-bg-canvas hover:bg-bg-subtle"
                    aria-label={t.console('shell.notifications')}
                  >
                    <Bell className="h-4 w-4 text-text-main" />
                    <span className="sr-only">{t.console('shell.notifications')}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t.console('shell.notifications')}</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-72 rounded-xl border-border-subtle bg-bg-canvas p-1">
              <DropdownMenuLabel>{t.console('shell.notifications')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-3 text-sm text-text-muted">
                {t.console('shell.notificationsEmpty')}
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
                    className="h-9 w-9 overflow-hidden rounded-full border border-border-strong bg-bg-canvas transition-colors hover:bg-bg-subtle"
                    aria-label={t.console('shell.profile')}
                  >
                    <Avatar className="h-full w-full">
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="sr-only">{t.console('shell.profile')}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t.console('shell.profile')}</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-border-subtle bg-bg-canvas p-1">
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                {displayName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
                <Link href={ROUTES.CONSOLE.PROFILE}>{t('nav.profile')}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer rounded-xl text-destructive focus:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t.console('shell.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex h-0 grow overflow-hidden">
        <aside className="hidden w-[232px] shrink-0 border-r border-border-subtle bg-bg-soft md:flex md:flex-col">
          <div className="flex flex-1 flex-col overflow-y-auto py-4">
            <nav className="grid items-start gap-1 px-3 text-sm font-medium">
              {mainNavItems.map(item => {
                const IconComponent = item.icon;
                const isActive = isRouteActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-full px-3 py-2 transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-text-subtle hover:bg-bg-subtle hover:text-text-main'
                    )}
                  >
                    <IconComponent className="h-4.5 w-4.5" />
                    {t(item.titleKey)}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="mt-auto border-t border-border-subtle p-4">
            <nav className="grid items-start gap-1 text-sm font-medium">
              {secondaryNavItems.map(item => {
                const IconComponent = item.icon;
                const isActive = isRouteActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-full px-3 py-2 transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-text-subtle hover:bg-bg-subtle hover:text-text-main'
                    )}
                  >
                    <IconComponent className="h-4.5 w-4.5" />
                    {t(item.titleKey)}
                  </Link>
                );
              })}
            </nav>
            <Link
              href={ROUTES.SITE.HOME}
              className="mt-4 flex h-8 items-center rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-bg-subtle hover:text-foreground"
            >
              <span>{t.console('shell.returnToSite')}</span>
            </Link>
          </div>
        </aside>

        <main className="h-full w-full overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export default ConsoleShell;
