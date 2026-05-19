import { ProjectWorkspacePage } from '@/components/features/project/project-workspace-page';

interface WorkspaceApiSpecsPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams: Promise<{
    item?: string;
    mode?: string;
    ai?: string;
  }>;
}

// 项目 API 规格页面入口。
// 作用：统一挂载工作区二层列表 + 内容区，并兼容旧的 `?mode=manage` 链接。
export default async function WorkspaceApiSpecsPage({
  params,
  searchParams,
}: WorkspaceApiSpecsPageProps) {
  const { workspaceId } = await params;
  const { item, ai } = await searchParams;
  const selectedItemId = item?.trim() ? item : null;

  return (
    <ProjectWorkspacePage
      projectId={workspaceId}
      module="api-specs"
      selectedItemId={selectedItemId}
      autoOpenAICreate={ai === 'create'}
    />
  );
}
