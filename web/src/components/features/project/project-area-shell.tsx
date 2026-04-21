'use client';

import { ProjectTopbar } from '@/components/features/project/project-topbar';

export function ProjectAreaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-bg-canvas text-text-main lg:h-screen lg:overflow-hidden">
      <ProjectTopbar />
      <div className="flex-1 overflow-x-hidden overflow-y-auto lg:min-h-0">{children}</div>
    </div>
  );
}
