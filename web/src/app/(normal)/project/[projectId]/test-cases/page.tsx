import { notFound } from 'next/navigation';
import { TestCaseManagementPage } from '@/components/features/project/test-case-management-page';

interface ProjectTestCasesPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    fromSpec?: string;
    source?: string;
  }>;
}

// 项目 Test Cases 管理页面入口。
// 作用：读取动态项目 ID，并挂载受保护的 Test Cases 管理界面。
export default async function ProjectTestCasesPage({
  params,
  searchParams,
}: ProjectTestCasesPageProps) {
  const { projectId } = await params;
  const { fromSpec, source } = await searchParams;
  const numericProjectId = Number(projectId);
  const numericSpecId = Number(fromSpec);

  if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
    notFound();
  }

  return (
    <TestCaseManagementPage
      projectId={numericProjectId}
      autoOpenFromSpecSpecId={Number.isInteger(numericSpecId) && numericSpecId > 0 ? numericSpecId : null}
      flowSource={source === 'ai' ? 'ai' : null}
    />
  );
}
