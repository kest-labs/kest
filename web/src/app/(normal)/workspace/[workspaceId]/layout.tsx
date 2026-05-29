import { WorkspaceLayout } from '@/components/features/workspace/workspace-layout';

interface WorkspaceRouteLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    workspaceId: string;
  }>;
}

// 单个 workspace 的工作区布局。
// 作用：为 `/workspace/:workspaceId/*` 提供固定的一层工作区模块侧栏，模块页只负责二层列表与内容区。
export default async function WorkspaceRouteLayout({
  children,
  params,
}: WorkspaceRouteLayoutProps) {
  const { workspaceId } = await params;
  return <WorkspaceLayout workspaceId={workspaceId}>{children}</WorkspaceLayout>;
}
