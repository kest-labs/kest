import { ProjectWorkspacePage } from '@/components/features/project/project-workspace-page';

interface ProjectHistoriesPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    item?: string;
  }>;
}

// 项目 histories 工作区入口。
// 作用：挂载项目历史工作区，并通过 `?item=` 支持选中具体记录。
export default async function ProjectHistoriesPage({
  params,
  searchParams,
}: ProjectHistoriesPageProps) {
  const { projectId } = await params;
  const { item } = await searchParams;
  const selectedItemId = item?.trim() ? item : null;

  return (
    <ProjectWorkspacePage
      projectId={projectId}
      module="histories"
      selectedItemId={selectedItemId}
    />
  );
}
