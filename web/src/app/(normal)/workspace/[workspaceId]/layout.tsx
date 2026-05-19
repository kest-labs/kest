import { ProjectWorkspaceLayout } from '@/components/features/project/project-workspace-layout';

interface WorkspaceWorkspaceRouteLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    workspaceId: string;
  }>;
}

// 单个项目的工作区布局。
// 作用：为 `/workspace/:workspaceId/*` 提供固定的一层项目模块侧栏，模块页只负责二层列表与内容区。
export default async function WorkspaceWorkspaceRouteLayout({
  children,
  params,
}: WorkspaceWorkspaceRouteLayoutProps) {
  const { workspaceId } = await params;
  return <ProjectWorkspaceLayout projectId={workspaceId}>{children}</ProjectWorkspaceLayout>;
}
