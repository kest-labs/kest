import { redirect } from 'next/navigation';
import { buildProjectApiSpecsRoute } from '@/constants/routes';

interface WorkspaceDetailRoutePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// 项目工作区默认入口。
// 作用：把 `/workspace/:workspaceId` 直接收敛到 API Specs 工作区，避免再展示旧的 overview 内容区。
export default async function WorkspaceDetailRoutePage({ params }: WorkspaceDetailRoutePageProps) {
  const { workspaceId } = await params;
  redirect(buildProjectApiSpecsRoute(workspaceId));
}
