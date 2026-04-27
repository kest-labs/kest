import { ProjectWorkspacePage } from '@/components/features/project/project-workspace-page';

interface ProjectEnvironmentsPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    item?: string;
    mode?: string;
  }>;
}

// 项目环境管理页面入口。
// 作用：统一挂载 environments 工作区，兼容旧 `?mode=manage` 链接但不再分叉到独立管理页。
export default async function ProjectEnvironmentsPage({
  params,
  searchParams,
}: ProjectEnvironmentsPageProps) {
  const { projectId } = await params;
  const { item } = await searchParams;
  const selectedItemId = item?.trim() ? item : null;

  return (
    <ProjectWorkspacePage
      projectId={projectId}
      module="environments"
      selectedItemId={selectedItemId}
    />
  );
}
