import { CategoryManagementPage } from '@/components/features/project/category-management-page';
import { ProjectWorkspacePage } from '@/components/features/project/project-workspace-page';

interface WorkspaceCategoriesPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams: Promise<{
    item?: string;
    mode?: string;
  }>;
}

// 项目分类管理页面入口。
// 作用：默认挂载新的 categories 工作区，并通过 `?mode=manage` 兼容旧管理页。
export default async function WorkspaceCategoriesPage({
  params,
  searchParams,
}: WorkspaceCategoriesPageProps) {
  const { workspaceId } = await params;
  const { item, mode } = await searchParams;

  if (mode === 'manage') {
    return <CategoryManagementPage projectId={workspaceId} />;
  }

  const selectedItemId = item?.trim() ? item : null;

  return (
    <ProjectWorkspacePage
      projectId={workspaceId}
      module="categories"
      selectedItemId={selectedItemId}
    />
  );
}
