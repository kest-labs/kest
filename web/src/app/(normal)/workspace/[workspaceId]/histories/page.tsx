import { ProjectWorkspacePage } from '@/components/features/project/project-workspace-page';

interface WorkspaceHistoriesPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams: Promise<{
    item?: string;
    entityType?: string;
  }>;
}

// 项目 histories 工作区入口。
// 作用：挂载项目历史工作区，并通过 `?item=` 支持选中具体记录。
export default async function WorkspaceHistoriesPage({
  params,
  searchParams,
}: WorkspaceHistoriesPageProps) {
  const { workspaceId } = await params;
  const { item, entityType } = await searchParams;
  const selectedItemId = item?.trim() ? item : null;
  const initialHistoryEntityType = entityType?.trim() ? entityType : null;

  return (
    <ProjectWorkspacePage
      projectId={workspaceId}
      module="histories"
      selectedItemId={selectedItemId}
      initialHistoryEntityType={initialHistoryEntityType}
      routeScope="workspace"
    />
  );
}
