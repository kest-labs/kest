import { WorkspaceWorkspacePage } from '@/components/features/workspace/workspace-workspace-page';

interface WorkspaceKeysPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// 工作区 Keys 页面入口。
// 作用：在工作区一级侧栏中提供 CLI/Web 连接密钥生成页。
export default async function WorkspaceKeysPage({ params }: WorkspaceKeysPageProps) {
  const { workspaceId } = await params;
  return <WorkspaceWorkspacePage workspaceId={workspaceId} module="keys" />;
}
