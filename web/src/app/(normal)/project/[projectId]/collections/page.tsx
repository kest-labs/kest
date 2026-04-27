import { ProjectWorkspacePage } from '@/components/features/project/project-workspace-page';

interface ProjectCollectionsPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

// 项目 collections 工作区入口。
// 作用：挂载 Postman 风格 collections 工作区，并由后端 collections/request 数据驱动。
export default async function ProjectCollectionsPage({
  params,
}: ProjectCollectionsPageProps) {
  const { projectId } = await params;
  return <ProjectWorkspacePage projectId={projectId} module="collections" />;
}
