import { WorkspaceWorkspaceLayout } from '@/components/features/workspace/workspace-workspace-layout';

interface WorkspaceWorkspaceRouteLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    workspaceId: string;
  }>;
}

// 单个工作区的工作区布局。
// 作用：为 `/workspace/:workspaceId/*` 提供固定的一层工作区模块侧栏，模块页只负责二层列表与内容区。
export default async function WorkspaceWorkspaceRouteLayout({
  children,
  params,
}: WorkspaceWorkspaceRouteLayoutProps) {
  const { workspaceId } = await params;
  return <WorkspaceWorkspaceLayout workspaceId={workspaceId}>{children}</WorkspaceWorkspaceLayout>;
}
