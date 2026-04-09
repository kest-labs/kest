import { notFound } from 'next/navigation';
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
  const numericProjectId = Number(projectId);

  if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
    notFound();
  }

  return <ProjectWorkspacePage projectId={numericProjectId} module="collections" />;
}
