import { WorkspacePage } from '@/components/features/workspace/workspace-page';

interface WorkspaceEnvironmentsPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams: Promise<{
    item?: string;
    mode?: string;
  }>;
}

// 工作区环境管理页面入口。
// 作用：统一挂载 environments 工作区，兼容旧 `?mode=manage` 链接但不再分叉到独立管理页。
export default async function WorkspaceEnvironmentsPage({
  params,
  searchParams,
}: WorkspaceEnvironmentsPageProps) {
  const { workspaceId } = await params;
  const { item } = await searchParams;
  const selectedItemId = item?.trim() ? item : null;

  return (
    <WorkspacePage
      workspaceId={workspaceId}
      module="environments"
      selectedItemId={selectedItemId}
    />
  );
}
