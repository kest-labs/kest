import { ProjectDetailPage } from '@/components/features/project/project-detail-page';

interface ProjectDetailRoutePageProps {
  params: Promise<{
    projectId: string;
  }>;
}

// 项目工作区入口。
// 作用：
// 1. 把 `/project/:projectId` 收敛为项目概览首页，承担进入各个工作区模块前的启动页
// 2. 避免把项目概览藏在 query 参数里，保持信息架构可预测
export default async function ProjectDetailRoutePage({
  params,
}: ProjectDetailRoutePageProps) {
  const { projectId } = await params;
  return <ProjectDetailPage projectId={projectId} />;
}
