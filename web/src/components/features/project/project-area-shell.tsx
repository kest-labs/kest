'use client';

import { ProjectTopbar } from '@/components/features/project/project-topbar';

export function ProjectAreaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-bg-soft text-text-main lg:h-screen lg:overflow-hidden">
      <ProjectTopbar />
      <div className="flex-1 overflow-x-hidden overflow-y-auto bg-bg-soft lg:min-h-0">{children}</div>
    </div>
  );
}
