import { WorkspaceWorkspacePage } from '@/components/features/workspace/workspace-workspace-page';

interface WorkspaceHistoriesPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams: Promise<{
    item?: string;
    entityType?: string;
  }>;
}

// 工作区 histories 工作区入口。
// 作用：挂载工作区历史工作区，并通过 `?item=` 支持选中具体记录。
export default async function WorkspaceHistoriesPage({
  params,
  searchParams,
}: WorkspaceHistoriesPageProps) {
  const { workspaceId } = await params;
  const { item, entityType } = await searchParams;
  const selectedItemId = item?.trim() ? item : null;
  const initialHistoryEntityType = entityType?.trim() ? entityType : null;

  return (
    <WorkspaceWorkspacePage
      workspaceId={workspaceId}
      module="histories"
      selectedItemId={selectedItemId}
      initialHistoryEntityType={initialHistoryEntityType}
    />
  );
}
