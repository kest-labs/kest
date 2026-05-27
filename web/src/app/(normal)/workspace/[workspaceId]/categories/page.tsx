import { CategoryManagementPage } from '@/components/features/workspace/category-management-page';
import { WorkspaceWorkspacePage } from '@/components/features/workspace/workspace-workspace-page';

interface WorkspaceCategoriesPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams: Promise<{
    item?: string;
    mode?: string;
  }>;
}

// 工作区分类管理页面入口。
// 作用：默认挂载新的 categories 工作区，并通过 `?mode=manage` 兼容旧管理页。
export default async function WorkspaceCategoriesPage({
  params,
  searchParams,
}: WorkspaceCategoriesPageProps) {
  const { workspaceId } = await params;
  const { item, mode } = await searchParams;

  if (mode === 'manage') {
    return <CategoryManagementPage workspaceId={workspaceId} />;
  }

  const selectedItemId = item?.trim() ? item : null;

  return (
    <WorkspaceWorkspacePage
      workspaceId={workspaceId}
      module="categories"
      selectedItemId={selectedItemId}
    />
  );
}
