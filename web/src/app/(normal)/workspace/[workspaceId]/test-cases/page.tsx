import { TestCaseManagementPage } from '@/components/features/workspace/test-case-management-page';

interface WorkspaceTestCasesPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
  searchParams: Promise<{
    fromSpec?: string;
    source?: string;
  }>;
}

// 工作区 Test Cases 管理页面入口。
// 作用：读取动态工作区 ID，并挂载受保护的 Test Cases 管理界面。
export default async function WorkspaceTestCasesPage({
  params,
  searchParams,
}: WorkspaceTestCasesPageProps) {
  const { workspaceId } = await params;
  const { fromSpec, source } = await searchParams;
  const selectedSpecId = fromSpec?.trim() ? fromSpec : null;

  return (
    <TestCaseManagementPage
      workspaceId={workspaceId}
      autoOpenFromSpecSpecId={selectedSpecId}
      flowSource={source === 'ai' ? 'ai' : null}
    />
  );
}
