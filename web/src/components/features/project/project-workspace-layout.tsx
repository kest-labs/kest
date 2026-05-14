'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  PROJECT_WORKSPACE_MODULES,
  buildProjectWorkspaceRoute,
} from '@/components/features/project/project-navigation';
import { getProjectModuleCopy } from '@/components/features/project/project-i18n';
import { buildProjectDetailRoute } from '@/constants/routes';
import { useT } from '@/i18n/client';
import { cn } from '@/utils';

const PROJECT_WORKSPACE_NAV_STATE_KEY = 'kest_project_workspace_nav_collapsed';

const getInitialDesktopNavCollapsed = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(PROJECT_WORKSPACE_NAV_STATE_KEY) === '1';
};

export function ProjectWorkspaceLayout({
  projectId,
  children,
}: {
  projectId: number | string;
  children: React.ReactNode;
}) {
  const t = useT('project');
  const pathname = usePathname();
  const readyModules = PROJECT_WORKSPACE_MODULES.filter(item => item.status !== 'planned');
  const plannedModules = PROJECT_WORKSPACE_MODULES.filter(item => item.status === 'planned');
  const [isDesktopNavCollapsed, setIsDesktopNavCollapsed] = useState(getInitialDesktopNavCollapsed);
  const isRouteActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}?`) || pathname.startsWith(`${href}/`);

  const updateDesktopNavCollapsed = (nextValue: boolean) => {
    setIsDesktopNavCollapsed(nextValue);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PROJECT_WORKSPACE_NAV_STATE_KEY, nextValue ? '1' : '0');
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-bg-soft lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">
      <aside
        className={cn(
          'w-full shrink-0 border-b border-border-subtle bg-bg-canvas lg:border-r lg:border-b-0 lg:transition-[width]',
          isDesktopNavCollapsed ? 'lg:w-[92px]' : 'lg:w-[236px]'
        )}
      >
        <div className="flex items-center gap-3 border-b border-border-subtle p-3 lg:hidden">
          <Button
            asChild
            variant="ghost"
            size="sm"
            isIcon
            className="h-8 w-8 shrink-0 rounded-full border border-border-strong bg-bg-canvas text-text-main hover:bg-bg-subtle"
          >
            <Link href={buildProjectDetailRoute(projectId)}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </Button>

          <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <nav className="flex min-w-max items-center gap-2 pr-1">
              {readyModules.map(item => {
                const Icon = item.icon;
                const href = buildProjectWorkspaceRoute(projectId, item.value);
                const isActive = isRouteActive(href);

                return (
                  <Link
                    key={item.value}
                    href={href}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border-subtle bg-bg-canvas text-text-muted hover:border-border-strong hover:bg-bg-subtle hover:text-text-main'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        isActive ? 'bg-text-inverse/16 text-primary-foreground' : 'bg-bg-surface text-text-main'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    <span>{getProjectModuleCopy(t, item.i18nKey, 'shortLabel')}</span>
                  </Link>
                );
              })}

              {plannedModules.map(item => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.value}
                    className="flex shrink-0 items-center gap-2 rounded-full border border-dashed border-border-subtle bg-bg-subtle px-3 py-2 text-xs font-medium text-text-muted whitespace-nowrap"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-canvas text-text-muted">
                      <Icon className="h-3 w-3" />
                    </div>
                    <span>{getProjectModuleCopy(t, item.i18nKey, 'shortLabel')}</span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.03125rem] text-text-muted/80">
                      {t('common.soon')}
                    </span>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="hidden h-full flex-col overflow-hidden lg:flex">
          <div className="flex items-center justify-between gap-2 p-3">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  isIcon
                  className="!size-8 rounded-full border border-border-strong bg-bg-canvas text-text-main hover:bg-bg-subtle"
                >
                  <Link href={buildProjectDetailRoute(projectId)}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{t('common.backToProjectOverview')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isIcon
                  className="!size-8 rounded-full border border-border-strong bg-bg-canvas text-text-main hover:bg-bg-subtle"
                  onClick={() => updateDesktopNavCollapsed(!isDesktopNavCollapsed)}
                  aria-label={
                    isDesktopNavCollapsed
                      ? t('workspaceLayout.expandNavigation')
                      : t('workspaceLayout.collapseNavigation')
                  }
                >
                  {isDesktopNavCollapsed ? (
                    <ChevronsRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>
                  {isDesktopNavCollapsed
                    ? t('workspaceLayout.expandNavigation')
                    : t('workspaceLayout.collapseNavigation')}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          <Separator className="bg-border-subtle" />

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <nav className="space-y-4">
              <div className="space-y-2">
                {readyModules.map(item => {
                  const Icon = item.icon;
                  const href = buildProjectWorkspaceRoute(projectId, item.value);
                  const isActive = isRouteActive(href);
                  const label = getProjectModuleCopy(t, item.i18nKey, 'label');
                  const navItem = (
                    <Link
                      key={item.value}
                      href={href}
                      className={cn(
                        'group flex rounded-full border transition-colors',
                        isDesktopNavCollapsed
                          ? 'items-center justify-center px-2 py-3 text-center'
                          : 'items-center gap-3 px-3 py-3',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-transparent text-text-muted hover:border-border-subtle hover:bg-bg-subtle hover:text-text-main'
                      )}
                      aria-label={label}
                    >
                      <div
                        className={cn(
                          'flex shrink-0 items-center justify-center rounded-xl',
                          isDesktopNavCollapsed ? 'h-8 w-8' : 'h-8 w-8',
                          isActive ? 'bg-text-inverse/16 text-primary-foreground' : 'bg-bg-surface text-text-main'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {!isDesktopNavCollapsed ? (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{label}</p>
                        </div>
                      ) : null}
                    </Link>
                  );

                  if (!isDesktopNavCollapsed) {
                    return navItem;
                  }

                  return (
                    <Tooltip key={item.value} delayDuration={300}>
                      <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {plannedModules.length > 0 ? (
                <>
                  <Separator className="bg-border-subtle" />
                  <div className="space-y-2 pt-1">
                    {plannedModules.map(item => {
                      const Icon = item.icon;
                      const label = getProjectModuleCopy(t, item.i18nKey, 'label');
                      const plannedItem = (
                        <div
                          key={item.value}
                          className={cn(
                            'rounded-full border border-dashed border-border-subtle bg-bg-subtle text-text-muted',
                            isDesktopNavCollapsed
                              ? 'flex items-center justify-center px-2 py-3 text-center'
                              : 'flex items-center gap-3 px-3 py-3'
                          )}
                          aria-label={`${label} · ${t('common.soon')}`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-canvas text-text-muted">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          {!isDesktopNavCollapsed ? (
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{label}</p>
                              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.03125rem] text-text-muted/80">
                                {t('common.soon')}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );

                      if (!isDesktopNavCollapsed) {
                        return plannedItem;
                      }

                      return (
                        <Tooltip key={item.value} delayDuration={300}>
                          <TooltipTrigger asChild>{plannedItem}</TooltipTrigger>
                          <TooltipContent side="right">
                            <p>{label}</p>
                            <p className="mt-1 text-[11px] text-text-muted">{t('common.soon')}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </nav>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-bg-soft lg:min-h-0 lg:overflow-hidden">{children}</div>
    </div>
  );
}
