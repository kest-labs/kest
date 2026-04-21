'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  PROJECT_WORKSPACE_MODULES,
  buildProjectWorkspaceRoute,
} from '@/components/features/project/project-navigation';
import { buildProjectDetailRoute } from '@/constants/routes';
import { cn } from '@/utils';

export function ProjectWorkspaceLayout({
  projectId,
  children,
}: {
  projectId: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const readyModules = PROJECT_WORKSPACE_MODULES.filter((item) => item.status !== 'planned');
  const plannedModules = PROJECT_WORKSPACE_MODULES.filter((item) => item.status === 'planned');
  const isRouteActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}?`) || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">
      <aside className="w-full shrink-0 border-b border-border/60 bg-bg-surface/70 lg:w-[92px] lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 border-b border-border/60 p-3 lg:hidden">
          <Button
            asChild
            variant="ghost"
            size="sm"
            isIcon
            className="h-8 w-8 shrink-0 rounded-full text-text-muted"
          >
            <Link href={buildProjectDetailRoute(projectId)}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </Button>

          <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <nav className="flex min-w-max items-center gap-2 pr-1">
              {readyModules.map((item) => {
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
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border/70 bg-background/70 text-text-muted hover:border-primary/20 hover:text-text-main'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-text-muted'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    <span>{item.shortLabel}</span>
                  </Link>
                );
              })}

              {plannedModules.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.value}
                    className="flex shrink-0 items-center gap-2 rounded-full border border-dashed border-border/70 bg-muted/35 px-3 py-2 text-xs font-medium text-text-muted whitespace-nowrap"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-text-muted">
                      <Icon className="h-3 w-3" />
                    </div>
                    <span>{item.shortLabel}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted/80">
                      Soon
                    </span>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="hidden h-full flex-col overflow-hidden lg:flex">
          <div className="p-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              isIcon
              className="h-8 w-8 rounded-full text-text-muted"
            >
              <Link href={buildProjectDetailRoute(projectId)}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <Separator />

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <nav className="space-y-4">
              <div className="space-y-2">
                {readyModules.map((item) => {
                  const Icon = item.icon;
                  const href = buildProjectWorkspaceRoute(projectId, item.value);
                  const isActive = isRouteActive(href);

                  return (
                    <Link
                      key={item.value}
                      href={href}
                      className={cn(
                        'group flex flex-col items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 py-2.5 text-center transition-colors',
                        isActive
                          ? ' text-text-main '
                          : 'text-text-muted hover:bg-background/70 hover:text-black'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                          isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-text-muted'
                        )}
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium leading-4">{item.label}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {plannedModules.length > 0 ? (
                <>
                  <Separator />
                  <div className="space-y-2 pt-1">
                    {plannedModules.map((item) => {
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.value}
                          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 px-2 py-2.5 text-center text-text-muted"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-text-muted">
                            <Icon className="h-3 w-3" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium leading-4">{item.label}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-text-muted/80">
                              Soon
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </nav>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:min-h-0 lg:overflow-hidden">{children}</div>
    </div>
  );
}
