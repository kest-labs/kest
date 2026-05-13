import { redirect } from 'next/navigation';
import { buildProjectCategoriesRoute } from '@/constants/routes';

interface ProjectDetailRoutePageProps {
  params: Promise<{
    projectId: string;
  }>;
}

// 项目工作区默认入口。
// 作用：把 `/project/:projectId` 直接收敛到 Categories 工作区，避免再展示旧的 overview 内容区。
export default async function ProjectDetailRoutePage({ params }: ProjectDetailRoutePageProps) {
  const { projectId } = await params;
  redirect(buildProjectCategoriesRoute(projectId));
}
