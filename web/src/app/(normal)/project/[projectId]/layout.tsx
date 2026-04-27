import { ProjectWorkspaceLayout } from '@/components/features/project/project-workspace-layout';

interface ProjectWorkspaceRouteLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    projectId: string;
  }>;
}

// 单个项目的工作区布局。
// 作用：为 `/project/:projectId/*` 提供固定的一层项目模块侧栏，模块页只负责二层列表与内容区。
export default async function ProjectWorkspaceRouteLayout({
  children,
  params,
}: ProjectWorkspaceRouteLayoutProps) {
  const { projectId } = await params;
  return <ProjectWorkspaceLayout projectId={projectId}>{children}</ProjectWorkspaceLayout>;
}
