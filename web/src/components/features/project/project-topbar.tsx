'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Command, HelpCircle, LogOut, Settings } from 'lucide-react';
import { LanguageSwitcher } from '@/components/common';
import {
  OPEN_COMMAND_PALETTE_EVENT,
  OPEN_HELP_CENTER_EVENT,
} from '@/components/features/project/project-onboarding-shell';
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
import { ROUTES, buildProjectInviteRoute } from '@/constants/routes';
import { useMyProjectInvitations } from '@/hooks/use-project-invitations';
import { useLogout } from '@/hooks/use-auth';
import { useT } from '@/i18n/client';
import type { ScopedTranslations } from '@/i18n/shared';
import { useAuthStore } from '@/store/auth-store';

const buildInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'U';

const getInvitationRoleLabel = (
  t: ScopedTranslations<'project'>,
  role: 'admin' | 'read' | 'write'
) => {
  switch (role) {
    case 'admin':
      return t('roles.admin');
    case 'write':
      return t('roles.write');
    case 'read':
      return t('roles.read');
    default:
      return t('roles.unknown');
  }
};

export function ProjectTopbar() {
  const t = useT('project');
  const router = useRouter();
  const logout = useLogout();
  const user = useAuthStore.use.user();
  const receivedInvitationsQuery = useMyProjectInvitations();

  const displayName = user?.nickname || user?.username || user?.email || 'User';
  const initials = useMemo(() => buildInitials(displayName), [displayName]);
  const pendingInvitations = receivedInvitationsQuery.data ?? [];
  const pendingInvitationCount = pendingInvitations.length;
  const invitationPreview = pendingInvitations.slice(0, 3);

  const handleLogout = () => {
    logout();
    router.replace(ROUTES.AUTH.LOGIN);
  };

  return (
    <header className="z-40 flex h-16 shrink-0 items-center justify-between border-b border-border-main bg-bg-canvas px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link href={ROUTES.CONSOLE.PROJECTS} className="group flex items-center" aria-label="KEST">
          <Logo className="h-8 w-[99px] shrink-0 text-black" aria-hidden="true" />
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
              className="hidden border-border-strong bg-bg-canvas px-3 text-text-main hover:border-border-strong hover:bg-bg-soft md:inline-flex"
              data-onboarding="command-palette"
              onClick={() => {
                window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
              }}
            >
              <Command className="h-3.5 w-3.5" />
              <span>{t('topbar.commandMenu')}</span>
              <span className="rounded-sm border border-border-strong bg-bg-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-text-muted">
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
              className="h-9 w-9 rounded-md border border-border-strong bg-bg-canvas hover:bg-bg-soft"
              data-onboarding="help-button"
              aria-label={t('topbar.help')}
              onClick={() => {
                window.dispatchEvent(new Event(OPEN_HELP_CENTER_EVENT));
              }}
            >
              <HelpCircle className="h-4 w-4 text-text-main" />
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
                  className="relative h-9 w-9 rounded-md border border-border-strong bg-bg-canvas hover:bg-bg-soft"
                  aria-label={t('topbar.notifications')}
                >
                  <Bell className="h-4 w-4 text-text-main" />
                  {pendingInvitationCount > 0 ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-sm bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                      {pendingInvitationCount > 9 ? '9+' : pendingInvitationCount}
                    </span>
                  ) : null}
                  <span className="sr-only">{t('topbar.notifications')}</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('topbar.notifications')}</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-72 rounded-lg border-border-subtle bg-bg-canvas p-1">
            <DropdownMenuLabel>{t('topbar.notifications')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {receivedInvitationsQuery.isError ? (
              <div className="px-2 py-3 text-sm text-text-muted">
                {t('topbar.notificationsLoadFailed')}
              </div>
            ) : invitationPreview.length === 0 ? (
              <div className="px-2 py-3 text-sm text-text-muted">
                {t('topbar.notificationsEmpty')}
              </div>
            ) : (
              <>
                <div className="px-2 py-2 text-xs font-medium uppercase tracking-[0.03125rem] text-text-muted">
                  {t('topbar.pendingInvitations', { count: pendingInvitationCount })}
                </div>
                {invitationPreview.map(invitation => (
                  <DropdownMenuItem
                    key={invitation.id}
                    asChild
                    className="cursor-pointer rounded-md"
                  >
                    <Link href={buildProjectInviteRoute(invitation.slug)}>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{invitation.project_name}</div>
                        <div className="truncate text-xs text-text-muted">
                          {invitation.project_slug} · {getInvitationRoleLabel(t, invitation.role)}
                        </div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer rounded-md text-text-main focus:text-text-main"
                >
                  <Link href={ROUTES.CONSOLE.PROJECTS}>{t('topbar.reviewInvitations')}</Link>
                </DropdownMenuItem>
              </>
            )}
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
