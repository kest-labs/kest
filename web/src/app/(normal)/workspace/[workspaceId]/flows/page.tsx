import { ProjectWorkspacePage } from '@/components/features/project/project-workspace-page';

interface WorkspaceFlowsPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams: Promise<{
    item?: string;
  }>;
}

// 项目 flows 工作区入口。
// 作用：挂载基于 React Flow 的测试流工作区，并通过 `?item=` 支持选中具体 flow。
export default async function WorkspaceFlowsPage({
  params,
  searchParams,
}: WorkspaceFlowsPageProps) {
  const { workspaceId } = await params;
  const { item } = await searchParams;
  const selectedItemId = item?.trim() ? item : null;

  return (
    <ProjectWorkspacePage
      projectId={workspaceId}
      module="flows"
      selectedItemId={selectedItemId}
    />
  );
}
