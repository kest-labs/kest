import { WorkspaceLayout } from '@/components/features/workspace/workspace-layout';

interface WorkspaceRouteLayoutProps {
  children: React.ReactNode;
  params: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WorkspaceRouteLayout({
  children,
  params,
}: WorkspaceRouteLayoutProps) {
  const routeParams = await params;
  const workspaceId = Array.isArray(routeParams.workspaceId)
    ? routeParams.workspaceId[0] ?? ''
    : routeParams.workspaceId ?? '';

  return <WorkspaceLayout workspaceId={workspaceId}>{children}</WorkspaceLayout>;
}
