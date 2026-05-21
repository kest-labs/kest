import { TestCaseManagementPage } from '@/components/features/project/test-case-management-page';

interface ProjectTestCasesPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams: Promise<{
    fromSpec?: string;
    source?: string;
  }>;
}

// 项目 Test Cases 管理页面入口。
// 作用：读取动态workspace ID，并挂载受保护的 Test Cases 管理界面。
export default async function ProjectTestCasesPage({
  params,
  searchParams,
}: ProjectTestCasesPageProps) {
  const { workspaceId } = await params;
  const { fromSpec, source } = await searchParams;
  const selectedSpecId = fromSpec?.trim() ? fromSpec : null;

  return (
    <TestCaseManagementPage
      projectId={workspaceId}
      autoOpenFromSpecSpecId={selectedSpecId}
      flowSource={source === 'ai' ? 'ai' : null}
    />
  );
}
