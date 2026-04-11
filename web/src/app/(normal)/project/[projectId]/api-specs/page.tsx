import { notFound } from 'next/navigation';
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
  const numericProjectId = Number(projectId);

  if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
    notFound();
  }

  if (mode === 'manage') {
    return <ApiSpecManagementPage projectId={numericProjectId} />;
  }

  const selectedItemId = Number(item);

  return (
    <ProjectWorkspacePage
      projectId={numericProjectId}
      module="api-specs"
      selectedItemId={Number.isInteger(selectedItemId) && selectedItemId > 0 ? selectedItemId : null}
      autoOpenAICreate={ai === 'create'}
    />
  );
}
