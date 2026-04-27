import { ApiSpecManagementPage } from '@/components/features/project/api-spec-management-page';
import { ProjectWorkspacePage } from '@/components/features/project/project-workspace-page';

interface ProjectApiSpecsPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    item?: string;
    mode?: string;
    ai?: string;
  }>;
}

// 项目 API 规格管理页面入口。
// 作用：默认挂载新的工作区二层列表 + 内容区，并通过 `?mode=manage` 保留旧管理页。
export default async function ProjectApiSpecsPage({
  params,
  searchParams,
}: ProjectApiSpecsPageProps) {
  const { projectId } = await params;
  const { item, mode, ai } = await searchParams;
  const selectedItemId = item?.trim() ? item : null;

  if (mode === 'manage') {
    return (
      <ApiSpecManagementPage
        projectId={projectId}
        initialSpecId={selectedItemId}
      />
    );
  }

  return (
    <ProjectWorkspacePage
      projectId={projectId}
      module="api-specs"
      selectedItemId={selectedItemId}
      autoOpenAICreate={ai === 'create'}
    />
  );
}
